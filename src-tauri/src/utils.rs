use scholarium_core::core::domain::BookFormat;
pub use scholarium_core::utils::current_epoch_ms;
use std::path::{Path, PathBuf};

pub struct LocalBookFile {
    pub raw_bytes: Vec<u8>,
    pub title: String,
    pub format: BookFormat,
}

pub fn read_local_book_file(path: &Path) -> Result<LocalBookFile, String> {
    if !path.exists() {
        return Err(format!("Book file does not exist: {}", path.display()));
    }

    let raw_bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    let filename = path
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| "document".to_string());
    let format = if filename.ends_with(".pdf") {
        BookFormat::Pdf
    } else {
        BookFormat::Epub
    };
    let title = path
        .file_stem()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| "Book".to_string());

    Ok(LocalBookFile {
        raw_bytes,
        title,
        format,
    })
}

pub fn find_file_argument(args: &[String]) -> Option<PathBuf> {
    for arg in args.iter().skip(1) {
        if arg.starts_with('-') {
            continue;
        }
        let path = PathBuf::from(arg);
        if path.is_file() {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                let ext_lower = ext.to_lowercase();
                if ext_lower == "epub" || ext_lower == "pdf" {
                    return Some(path);
                }
            }
        }
    }
    None
}

pub async fn pick_file_dialog(
    app: &tauri::AppHandle,
    title: &str,
    filter_name: &str,
    extensions: &[&str],
) -> Result<Option<tauri_plugin_dialog::FilePath>, String> {
    use tauri_plugin_dialog::DialogExt;

    let app = app.clone();
    let title = title.to_string();
    let filter_name = filter_name.to_string();
    let extensions: Vec<String> = extensions.iter().map(|s| (*s).to_string()).collect();

    tauri::async_runtime::spawn_blocking(move || {
        let ext_refs: Vec<&str> = extensions.iter().map(String::as_str).collect();
        app.dialog()
            .file()
            .add_filter(&filter_name, &ext_refs)
            .set_title(&title)
            .blocking_pick_file()
    })
    .await
    .map_err(|e| e.to_string())
}

pub async fn save_file_dialog(
    app: &tauri::AppHandle,
    title: &str,
    filter_name: &str,
    extensions: &[&str],
    file_name: &str,
) -> Result<Option<tauri_plugin_dialog::FilePath>, String> {
    use tauri_plugin_dialog::DialogExt;

    let app = app.clone();
    let title = title.to_string();
    let filter_name = filter_name.to_string();
    let file_name = file_name.to_string();
    let extensions: Vec<String> = extensions.iter().map(|s| (*s).to_string()).collect();

    tauri::async_runtime::spawn_blocking(move || {
        let ext_refs: Vec<&str> = extensions.iter().map(String::as_str).collect();
        app.dialog()
            .file()
            .add_filter(&filter_name, &ext_refs)
            .set_file_name(&file_name)
            .set_title(&title)
            .blocking_save_file()
    })
    .await
    .map_err(|e| e.to_string())
}

pub async fn read_dialog_file_bytes(
    app: &tauri::AppHandle,
    file_path: tauri_plugin_dialog::FilePath,
) -> Result<Vec<u8>, String> {
    use std::io::Read;
    use tauri_plugin_fs::{FsExt, OpenOptions};

    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || -> Result<Vec<u8>, String> {
        let mut opts = OpenOptions::new();
        opts.read(true);
        let mut file = app.fs().open(file_path, opts).map_err(|e| e.to_string())?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
        Ok(buffer)
    })
    .await
    .map_err(|e| e.to_string())?
}

pub async fn write_dialog_file_bytes(
    app: &tauri::AppHandle,
    file_path: tauri_plugin_dialog::FilePath,
    bytes: Vec<u8>,
) -> Result<(), String> {
    use std::io::Write;
    use tauri_plugin_fs::{FsExt, OpenOptions};

    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        let mut opts = OpenOptions::new();
        opts.write(true).create(true).truncate(true);
        let mut file = app.fs().open(file_path, opts).map_err(|e| e.to_string())?;
        file.write_all(&bytes).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_file_argument() {
        let temp_dir = std::env::temp_dir();
        let epub_path = temp_dir.join(format!("test_doc_{}.epub", std::process::id()));
        let pdf_path = temp_dir.join(format!("test_doc_{}.pdf", std::process::id()));
        let txt_path = temp_dir.join(format!("test_doc_{}.txt", std::process::id()));

        std::fs::write(&epub_path, b"epub content").unwrap();
        std::fs::write(&pdf_path, b"pdf content").unwrap();
        std::fs::write(&txt_path, b"text content").unwrap();

        // 1. Only binary name passed
        assert!(find_file_argument(&["scholarium".to_string()]).is_none());

        // 2. Flags are ignored
        assert!(find_file_argument(&[
            "scholarium".to_string(),
            "--help".to_string(),
            "-v".to_string()
        ])
        .is_none());

        // 3. EPUB file is found
        let args_epub = vec![
            "scholarium".to_string(),
            "--debug".to_string(),
            epub_path.to_string_lossy().to_string(),
        ];
        assert_eq!(find_file_argument(&args_epub), Some(epub_path.clone()));

        // 4. PDF file is found
        let args_pdf = vec![
            "scholarium".to_string(),
            pdf_path.to_string_lossy().to_string(),
        ];
        assert_eq!(find_file_argument(&args_pdf), Some(pdf_path.clone()));

        // 5. TXT file is ignored
        let args_txt = vec![
            "scholarium".to_string(),
            txt_path.to_string_lossy().to_string(),
        ];
        assert!(find_file_argument(&args_txt).is_none());

        let _ = std::fs::remove_file(&epub_path);
        let _ = std::fs::remove_file(&pdf_path);
        let _ = std::fs::remove_file(&txt_path);
    }
}
