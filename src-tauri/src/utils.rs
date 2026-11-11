use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

pub fn current_epoch_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
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
        assert!(
            find_file_argument(&["scholarium".to_string(), "--help".to_string(), "-v".to_string()])
                .is_none()
        );

        // 3. EPUB file is found
        let args_epub = vec![
            "scholarium".to_string(),
            "--debug".to_string(),
            epub_path.to_string_lossy().to_string(),
        ];
        assert_eq!(find_file_argument(&args_epub), Some(epub_path.clone()));

        // 4. PDF file is found
        let args_pdf = vec!["scholarium".to_string(), pdf_path.to_string_lossy().to_string()];
        assert_eq!(find_file_argument(&args_pdf), Some(pdf_path.clone()));

        // 5. TXT file is ignored
        let args_txt = vec!["scholarium".to_string(), txt_path.to_string_lossy().to_string()];
        assert!(find_file_argument(&args_txt).is_none());

        let _ = std::fs::remove_file(&epub_path);
        let _ = std::fs::remove_file(&pdf_path);
        let _ = std::fs::remove_file(&txt_path);
    }
}
