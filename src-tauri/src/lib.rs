#[tauri::command]
fn healthcheck() -> &'static str {
    "IPDF Tauri v2 Native Backend Active"
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![healthcheck])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
