use scholarium_core::adapters::cloud::{
    FileCloudCredentialStore, GoogleDriveAppDataAdapter, GoogleOAuthConfig, GoogleOAuthPkceAdapter,
    HttpMethod, HttpRequest, HttpResponse, HttpTransport, PkceChallenge,
    GOOGLE_DRIVE_APPDATA_SCOPE, GOOGLE_DRIVE_PROVIDER_ID,
};
use scholarium_core::adapters::platform::LinuxEnvironment;
use scholarium_core::core::domain::{AppStoragePaths, PlatformKind};
use scholarium_core::core::ports::{
    CloudAuthKind, CloudAuthProvider, CloudCredentialStore, CloudStorageError, CloudStorageProvider,
};
use std::collections::BTreeMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

struct FakeDriveFile {
    id: String,
    name: String,
    version: usize,
    body: Vec<u8>,
}

struct FakeGoogleTransport {
    files: Mutex<BTreeMap<String, FakeDriveFile>>,
    id_seq: AtomicUsize,
    token_refreshes: AtomicUsize,
    revokes: AtomicUsize,
    forced_status: Mutex<Option<u16>>,
}

impl FakeGoogleTransport {
    fn new() -> Self {
        Self {
            files: Mutex::new(BTreeMap::new()),
            id_seq: AtomicUsize::new(1),
            token_refreshes: AtomicUsize::new(0),
            revokes: AtomicUsize::new(0),
            forced_status: Mutex::new(None),
        }
    }

    fn force_next_status(&self, status: u16) {
        *self.forced_status.lock().unwrap() = Some(status);
    }
}

impl HttpTransport for FakeGoogleTransport {
    fn send(&self, request: HttpRequest) -> Result<HttpResponse, String> {
        if let Some(status) = self.forced_status.lock().unwrap().take() {
            return Ok(HttpResponse {
                status,
                headers: vec![],
                body: b"forced error".to_vec(),
            });
        }

        // OAuth2 token endpoint
        if request
            .url
            .starts_with("https://oauth2.googleapis.com/token")
        {
            let body_str = String::from_utf8_lossy(&request.body);
            if body_str.contains("grant_type=authorization_code") {
                let json = serde_json::json!({
                    "access_token": "ya29.initial-token",
                    "expires_in": 3600,
                    "refresh_token": "1//refresh-token-abc"
                });
                return Ok(HttpResponse {
                    status: 200,
                    headers: vec![("Content-Type".to_string(), "application/json".to_string())],
                    body: json.to_string().into_bytes(),
                });
            }
            if body_str.contains("grant_type=refresh_token") {
                let count = self.token_refreshes.fetch_add(1, Ordering::SeqCst) + 1;
                let json = serde_json::json!({
                    "access_token": format!("ya29.refreshed-{count}"),
                    "expires_in": 3600
                });
                return Ok(HttpResponse {
                    status: 200,
                    headers: vec![("Content-Type".to_string(), "application/json".to_string())],
                    body: json.to_string().into_bytes(),
                });
            }
            return Ok(HttpResponse {
                status: 400,
                headers: vec![],
                body: b"unsupported grant".to_vec(),
            });
        }

        // OAuth2 revoke endpoint
        if request
            .url
            .starts_with("https://oauth2.googleapis.com/revoke")
        {
            self.revokes.fetch_add(1, Ordering::SeqCst);
            return Ok(HttpResponse {
                status: 200,
                headers: vec![],
                body: vec![],
            });
        }

        // Drive v3 API: multipart create
        if request.method == HttpMethod::Post
            && request.url.contains("/upload/drive/v3/files")
            && request.url.contains("uploadType=multipart")
        {
            let raw = String::from_utf8_lossy(&request.body);
            let parts: Vec<&str> = raw.split("--scholarium_drive_boundary_7f3a").collect();
            let meta_section = parts[1].split("\r\n\r\n").nth(1).unwrap().trim();
            let meta_val: serde_json::Value = serde_json::from_str(meta_section).unwrap();
            let name = meta_val["name"].as_str().unwrap().to_string();
            assert_eq!(meta_val["parents"][0], "appDataFolder");

            let content_raw = parts[2].split("\r\n\r\n").nth(1).unwrap();
            let content = content_raw.strip_suffix("\r\n").unwrap_or(content_raw);
            let id = format!("file-{}", self.id_seq.fetch_add(1, Ordering::SeqCst));
            let record = FakeDriveFile {
                id: id.clone(),
                name: name.clone(),
                version: 1,
                body: content.as_bytes().to_vec(),
            };
            let json = serde_json::json!({
                "id": record.id,
                "name": record.name,
                "size": record.body.len().to_string(),
                "version": record.version.to_string(),
            });
            self.files.lock().unwrap().insert(id, record);
            return Ok(HttpResponse {
                status: 200,
                headers: vec![],
                body: json.to_string().into_bytes(),
            });
        }

        // Drive v3 API: media patch
        if request.method == HttpMethod::Patch && request.url.contains("/upload/drive/v3/files/") {
            let file_id = request
                .url
                .split("/upload/drive/v3/files/")
                .nth(1)
                .unwrap()
                .split('?')
                .next()
                .unwrap();
            let mut guard = self.files.lock().unwrap();
            let Some(file) = guard.get_mut(file_id) else {
                return Ok(HttpResponse {
                    status: 404,
                    headers: vec![],
                    body: b"not found".to_vec(),
                });
            };
            file.version += 1;
            file.body = request.body;
            let json = serde_json::json!({
                "id": file.id,
                "name": file.name,
                "size": file.body.len().to_string(),
                "version": file.version.to_string(),
            });
            return Ok(HttpResponse {
                status: 200,
                headers: vec![],
                body: json.to_string().into_bytes(),
            });
        }

        // Drive v3 API: download media
        if request.method == HttpMethod::Get && request.url.contains("alt=media") {
            let file_id = request
                .url
                .split("/drive/v3/files/")
                .nth(1)
                .unwrap()
                .split('?')
                .next()
                .unwrap();
            let guard = self.files.lock().unwrap();
            let Some(file) = guard.get(file_id) else {
                return Ok(HttpResponse {
                    status: 404,
                    headers: vec![],
                    body: b"not found".to_vec(),
                });
            };
            return Ok(HttpResponse {
                status: 200,
                headers: vec![],
                body: file.body.clone(),
            });
        }

        // Drive v3 API: list / query in appDataFolder
        if request.method == HttpMethod::Get && request.url.contains("spaces=appDataFolder") {
            let guard = self.files.lock().unwrap();
            let matched: Vec<serde_json::Value> = guard
                .values()
                .filter(|f| {
                    if let Some(q_part) = request.url.split("&q=").nth(1) {
                        if q_part.contains("name%20%3D%20%27") {
                            let encoded_name = q_part
                                .split("name%20%3D%20%27")
                                .nth(1)
                                .unwrap()
                                .split("%27")
                                .next()
                                .unwrap();
                            let decoded = encoded_name.replace("%2F", "/");
                            return f.name == decoded;
                        }
                    }
                    true
                })
                .map(|f| {
                    serde_json::json!({
                        "id": f.id,
                        "name": f.name,
                        "size": f.body.len().to_string(),
                        "version": f.version.to_string(),
                    })
                })
                .collect();
            let json = serde_json::json!({ "files": matched });
            return Ok(HttpResponse {
                status: 200,
                headers: vec![],
                body: json.to_string().into_bytes(),
            });
        }

        // Drive v3 API: delete
        if request.method == HttpMethod::Delete && request.url.contains("/drive/v3/files/") {
            let file_id = request.url.split("/drive/v3/files/").nth(1).unwrap();
            self.files.lock().unwrap().remove(file_id);
            return Ok(HttpResponse {
                status: 204,
                headers: vec![],
                body: vec![],
            });
        }

        Ok(HttpResponse {
            status: 500,
            headers: vec![],
            body: format!(
                "Unhandled fake request: {:?} {}",
                request.method, request.url
            )
            .into_bytes(),
        })
    }
}

fn temp_cred_path(name: &str) -> std::path::PathBuf {
    std::env::temp_dir().join(format!(
        "scholarium_creds_{}_{}_{}.json",
        name,
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ))
}

#[test]
fn file_credential_store_persists_and_deletes_secrets_isolated_from_db() {
    let path = temp_cred_path("store");
    let store = FileCloudCredentialStore::new(&path);
    assert_eq!(store.file_path(), path.as_path());
    assert_eq!(store.get_secret("google_drive").unwrap(), None);

    store
        .set_secret("google_drive", r#"{"refreshToken":"secret"}"#)
        .unwrap();
    assert_eq!(
        store.get_secret("google_drive").unwrap().as_deref(),
        Some(r#"{"refreshToken":"secret"}"#)
    );

    store.delete_secret("google_drive").unwrap();
    assert_eq!(store.get_secret("google_drive").unwrap(), None);

    // Platform constructor resolves inside config_dir.
    let env = LinuxEnvironment::new(None);
    let plat_store = FileCloudCredentialStore::for_platform(&env).unwrap();
    assert!(plat_store
        .file_path()
        .ends_with(AppStoragePaths::CLOUD_CREDENTIALS_FILENAME));

    let _ = std::fs::remove_file(&path);
}

#[test]
fn google_oauth_pkce_adapter_handles_auth_url_exchange_refresh_and_sign_out() {
    let path = temp_cred_path("oauth");
    let creds = Arc::new(FileCloudCredentialStore::new(&path));
    let transport = Arc::new(FakeGoogleTransport::new());

    let cfg = GoogleOAuthConfig::resolve(
        Some("client-id-123".to_string()),
        Some("client-secret-opt".to_string()),
        "http://127.0.0.1:42813/callback",
    )
    .unwrap();
    let auth = GoogleOAuthPkceAdapter::new(cfg, creds, transport.clone());

    let desc = auth.descriptor();
    assert_eq!(desc.id, GOOGLE_DRIVE_PROVIDER_ID);
    assert_eq!(desc.auth_kind, CloudAuthKind::OAuthPkce);
    assert!(desc.supports_platform(PlatformKind::Linux));
    assert!(desc.supports_platform(PlatformKind::Android));

    // Exercise PKCE base64url across remainder lengths (1, 2, 0).
    let pkce_1 = PkceChallenge::from_entropy(b"a", b"s1");
    let pkce_2 = PkceChallenge::from_entropy(b"ab", b"s2");
    let pkce_3 = PkceChallenge::from_entropy(b"abc12345678901234567890123456789", b"state-xyz");
    assert!(!pkce_1.code_verifier.is_empty());
    assert!(!pkce_2.code_verifier.is_empty());

    let auth_url = auth.build_authorization_url(&pkce_3);
    assert!(auth_url.contains("client_id=client-id-123"));
    assert!(auth_url.contains("code_challenge_method=S256"));
    assert!(auth_url.contains("drive.appdata"));
    assert_eq!(
        GOOGLE_DRIVE_APPDATA_SCOPE,
        "https://www.googleapis.com/auth/drive.appdata"
    );

    assert!(!auth.session().unwrap().connected);
    assert!(auth.get_valid_access_token(1_000).is_err());

    let session = auth
        .exchange_code(
            "auth-code-999",
            &pkce_3.code_verifier,
            Some("reader@example.com".to_string()),
            10_000,
        )
        .unwrap();
    assert!(session.connected);
    assert_eq!(session.account_label.as_deref(), Some("reader@example.com"));

    // Valid token served from cache without refresh.
    let token_cached = auth.get_valid_access_token(20_000).unwrap();
    assert_eq!(token_cached.access_token, "ya29.initial-token");
    assert_eq!(transport.token_refreshes.load(Ordering::SeqCst), 0);

    // Expired token triggers automatic refresh.
    let token_refreshed = auth.get_valid_access_token(4_000_000).unwrap();
    assert_eq!(token_refreshed.access_token, "ya29.refreshed-1");
    assert_eq!(transport.token_refreshes.load(Ordering::SeqCst), 1);

    // Sign out revokes and clears stored credentials.
    auth.sign_out().unwrap();
    assert_eq!(transport.revokes.load(Ordering::SeqCst), 1);
    assert!(!auth.session().unwrap().connected);

    let _ = std::fs::remove_file(&path);
}

#[test]
fn google_drive_appdata_adapter_supports_optimistic_concurrency_and_prefix_listing() {
    let path = temp_cred_path("drive");
    let creds = Arc::new(FileCloudCredentialStore::new(&path));
    let transport = Arc::new(FakeGoogleTransport::new());
    let cfg = GoogleOAuthConfig::resolve(
        Some("client-id-drive".to_string()),
        None,
        "http://127.0.0.1:42813/callback",
    )
    .unwrap();
    let auth = Arc::new(GoogleOAuthPkceAdapter::new(cfg, creds, transport.clone()));
    auth.exchange_code("code", "verifier", None, 1_000).unwrap();

    let drive = GoogleDriveAppDataAdapter::with_clock(auth, transport.clone(), Arc::new(|| 5_000));
    assert_eq!(drive.provider_id(), GOOGLE_DRIVE_PROVIDER_ID);
    assert!(drive.head("sync-manifest.json").unwrap().is_none());
    assert!(drive.read("sync-manifest.json").unwrap().is_none());

    // write_if_absent creates file; second write_if_absent fails with PreconditionFailed.
    let meta1 = drive
        .write_if_absent("sync-manifest.json", br#"{"rev":1}"#, "application/json")
        .unwrap();
    assert_eq!(meta1.etag, "1");
    assert!(matches!(
        drive.write_if_absent("sync-manifest.json", br#"{"rev":2}"#, "application/json"),
        Err(CloudStorageError::PreconditionFailed(_))
    ));

    // read returns bytes + etag.
    let (bytes, read_meta) = drive.read("sync-manifest.json").unwrap().unwrap();
    assert_eq!(bytes, br#"{"rev":1}"#);
    assert_eq!(read_meta.etag, "1");

    // write_if_match with wrong etag -> PreconditionFailed; with right etag -> updates to v2.
    assert!(matches!(
        drive.write_if_match(
            "sync-manifest.json",
            br#"{"rev":2}"#,
            "application/json",
            "wrong-etag"
        ),
        Err(CloudStorageError::PreconditionFailed(_))
    ));
    let meta2 = drive
        .write_if_match(
            "sync-manifest.json",
            br#"{"rev":2}"#,
            "application/json",
            "1",
        )
        .unwrap();
    assert_eq!(meta2.etag, "2");

    // write_unconditional creates and patches state files; list_prefix filters by prefix.
    drive
        .write_unconditional("state/book1.json", br#"{"a":1}"#, "application/json")
        .unwrap();
    drive
        .write_unconditional("state/book1.json", br#"{"a":2}"#, "application/json")
        .unwrap();
    let listed = drive.list_prefix("state/").unwrap();
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].path, "state/book1.json");

    // HTTP status error mapping (401 -> Unauthorized, 500 -> Other).
    transport.force_next_status(401);
    assert!(matches!(
        drive.head("sync-manifest.json"),
        Err(CloudStorageError::Unauthorized(_))
    ));
    transport.force_next_status(500);
    assert!(matches!(
        drive.head("sync-manifest.json"),
        Err(CloudStorageError::Other(_))
    ));

    // delete_if_match & delete_unconditional.
    assert!(matches!(
        drive.delete_if_match("sync-manifest.json", "stale"),
        Err(CloudStorageError::PreconditionFailed(_))
    ));
    drive.delete_if_match("sync-manifest.json", "2").unwrap();
    assert!(drive.head("sync-manifest.json").unwrap().is_none());
    drive.delete_unconditional("state/book1.json").unwrap();
    assert!(drive.head("state/book1.json").unwrap().is_none());

    let _ = std::fs::remove_file(&path);
}

#[test]
fn ureq_http_transport_executes_all_methods_against_local_loopback_server() {
    use scholarium_core::adapters::cloud::UreqHttpTransport;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::thread;

    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();

    let server = thread::spawn(move || {
        for _ in 0..4 {
            let (mut stream, _) = listener.accept().unwrap();
            let mut buf = [0u8; 2048];
            let _ = stream.read(&mut buf);
            let response = concat!(
                "HTTP/1.1 200 OK\r\n",
                "X-Test-Header: scholarium\r\n",
                "Content-Length: 2\r\n",
                "Connection: close\r\n\r\n",
                "ok"
            );
            let _ = stream.write_all(response.as_bytes());
        }
    });

    let transport = UreqHttpTransport::default();
    let base_url = format!("http://{addr}/test");

    for method in [
        HttpMethod::Get,
        HttpMethod::Post,
        HttpMethod::Patch,
        HttpMethod::Delete,
    ] {
        let resp = transport
            .send(HttpRequest {
                method,
                url: base_url.clone(),
                headers: vec![("X-Client".to_string(), "test".to_string())],
                body: if matches!(method, HttpMethod::Post | HttpMethod::Patch) {
                    b"payload".to_vec()
                } else {
                    vec![]
                },
            })
            .unwrap();
        assert_eq!(resp.status, 200);
        assert_eq!(resp.header("x-test-header"), Some("scholarium"));
        assert_eq!(resp.body, b"ok");
    }

    server.join().unwrap();
}
