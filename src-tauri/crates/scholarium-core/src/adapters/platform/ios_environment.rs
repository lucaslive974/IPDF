use crate::core::domain::PlatformKind;
use crate::core::ports::PlatformEnvironment;
use std::path::PathBuf;

pub struct IosEnvironment {
    base_dir: PathBuf,
}

impl IosEnvironment {
    pub fn new(custom_root: Option<PathBuf>) -> Self {
        let base = custom_root
            .unwrap_or_else(|| PathBuf::from("/var/mobile/Containers/Data/Application/Scholarium"));
        Self { base_dir: base }
    }
}

impl Default for IosEnvironment {
    fn default() -> Self {
        Self::new(None)
    }
}

impl PlatformEnvironment for IosEnvironment {
    fn platform_kind(&self) -> PlatformKind {
        PlatformKind::Ios
    }

    fn config_dir(&self) -> Result<PathBuf, String> {
        Ok(self.base_dir.join("Library/Application Support/Scholarium"))
    }

    fn data_dir(&self) -> Result<PathBuf, String> {
        Ok(self.base_dir.join("Documents"))
    }

    fn cache_dir(&self) -> Result<PathBuf, String> {
        Ok(self.base_dir.join("Library/Caches/Scholarium"))
    }
}
