use crate::core::ports::ConfigurationStore;
use std::collections::BTreeMap;

pub struct LocalStorageConfigurationStore {
    prefix: String,
    storage: BTreeMap<String, String>,
}

impl LocalStorageConfigurationStore {
    pub fn new(prefix: Option<&str>) -> Self {
        Self {
            prefix: prefix.unwrap_or("").to_string(),
            storage: BTreeMap::new(),
        }
    }

    fn prefixed_key(&self, key: &str) -> String {
        format!("{}{}", self.prefix, key)
    }

    fn strip_prefix<'a>(&self, full_key: &'a str) -> Option<&'a str> {
        if self.prefix.is_empty() {
            Some(full_key)
        } else {
            full_key.strip_prefix(&self.prefix)
        }
    }
}

impl Default for LocalStorageConfigurationStore {
    fn default() -> Self {
        Self::new(None)
    }
}

impl ConfigurationStore for LocalStorageConfigurationStore {
    fn get(&self, key: &str) -> Result<Option<String>, String> {
        let p_key = self.prefixed_key(key);
        Ok(self.storage.get(&p_key).cloned())
    }

    fn set(&mut self, key: &str, value: &str) -> Result<(), String> {
        let p_key = self.prefixed_key(key);
        self.storage.insert(p_key, value.to_string());
        Ok(())
    }

    fn remove(&mut self, key: &str) -> Result<(), String> {
        let p_key = self.prefixed_key(key);
        self.storage.remove(&p_key);
        Ok(())
    }

    fn keys(&self) -> Result<Vec<String>, String> {
        let mut result = Vec::new();
        for k in self.storage.keys() {
            if let Some(stripped) = self.strip_prefix(k) {
                result.push(stripped.to_string());
            }
        }
        Ok(result)
    }

    fn clear(&mut self) -> Result<(), String> {
        self.storage.clear();
        Ok(())
    }
}
