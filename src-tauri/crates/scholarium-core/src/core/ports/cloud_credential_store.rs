/// Provider-agnostic secret store indexed by `provider_id`.
///
/// Implementations MUST store credentials strictly outside the primary SQLite database
/// and excluded from exported `.zip` backup archives so tokens never leak in backups.
pub trait CloudCredentialStore: Send + Sync {
    fn get_secret(&self, provider_id: &str) -> Result<Option<String>, String>;
    fn set_secret(&self, provider_id: &str, secret_json: &str) -> Result<(), String>;
    fn delete_secret(&self, provider_id: &str) -> Result<(), String>;
}
