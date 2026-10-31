use crate::core::domain::PlatformKind;
use crate::core::ports::PlatformEnvironment;
use std::env;
use std::path::PathBuf;

pub struct LinuxEnvironment {
    base_dir: PathBuf,
}

impl LinuxEnvironment {
    pub fn new(custom_root: Option<PathBuf>) -> Self {
        let base = custom_root.unwrap_or_else(|| {
            if let Ok(home) = env::var("HOME") {
                PathBuf::from(home).join(".var/app/com.ipdf.reader")
            } else {
                PathBuf::from("/tmp/ipdf")
            }
        });
        Self { base_dir: base }
    }
}

impl Default for LinuxEnvironment {
    fn default() -> Self {
        Self::new(None)
    }
}

impl PlatformEnvironment for LinuxEnvironment {
    fn platform_kind(&self) -> PlatformKind {
        PlatformKind::Linux
    }

    fn config_dir(&self) -> Result<PathBuf, String> {
        Ok(self.base_dir.join("config"))
    }

    fn data_dir(&self) -> Result<PathBuf, String> {
        Ok(self.base_dir.join("data"))
    }

    fn cache_dir(&self) -> Result<PathBuf, String> {
        Ok(self.base_dir.join("cache"))
    }
}
