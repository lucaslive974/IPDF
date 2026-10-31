use crate::core::domain::PlatformKind;
use crate::core::ports::PlatformEnvironment;
use std::path::PathBuf;

pub struct AndroidEnvironment {
    base_dir: PathBuf,
}

impl AndroidEnvironment {
    pub fn new(custom_root: Option<PathBuf>) -> Self {
        let base = custom_root.unwrap_or_else(|| PathBuf::from("/data/user/0/com.ipdf.reader"));
        Self { base_dir: base }
    }
}

impl Default for AndroidEnvironment {
    fn default() -> Self {
        Self::new(None)
    }
}

impl PlatformEnvironment for AndroidEnvironment {
    fn platform_kind(&self) -> PlatformKind {
        PlatformKind::Android
    }

    fn config_dir(&self) -> Result<PathBuf, String> {
        Ok(self.base_dir.join("shared_prefs"))
    }

    fn data_dir(&self) -> Result<PathBuf, String> {
        Ok(self.base_dir.join("files"))
    }

    fn cache_dir(&self) -> Result<PathBuf, String> {
        Ok(self.base_dir.join("cache"))
    }
}
