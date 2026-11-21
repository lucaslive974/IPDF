use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

pub fn current_epoch_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub fn current_epoch_nanos() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0)
}

pub fn configure_wal_connection(conn: &rusqlite::Connection) -> Result<(), String> {
    conn.execute_batch("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;")
        .map_err(|e| e.to_string())
}

pub fn remove_sqlite_sidecars(db_path: &Path) {
    let path_str = db_path.to_string_lossy();
    for suffix in ["-wal", "-shm", "-journal"] {
        let _ = fs::remove_file(format!("{path_str}{suffix}"));
    }
}

pub fn remove_sqlite_files(db_path: &Path) {
    let _ = fs::remove_file(db_path);
    remove_sqlite_sidecars(db_path);
}

pub fn snapshot_database_bytes(db_path: &Path) -> Result<Vec<u8>, String> {
    let temp_path = std::env::temp_dir().join(format!(
        "scholarium-backup-{}-{}.db",
        std::process::id(),
        current_epoch_nanos()
    ));
    let temp_path_str = temp_path
        .to_str()
        .ok_or_else(|| "Temporary backup path is not valid UTF-8".to_string())?;

    let snapshot_res = (|| -> Result<Vec<u8>, String> {
        let conn = rusqlite::Connection::open(db_path).map_err(|e| e.to_string())?;
        conn.execute_batch("PRAGMA busy_timeout = 5000;")
            .map_err(|e| e.to_string())?;
        conn.execute("VACUUM INTO ?", [temp_path_str])
            .map_err(|e| e.to_string())?;
        fs::read(&temp_path).map_err(|e| e.to_string())
    })();
    let _ = fs::remove_file(&temp_path);

    match snapshot_res {
        Ok(bytes) => Ok(bytes),
        Err(_) => fs::read(db_path).map_err(|e| e.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_epoch_helpers_and_sqlite_utils() {
        assert!(current_epoch_ms() > 0);
        assert!(current_epoch_nanos() > 0);

        let dir = std::env::temp_dir().join(format!(
            "scholarium-utils-test-{}-{}",
            std::process::id(),
            current_epoch_nanos()
        ));
        fs::create_dir_all(&dir).expect("create temp dir");
        let db_path = dir.join("test.db");

        {
            let conn = rusqlite::Connection::open(&db_path).expect("open db");
            configure_wal_connection(&conn).expect("configure wal");
            conn.execute_batch(
                "CREATE TABLE items (id INTEGER PRIMARY KEY); INSERT INTO items VALUES (1);",
            )
            .expect("seed table");
        }

        let bytes = snapshot_database_bytes(&db_path).expect("snapshot db");
        assert!(!bytes.is_empty());

        let wal_path = format!("{}-wal", db_path.to_string_lossy());
        fs::write(&wal_path, b"stale-wal").expect("write wal");
        remove_sqlite_files(&db_path);
        assert!(!db_path.exists());
        assert!(!Path::new(&wal_path).exists());

        let _ = fs::remove_dir_all(&dir);
    }
}
