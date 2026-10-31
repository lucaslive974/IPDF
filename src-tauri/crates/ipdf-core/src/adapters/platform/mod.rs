pub mod android_environment;
pub mod ios_environment;
pub mod linux_environment;
pub mod windows_environment;

pub use android_environment::AndroidEnvironment;
pub use ios_environment::IosEnvironment;
pub use linux_environment::LinuxEnvironment;
pub use windows_environment::WindowsEnvironment;

use crate::core::domain::PlatformKind;
use crate::core::ports::PlatformEnvironment;
use std::path::PathBuf;

pub fn create_platform_environment(
    kind: PlatformKind,
    custom_root: Option<PathBuf>,
) -> Box<dyn PlatformEnvironment> {
    match kind {
        PlatformKind::Linux => Box::new(LinuxEnvironment::new(custom_root)),
        PlatformKind::Android => Box::new(AndroidEnvironment::new(custom_root)),
        PlatformKind::Windows => Box::new(WindowsEnvironment::new(custom_root)),
        PlatformKind::Ios => Box::new(IosEnvironment::new(custom_root)),
    }
}
