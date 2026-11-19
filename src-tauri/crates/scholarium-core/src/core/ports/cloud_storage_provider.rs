use serde::{Deserialize, Serialize};
use std::fmt;

/// Metadata returned by cloud storage for an object (used for ETag/optimistic concurrency).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudObjectMeta {
    pub path: String,
    pub etag: String,
    pub size_bytes: u64,
    pub modified_at_ms: Option<i64>,
}

/// Typed error enum returned by `CloudStorageProvider` implementations.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CloudStorageError {
    NotFound(String),
    PreconditionFailed(String),
    Unauthorized(String),
    Network(String),
    Other(String),
}

impl fmt::Display for CloudStorageError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::NotFound(msg) => write!(f, "Cloud object not found: {msg}"),
            Self::PreconditionFailed(msg) => write!(f, "Cloud precondition failed: {msg}"),
            Self::Unauthorized(msg) => write!(f, "Cloud unauthorized: {msg}"),
            Self::Network(msg) => write!(f, "Cloud network error: {msg}"),
            Self::Other(msg) => write!(f, "Cloud storage error: {msg}"),
        }
    }
}

impl std::error::Error for CloudStorageError {}

/// Provider-agnostic object storage port supporting optimistic concurrency (`If-Match` / `If-None-Match`).
pub trait CloudStorageProvider: Send + Sync {
    fn provider_id(&self) -> &str;
    fn head(&self, path: &str) -> Result<Option<CloudObjectMeta>, CloudStorageError>;
    fn read(&self, path: &str) -> Result<Option<(Vec<u8>, CloudObjectMeta)>, CloudStorageError>;
    fn write_unconditional(
        &self,
        path: &str,
        bytes: &[u8],
        content_type: &str,
    ) -> Result<CloudObjectMeta, CloudStorageError>;
    fn write_if_absent(
        &self,
        path: &str,
        bytes: &[u8],
        content_type: &str,
    ) -> Result<CloudObjectMeta, CloudStorageError>;
    fn write_if_match(
        &self,
        path: &str,
        bytes: &[u8],
        content_type: &str,
        expected_etag: &str,
    ) -> Result<CloudObjectMeta, CloudStorageError>;
    fn delete_if_match(&self, path: &str, expected_etag: &str) -> Result<(), CloudStorageError>;
    fn delete_unconditional(&self, path: &str) -> Result<(), CloudStorageError>;
    fn list_prefix(&self, prefix: &str) -> Result<Vec<CloudObjectMeta>, CloudStorageError>;
}
