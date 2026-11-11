use crate::core::domain::BookFormat;
use crate::core::ports::{PlatformEnvironment, StorageEntry, StorageProvider};
use std::fmt::Display;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

fn to_err<E: Display>(err: E) -> String {
    err.to_string()
}

fn modified_ms_for_path(path: &Path) -> i64 {
    if let Ok(meta) = fs::metadata(path) {
        if let Ok(modified) = meta.modified() {
            if let Ok(duration) = modified.duration_since(UNIX_EPOCH) {
                return duration.as_millis() as i64;
            }
        }
    }
    0
}

#[derive(Clone)]
pub struct LocalFolderStorageAdapter {
    provider_id: String,
    root_dir: PathBuf,
    initialized: bool,
}

impl LocalFolderStorageAdapter {
    pub fn new<P: AsRef<Path>>(provider_id: impl Into<String>, root_dir: P) -> Self {
        Self {
            provider_id: provider_id.into(),
            root_dir: root_dir.as_ref().to_path_buf(),
            initialized: false,
        }
    }

    pub fn for_platform<E: PlatformEnvironment + ?Sized>(
        provider_id: impl Into<String>,
        env: &E,
    ) -> Result<Self, String> {
        let data_dir = env.data_dir()?;
        Ok(Self::new(provider_id, data_dir))
    }

    fn resolve_book_path(&self, book_hash: &str) -> PathBuf {
        let epub_path = self.root_dir.join(format!("{book_hash}.epub"));
        if epub_path.exists() {
            return epub_path;
        }
        let pdf_path = self.root_dir.join(format!("{book_hash}.pdf"));
        if pdf_path.exists() {
            return pdf_path;
        }
        epub_path
    }

    pub fn root_dir(&self) -> &Path {
        &self.root_dir
    }
}

impl StorageProvider for LocalFolderStorageAdapter {
    fn provider_id(&self) -> &str {
        &self.provider_id
    }

    fn initialize(&mut self) -> Result<bool, String> {
        fs::create_dir_all(&self.root_dir).map_err(to_err)?;
        self.initialized = true;
        Ok(true)
    }

    fn is_available(&self) -> bool {
        self.initialized && self.root_dir.exists()
    }

    fn has_book_binary(&self, book_hash: &str) -> Result<bool, String> {
        let epub_exists = self.root_dir.join(format!("{book_hash}.epub")).exists();
        let pdf_exists = self.root_dir.join(format!("{book_hash}.pdf")).exists();
        Ok(epub_exists || pdf_exists)
    }

    fn read_book_binary(&mut self, book_hash: &str) -> Result<Vec<u8>, String> {
        let path = self.resolve_book_path(book_hash);
        if !path.exists() {
            return Err(format!("Book binary not found for hash: {book_hash}"));
        }
        fs::read(&path).map_err(to_err)
    }

    fn write_book_binary(
        &mut self,
        book_hash: &str,
        data: Vec<u8>,
        format: BookFormat,
    ) -> Result<(), String> {
        if !self.root_dir.exists() {
            fs::create_dir_all(&self.root_dir).map_err(to_err)?;
        }
        let ext = match format {
            BookFormat::Epub => "epub",
            BookFormat::Pdf => "pdf",
        };
        let path = self.root_dir.join(format!("{book_hash}.{ext}"));
        fs::write(&path, data).map_err(to_err)
    }

    fn delete_book_binary(&mut self, book_hash: &str) -> Result<bool, String> {
        let path = self.resolve_book_path(book_hash);
        if path.exists() {
            fs::remove_file(&path).map_err(to_err)?;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    fn list_entries(&self, prefix: Option<&str>) -> Result<Vec<StorageEntry>, String> {
        if !self.root_dir.exists() {
            return Ok(Vec::new());
        }
        let read_dir = fs::read_dir(&self.root_dir).map_err(to_err)?;
        let mut entries = Vec::new();
        for item in read_dir {
            let entry = item.map_err(to_err)?;
            let file_name = entry.file_name().to_string_lossy().to_string();
            if let Some(pfx) = prefix {
                if !file_name.starts_with(pfx) {
                    continue;
                }
            }
            let metadata = entry.metadata().map_err(to_err)?;
            if !metadata.is_file() {
                continue;
            }
            let mime_type = if file_name.ends_with(".json") {
                "application/json"
            } else if file_name.ends_with(".epub") {
                "application/epub+zip"
            } else if file_name.ends_with(".pdf") {
                "application/pdf"
            } else {
                "application/octet-stream"
            };
            entries.push(StorageEntry {
                name: file_name,
                size_bytes: metadata.len() as usize,
                mime_type: mime_type.to_string(),
                modified_at_ms: modified_ms_for_path(&entry.path()),
            });
        }
        entries.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(entries)
    }

    fn read_entry(&mut self, name: &str) -> Result<Option<Vec<u8>>, String> {
        let path = self.root_dir.join(name);
        if !path.exists() {
            return Ok(None);
        }
        let bytes = fs::read(&path).map_err(to_err)?;
        Ok(Some(bytes))
    }

    fn write_entry(
        &mut self,
        name: &str,
        data: &[u8],
        mime_type: &str,
    ) -> Result<StorageEntry, String> {
        if !self.root_dir.exists() {
            fs::create_dir_all(&self.root_dir).map_err(to_err)?;
        }
        let path = self.root_dir.join(name);
        if let Some(parent) = path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent).map_err(to_err)?;
            }
        }
        fs::write(&path, data).map_err(to_err)?;

        Ok(StorageEntry {
            name: name.to_string(),
            size_bytes: data.len(),
            mime_type: mime_type.to_string(),
            modified_at_ms: modified_ms_for_path(&path),
        })
    }

    fn rename_entry(&mut self, old_name: &str, new_name: &str) -> Result<(), String> {
        let old_path = self.root_dir.join(old_name);
        if !old_path.exists() {
            return Err(format!("Entry not found: {old_name}"));
        }
        let new_path = self.root_dir.join(new_name);
        if let Some(parent) = new_path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent).map_err(to_err)?;
            }
        }
        fs::rename(&old_path, &new_path).map_err(to_err)
    }

    fn resolve_entry_path(&self, name: &str) -> Option<PathBuf> {
        Some(self.root_dir.join(name))
    }
}
