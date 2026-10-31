use crate::core::ports::{ConfigurationStore, PlatformEnvironment};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

pub struct FileConfigurationStore {
    file_path: PathBuf,
    cache: BTreeMap<String, String>,
}

impl FileConfigurationStore {
    pub fn new<P: AsRef<Path>>(file_path: P) -> Result<Self, String> {
        let path = file_path.as_ref().to_path_buf();
        let cache = if path.exists() {
            let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            BTreeMap::new()
        };

        Ok(Self {
            file_path: path,
            cache,
        })
    }

    pub fn for_platform<E: PlatformEnvironment + ?Sized>(
        env: &E,
        file_name: &str,
    ) -> Result<Self, String> {
        let path = env.resolve_config_file_path(file_name)?;
        Self::new(path)
    }

    fn persist(&self) -> Result<(), String> {
        if let Some(parent) = self.file_path.parent() {
            if !parent.as_os_str().is_empty() && !parent.exists() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
        }
        let json = serde_json::to_string_pretty(&self.cache).map_err(|e| e.to_string())?;
        fs::write(&self.file_path, json).map_err(|e| e.to_string())
    }
}

impl ConfigurationStore for FileConfigurationStore {
    fn get(&self, key: &str) -> Result<Option<String>, String> {
        Ok(self.cache.get(key).cloned())
    }

    fn set(&mut self, key: &str, value: &str) -> Result<(), String> {
        self.cache.insert(key.to_string(), value.to_string());
        self.persist()
    }

    fn remove(&mut self, key: &str) -> Result<(), String> {
        self.cache.remove(key);
        self.persist()
    }

    fn keys(&self) -> Result<Vec<String>, String> {
        Ok(self.cache.keys().cloned().collect())
    }

    fn clear(&mut self) -> Result<(), String> {
        self.cache.clear();
        self.persist()
    }
}
