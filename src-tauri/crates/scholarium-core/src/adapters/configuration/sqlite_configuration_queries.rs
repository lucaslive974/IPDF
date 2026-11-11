pub const INIT_SCHEMA: &str = "CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);";

pub const GET_VALUE: &str = "SELECT value FROM app_settings WHERE key = ?1;";

pub const UPSERT_VALUE: &str = "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?1, ?2);";

pub const DELETE_KEY: &str = "DELETE FROM app_settings WHERE key = ?1;";

pub const LIST_KEYS: &str = "SELECT key FROM app_settings ORDER BY key ASC;";

pub const CLEAR_ALL: &str = "DELETE FROM app_settings;";
