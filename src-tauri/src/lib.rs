use std::net::TcpStream;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

static SERVER_CHILD: Mutex<Option<Child>> = Mutex::new(None);

fn is_server_running() -> bool {
  if let Ok(addr) = "127.0.0.1:3000".parse() {
    TcpStream::connect_timeout(&addr, Duration::from_millis(300)).is_ok()
  } else {
    false
  }
}

fn ensure_backend_running() {
  if is_server_running() {
    return;
  }

  let child = Command::new("node")
    .arg("dist/server.cjs")
    .spawn()
    .or_else(|_| {
      Command::new("npm")
        .args(["run", "start"])
        .spawn()
    });

  if let Ok(c) = child {
    if let Ok(mut lock) = SERVER_CHILD.lock() {
      *lock = Some(c);
    }
    for _ in 0..40 {
      if is_server_running() {
        break;
      }
      thread::sleep(Duration::from_millis(100));
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
