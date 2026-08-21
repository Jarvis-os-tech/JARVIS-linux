export type PrebuiltVoiceName = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr' | 'Aoede';

export interface PersonaAudioProfile {
  voiceName: PrebuiltVoiceName;
  gain: number;               // Master gain multiplier (e.g. 1.0 - 1.2)
  bassGainDb: number;         // Low shelf filter boost/cut in dB at 150Hz
  midGainDb: number;          // Peaking filter boost/cut in dB at 1.5kHz
  trebleGainDb: number;       // High shelf filter boost/cut in dB at 6kHz
  compressorThreshold: number;// Dynamic range threshold in dB (-50 to 0)
  compressorRatio: number;    // Dynamic compression ratio (1.0 to 20.0)
  tempoMultiplier?: number;   // Fine tempo pace characteristic
}

export interface SoundServerStatus {
  healthy: boolean;
  pipewireRunning: boolean;
  wireplumberRunning: boolean;
  pulseRunning: boolean;
  activeSink?: string;
  activeSource?: string;
  volumePercent: number;
  muted: boolean;
  driver: 'pipewire' | 'pulseaudio' | 'alsa' | 'unknown';
  diagnostics?: string;
}

export interface VoicePersona {
  id: string;
  name: string;
  role: string;
  avatarIcon: string;
  voiceName: PrebuiltVoiceName;
  systemInstruction: string;
  description: string;
  tagline: string;
  accentColor: string;
  bgGradient: string;
  personalityTraits: string[];
  audioProfile?: PersonaAudioProfile;
  primaryModel?: string;
  fallbackModel?: string;
  fallbackJustification?: string;
}

export interface ConversationMessage {
  id: string;
  sender: 'user' | 'agent' | 'system';
  text: string;
  timestamp: string;
  isFinal?: boolean;
  isStreaming?: boolean;
  personaId?: string;
  imageUrl?: string;
}

export type Message = ConversationMessage;

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'listening' | 'speaking' | 'error';

export interface AudioStats {
  latencyMs: number;
  inputVolume: number; // 0 to 100
  outputVolume: number; // 0 to 100
  packetsReceived: number;
  packetsSent: number;
  connectedTimeSeconds: number;
}

export interface AgentConfig {
  selectedPersonaId: string;
  voiceName: PrebuiltVoiceName;
  customInstruction: string;
  micSensitivity: number; // 1-10
  enableTranscription: boolean;
  enableNoiseFilter: boolean;
  model: string;
}

export interface QuickPrompt {
  id: string;
  label: string;
  prompt: string;
  iconName: string;
}

export interface WorkspaceActionItem {
  id: string;
  toolName: string;
  category: 'gmail' | 'calendar' | 'docs' | 'sheets' | 'tasks' | 'drive' | 'system' | 'hardware' | 'process' | 'network' | 'media' | 'power' | 'storage' | 'thermals';
  title: string;
  summary: string;
  status: 'started' | 'completed' | 'error';
  timestamp: string;
  resultData?: any;
  linkUrl?: string;
  error?: string;
}

export interface HardwareControlState {
  volume: {
    volumePercent: number;
    muted: boolean;
  };
  brightness: {
    brightnessPercent: number;
    connector: string;
  };
  battery: {
    available: boolean;
    percent: number | null;
    state: string;
    plugged: boolean | null;
    timeToEmpty?: string;
    timeToFull?: string;
  };
  thermals?: {
    maxTempCelsius: number;
    status: string;
    sensors: Array<{
      zone: string;
      type: string;
      tempCelsius: number;
      status: 'normal' | 'warm' | 'hot' | 'critical';
    }>;
  };
  powerProfile: string;
}

export interface WebRTCStats {
  roundTripTimeMs: number;
  jitterMs: number;
  packetsLost: number;
  bytesReceived: number;
  bytesSent: number;
  connectionState: RTCPeerConnectionState | string;
}

export type DataChannelMessageType =
  | 'persona_switch'
  | 'tool_trigger'
  | 'mute_toggle'
  | 'voice_patch'
  | 'tool_result'
  | 'telemetry'
  | 'persona_active'
  | 'latency'
  | 'system_alert'
  | 'heartbeat';

export interface DataChannelMessage {
  type: DataChannelMessageType | string;
  personaId?: string;
  toolName?: string;
  args?: Record<string, any>;
  result?: any;
  duration_ms?: number;
  muted?: boolean;
  active?: boolean;
  voiceToken?: boolean;
  timestamp?: number;
  clientTime?: number;
  serverTime?: number;
  payload?: any;
  stats?: Record<string, any>;
  error?: string;
}

export interface PersonaMetadata {
  id: 'jarvis' | 'friday' | 'ultron' | 'edith' | 'hermes';
  name: string;
  callsign: string;
  title: string;
  role: 'commander' | 'engineer' | 'cso' | 'researcher' | 'operations';
  voiceName: string;
  accentColor: string;
  domain: string;
  audioProfile?: PersonaAudioProfile;
  status: 'active_voice' | 'running_task' | 'idle';
  lastActivityTime: string;
  activeTask?: string;
}

export interface MutedRelayEvent {
  id: string;
  timestamp: string;
  sourceManagerId: string;
  sourceManagerName: string;
  rawOutput: string;
  relayedSummary: string;
  severity: 'info' | 'warning' | 'critical';
}
