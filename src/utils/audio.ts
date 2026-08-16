import { PersonaAudioProfile } from '../types';

/**
 * Utility functions for Web Audio API PCM capture, base64 encoding/decoding,
 * gapless audio queue playback at 24kHz, and volume visualization metering.
 */

export function float32ToInt16Base64(buffer: Float32Array): string {
  const l = buffer.length;
  const int16Array = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  let binary = '';
  const bytes = new Uint8Array(int16Array.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToAudioBuffer(base64: string, ctx: AudioContext): AudioBuffer {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768.0;
  }
  const buffer = ctx.createBuffer(1, float32.length, 24000);
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

  // DSP Nodes
  private personaGainNode: GainNode | null = null;
  private bassFilterNode: BiquadFilterNode | null = null;
  private midFilterNode: BiquadFilterNode | null = null;
  private trebleFilterNode: BiquadFilterNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private masterGainNode: GainNode | null = null;

  private currentProfile: PersonaAudioProfile | null = null;
  private watchdogTimer: any = null;

  constructor(onVolumeChange?: (vol: number) => void, onPlaybackStateChange?: (isPlaying: boolean) => void) {
    this.onVolumeChange = onVolumeChange;
    this.onPlaybackStateChange = onPlaybackStateChange;
  }

  private initDspGraph(ctx: AudioContext): void {
    try {
      this.personaGainNode = ctx.createGain();
      this.personaGainNode.gain.value = 1.0;

      // Bass EQ (Low Shelf @ 150Hz)
      this.bassFilterNode = ctx.createBiquadFilter();
      this.bassFilterNode.type = 'lowshelf';
      this.bassFilterNode.frequency.value = 150;
      this.bassFilterNode.gain.value = 0.0;

      // Mid EQ (Peaking @ 1500Hz)
      this.midFilterNode = ctx.createBiquadFilter();
      this.midFilterNode.type = 'peaking';
      this.midFilterNode.frequency.value = 1500;
      this.midFilterNode.Q.value = 1.0;
      this.midFilterNode.gain.value = 0.0;

      // Treble EQ (High Shelf @ 6000Hz)
      this.trebleFilterNode = ctx.createBiquadFilter();
      this.trebleFilterNode.type = 'highshelf';
      this.trebleFilterNode.frequency.value = 6000;
      this.trebleFilterNode.gain.value = 0.0;

      // Dynamics Compressor (Vocal Clarity & Anti-clipping)
      this.compressorNode = ctx.createDynamicsCompressor();
      this.compressorNode.threshold.value = -24;
      this.compressorNode.knee.value = 12;
      this.compressorNode.ratio.value = 3.0;
      this.compressorNode.attack.value = 0.003;
      this.compressorNode.release.value = 0.25;

      // Master Gain
      this.masterGainNode = ctx.createGain();
      this.masterGainNode.gain.value = 1.0;

      // Connect DSP Chain: personaGain -> bass -> mid -> treble -> compressor -> masterGain -> destination
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
      this.ctx = new AudioCtx({ sampleRate: 24000 });
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
        this.personaGainNode.gain.setTargetAtTime(profile.gain || 1.0, now, ramp);
      }
      if (this.bassFilterNode) {
        this.bassFilterNode.gain.cancelScheduledValues(now);
        this.bassFilterNode.gain.setTargetAtTime(profile.bassGainDb || 0.0, now, ramp);
      }
      if (this.midFilterNode) {
        this.midFilterNode.gain.cancelScheduledValues(now);
        this.midFilterNode.gain.setTargetAtTime(profile.midGainDb || 0.0, now, ramp);
      }
      if (this.trebleFilterNode) {
        this.trebleFilterNode.gain.cancelScheduledValues(now);
        this.trebleFilterNode.gain.setTargetAtTime(profile.trebleGainDb || 0.0, now, ramp);
      }
      if (this.compressorNode) {
        this.compressorNode.threshold.cancelScheduledValues(now);
        this.compressorNode.threshold.setTargetAtTime(profile.compressorThreshold ?? -24, now, ramp);
        this.compressorNode.ratio.cancelScheduledValues(now);
        this.compressorNode.ratio.setTargetAtTime(profile.compressorRatio ?? 3.0, now, ramp);
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
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime + 0.01; // small buffer to prevent click
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
