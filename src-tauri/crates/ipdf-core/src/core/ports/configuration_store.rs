pub trait ConfigurationStore {
    fn get(&self, key: &str) -> Result<Option<String>, String>;
    fn set(&mut self, key: &str, value: &str) -> Result<(), String>;
    fn remove(&mut self, key: &str) -> Result<(), String>;
    fn keys(&self) -> Result<Vec<String>, String>;
    fn clear(&mut self) -> Result<(), String>;
}
