use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use ringbuf::traits::{Consumer, Producer};
use ringbuf::{HeapCons, HeapProd};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::{self, Duration};
use tracing::{error, info, warn};

/// Maximum backoff delay between reconnection attempts (30 seconds).
const MAX_BACKOFF_SECS: u64 = 30;

/// Initial backoff delay (2 seconds).
const INITIAL_BACKOFF_SECS: u64 = 2;

/// Interval between send cycles (20ms = ~320 samples at 16kHz = 640 bytes).
const SEND_INTERVAL_MS: u64 = 20;

/// Maximum frame size to send in one TCP write (32KB — well under TCP MSS).
const MAX_FRAME_BYTES: usize = 32768;

/// Runs the TCP bridge on the tokio async runtime.
///
/// Connects to the orchestrator, sends captured PCM audio (length-prefixed frames),
/// and receives response audio. Auto-reconnects with exponential backoff on failure.
///
/// Wire protocol (both directions):
///   [payload_length: u32 little-endian][pcm_bytes: &[u8]]
pub async fn run(
    capture_cons: HeapCons<u8>,
    playback_prod: HeapProd<u8>,
    addr: &str,
    shutdown: Arc<AtomicBool>,
) {
    let mut backoff_secs = INITIAL_BACKOFF_SECS;

    // We need interior mutability for the ring buffer halves across the
    // split read/write tokio tasks. Using Arc<Mutex<>> here is fine because
    // the lock is held only briefly (memcpy into/out of a local buffer),
    // never across an await point.
    let capture_cons = Arc::new(tokio::sync::Mutex::new(capture_cons));
    let playback_prod = Arc::new(tokio::sync::Mutex::new(playback_prod));

    loop {
        if shutdown.load(Ordering::Relaxed) {
            info!("[Bridge] Shutdown flag set, exiting");
            return;
        }

        info!("[Bridge] Connecting to {}...", addr);

        match TcpStream::connect(addr).await {
            Ok(stream) => {
                info!("[Bridge] Connected to orchestrator at {}", addr);
                backoff_secs = INITIAL_BACKOFF_SECS; // Reset backoff on success

                // Disable Nagle's algorithm for low-latency sends
                if let Err(e) = stream.set_nodelay(true) {
                    warn!("[Bridge] Failed to set TCP_NODELAY: {}", e);
                }

                let (read_half, write_half) = stream.into_split();

                let send_shutdown = Arc::clone(&shutdown);
                let send_cons = Arc::clone(&capture_cons);
                let recv_shutdown = Arc::clone(&shutdown);
                let recv_prod = Arc::clone(&playback_prod);

                // Run send and receive concurrently; if either fails, reconnect.
                tokio::select! {
                    result = send_loop(write_half, send_cons, send_shutdown) => {
                        match result {
                            Ok(()) => info!("[Bridge] Send loop ended (shutdown)"),
                            Err(e) => warn!("[Bridge] Send loop error: {}", e),
                        }
                    }
                    result = recv_loop(read_half, recv_prod, recv_shutdown) => {
                        match result {
                            Ok(()) => info!("[Bridge] Recv loop ended (shutdown)"),
                            Err(e) => warn!("[Bridge] Recv loop error: {}", e),
                        }
                    }
                }

                warn!("[Bridge] Connection lost, will reconnect...");
            }
            Err(e) => {
                warn!(
                    "[Bridge] Failed to connect to {}: {}. Retrying in {}s...",
                    addr, e, backoff_secs
                );
            }
        }

        // Wait before reconnecting (with shutdown check)
        let sleep_duration = Duration::from_secs(backoff_secs);
        let mut interval = time::interval(Duration::from_millis(200));
        let deadline = time::Instant::now() + sleep_duration;

        while time::Instant::now() < deadline {
            interval.tick().await;
            if shutdown.load(Ordering::Relaxed) {
                info!("[Bridge] Shutdown during reconnect backoff");
                return;
            }
        }

        // Exponential backoff: 2 → 4 → 8 → 16 → 30 (capped)
        backoff_secs = (backoff_secs * 2).min(MAX_BACKOFF_SECS);
    }
}

/// Periodically drains captured PCM from the ring buffer and sends
/// length-prefixed frames over TCP to the orchestrator.
async fn send_loop(
    mut writer: tokio::net::tcp::OwnedWriteHalf,
    capture_cons: Arc<tokio::sync::Mutex<HeapCons<u8>>>,
    shutdown: Arc<AtomicBool>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut send_buf = vec![0u8; MAX_FRAME_BYTES];
    let mut interval = time::interval(Duration::from_millis(SEND_INTERVAL_MS));

    loop {
        interval.tick().await;

        if shutdown.load(Ordering::Relaxed) {
            return Ok(());
        }

        // Drain available bytes from capture ring buffer
        let available = {
            let mut cons = capture_cons.lock().await;
            cons.pop_slice(&mut send_buf)
        };

        if available > 0 {
            // Write length prefix (u32 LE)
            let len_bytes = (available as u32).to_le_bytes();
            writer.write_all(&len_bytes).await?;

            // Write PCM payload
            writer.write_all(&send_buf[..available]).await?;
        }
    }
}

/// Continuously reads length-prefixed PCM frames from the orchestrator
/// and pushes them into the playback ring buffer.
async fn recv_loop(
    mut reader: tokio::net::tcp::OwnedReadHalf,
    playback_prod: Arc<tokio::sync::Mutex<HeapProd<u8>>>,
    shutdown: Arc<AtomicBool>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut len_buf = [0u8; 4];
    let mut recv_buf = vec![0u8; MAX_FRAME_BYTES * 2];

    loop {
        if shutdown.load(Ordering::Relaxed) {
            return Ok(());
        }

        // Read 4-byte length prefix
        reader.read_exact(&mut len_buf).await?;
        let payload_len = u32::from_le_bytes(len_buf) as usize;

        if payload_len == 0 {
            continue;
        }

        if payload_len > recv_buf.len() {
            error!(
                "[Bridge] Received oversized frame: {} bytes (max {})",
                payload_len,
                recv_buf.len()
            );
            // Skip this frame by reading and discarding
            let mut remaining = payload_len;
            while remaining > 0 {
                let to_read = remaining.min(recv_buf.len());
                reader.read_exact(&mut recv_buf[..to_read]).await?;
                remaining -= to_read;
            }
            continue;
        }

        // Read the PCM payload
        reader.read_exact(&mut recv_buf[..payload_len]).await?;

        // Push into playback ring buffer
        let mut prod = playback_prod.lock().await;
        let written = prod.push_slice(&recv_buf[..payload_len]);
        if written < payload_len {
            warn!(
                "[Bridge] Playback buffer full, dropped {} bytes",
                payload_len - written
            );
        }
    }
}
