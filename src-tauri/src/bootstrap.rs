use crate::commands::{ai, backup, highlights, library, reader, settings, sync, system};
use crate::state::BackendState;
use crate::sync_scheduler::{empty_status, load_configured_interval_secs, SyncSchedulerHandle};
use scholarium_core::core::ports::StorageProvider;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init());

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            handle_single_instance(app, &args);
        }));
    }

    let backend_state = BackendState::default();
    let initial_interval = load_configured_interval_secs(&backend_state.config_store);
    let initial_status = empty_status(initial_interval, &backend_state);
    let sync_scheduler = SyncSchedulerHandle::new(initial_interval, initial_status);
    let bg_scheduler = sync_scheduler.clone();

    builder
        .manage(Mutex::new(backend_state))
        .manage(sync_scheduler)
        .setup(move |app| {
            bg_scheduler.spawn_background_loop(app.handle().clone());
            Ok(())
        })
        .register_asynchronous_uri_scheme_protocol("cover", handle_cover_protocol_request)
        .invoke_handler(tauri::generate_handler![
            // System routes
            system::healthcheck,
            system::write_log,
            system::reset_application_data,
            system::get_platform_info,
            system::get_startup_book,
            system::set_discord_presence_enabled,
            system::clear_rich_presence,
            system::update_library_presence,
            system::update_annotations_presence,
            system::update_reading_presence,
            system::get_discord_presence_health,
            // Library & Book routes
            library::list_library_books,
            library::list_authors,
            library::list_tags,
            library::compute_book_sha256,
            library::import_books_from_paths,
            library::import_book_from_bytes,
            library::pick_and_import_book,
            library::rename_book,
            library::update_book_metadata,
            library::delete_book,
            library::save_book_cover,
            library::delete_book_cover,
            // Reader & Content routes
            reader::read_book_binary,
            reader::get_book_file_size,
            reader::read_book_range,
            reader::get_book_pages,
            reader::update_book_progress,
            // Highlights & Annotations routes
            highlights::load_book_highlights,
            highlights::load_all_highlights,
            highlights::save_highlight,
            highlights::delete_highlight,
            highlights::sync_book_workspace,
            // Settings routes
            settings::get_app_setting,
            settings::set_app_setting,
            // AI / LLM routes
            ai::build_term_lookup_prompt,
            // Backup routes
            backup::create_local_backup,
            backup::list_local_backups,
            backup::restore_local_backup,
            backup::delete_local_backup,
            backup::export_local_backup,
            backup::import_and_restore_backup,
            // Cloud Sync & On-Demand Storage routes
            sync::list_cloud_providers,
            sync::get_cloud_sync_status,
            sync::begin_google_oauth,
            sync::complete_google_oauth,
            sync::connect_google_drive,
            sync::disconnect_cloud_provider,
            sync::trigger_cloud_sync,
            sync::notify_app_resumed,
            sync::set_cloud_sync_interval,
            sync::list_book_availabilities,
            sync::download_remote_book,
            sync::evict_local_book,
            sync::clear_cloud_sync_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn handle_single_instance(app: &tauri::AppHandle, args: &[String]) {
    use tauri::{Emitter, Manager};

    focus_main_window(app);

    let Some(state) = app.try_state::<Mutex<BackendState>>() else {
        return;
    };
    let Ok(mut guard) = state.lock() else {
        return;
    };

    let BackendState {
        ref mut library,
        ref epub_content,
        ..
    } = *guard;
    if let Some(metadata) = BackendState::import_book_from_cli_args(library, epub_content, args) {
        if let Err(err) = app.emit("open-book-from-system", &metadata) {
            tracing::warn!(
                source = "bootstrap",
                "Failed to emit open-book-from-system event: {err}"
            );
        }
    }
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn focus_main_window(app: &tauri::AppHandle) {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn handle_cover_protocol_request(
    ctx: tauri::UriSchemeContext<'_, tauri::Wry>,
    request: tauri::http::Request<Vec<u8>>,
    responder: tauri::UriSchemeResponder,
) {
    let Some(book_hash) = extract_cover_hash(request.uri().path()) else {
        responder.respond(build_cover_response(
            400,
            "text/plain",
            "no-store",
            Vec::new(),
        ));
        return;
    };

    let app_handle = ctx.app_handle().clone();
    tauri::async_runtime::spawn(async move {
        let response = cover_result_to_response(read_cover_from_state(&app_handle, &book_hash));
        responder.respond(response);
    });
}

fn read_cover_from_state(
    app_handle: &tauri::AppHandle,
    book_hash: &str,
) -> Result<Option<(Vec<u8>, String)>, String> {
    let state = app_handle.state::<Mutex<BackendState>>();
    let mut guard = state.lock().map_err(|e| e.to_string())?;
    guard.storage.read_book_cover(book_hash)
}

fn cover_result_to_response(
    result: Result<Option<(Vec<u8>, String)>, String>,
) -> tauri::http::Response<Vec<u8>> {
    match result {
        Ok(Some((bytes, mime_type))) => build_cover_response(
            200,
            &mime_type,
            "public, max-age=31536000, immutable",
            bytes,
        ),
        Ok(None) => build_cover_response(404, "text/plain", "no-store", Vec::new()),
        Err(_) => build_cover_response(500, "text/plain", "no-store", Vec::new()),
    }
}

fn extract_cover_hash(uri_path: &str) -> Option<String> {
    let trimmed = uri_path.trim_start_matches('/').trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn build_cover_response(
    status: u16,
    content_type: &str,
    cache_control: &str,
    body: Vec<u8>,
) -> tauri::http::Response<Vec<u8>> {
    tauri::http::Response::builder()
        .status(status)
        .header("Content-Type", content_type)
        .header("Cache-Control", cache_control)
        .header("Access-Control-Allow-Origin", "*")
        .body(body)
        .unwrap_or_else(|_| tauri::http::Response::new(Vec::new()))
}
