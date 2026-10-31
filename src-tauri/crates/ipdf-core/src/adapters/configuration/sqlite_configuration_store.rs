use crate::core::ports::{ConfigurationStore, PlatformEnvironment};
use rusqlite::{params, Connection, OptionalExtension};
use std::fmt::Display;
use std::fs;
use std::path::Path;

fn to_err<E: Display>(err: E) -> String {
    err.to_string()
}

pub struct SqliteConfigurationStore {
    conn: Connection,
}

impl SqliteConfigurationStore {
    pub fn new(conn: Connection) -> Result<Self, String> {
        let store = Self { conn };
        store.initialize_schema()?;
        Ok(store)
    }

    pub fn new_in_memory() -> Result<Self, String> {
        let conn = Connection::open_in_memory().map_err(to_err)?;
        Self::new(conn)
    }

    pub fn open_file<P: AsRef<Path>>(path: P) -> Result<Self, String> {
        if let Some(parent) = path.as_ref().parent() {
            if !parent.as_os_str().is_empty() && !parent.exists() {
                fs::create_dir_all(parent).map_err(to_err)?;
            }
        }
        let conn = Connection::open(path).map_err(to_err)?;
        Self::new(conn)
    }

    pub fn for_platform<E: PlatformEnvironment + ?Sized>(env: &E) -> Result<Self, String> {
        let path = env.resolve_database_path("ipdf_config.db")?;
        Self::open_file(path)
    }

    fn initialize_schema(&self) -> Result<(), String> {
        self.conn
            .execute_batch(
                "CREATE TABLE IF NOT EXISTS app_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );",
            )
            .map_err(to_err)
    }
}

impl ConfigurationStore for SqliteConfigurationStore {
    fn get(&self, key: &str) -> Result<Option<String>, String> {
        let mut stmt = self
            .conn
            .prepare("SELECT value FROM app_settings WHERE key = ?1")
            .map_err(to_err)?;

        stmt.query_row(params![key], |row| row.get(0))
            .optional()
            .map_err(to_err)
    }

    fn set(&mut self, key: &str, value: &str) -> Result<(), String> {
        self.conn
            .execute(
                "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?1, ?2)",
                params![key, value],
            )
            .map_err(to_err)?;
        Ok(())
    }

    fn remove(&mut self, key: &str) -> Result<(), String> {
        self.conn
            .execute("DELETE FROM app_settings WHERE key = ?1", params![key])
            .map_err(to_err)?;
        Ok(())
    }

    fn keys(&self) -> Result<Vec<String>, String> {
        let mut stmt = self
            .conn
            .prepare("SELECT key FROM app_settings ORDER BY key ASC")
            .map_err(to_err)?;

        let rows = stmt.query_map([], |row| row.get(0)).map_err(to_err)?;

        let mut list = Vec::new();
        for row in rows {
            list.push(row.map_err(to_err)?);
        }
        Ok(list)
    }

    fn clear(&mut self) -> Result<(), String> {
        self.conn
            .execute("DELETE FROM app_settings", [])
            .map_err(to_err)?;
        Ok(())
    }
}
