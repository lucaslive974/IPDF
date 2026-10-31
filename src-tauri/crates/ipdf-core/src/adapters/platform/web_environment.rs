use crate::core::domain::PlatformKind;
use crate::core::ports::PlatformEnvironment;
use std::path::PathBuf;

pub struct WebEnvironment {
    virtual_root: PathBuf,
}

impl WebEnvironment {
    pub fn new(virtual_root: Option<PathBuf>) -> Self {
        Self {
            virtual_root: virtual_root.unwrap_or_else(|| PathBuf::from("/local-storage/ipdf")),
        }
    }
}

impl Default for WebEnvironment {
    fn default() -> Self {
        Self::new(None)
    }
}

impl PlatformEnvironment for WebEnvironment {
    fn platform_kind(&self) -> PlatformKind {
        PlatformKind::Web
    }

    fn config_dir(&self) -> Result<PathBuf, String> {
        Ok(self.virtual_root.join("config"))
    }

    fn data_dir(&self) -> Result<PathBuf, String> {
        Ok(self.virtual_root.join("data"))
    }

    fn cache_dir(&self) -> Result<PathBuf, String> {
        Ok(self.virtual_root.join("cache"))
    }
}
