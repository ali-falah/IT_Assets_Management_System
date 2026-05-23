use tauri::{Emitter};

#[derive(serde::Serialize)]
pub struct DeviceInfo {
    pub os: String,
    pub os_version: String,
    pub arch: String,
}

#[tauri::command]
fn get_device_info() -> DeviceInfo {
    DeviceInfo {
        os: std::env::consts::OS.to_string(),
        os_version: "Unknown".to_string(),
        arch: std::env::consts::ARCH.to_string(),
    }
}

#[tauri::command]
async fn check_connectivity() -> bool {
    use std::net::TcpStream;
    use std::time::Duration;

    TcpStream::connect_timeout(
        &"8.8.8.8:53".parse().unwrap(),
        Duration::from_secs(2),
    )
    .is_ok()
}

#[tauri::command]
fn get_app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::Resumed => {
                    let _ = window.emit("mobile-lifecycle", "resume");
                }
                tauri::WindowEvent::Suspended => {
                    let _ = window.emit("mobile-lifecycle", "pause");
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_device_info,
            check_connectivity,
            get_app_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running IT Assets Tauri application");
}
