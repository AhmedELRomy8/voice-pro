use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub platform: String,
    pub local_whisper_available: bool,
    pub local_tesseract_available: bool,
}

#[tauri::command]
fn get_app_info() -> AppInfo {
    AppInfo {
        name: "Voice & Document Tools".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        platform: std::env::consts::OS.to_string(),
        local_whisper_available: true,
        local_tesseract_available: true,
    }
}

#[tauri::command]
fn save_local_file(path: String, content: String) -> Result<bool, String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_app_info, save_local_file])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
