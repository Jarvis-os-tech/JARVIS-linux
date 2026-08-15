use std::error::Error;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use ringbuf::traits::Consumer;
use ringbuf::HeapCons;
use tracing::{debug, error, info};

/// Runs the speaker playback loop on a dedicated OS thread.
///
/// Reads raw 24kHz, mono, i16 PCM bytes from the ring buffer consumer
/// (fed by the TCP bridge) and plays them through the default output device.
/// Writes silence when the buffer is empty.
pub fn run(
    mut consumer: HeapCons<u8>,
    sample_rate: u32,
    shutdown: Arc<AtomicBool>,
) -> Result<(), Box<dyn Error>> {
    let host = cpal::default_host();

    let device = host
        .default_output_device()
        .ok_or("No default output audio device found")?;

    let device_name = device.name().unwrap_or_else(|_| "unknown".into());
    info!("[Playback] Output device: {}", device_name);

    // List supported configs for debugging
    if let Ok(configs) = device.supported_output_configs() {
        for config in configs {
            debug!(
                "[Playback] Supported: channels={}, rate={}-{}, format={:?}",
                config.channels(),
                config.min_sample_rate().0,
                config.max_sample_rate().0,
                config.sample_format()
            );
        }
    }

    // Build the desired config: mono, 24kHz, i16
    let desired_config = cpal::StreamConfig {
        channels: 1,
        sample_rate: cpal::SampleRate(sample_rate),
        buffer_size: cpal::BufferSize::Default,
    };

    info!(
        "[Playback] Starting stream: {}Hz, mono, i16",
        sample_rate
    );

    let stream = device.build_output_stream(
        &desired_config,
        move |data: &mut [i16], _info: &cpal::OutputCallbackInfo| {
            // We need (data.len() * 2) bytes from the ring buffer (each i16 = 2 bytes)
            let bytes_needed = data.len() * std::mem::size_of::<i16>();
            let output_bytes = u8_slice_from_i16_mut(data);

            let read = consumer.pop_slice(&mut output_bytes[..bytes_needed]);

            if read < bytes_needed {
                // Not enough audio data — fill remainder with silence
                for byte in &mut output_bytes[read..bytes_needed] {
                    *byte = 0;
                }
                if read == 0 {
                    // Completely empty — normal when no audio is being received
                } else {
                    debug!(
                        "[Playback] Buffer underrun: got {} of {} bytes",
                        read, bytes_needed
                    );
                }
            }
        },
        move |err| {
            error!("[Playback] Stream error: {}", err);
        },
        None, // No timeout
    )?;

    stream.play()?;
    info!("[Playback] Speaker stream active");

    // Keep the thread alive until shutdown
    while !shutdown.load(Ordering::Relaxed) {
        std::thread::park_timeout(std::time::Duration::from_millis(100));
    }

    drop(stream);
    info!("[Playback] Stopped");
    Ok(())
}

/// Safely reinterpret a mutable slice of i16 as a mutable slice of u8.
/// Zero-copy — the underlying memory is shared.
fn u8_slice_from_i16_mut(data: &mut [i16]) -> &mut [u8] {
    unsafe {
        std::slice::from_raw_parts_mut(
            data.as_mut_ptr() as *mut u8,
            data.len() * std::mem::size_of::<i16>(),
        )
    }
}
