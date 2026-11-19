use crate::core::ports::{CloudCredentialStore, PlatformEnvironment};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

fn err_string<E: std::fmt::Display>(err: E) -> String {
    err.to_string()
}

/// File-backed `CloudCredentialStore` stored strictly outside the primary SQLite database
/// and outside exported backup directories so OAuth/API tokens never leak in `.zip` backups.
pub struct FileCloudCredentialStore {
    file_path: PathBuf,
    lock: Mutex<()>,
}

impl FileCloudCredentialStore {
    pub const CREDENTIALS_FILENAME: &'static str = "cloud_credentials.json";

    pub fn new<P: AsRef<Path>>(file_path: P) -> Self {
        Self {
            file_path: file_path.as_ref().to_path_buf(),
            lock: Mutex::new(()),
        }
    }

    pub fn for_platform<E: PlatformEnvironment + ?Sized>(env: &E) -> Result<Self, String> {
        let dir = env.config_dir()?;
        Ok(Self::new(dir.join(Self::CREDENTIALS_FILENAME)))
    }

    pub fn file_path(&self) -> &Path {
        &self.file_path
    }

    fn read_map(&self) -> Result<BTreeMap<String, String>, String> {
        if !self.file_path.exists() {
            return Ok(BTreeMap::new());
        }
        let raw = fs::read_to_string(&self.file_path).map_err(err_string)?;
        if raw.trim().is_empty() {
            return Ok(BTreeMap::new());
        }
        serde_json::from_str(&raw).map_err(|e| format!("Invalid credentials store JSON: {e}"))
    }

    fn write_map(&self, map: &BTreeMap<String, String>) -> Result<(), String> {
        if let Some(parent) = self.file_path.parent() {
            fs::create_dir_all(parent).map_err(err_string)?;
        }
        let raw = serde_json::to_string_pretty(map).map_err(err_string)?;
        fs::write(&self.file_path, raw).map_err(err_string)?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = fs::set_permissions(&self.file_path, fs::Permissions::from_mode(0o600));
        }
        Ok(())
    }
}

impl CloudCredentialStore for FileCloudCredentialStore {
    fn get_secret(&self, provider_id: &str) -> Result<Option<String>, String> {
        let _guard = self.lock.lock().map_err(err_string)?;
        let map = self.read_map()?;
        Ok(map.get(provider_id).cloned())
    }

    fn set_secret(&self, provider_id: &str, secret_json: &str) -> Result<(), String> {
        let _guard = self.lock.lock().map_err(err_string)?;
        let mut map = self.read_map()?;
        map.insert(provider_id.to_string(), secret_json.to_string());
        self.write_map(&map)
    }

    fn delete_secret(&self, provider_id: &str) -> Result<(), String> {
        let _guard = self.lock.lock().map_err(err_string)?;
        let mut map = self.read_map()?;
        if map.remove(provider_id).is_some() {
            self.write_map(&map)?;
        }
        Ok(())
    }
}
