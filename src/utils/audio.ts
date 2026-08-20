import { PersonaAudioProfile } from '../types';

/**
 * Utility functions for Web Audio API PCM capture, base64 encoding/decoding,
 * gapless audio queue playback at 24kHz, and volume visualization metering.
 */

export function resampleTo16k(buffer: Float32Array, origSampleRate: number): Float32Array {
  if (!buffer || buffer.length === 0) return new Float32Array(0);
  if (origSampleRate === 16000) return buffer;
  const ratio = origSampleRate / 16000;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const origIndex = i * ratio;
    const indexLow = Math.floor(origIndex);
    const indexHigh = Math.min(indexLow + 1, buffer.length - 1);
    const fraction = origIndex - indexLow;
    result[i] = buffer[indexLow] * (1 - fraction) + buffer[indexHigh] * fraction;
  }
  return result;
}

export function float32ToInt16Base64(buffer: Float32Array): string {
  const l = buffer.length;
  const int16Array = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  const bytes = new Uint8Array(int16Array.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

export function base64ToAudioBuffer(base64: string, ctx: AudioContext): AudioBuffer {
  const binary = atob(base64);
  const len = binary.length;
  const numSamples = Math.floor(len / 2);
  const float32 = new Float32Array(numSamples);

  // Decode 16-bit little-endian PCM to Float32 [-1.0, 1.0] without per-chunk boundary windowing
  // Raw streaming PCM chunks from Gemini Live are continuous waveforms that must be stitched gaplessly
  for (let i = 0; i < numSamples; i++) {
    const low = binary.charCodeAt(i * 2);
    const high = binary.charCodeAt(i * 2 + 1);
    let sample = (high << 8) | low;
    if (sample >= 0x8000) sample -= 0x10000;
    float32[i] = sample / 32768.0;
  }

  const buffer = ctx.createBuffer(1, numSamples, 24000);
  buffer.getChannelData(0).set(float32);
  return buffer;
}

export function calculateVolume(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  const rms = Math.sqrt(sum / (buffer.length || 1));
  return Math.min(100, Math.round(rms * 350));
}

/**
 * Audio Queue Manager with Real-Time DSP Voice Shaping and Resilient Sound-Server Watchdog
 */
export class AudioQueuePlayer {
  private ctx: AudioContext | null = null;
  private nextStartTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private onVolumeChange?: (volume: number) => void;
  private onPlaybackStateChange?: (isPlaying: boolean) => void;

  // DSP Nodes for Studio-Quality Human Voice Warmth & Clarity
  private personaGainNode: GainNode | null = null;
  private bassFilterNode: BiquadFilterNode | null = null;
  private midFilterNode: BiquadFilterNode | null = null;
  private trebleFilterNode: BiquadFilterNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private masterGainNode: GainNode | null = null;

  private currentProfile: PersonaAudioProfile | null = null;
  private watchdogTimer: any = null;
  private lastPlaybackEndTimeMs = 0;
  private lastPlaybackEndAudioTime = 0;
  private isBufferingInitial = true;

  constructor(onVolumeChange?: (vol: number) => void, onPlaybackStateChange?: (isPlaying: boolean) => void) {
    this.onVolumeChange = onVolumeChange;
    this.onPlaybackStateChange = onPlaybackStateChange;
  }

  private initDspGraph(ctx: AudioContext): void {
    try {
      this.personaGainNode = ctx.createGain();
      this.bassFilterNode = ctx.createBiquadFilter();
      this.bassFilterNode.type = 'lowshelf';
      this.bassFilterNode.frequency.value = 220; // 220Hz warm chest resonance

      this.midFilterNode = ctx.createBiquadFilter();
      this.midFilterNode.type = 'peaking';
      this.midFilterNode.frequency.value = 2800; // 2.8kHz vocal clarity & presence
      this.midFilterNode.Q.value = 1.0;

      this.trebleFilterNode = ctx.createBiquadFilter();
      this.trebleFilterNode.type = 'highshelf';
      this.trebleFilterNode.frequency.value = 7500; // 7.5kHz air brilliance

      this.compressorNode = ctx.createDynamicsCompressor();
      this.compressorNode.threshold.value = -20; // Soft knee threshold
      this.compressorNode.knee.value = 12; // Smooth curve transition
      this.compressorNode.ratio.value = 2.5; // Natural vocal compression
      this.compressorNode.attack.value = 0.005; // Fast 5ms attack
      this.compressorNode.release.value = 0.180; // 180ms smooth release

      this.masterGainNode = ctx.createGain();
      this.masterGainNode.gain.value = 0.92; // Dedicated 1.5dB output headroom protection

      // Audio Graph Pipeline: Source -> Persona Gain -> Low Shelf -> Mid -> High Shelf -> Compressor -> Master Headroom Gain -> Destination
      this.personaGainNode.connect(this.bassFilterNode);
      this.bassFilterNode.connect(this.midFilterNode);
      this.midFilterNode.connect(this.trebleFilterNode);
      this.trebleFilterNode.connect(this.compressorNode);
      this.compressorNode.connect(this.masterGainNode);
      this.masterGainNode.connect(ctx.destination);

      if (this.currentProfile) {
        this.applyProfileDirect(this.currentProfile);
      }
    } catch (err) {
      console.warn('[AudioQueuePlayer] Error initializing DSP graph:', err);
    }
  }

  public getAudioContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      // Use system native sample rate (e.g. 48kHz) to prevent Linux PipeWire/ALSA clock drift
      this.ctx = new AudioCtx();
      this.initDspGraph(this.ctx);

      // Sound Server Watchdog: Listen for PipeWire/ALSA server disconnects or suspend states
      this.ctx.onstatechange = () => {
        if (this.ctx?.state === 'suspended' || (this.ctx as any)?.state === 'interrupted') {
          console.warn('[AudioQueuePlayer] AudioContext suspended or interrupted by sound server. Auto-resuming...');
          this.ctx.resume().catch((e) => console.warn('Resume failed:', e));
        }
      };

      this.startWatchdog();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  private startWatchdog(): void {
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    this.watchdogTimer = setInterval(() => {
      if (this.ctx && (this.ctx.state === 'suspended' || (this.ctx as any)?.state === 'interrupted')) {
        this.ctx.resume().catch(() => {});
      }
    }, 2500);
  }

  public setAudioProfile(profile: PersonaAudioProfile): void {
    this.currentProfile = profile;
    this.applyProfileDirect(profile);
  }

  private applyProfileDirect(profile: PersonaAudioProfile): void {
    if (!this.ctx || this.ctx.state === 'closed') return;
    const now = this.ctx.currentTime;
    const ramp = 0.05; // 50ms smooth transition to prevent pops

    try {
      if (this.personaGainNode) {
        this.personaGainNode.gain.cancelScheduledValues(now);
        this.personaGainNode.gain.setTargetAtTime(profile.gain || 0.98, now, ramp);
      }
      if (this.bassFilterNode) {
        this.bassFilterNode.gain.cancelScheduledValues(now);
        this.bassFilterNode.gain.setTargetAtTime(profile.bassGainDb ?? 0, now, ramp);
      }
      if (this.midFilterNode) {
        this.midFilterNode.gain.cancelScheduledValues(now);
        this.midFilterNode.gain.setTargetAtTime(profile.midGainDb ?? 0, now, ramp);
      }
      if (this.trebleFilterNode) {
        this.trebleFilterNode.gain.cancelScheduledValues(now);
        this.trebleFilterNode.gain.setTargetAtTime(profile.trebleGainDb ?? 0, now, ramp);
      }
      if (this.compressorNode) {
        this.compressorNode.threshold.cancelScheduledValues(now);
        this.compressorNode.threshold.setTargetAtTime(profile.compressorThreshold ?? -20, now, ramp);
        this.compressorNode.ratio.cancelScheduledValues(now);
        this.compressorNode.ratio.setTargetAtTime(profile.compressorRatio ?? 2.5, now, ramp);
      }
    } catch (err) {
      console.warn('[AudioQueuePlayer] Failed to apply DSP audio profile:', err);
    }
  }

  public playChunk(base64Pcm: string) {
    return this.enqueueChunk(base64Pcm);
  }

  public enqueueChunk(base64Pcm: string) {
    const ctx = this.getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    try {
      const audioBuffer = base64ToAudioBuffer(base64Pcm, ctx);
      const channelData = audioBuffer.getChannelData(0);
      const vol = calculateVolume(channelData);
      if (this.onVolumeChange) {
        this.onVolumeChange(vol);
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      // Route through persona DSP node chain
      if (this.personaGainNode) {
        source.connect(this.personaGainNode);
      } else {
        source.connect(ctx.destination);
      }

      const currentTime = ctx.currentTime;
      const isQueueIdle = this.activeSources.length === 0;

      // Adaptive Jitter Buffer:
      // 1. If starting a fresh utterance or queue idle: give 45ms initial lead cushion to absorb packet arrival variance
      // 2. If small underrun occurred: resume with 15ms smoothing lead to prevent cascading stutter
      // 3. Otherwise: schedule seamlessly at exact end of previous chunk (gapless playback)
      if (isQueueIdle || this.isBufferingInitial || this.nextStartTime <= currentTime) {
        this.nextStartTime = currentTime + 0.045;
        this.isBufferingInitial = false;
      } else if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime + 0.015;
      }

      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
      this.activeSources.push(source);

      if (this.onPlaybackStateChange && this.activeSources.length === 1) {
        this.onPlaybackStateChange(true);
      }

      source.onended = () => {
        const idx = this.activeSources.indexOf(source);
        if (idx !== -1) {
          this.activeSources.splice(idx, 1);
        }
        if (this.activeSources.length === 0) {
          this.lastPlaybackEndTimeMs = Date.now();
          this.lastPlaybackEndAudioTime = ctx.currentTime;
          this.isBufferingInitial = true;
          this.nextStartTime = 0;
          if (this.onPlaybackStateChange) {
            this.onPlaybackStateChange(false);
          }
          if (this.onVolumeChange) {
            this.onVolumeChange(0);
          }
        }
      };
    } catch (err) {
      console.error('Error playing audio chunk:', err);
    }
  }

  public isPlaying(): boolean {
    if (this.activeSources.length > 0) return true;
    if (this.ctx && this.nextStartTime > this.ctx.currentTime) return true;
    return false;
  }

  public isEchoSuppressionActive(cooldownMs = 350): boolean {
    if (this.isPlaying()) return true;
    return Date.now() - this.lastPlaybackEndTimeMs < cooldownMs;
  }

  public stopAndClear() {
    this.activeSources.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // ignore
      }
    });
    this.activeSources = [];
    this.lastPlaybackEndTime = 0;
    this.isBufferingInitial = true;
    if (this.ctx) {
      this.nextStartTime = this.ctx.currentTime;
    }
    if (this.onPlaybackStateChange) {
      this.onPlaybackStateChange(false);
    }
    if (this.onVolumeChange) {
      this.onVolumeChange(0);
    }
  }

  public close() {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    this.stopAndClear();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.personaGainNode = null;
    this.bassFilterNode = null;
    this.midFilterNode = null;
    this.trebleFilterNode = null;
    this.compressorNode = null;
    this.masterGainNode = null;
  }
}
