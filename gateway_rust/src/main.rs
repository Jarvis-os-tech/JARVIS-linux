use std::error::Error;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use clap::Parser;
use ringbuf::traits::Split;
use ringbuf::HeapRb;
use tracing::{info, warn};

mod bridge;
mod capture;
mod playback;

/// Jarvis Audio Gateway — Zero-GC, microsecond-latency Linux audio engine.
///
/// Captures microphone audio (16kHz mono PCM), streams it over TCP to the
/// Jarvis orchestrator, and plays back response audio (24kHz mono PCM)
/// through the system speakers.
#[derive(Parser, Debug)]
#[command(name = "jarvis-gateway", version, about)]
struct Args {
    /// Orchestrator host address
    #[arg(long, default_value = "127.0.0.1")]
    host: String,

    /// Orchestrator TCP port
    #[arg(long, default_value_t = 3001)]
    port: u16,

    /// Microphone capture sample rate in Hz
    #[arg(long, default_value_t = 16000)]
    capture_rate: u32,

    /// Speaker playback sample rate in Hz
    #[arg(long, default_value_t = 24000)]
    playback_rate: u32,

    /// Ring buffer capacity in bytes (default ~1 second of 16kHz i16 mono)
    #[arg(long, default_value_t = 64000)]
    buffer_size: usize,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    // Initialize structured logging (controlled by RUST_LOG env var)
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .compact()
        .init();

    let args = Args::parse();

    info!("========================================");
    info!("  J.A.R.V.I.S. Audio Gateway v{}", env!("CARGO_PKG_VERSION"));
    info!("========================================");
    info!(
        "Orchestrator target: {}:{}",
        args.host, args.port
    );
    info!(
        "Capture: {}Hz mono i16 | Playback: {}Hz mono i16",
        args.capture_rate, args.playback_rate
    );
    info!("Ring buffer: {} bytes per channel", args.buffer_size);

    // Shared shutdown flag
    let shutdown = Arc::new(AtomicBool::new(false));

    // --- Ring Buffers ---
    // Capture ring: mic capture thread (producer) → TCP bridge send loop (consumer)
    let capture_rb = HeapRb::<u8>::new(args.buffer_size);
    let (capture_prod, capture_cons) = capture_rb.split();

    // Playback ring: TCP bridge recv loop (producer) → speaker playback thread (consumer)
    let playback_rb = HeapRb::<u8>::new(args.buffer_size * 2); // larger for 24kHz
    let (playback_prod, playback_cons) = playback_rb.split();

    // --- Spawn Capture Thread (dedicated OS thread for real-time cpal) ---
    let capture_rate = args.capture_rate;
    let capture_shutdown = Arc::clone(&shutdown);
    let capture_handle = std::thread::Builder::new()
        .name("jarvis-capture".into())
        .spawn(move || {
            if let Err(e) = capture::run(capture_prod, capture_rate, capture_shutdown) {
                warn!("Capture thread exited with error: {}", e);
            }
        })?;

    // --- Spawn Playback Thread (dedicated OS thread for real-time cpal) ---
    let playback_rate = args.playback_rate;
    let playback_shutdown = Arc::clone(&shutdown);
    let playback_handle = std::thread::Builder::new()
        .name("jarvis-playback".into())
        .spawn(move || {
            if let Err(e) = playback::run(playback_cons, playback_rate, playback_shutdown) {
                warn!("Playback thread exited with error: {}", e);
            }
        })?;

    // --- Spawn TCP Bridge (on tokio async runtime) ---
    let bridge_addr = format!("{}:{}", args.host, args.port);
    let bridge_shutdown = Arc::clone(&shutdown);
    let bridge_handle = tokio::spawn(async move {
        bridge::run(capture_cons, playback_prod, &bridge_addr, bridge_shutdown).await;
    });

    // --- Wait for Ctrl+C ---
    info!("Gateway running. Press Ctrl+C to shutdown.");
    tokio::signal::ctrl_c().await?;

    info!("Shutdown signal received. Stopping...");
    shutdown.store(true, Ordering::SeqCst);

    // Give threads a moment to exit
    tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;

    // Abort the bridge task if still running
    bridge_handle.abort();
    let _ = bridge_handle.await;

    // Unpark capture/playback threads so they can check the shutdown flag
    capture_handle.thread().unpark();
    playback_handle.thread().unpark();

    let _ = capture_handle.join();
    let _ = playback_handle.join();

    info!("J.A.R.V.I.S. Audio Gateway shut down cleanly.");
    Ok(())
}
