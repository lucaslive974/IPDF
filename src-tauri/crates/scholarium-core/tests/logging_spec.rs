use scholarium_core::adapters::logging::AsyncFileLogger;
use scholarium_core::adapters::platform::LinuxEnvironment;
use scholarium_core::core::ports::{LogEntry, LogLevel, LogService, PlatformEnvironment};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

fn make_temp_dir(label: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let dir = std::env::temp_dir().join(format!("scholarium_{label}_{nanos}"));
    fs::create_dir_all(&dir).expect("create temp dir");
    dir
}

#[test]
fn test_platform_environment_resolves_log_dir() {
    let root = make_temp_dir("log_dir");
    let env = LinuxEnvironment::new(Some(root.clone()));

    let log_dir = env.log_dir().expect("log_dir should resolve");
    assert_eq!(log_dir, root.join("data").join(".logs"));

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn test_tracing_async_logger_writes_entries_and_flushes_on_shutdown() {
    let root = make_temp_dir("tracing_logger");
    let env = LinuxEnvironment::new(Some(root.clone()));

    let mut logger = AsyncFileLogger::for_platform(&env, false).expect("create logger");
    logger
        .log(LogEntry::new(
            1_700_000_000_000,
            LogLevel::Status,
            "startup",
            "Backend initialized",
        ))
        .expect("enqueue status");
    logger
        .log(LogEntry::new(
            1_700_000_000_100,
            LogLevel::Warn,
            "reader",
            "Slow page decode",
        ))
        .expect("enqueue warn");
    logger
        .log(LogEntry::new(
            1_700_000_000_200,
            LogLevel::Error,
            "sqlite",
            "Constraint failed",
        ))
        .expect("enqueue error");

    logger.shutdown();

    let log_dir = env.log_dir().expect("log_dir");
    let log_file = fs::read_dir(&log_dir)
        .expect("read log dir")
        .filter_map(Result::ok)
        .map(|e| e.path())
        .find(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.starts_with("scholarium.log"))
        })
        .expect("daily log file should exist");

    let contents = fs::read_to_string(&log_file).expect("read daily log");
    assert!(contents.contains("INFO"));
    assert!(contents.contains("Backend initialized"));
    assert!(contents.contains("WARN"));
    assert!(contents.contains("Slow page decode"));
    assert!(contents.contains("ERROR"));
    assert!(contents.contains("Constraint failed"));

    let _ = fs::remove_dir_all(&root);
}

#[test]
fn test_log_entry_formats_canonical_line() {
    let entry = LogEntry::new(1_700_000_000_000, LogLevel::Status, "ipc", "Ping");
    assert_eq!(entry.format_line(), "[1700000000000] [STATUS] [ipc] Ping");
}
