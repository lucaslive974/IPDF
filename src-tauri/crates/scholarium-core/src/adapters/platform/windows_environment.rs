use crate::core::domain::PlatformKind;
use crate::core::ports::PlatformEnvironment;
use std::path::PathBuf;

pub struct WindowsEnvironment {
    base_dir: PathBuf,
}

impl WindowsEnvironment {
    pub fn new(custom_root: Option<PathBuf>) -> Self {
        let base = custom_root.unwrap_or_else(|| PathBuf::from("C:\\Users\\Default\\AppData"));
        Self { base_dir: base }
    }
}

impl Default for WindowsEnvironment {
    fn default() -> Self {
        Self::new(None)
    }
}

impl PlatformEnvironment for WindowsEnvironment {
    fn platform_kind(&self) -> PlatformKind {
        PlatformKind::Windows
    }

    fn config_dir(&self) -> Result<PathBuf, String> {
        Ok(self.base_dir.join("Roaming").join("Scholarium"))
    }

    fn data_dir(&self) -> Result<PathBuf, String> {
        Ok(self.base_dir.join("Local").join("Scholarium").join("Data"))
    }

    fn cache_dir(&self) -> Result<PathBuf, String> {
        Ok(self.base_dir.join("Local").join("Scholarium").join("Cache"))
    }
}
