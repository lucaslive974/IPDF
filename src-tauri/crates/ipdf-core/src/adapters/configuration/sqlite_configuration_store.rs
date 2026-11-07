use super::sqlite_configuration_queries as queries;
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
        let path = env.resolve_database_path("ipdf.db")?;
        Self::open_file(path)
    }

    fn initialize_schema(&self) -> Result<(), String> {
        self.conn
            .execute_batch(queries::INIT_SCHEMA)
            .map_err(to_err)
    }
}

impl ConfigurationStore for SqliteConfigurationStore {
    fn get(&self, key: &str) -> Result<Option<String>, String> {
        let mut stmt = self.conn.prepare(queries::GET_VALUE).map_err(to_err)?;

        stmt.query_row(params![key], |row| row.get(0))
            .optional()
            .map_err(to_err)
    }

    fn set(&mut self, key: &str, value: &str) -> Result<(), String> {
        self.conn
            .execute(queries::UPSERT_VALUE, params![key, value])
            .map_err(to_err)?;
        Ok(())
    }

    fn remove(&mut self, key: &str) -> Result<(), String> {
        self.conn
            .execute(queries::DELETE_KEY, params![key])
            .map_err(to_err)?;
        Ok(())
    }

    fn keys(&self) -> Result<Vec<String>, String> {
        let mut stmt = self.conn.prepare(queries::LIST_KEYS).map_err(to_err)?;

        let rows = stmt.query_map([], |row| row.get(0)).map_err(to_err)?;

        let mut list = Vec::new();
        for row in rows {
            list.push(row.map_err(to_err)?);
        }
        Ok(list)
    }

    fn clear(&mut self) -> Result<(), String> {
        self.conn.execute(queries::CLEAR_ALL, []).map_err(to_err)?;
        Ok(())
    }
}
