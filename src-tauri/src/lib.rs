use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

#[cfg(target_os = "linux")]
use tauri::Manager;
#[cfg(target_os = "linux")]
use webkit2gtk::*;

static SERVER_CHILD: Mutex<Option<Child>> = Mutex::new(None);

fn is_server_running() -> bool {
  if let Ok(addr) = "127.0.0.1:3000".parse() {
    TcpStream::connect_timeout(&addr, Duration::from_millis(150)).is_ok()
  } else {
    false
  }
}

fn get_project_dir() -> PathBuf {
  if let Ok(dir) = std::env::var("JARVIS_DIR") {
    let p = PathBuf::from(dir);
    if p.join("dist/server.cjs").exists() || p.join("package.json").exists() {
      return p;
    }
  }

  if let Ok(p) = std::env::current_dir() {
    if p.join("dist/server.cjs").exists() || p.join("package.json").exists() {
      return p;
    }
  }

  let default_path = PathBuf::from("/home/gopi/Downloads/JARVIS-V0");
  if default_path.join("dist/server.cjs").exists() {
    return default_path;
  }

  if let Ok(home) = std::env::var("HOME") {
    let home_path = PathBuf::from(home).join("Downloads/JARVIS-V0");
    if home_path.exists() {
      return home_path;
    }
  }

  default_path
}

fn ensure_backend_running() {
  if is_server_running() {
    return;
  }

  let project_dir = get_project_dir();
  let server_script = project_dir.join("dist/server.cjs");

  let child = if server_script.exists() {
    Command::new("node")
      .arg(&server_script)
      .current_dir(&project_dir)
      .env("IS_TAURI", "1")
      .env("JARVIS_DESKTOP", "1")
      .spawn()
  } else {
    Command::new("npm")
      .args(["run", "start"])
      .current_dir(&project_dir)
      .env("IS_TAURI", "1")
      .env("JARVIS_DESKTOP", "1")
      .spawn()
  };

  if let Ok(c) = child {
    if let Ok(mut lock) = SERVER_CHILD.lock() {
      *lock = Some(c);
    }
    for _ in 0..20 {
      if is_server_running() {
        break;
      }
      thread::sleep(Duration::from_millis(50));
    }
  }
}

fn cleanup_backend() {
  if let Ok(mut lock) = SERVER_CHILD.lock() {
    if let Some(mut child) = lock.take() {
      let _ = child.kill();
      let _ = child.wait();
    }
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  ensure_backend_running();

  let app = tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      #[cfg(target_os = "linux")]
      {
        for (_label, window) in app.webview_windows() {
          let _ = window.with_webview(|webview| {
            let webview_gtk = webview.inner();
            if let Some(settings) = webview_gtk.settings() {
              settings.set_enable_webrtc(true);
              settings.set_enable_media_stream(true);
              settings.set_enable_mock_capture_devices(false);
              settings.set_media_playback_allows_inline(true);
              settings.set_media_playback_requires_user_gesture(false);
            }
            webview_gtk.connect_permission_request(|_wv, request| {
              request.allow();
              true
            });
          });
        }
      }

      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(|_app_handle, event| {
    if let tauri::RunEvent::ExitRequested { .. } = event {
      cleanup_backend();
    }
  });
}
