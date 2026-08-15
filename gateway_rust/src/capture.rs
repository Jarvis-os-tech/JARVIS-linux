use std::error::Error;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use ringbuf::traits::Producer;
use ringbuf::HeapProd;
use tracing::{debug, error, info};

/// Runs the microphone capture loop on a dedicated OS thread.
///
/// Captures 16kHz, mono, i16 PCM from the default input device and writes
/// raw bytes into the ring buffer producer. The TCP bridge consumes these
/// bytes and streams them to the orchestrator.
pub fn run(
    mut producer: HeapProd<u8>,
    sample_rate: u32,
    shutdown: Arc<AtomicBool>,
) -> Result<(), Box<dyn Error>> {
    let host = cpal::default_host();

    let device = host
        .default_input_device()
        .ok_or("No default input audio device found")?;

    let device_name = device.name().unwrap_or_else(|_| "unknown".into());
    info!("[Capture] Input device: {}", device_name);

    // List supported configs for debugging
    if let Ok(configs) = device.supported_input_configs() {
        for config in configs {
            debug!(
                "[Capture] Supported: channels={}, rate={}-{}, format={:?}",
                config.channels(),
                config.min_sample_rate().0,
                config.max_sample_rate().0,
                config.sample_format()
            );
        }
    }

    // Build the desired config: mono, 16kHz, i16
    let desired_config = cpal::StreamConfig {
        channels: 1,
        sample_rate: cpal::SampleRate(sample_rate),
        buffer_size: cpal::BufferSize::Default,
    };

    info!(
        "[Capture] Starting stream: {}Hz, mono, i16",
        sample_rate
    );

    let stream = device.build_input_stream(
        &desired_config,
        move |data: &[i16], _info: &cpal::InputCallbackInfo| {
            // Convert i16 samples to raw bytes (little-endian) and push into ring buffer
            let bytes: &[u8] = bytemuck_cast_i16_to_u8(data);
            let written = producer.push_slice(bytes);
            if written < bytes.len() {
                // Ring buffer full — dropping samples. This is expected under
                // heavy load or when the TCP bridge is temporarily disconnected.
                debug!(
                    "[Capture] Ring buffer full, dropped {} bytes",
                    bytes.len() - written
                );
            }
        },
        move |err| {
            error!("[Capture] Stream error: {}", err);
        },
        None, // No timeout
    )?;

    stream.play()?;
    info!("[Capture] Microphone stream active");

    // Keep the thread alive until shutdown
    while !shutdown.load(Ordering::Relaxed) {
        std::thread::park_timeout(std::time::Duration::from_millis(100));
    }

    // Stream is dropped here, stopping capture
    drop(stream);
    info!("[Capture] Stopped");
    Ok(())
}

/// Safely reinterpret a slice of i16 as a slice of u8 (little-endian on LE platforms).
/// This is a zero-copy cast — no allocation.
fn bytemuck_cast_i16_to_u8(data: &[i16]) -> &[u8] {
    unsafe {
        std::slice::from_raw_parts(
            data.as_ptr() as *const u8,
            data.len() * std::mem::size_of::<i16>(),
        )
    }
}
