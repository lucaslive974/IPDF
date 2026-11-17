use crate::core::domain::AppStoragePaths;
use crate::core::ports::{BackupArtifact, BackupDestination, BackupReport, PlatformEnvironment};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Cursor, Read, Seek, Write};
use std::path::{Path, PathBuf};
use zip::read::ZipFile;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

const MANIFEST_FILENAME: &str = "manifest.json";
const BACKUP_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupManifest {
    schema_version: u32,
    created_at_ms: i64,
    report: BackupReport,
}

#[derive(Debug, Default, Clone, Copy)]
pub struct BackupService;

impl BackupService {
    pub fn new() -> Self {
        Self
    }

    pub fn create_backup<D: BackupDestination>(
        &self,
        env: &dyn PlatformEnvironment,
        destination: &D,
        now_ms: i64,
    ) -> Result<(BackupArtifact, BackupReport), String> {
        let (bytes, report) = self.export_to_bytes(env, now_ms)?;
        let file_name = format!("scholarium-backup-{now_ms}.zip");
        let artifact = destination.save_backup(&file_name, &bytes)?;
        Ok((artifact, report))
    }

    pub fn restore_backup<D: BackupDestination>(
        &self,
        env: &dyn PlatformEnvironment,
        destination: &D,
        backup_id: &str,
    ) -> Result<BackupReport, String> {
        let bytes = destination.load_backup(backup_id)?;
        self.restore_from_bytes(env, &bytes)
    }

    pub fn export_to_bytes(
        &self,
        env: &dyn PlatformEnvironment,
        now_ms: i64,
    ) -> Result<(Vec<u8>, BackupReport), String> {
        let mut buffer = Vec::new();
        let report = {
            let mut archive = BackupArchiveWriter::new(Cursor::new(&mut buffer), env);
            archive.write_all(now_ms)?;
            archive.finish()?
        };
        Ok((buffer, report))
    }

    pub fn restore_from_bytes(
        &self,
        env: &dyn PlatformEnvironment,
        zip_bytes: &[u8],
    ) -> Result<BackupReport, String> {
        let mut restorer = BackupArchiveRestorer::new(env)?;
        restorer.restore(zip_bytes)
    }
}

struct BackupArchiveWriter<'a, W: Write + Seek> {
    writer: ZipWriter<W>,
    env: &'a dyn PlatformEnvironment,
    options: SimpleFileOptions,
    report: BackupReport,
}

impl<'a, W: Write + Seek> BackupArchiveWriter<'a, W> {
    fn new(inner: W, env: &'a dyn PlatformEnvironment) -> Self {
        Self {
            writer: ZipWriter::new(inner),
            env,
            options: SimpleFileOptions::default().compression_method(CompressionMethod::Deflated),
            report: BackupReport::default(),
        }
    }

    fn write_all(&mut self, now_ms: i64) -> Result<(), String> {
        self.report.books_count =
            self.append_directory(&self.env.books_dir()?, AppStoragePaths::BOOKS_DIR)?;
        self.report.covers_count =
            self.append_directory(&self.env.covers_dir()?, AppStoragePaths::COVERS_DIR)?;
        self.report.includes_database = self.append_database()?;
        self.append_highlights()?;
        self.append_manifest(now_ms)?;
        Ok(())
    }

    fn finish(self) -> Result<BackupReport, String> {
        self.writer.finish().map_err(|e| e.to_string())?;
        Ok(self.report)
    }

    fn append_directory(&mut self, source_dir: &Path, zip_prefix: &str) -> Result<usize, String> {
        if !source_dir.is_dir() {
            return Ok(0);
        }

        let mut count = 0;
        for entry in fs::read_dir(source_dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if !path.is_file() {
                continue;
            }

            let file_name = entry.file_name().to_string_lossy().to_string();
            let bytes = fs::read(&path).map_err(|e| e.to_string())?;
            self.write_zip_file(&format!("{zip_prefix}/{file_name}"), &bytes)?;
            count += 1;
        }
        Ok(count)
    }

    fn append_database(&mut self) -> Result<bool, String> {
        let db_path = self.env.default_database_path()?;
        if !db_path.is_file() {
            return Ok(false);
        }

        let bytes = fs::read(&db_path).map_err(|e| e.to_string())?;
        self.write_zip_file(&AppStoragePaths::database_relative_path(), &bytes)?;
        Ok(true)
    }

    fn append_highlights(&mut self) -> Result<(), String> {
        let highlights_dir = self.env.highlights_dir()?;
        let _ =
            self.append_directory(&highlights_dir, &AppStoragePaths::highlights_relative_dir())?;
        Ok(())
    }

    fn append_manifest(&mut self, now_ms: i64) -> Result<(), String> {
        let manifest = BackupManifest {
            schema_version: BACKUP_SCHEMA_VERSION,
            created_at_ms: now_ms,
            report: self.report.clone(),
        };
        let bytes = serde_json::to_vec_pretty(&manifest).map_err(|e| e.to_string())?;
        self.writer
            .start_file(MANIFEST_FILENAME, self.options)
            .map_err(|e| e.to_string())?;
        self.writer.write_all(&bytes).map_err(|e| e.to_string())?;
        Ok(())
    }

    fn write_zip_file(&mut self, zip_path: &str, bytes: &[u8]) -> Result<(), String> {
        self.report.total_bytes += bytes.len() as u64;
        self.writer
            .start_file(zip_path, self.options)
            .map_err(|e| e.to_string())?;
        self.writer.write_all(bytes).map_err(|e| e.to_string())?;
        Ok(())
    }
}

struct BackupArchiveRestorer {
    data_dir: PathBuf,
    report: BackupReport,
}

impl BackupArchiveRestorer {
    fn new(env: &dyn PlatformEnvironment) -> Result<Self, String> {
        let data_dir = env.data_dir()?;
        fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
        Ok(Self {
            data_dir,
            report: BackupReport::default(),
        })
    }

    fn restore(&mut self, zip_bytes: &[u8]) -> Result<BackupReport, String> {
        let mut archive = ZipArchive::new(Cursor::new(zip_bytes))
            .map_err(|e| format!("Invalid backup zip: {e}"))?;

        for idx in 0..archive.len() {
            let mut entry = archive.by_index(idx).map_err(|e| e.to_string())?;
            self.extract_entry(&mut entry)?;
        }

        Ok(self.report.clone())
    }

    fn extract_entry<R: Read>(&mut self, entry: &mut ZipFile<'_, R>) -> Result<(), String> {
        if entry.is_dir() {
            return Ok(());
        }

        let Some(enclosed) = entry.enclosed_name() else {
            return Err("Backup archive contains unsafe path traversal entry".to_string());
        };
        let rel_path = enclosed.to_string_lossy().to_string();
        if rel_path == MANIFEST_FILENAME || !Self::is_allowed_path(&rel_path) {
            return Ok(());
        }

        let target_path = self.data_dir.join(&enclosed);
        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let mut contents = Vec::with_capacity(entry.size() as usize);
        entry
            .read_to_end(&mut contents)
            .map_err(|e| e.to_string())?;
        fs::write(&target_path, &contents).map_err(|e| e.to_string())?;

        self.record_entry(&rel_path, contents.len() as u64);
        Ok(())
    }

    fn record_entry(&mut self, rel_path: &str, bytes_len: u64) {
        self.report.total_bytes += bytes_len;
        if rel_path.starts_with(&format!("{}/", AppStoragePaths::BOOKS_DIR)) {
            self.report.books_count += 1;
        } else if rel_path.starts_with(&format!("{}/", AppStoragePaths::COVERS_DIR)) {
            self.report.covers_count += 1;
        } else if rel_path == AppStoragePaths::database_relative_path() {
            self.report.includes_database = true;
        }
    }

    fn is_allowed_path(rel_path: &str) -> bool {
        rel_path.starts_with(&format!("{}/", AppStoragePaths::BOOKS_DIR))
            || rel_path.starts_with(&format!("{}/", AppStoragePaths::COVERS_DIR))
            || rel_path.starts_with(&format!("{}/", AppStoragePaths::CONFIG_DIR))
    }
}
