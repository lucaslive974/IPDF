use crate::adapters::cloud::google_oauth_adapter::{url_encode, GOOGLE_DRIVE_PROVIDER_ID};
use crate::adapters::cloud::http_transport::{
    HttpMethod, HttpRequest, HttpResponse, HttpTransport,
};
use crate::core::ports::{
    CloudAuthProvider, CloudObjectMeta, CloudStorageError, CloudStorageProvider,
};
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

const DRIVE_FILES_API: &str = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_API: &str = "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_FILE_FIELDS: &str = "id,name,size,version,md5Checksum";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DriveFileRecord {
    id: String,
    name: String,
    size: Option<String>,
    version: Option<String>,
    md5_checksum: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DriveListResponse {
    files: Vec<DriveFileRecord>,
}

/// Google Drive `appDataFolder` storage adapter implementing `CloudStorageProvider`.
///
/// All objects live strictly inside `spaces=appDataFolder` so end-users cannot accidentally
/// modify or delete sync state files in their visible Google Drive.
pub struct GoogleDriveAppDataAdapter {
    auth: Arc<dyn CloudAuthProvider>,
    http: Arc<dyn HttpTransport>,
    clock: Arc<dyn Fn() -> i64 + Send + Sync>,
    id_cache: Mutex<HashMap<String, String>>,
}

impl GoogleDriveAppDataAdapter {
    pub fn new(auth: Arc<dyn CloudAuthProvider>, http: Arc<dyn HttpTransport>) -> Self {
        let clock = Arc::new(|| {
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_millis() as i64)
                .unwrap_or(0)
        });
        Self::with_clock(auth, http, clock)
    }

    pub fn with_clock(
        auth: Arc<dyn CloudAuthProvider>,
        http: Arc<dyn HttpTransport>,
        clock: Arc<dyn Fn() -> i64 + Send + Sync>,
    ) -> Self {
        Self {
            auth,
            http,
            clock,
            id_cache: Mutex::new(HashMap::new()),
        }
    }

    fn bearer_header(&self) -> Result<(String, String), CloudStorageError> {
        let now_ms = (self.clock)();
        let token = self
            .auth
            .get_valid_access_token(now_ms)
            .map_err(CloudStorageError::Unauthorized)?;
        Ok((
            "Authorization".to_string(),
            format!("Bearer {}", token.access_token),
        ))
    }

    fn find_file_record(&self, path: &str) -> Result<Option<DriveFileRecord>, CloudStorageError> {
        let escaped = path.replace('\'', "\\'");
        let query = format!("name = '{escaped}' and trashed = false");
        let url = format!(
            "{DRIVE_FILES_API}?spaces=appDataFolder&fields=files({DRIVE_FILE_FIELDS})&pageSize=1&q={}",
            url_encode(&query)
        );
        let resp = self.send_authed(HttpMethod::Get, url, vec![], vec![])?;
        let parsed: DriveListResponse = parse_json(&resp.body)?;
        let record = parsed.files.into_iter().next();
        if let Some(rec) = &record {
            if let Ok(mut cache) = self.id_cache.lock() {
                cache.insert(path.to_string(), rec.id.clone());
            }
        }
        Ok(record)
    }

    fn create_multipart(
        &self,
        path: &str,
        bytes: &[u8],
        content_type: &str,
    ) -> Result<CloudObjectMeta, CloudStorageError> {
        let boundary = "scholarium_drive_boundary_7f3a";
        let metadata_json = serde_json::json!({
            "name": path,
            "parents": ["appDataFolder"],
        })
        .to_string();

        let mut body = Vec::with_capacity(metadata_json.len() + bytes.len() + 256);
        body.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
        body.extend_from_slice(b"Content-Type: application/json; charset=UTF-8\r\n\r\n");
        body.extend_from_slice(metadata_json.as_bytes());
        body.extend_from_slice(format!("\r\n--{boundary}\r\n").as_bytes());
        body.extend_from_slice(format!("Content-Type: {content_type}\r\n\r\n").as_bytes());
        body.extend_from_slice(bytes);
        body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());

        let url = format!("{DRIVE_UPLOAD_API}?uploadType=multipart&fields={DRIVE_FILE_FIELDS}");
        let resp = self.send_authed(
            HttpMethod::Post,
            url,
            vec![(
                "Content-Type".to_string(),
                format!("multipart/related; boundary={boundary}"),
            )],
            body,
        )?;
        let record: DriveFileRecord = parse_json(&resp.body)?;
        if let Ok(mut cache) = self.id_cache.lock() {
            cache.insert(path.to_string(), record.id.clone());
        }
        Ok(record_to_meta(&record))
    }

    fn patch_media(
        &self,
        file_id: &str,
        bytes: &[u8],
        content_type: &str,
    ) -> Result<CloudObjectMeta, CloudStorageError> {
        let url =
            format!("{DRIVE_UPLOAD_API}/{file_id}?uploadType=media&fields={DRIVE_FILE_FIELDS}");
        let resp = self.send_authed(
            HttpMethod::Patch,
            url,
            vec![("Content-Type".to_string(), content_type.to_string())],
            bytes.to_vec(),
        )?;
        let record: DriveFileRecord = parse_json(&resp.body)?;
        Ok(record_to_meta(&record))
    }

    fn send_authed(
        &self,
        method: HttpMethod,
        url: String,
        mut headers: Vec<(String, String)>,
        body: Vec<u8>,
    ) -> Result<HttpResponse, CloudStorageError> {
        headers.push(self.bearer_header()?);
        let resp = self
            .http
            .send(HttpRequest {
                method,
                url,
                headers,
                body,
            })
            .map_err(CloudStorageError::Network)?;
        check_http_status(&resp)?;
        Ok(resp)
    }
}

impl CloudStorageProvider for GoogleDriveAppDataAdapter {
    fn provider_id(&self) -> &str {
        GOOGLE_DRIVE_PROVIDER_ID
    }

    fn head(&self, path: &str) -> Result<Option<CloudObjectMeta>, CloudStorageError> {
        Ok(self.find_file_record(path)?.map(|r| record_to_meta(&r)))
    }

    fn read(&self, path: &str) -> Result<Option<(Vec<u8>, CloudObjectMeta)>, CloudStorageError> {
        let Some(record) = self.find_file_record(path)? else {
            return Ok(None);
        };
        let url = format!("{DRIVE_FILES_API}/{}?alt=media", record.id);
        let resp = self.send_authed(HttpMethod::Get, url, vec![], vec![])?;
        Ok(Some((resp.body, record_to_meta(&record))))
    }

    fn write_unconditional(
        &self,
        path: &str,
        bytes: &[u8],
        content_type: &str,
    ) -> Result<CloudObjectMeta, CloudStorageError> {
        let existing_id = self.id_cache.lock().ok().and_then(|c| c.get(path).cloned());
        if let Some(id) = existing_id {
            match self.patch_media(&id, bytes, content_type) {
                Ok(meta) => return Ok(meta),
                Err(CloudStorageError::NotFound(_)) => {
                    if let Ok(mut c) = self.id_cache.lock() {
                        c.remove(path);
                    }
                }
                Err(err) => return Err(err),
            }
        }

        match self.find_file_record(path)? {
            Some(record) => self.patch_media(&record.id, bytes, content_type),
            None => self.create_multipart(path, bytes, content_type),
        }
    }

    fn write_if_absent(
        &self,
        path: &str,
        bytes: &[u8],
        content_type: &str,
    ) -> Result<CloudObjectMeta, CloudStorageError> {
        if self.find_file_record(path)?.is_some() {
            return Err(CloudStorageError::PreconditionFailed(format!(
                "{path} already exists in appDataFolder"
            )));
        }
        self.create_multipart(path, bytes, content_type)
    }

    fn write_if_match(
        &self,
        path: &str,
        bytes: &[u8],
        content_type: &str,
        expected_etag: &str,
    ) -> Result<CloudObjectMeta, CloudStorageError> {
        let Some(record) = self.find_file_record(path)? else {
            return Err(CloudStorageError::PreconditionFailed(format!(
                "{path} not found for If-Match"
            )));
        };
        let current_meta = record_to_meta(&record);
        if current_meta.etag != expected_etag {
            return Err(CloudStorageError::PreconditionFailed(format!(
                "ETag mismatch for {path}: expected {expected_etag}, got {}",
                current_meta.etag
            )));
        }
        self.patch_media(&record.id, bytes, content_type)
    }

    fn delete_if_match(&self, path: &str, expected_etag: &str) -> Result<(), CloudStorageError> {
        let Some(record) = self.find_file_record(path)? else {
            return Err(CloudStorageError::PreconditionFailed(format!(
                "{path} not found for delete_if_match"
            )));
        };
        let current_meta = record_to_meta(&record);
        if current_meta.etag != expected_etag {
            return Err(CloudStorageError::PreconditionFailed(format!(
                "ETag mismatch deleting {path}"
            )));
        }
        let url = format!("{DRIVE_FILES_API}/{}", record.id);
        self.send_authed(HttpMethod::Delete, url, vec![], vec![])?;
        if let Ok(mut cache) = self.id_cache.lock() {
            cache.remove(path);
        }
        Ok(())
    }

    fn delete_unconditional(&self, path: &str) -> Result<(), CloudStorageError> {
        if let Some(record) = self.find_file_record(path)? {
            let url = format!("{DRIVE_FILES_API}/{}", record.id);
            self.send_authed(HttpMethod::Delete, url, vec![], vec![])?;
        }
        if let Ok(mut cache) = self.id_cache.lock() {
            cache.remove(path);
        }
        Ok(())
    }

    fn list_prefix(&self, prefix: &str) -> Result<Vec<CloudObjectMeta>, CloudStorageError> {
        let query = "trashed = false";
        let url = format!(
            "{DRIVE_FILES_API}?spaces=appDataFolder&fields=files({DRIVE_FILE_FIELDS})&pageSize=1000&q={}",
            url_encode(query)
        );
        let resp = self.send_authed(HttpMethod::Get, url, vec![], vec![])?;
        let parsed: DriveListResponse = parse_json(&resp.body)?;
        Ok(parsed
            .files
            .iter()
            .filter(|f| f.name.starts_with(prefix))
            .map(record_to_meta)
            .collect())
    }
}

fn record_to_meta(record: &DriveFileRecord) -> CloudObjectMeta {
    let etag = record
        .version
        .clone()
        .or_else(|| record.md5_checksum.clone())
        .unwrap_or_else(|| record.id.clone());
    let size_bytes = record
        .size
        .as_deref()
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(0);
    CloudObjectMeta {
        path: record.name.clone(),
        etag,
        size_bytes,
        modified_at_ms: None,
    }
}

fn parse_json<T: serde::de::DeserializeOwned>(body: &[u8]) -> Result<T, CloudStorageError> {
    serde_json::from_slice(body)
        .map_err(|e| CloudStorageError::Other(format!("Invalid Google Drive JSON response: {e}")))
}

fn check_http_status(resp: &HttpResponse) -> Result<(), CloudStorageError> {
    if (200..300).contains(&resp.status) {
        return Ok(());
    }
    let body = String::from_utf8_lossy(&resp.body).to_string();
    match resp.status {
        401 | 403 => Err(CloudStorageError::Unauthorized(body)),
        404 => Err(CloudStorageError::NotFound(body)),
        412 => Err(CloudStorageError::PreconditionFailed(body)),
        _ => Err(CloudStorageError::Other(format!(
            "HTTP {}: {body}",
            resp.status
        ))),
    }
}
