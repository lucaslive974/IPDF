use crate::core::ports::{LogEntry, LogLevel, LogService, PlatformEnvironment};
use std::fs;
use std::path::PathBuf;
use tracing::Dispatch;
use tracing_appender::non_blocking::WorkerGuard;
use tracing_subscriber::fmt;
use tracing_subscriber::layer::SubscriberExt;

const LOG_FILE_PREFIX: &str = "scholarium.log";

/// Non-blocking logger backed by `tracing`, `tracing-subscriber`, and `tracing-appender`.
/// Dispatches structured log events over a non-blocking background worker to daily-rotated
/// log files and optional console output, while keeping each instance isolated via `Dispatch`.
pub struct AsyncFileLogger {
    dispatch: Dispatch,
    guard: Option<WorkerGuard>,
}

impl AsyncFileLogger {
    pub fn for_platform(
        env: &dyn PlatformEnvironment,
        console_enabled: bool,
    ) -> Result<Self, String> {
        let dir = env.log_dir()?;
        Self::new(dir, console_enabled)
    }

    pub fn new(log_dir: PathBuf, console_enabled: bool) -> Result<Self, String> {
        fs::create_dir_all(&log_dir)
            .map_err(|e| format!("Failed to create log directory {}: {e}", log_dir.display()))?;

        let file_appender = tracing_appender::rolling::daily(&log_dir, LOG_FILE_PREFIX);
        let (non_blocking_file, guard) = tracing_appender::non_blocking(file_appender);

        let file_layer = fmt::layer()
            .with_writer(non_blocking_file)
            .with_ansi(false)
            .with_target(false);

        let dispatch = if console_enabled {
            let console_layer = fmt::layer()
                .with_writer(std::io::stderr)
                .with_ansi(true)
                .with_target(false);
            Dispatch::new(
                tracing_subscriber::registry()
                    .with(file_layer)
                    .with(console_layer),
            )
        } else {
            Dispatch::new(tracing_subscriber::registry().with(file_layer))
        };

        Ok(Self {
            dispatch,
            guard: Some(guard),
        })
    }

    /// Drops the non-blocking `WorkerGuard`, flushing all queued log events to disk.
    pub fn shutdown(&mut self) {
        self.guard.take();
    }
}

impl LogService for AsyncFileLogger {
    fn log(&self, entry: LogEntry) -> Result<(), String> {
        tracing::dispatcher::with_default(&self.dispatch, || match entry.level {
            LogLevel::Error => {
                tracing::error!(
                    source = %entry.source,
                    timestamp_ms = entry.timestamp_ms,
                    "{}",
                    entry.message
                );
            }
            LogLevel::Warn => {
                tracing::warn!(
                    source = %entry.source,
                    timestamp_ms = entry.timestamp_ms,
                    "{}",
                    entry.message
                );
            }
            LogLevel::Status => {
                tracing::info!(
                    source = %entry.source,
                    timestamp_ms = entry.timestamp_ms,
                    "{}",
                    entry.message
                );
            }
        });
        Ok(())
    }
}

impl Drop for AsyncFileLogger {
    fn drop(&mut self) {
        self.shutdown();
    }
}
