use crate::commands::{ai, highlights, library, settings, system};
use crate::state::BackendState;
use crate::utils::find_file_argument;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            use tauri::{Emitter, Manager};
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }

            if let Some(path) = find_file_argument(&args) {
                if let Some(state) = app.try_state::<Mutex<BackendState>>() {
                    if let Ok(mut guard) = state.lock() {
                        if let Ok((metadata, _bytes)) = guard.library.open_book_from_path(&path) {
                            let _ = app.emit("open-book-from-system", &metadata);
                        }
                    }
                }
            }
        }))
        .manage(Mutex::new(BackendState::default()))
        .invoke_handler(tauri::generate_handler![
            // System routes
            system::healthcheck,
            system::get_platform_info,
            system::get_startup_book,
            system::set_discord_presence_enabled,
            system::clear_rich_presence,
            // Library & Book routes
            library::compute_book_sha256,
            library::list_library_books,
            library::open_book_file,
            library::import_library_book,
            library::read_book_binary,
            library::get_book_pages,
            library::update_book_progress,
            library::rename_book,
            // Highlights & Annotations routes
            highlights::load_book_highlights,
            highlights::save_highlight,
            highlights::delete_highlight,
            highlights::sync_book_workspace,
            // Settings routes
            settings::get_app_setting,
            settings::set_app_setting,
            // AI / LLM routes
            ai::build_term_lookup_prompt,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
