/**
 * Jarvis WebRTC Real-Time Media & DataChannel Manager
 * 
 * Provides ultra-low latency browser-side WebRTC audio capture/playback,
 * real-time volume metering via Web Audio API, and the 'jarvis-telemetry'
 * DataChannel for instantaneous tool dispatching and persona switching.
 */

import { WebRTCStats, DataChannelMessage } from '../types';
import { calculateVolume } from './audio';

export interface WebRTCManagerOptions {
  signalingUrl?: string;
  iceServers?: RTCIceServer[];
  sampleRate?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  enableStatsPolling?: boolean;
  statsPollingIntervalMs?: number;
}

export function isWebRTCSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(
    (window.RTCPeerConnection || (window as any).webkitRTCPeerConnection) &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

export class WebRTCManager {
  // WebRTC core objects
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private remoteAudioEl: HTMLAudioElement;

  // Web Audio volume metering
  private audioContext: AudioContext | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private inputSourceNode: MediaStreamAudioSourceNode | null = null;
  private outputSourceNode: MediaStreamAudioSourceNode | null = null;
  private volumeMeterInterval: number | null = null;
  private statsInterval: any = null;

  // Connection metadata
  private clientId: string;
  private sessionId: string | null = null;
  private options: Required<WebRTCManagerOptions>;
  private isConnecting: boolean = false;

  // Callbacks
  public onRemoteAudio: ((stream: MediaStream) => void) | null = null;
  public onDataMessage: ((msg: DataChannelMessage) => void) | null = null;
  public onConnectionState: ((state: RTCPeerConnectionState | string) => void) | null = null;
  public onInputVolume: ((vol: number) => void) | null = null;
  public onOutputVolume: ((vol: number) => void) | null = null;
  public onError: ((err: Error) => void) | null = null;
  public onStats: ((stats: WebRTCStats) => void) | null = null;
  public onDataChannelState: ((state: RTCDataChannelState) => void) | null = null;

  constructor(options: WebRTCManagerOptions = {}) {
    this.options = {
      signalingUrl: options.signalingUrl || '',
      iceServers: options.iceServers || [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ],
      sampleRate: options.sampleRate || 16000,
      echoCancellation: options.echoCancellation ?? true,
      noiseSuppression: options.noiseSuppression ?? true,
      autoGainControl: options.autoGainControl ?? true,
      enableStatsPolling: options.enableStatsPolling ?? true,
      statsPollingIntervalMs: options.statsPollingIntervalMs || 1000
    };

    this.clientId = 'client_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();

    // Create hidden remote audio playback element
    this.remoteAudioEl = document.createElement('audio');
    this.remoteAudioEl.autoplay = true;
    this.remoteAudioEl.setAttribute('playsinline', 'true');
    this.remoteAudioEl.style.display = 'none';
    if (typeof document !== 'undefined' && document.body) {
      document.body.appendChild(this.remoteAudioEl);
    }
  }

  /**
   * Initializes local media, configures RTCPeerConnection, exchanges SDP offer/answer,
   * establishes the 'jarvis-telemetry' DataChannel, and begins volume & stats telemetry.
   */
  public async connect(): Promise<void> {
    if (this.isConnecting) return;
    if (this.pc && (this.pc.connectionState === 'connected' || this.pc.connectionState === 'connecting')) {
      return;
    }

    if (!isWebRTCSupported()) {
      const err = new Error('WebRTC is not supported in this browser environment');
      this.onError?.(err);
      throw err;
    }

    this.isConnecting = true;
    this.onConnectionState?.('connecting');

    try {
      // 1. Acquire microphone stream with optimized studio audio constraints
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.options.sampleRate,
          channelCount: 1,
          echoCancellation: this.options.echoCancellation,
          noiseSuppression: this.options.noiseSuppression,
          autoGainControl: this.options.autoGainControl
        },
        video: false
      });

      // 2. Initialize Web Audio Context for volume metering
      this.initAudioContext();
      if (this.audioContext && this.localStream) {
        this.inputSourceNode = this.audioContext.createMediaStreamSource(this.localStream);
        this.inputAnalyser = this.audioContext.createAnalyser();
        this.inputAnalyser.fftSize = 512;
        this.inputAnalyser.smoothingTimeConstant = 0.2;
        this.inputSourceNode.connect(this.inputAnalyser);
      }

      // 3. Create RTCPeerConnection
      const configuration: RTCConfiguration = {
        iceServers: this.options.iceServers,
        iceCandidatePoolSize: 2
      };

      const pc = new RTCPeerConnection(configuration);
      this.pc = pc;

      // 4. Attach local audio tracks
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });

      // 5. Create DataChannel for low-latency telemetry
      this.dataChannel = pc.createDataChannel('jarvis-telemetry', {
        ordered: true
      });
      this.setupDataChannel(this.dataChannel);

      // Also listen for incoming data channels
      pc.ondatachannel = (event) => {
        if (event.channel.label === 'jarvis-telemetry') {
          this.dataChannel = event.channel;
          this.setupDataChannel(this.dataChannel);
        }
      };

      // 6. Handle remote media tracks
      pc.ontrack = (event) => {
        const stream = event.streams[0] || new MediaStream([event.track]);
        this.remoteStream = stream;
        this.remoteAudioEl.srcObject = stream;
        this.remoteAudioEl.play().catch((e) => {
          console.warn('[WebRTC] Autoplay prevented, user interaction required:', e);
        });

        this.setupOutputVolumeMeter(stream);
        this.onRemoteAudio?.(stream);
      };

      // 7. Handle ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendIceCandidate(event.candidate);
        }
      };

      // 8. Track Connection State
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        this.onConnectionState?.(state);

        if (state === 'connected') {
          this.isConnecting = false;
          this.startStatsPolling();
        } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          this.isConnecting = false;
        }
      };

      pc.oniceconnectionstatechange = () => {
        const iceState = pc.iceConnectionState;
        if (iceState === 'failed') {
          pc.restartIce?.();
        }
      };

      // 9. Generate SDP Offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });
      await pc.setLocalDescription(offer);

      // 10. Perform Signaling Exchange via REST
      const signalingBase = this.options.signalingUrl.replace(/\/+$/, '');
      const offerUrl = `${signalingBase}/api/webrtc/offer`;

      const response = await fetch(offerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sdp: offer.sdp,
          type: offer.type,
          clientId: this.clientId
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Signaling offer failed (${response.status}): ${errorText}`);
      }

      const answerData = await response.json();
      if (!answerData.sdp) {
        throw new Error('Signaling response missing SDP answer');
      }

      this.sessionId = answerData.sessionId || null;

      // 11. Set Remote Description (SDP Answer)
      await pc.setRemoteDescription(
        new RTCSessionDescription({
          type: answerData.type || 'answer',
          sdp: answerData.sdp
        })
      );

      // 12. Start Volume Metering loop
      this.startVolumeMetering();
      this.isConnecting = false;

    } catch (err: any) {
      this.isConnecting = false;
      this.onConnectionState?.('error');
      const errorObj = err instanceof Error ? err : new Error(String(err));
      this.onError?.(errorObj);
      this.disconnect();
      throw errorObj;
    }
  }

  /**
   * Set up DataChannel event handling, telemetry reception, and heartbeat ping/pong
   */
  private setupDataChannel(channel: RTCDataChannel) {
    channel.onopen = () => {
      this.onDataChannelState?.('open');
      // Send initial latency measurement ping
      this.sendPing();
    };

    channel.onclose = () => {
      this.onDataChannelState?.('closed');
    };

    channel.onerror = (evt) => {
      const err = new Error(`DataChannel error: ${(evt as any).message || 'Unknown channel fault'}`);
      this.onError?.(err);
    };

    channel.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as DataChannelMessage;

        // Automatically resolve latency measurement pings
        if (msg.type === 'latency' && msg.timestamp) {
          const rtt = performance.now() - msg.timestamp;
          if (this.onStats) {
            this.getStats().then((stats) => {
              if (stats) {
                stats.roundTripTimeMs = Math.round(rtt * 10) / 10;
                this.onStats?.(stats);
              }
            });
          }
        }

        this.onDataMessage?.(msg);
      } catch (err) {
        console.warn('[WebRTC DataChannel] Failed to parse message JSON:', event.data, err);
      }
    };
  }

  /**
   * Transmit candidate to server signaling endpoint
   */
  private async sendIceCandidate(candidate: RTCIceCandidate) {
    try {
      const signalingBase = this.options.signalingUrl.replace(/\/+$/, '');
      const iceUrl = `${signalingBase}/api/webrtc/ice`;

      await fetch(iceUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: this.clientId,
          sessionId: this.sessionId,
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex
        })
      });
    } catch (err) {
      console.warn('[WebRTC] ICE candidate delivery failed:', err);
    }
  }

  /**
   * Send JSON-formatted command/telemetry message over the DataChannel
   */
  public sendCommand(cmd: DataChannelMessage | Record<string, any>): boolean {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      return false;
    }

    try {
      this.dataChannel.send(JSON.stringify(cmd));
      return true;
    } catch (err) {
      console.error('[WebRTC] Failed to send DataChannel command:', err);
      return false;
    }
  }

  /**
   * Send high-resolution latency ping to measure round-trip time
   */
  public sendPing(): void {
    this.sendCommand({
      type: 'latency',
      timestamp: performance.now(),
      clientTime: Date.now()
    });
  }

  /**
   * Retrieve real-time WebRTC network and media statistics
   */
  public async getStats(): Promise<WebRTCStats | null> {
    if (!this.pc) return null;

    try {
      const statsReport = await this.pc.getStats();
      let roundTripTimeMs = 0;
      let jitterMs = 0;
      let packetsLost = 0;
      let bytesReceived = 0;
      let bytesSent = 0;

      statsReport.forEach((report) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          if (typeof report.currentRoundTripTime === 'number') {
            roundTripTimeMs = report.currentRoundTripTime * 1000;
          } else if (typeof report.roundTripTime === 'number') {
            roundTripTimeMs = report.roundTripTime * 1000;
          }
        }

        if (report.type === 'inbound-rtp' && report.kind === 'audio') {
          if (typeof report.jitter === 'number') {
            jitterMs = report.jitter * 1000;
          }
          if (typeof report.packetsLost === 'number') {
            packetsLost += report.packetsLost;
          }
          if (typeof report.bytesReceived === 'number') {
            bytesReceived += report.bytesReceived;
          }
        }

        if (report.type === 'outbound-rtp' && report.kind === 'audio') {
          if (typeof report.bytesSent === 'number') {
            bytesSent += report.bytesSent;
          }
        }
      });

      return {
        roundTripTimeMs: Math.round(roundTripTimeMs * 10) / 10,
        jitterMs: Math.round(jitterMs * 10) / 10,
        packetsLost,
        bytesReceived,
        bytesSent,
        connectionState: this.pc.connectionState
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Initializes Web Audio Context for real-time RMS volume analysis
   */
  private initAudioContext() {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx({ sampleRate: 24000 });
      }
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  /**
   * Sets up output volume metering for remote audio stream
   */
  private setupOutputVolumeMeter(remoteStream: MediaStream) {
    if (!this.audioContext) {
      this.initAudioContext();
    }
    if (!this.audioContext) return;

    try {
      if (this.outputSourceNode) {
        this.outputSourceNode.disconnect();
      }
      this.outputSourceNode = this.audioContext.createMediaStreamSource(remoteStream);
      this.outputAnalyser = this.audioContext.createAnalyser();
      this.outputAnalyser.fftSize = 512;
      this.outputAnalyser.smoothingTimeConstant = 0.2;
      this.outputSourceNode.connect(this.outputAnalyser);
    } catch (err) {
      console.warn('[WebRTC] Output volume analyser setup warning:', err);
    }
  }

  /**
   * Starts periodic volume level calculation for input and output audio
   */
  private startVolumeMetering() {
    this.stopVolumeMetering();

    const inputDataArray = new Float32Array(256);
    const outputDataArray = new Float32Array(256);

    this.volumeMeterInterval = window.setInterval(() => {
      // Input Volume Metering
      if (this.inputAnalyser && this.onInputVolume) {
        this.inputAnalyser.getFloatTimeDomainData(inputDataArray);
        const inVol = calculateVolume(inputDataArray);
        this.onInputVolume(inVol);
      }

      // Output Volume Metering
      if (this.outputAnalyser && this.onOutputVolume) {
        this.outputAnalyser.getFloatTimeDomainData(outputDataArray);
        const outVol = calculateVolume(outputDataArray);
        this.onOutputVolume(outVol);
      }
    }, 50); // 20 FPS volume updates for responsive visualizers
  }

  private stopVolumeMetering() {
    if (this.volumeMeterInterval !== null) {
      clearInterval(this.volumeMeterInterval);
      this.volumeMeterInterval = null;
    }
  }

  /**
   * Starts periodic polling of connection statistics
   */
  private startStatsPolling() {
    this.stopStatsPolling();
    if (!this.options.enableStatsPolling) return;

    this.statsInterval = setInterval(async () => {
      const stats = await this.getStats();
      if (stats && this.onStats) {
        this.onStats(stats);
      }
    }, this.options.statsPollingIntervalMs);
  }

  private stopStatsPolling() {
    if (this.statsInterval !== null) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  /**
   * Getters for public state queries
   */
  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  public getConnectionState(): RTCPeerConnectionState | 'disconnected' {
    return this.pc ? this.pc.connectionState : 'disconnected';
  }

  public isDataChannelOpen(): boolean {
    return !!(this.dataChannel && this.dataChannel.readyState === 'open');
  }

  public getClientId(): string {
    return this.clientId;
  }

  /**
   * Closes all connections, tracks, and audio nodes cleanly
   */
  public disconnect(): void {
    this.isConnecting = false;
    this.stopVolumeMetering();
    this.stopStatsPolling();

    // Clean up media tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => {
        try { t.stop(); } catch (e) {}
      });
      this.localStream = null;
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((t) => {
        try { t.stop(); } catch (e) {}
      });
      this.remoteStream = null;
    }

    // Clean up audio nodes
    if (this.inputSourceNode) {
      try { this.inputSourceNode.disconnect(); } catch (e) {}
      this.inputSourceNode = null;
    }
    if (this.outputSourceNode) {
      try { this.outputSourceNode.disconnect(); } catch (e) {}
      this.outputSourceNode = null;
    }
    if (this.audioContext) {
      try { this.audioContext.close(); } catch (e) {}
      this.audioContext = null;
    }

    // Clean up WebRTC objects
    if (this.dataChannel) {
      try { this.dataChannel.close(); } catch (e) {}
      this.dataChannel = null;
    }

    if (this.pc) {
      try { this.pc.close(); } catch (e) {}
      this.pc = null;
    }

    // Clean up remote audio element
    if (this.remoteAudioEl) {
      this.remoteAudioEl.srcObject = null;
      this.remoteAudioEl.pause();
    }

    this.onConnectionState?.('disconnected');
    this.onInputVolume?.(0);
    this.onOutputVolume?.(0);
  }
}
