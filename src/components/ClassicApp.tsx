import React, { useState, useEffect, useRef } from 'react';
import { PERSONAS, VOICE_TRANSFER_SYSTEM_INSTRUCTION, TELGISH_LANGUAGE_SYSTEM_INSTRUCTION, detectVoiceTransfer, getPersonaAudioProfile } from '../data/personas';
import { VoicePersona, ConnectionState, ConversationMessage, AgentConfig, WorkspaceActionItem } from '../types';
import { Header } from './Header';
import { VoiceVisualizer } from './VoiceVisualizer';
import { PersonaCard } from './PersonaCard';
import { SettingsModal } from './SettingsModal';
import { VisionPreviewModal } from './VisionPreviewModal';
import { WorkspaceHub } from './WorkspaceHub';
import { AgentMemoryModal } from './AgentMemoryModal';
import { SystemControlModal } from './SystemControlModal';
import { NluInsightModal } from './NluInsightModal';
import { MultiAgentStatusModal } from './MultiAgentStatusModal';
import { loadAgentMemory, saveAgentMemory, formatMemoryForSystemInstruction, autoExtractMemoriesFromText, AgentMemoryState } from '../utils/agent_memory';
import { analyzeUtterance, NluAnalysisResult } from '../utils/nlu_engine';
import { PersonaMetadata, MutedRelayEvent } from '../utils/multi_agent_orchestrator';
import { AudioQueuePlayer, float32ToInt16Base64, resampleTo16k, calculateVolume } from '../utils/audio';
import { assistantGreeterInstance } from '../utils/automatic_greeting';
import { AlertCircle, RefreshCw, CheckCircle2, ExternalLink, Sparkles, X, Send, Brain, Zap, Tag, Radio, Shield } from 'lucide-react';

interface ClassicAppProps {
  onSwitchToModern?: () => void;
}

export function ClassicApp({ onSwitchToModern }: ClassicAppProps) {
  const [selectedPersona, setSelectedPersona] = useState<VoicePersona>(PERSONAS[0]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [isMuted, setIsMuted] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [isNluModalOpen, setIsNluModalOpen] = useState(false);
  const [isSystemControlOpen, setIsSystemControlOpen] = useState(false);
  const [isOrchestratorOpen, setIsOrchestratorOpen] = useState(false);
  const [orchestratorPersonas, setOrchestratorPersonas] = useState<PersonaMetadata[]>([]);
  const [mutedRelayEvents, setMutedRelayEvents] = useState<MutedRelayEvent[]>([]);
  const [activeOrchestratorPersonaId, setActiveOrchestratorPersonaId] = useState<string>('jarvis');
  const [mutedRelayToast, setMutedRelayToast] = useState<MutedRelayEvent | null>(null);
  const [latestNluResult, setLatestNluResult] = useState<NluAnalysisResult | null>(null);
  const [liveBatteryPercent, setLiveBatteryPercent] = useState<number | null>(null);
  const [liveBrightness, setLiveBrightness] = useState<number | null>(null);
  const [liveVolume, setLiveVolume] = useState<{ volumePercent: number; muted: boolean }>({ volumePercent: 75, muted: false });
  const [agentMemoryState, setAgentMemoryState] = useState<AgentMemoryState>(loadAgentMemory());
  const [workspaceActions, setWorkspaceActions] = useState<WorkspaceActionItem[]>([]);
  const [latestActionToast, setLatestActionToast] = useState<WorkspaceActionItem | null>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string>(localStorage.getItem('g_access_token') || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number>(45);
  const [textInput, setTextInput] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch initial Orchestrator status
  useEffect(() => {
    fetch('/api/orchestrator/status')
      .then(r => r.json())
      .then(data => {
        if (data?.personas) setOrchestratorPersonas(data.personas);
        if (data?.activePersonaId) setActiveOrchestratorPersonaId(data.activePersonaId);
        if (data?.mutedRelayEvents) setMutedRelayEvents(data.mutedRelayEvents);
      })
      .catch(e => console.warn('Failed to fetch orchestrator status:', e));
  }, []);

  // Poll system hardware telemetry periodically for top header indicator
  useEffect(() => {
    const fetchHardwareTelemetry = () => {
      fetch('/api/system/hardware')
        .then(r => r.json())
        .then(data => {
          if (data?.battery?.percent !== undefined) {
            setLiveBatteryPercent(data.battery.percent);
          }
          if (data?.brightness?.brightnessPercent !== undefined) {
            setLiveBrightness(data.brightness.brightnessPercent);
          }
          if (data?.volume?.volumePercent !== undefined) {
            setLiveVolume(data.volume);
          }
        })
        .catch(() => {});
    };
    fetchHardwareTelemetry();
    const interval = setInterval(fetchHardwareTelemetry, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-dismiss Workspace Action Toast after 8 seconds
  useEffect(() => {
    if (latestActionToast) {
      const timer = setTimeout(() => {
        setLatestActionToast(null);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [latestActionToast]);

  const [inputVolume, setInputVolume] = useState<number>(0);
  const [outputVolume, setOutputVolume] = useState<number>(0);

  const [isVisionActive, setIsVisionActive] = useState(false);
  const [visionMode, setVisionMode] = useState<'camera' | 'screen' | null>(null);
  const [visionStream, setVisionStream] = useState<MediaStream | null>(null);
  const [isLiveStreaming, setIsLiveStreaming] = useState(false);

  const isStartingVisionRef = useRef(false);

  const stopVision = () => {
    if (visionStream) {
      visionStream.getTracks().forEach(track => track.stop());
      setVisionStream(null);
    }
    setIsVisionActive(false);
    setVisionMode(null);
    setIsLiveStreaming(false);
    isStartingVisionRef.current = false;
  };

  const startVision = async (mode: 'camera' | 'screen') => {
    // Guard against duplicate / concurrent browser selection prompts
    if (isStartingVisionRef.current) {
      console.log(`[Vision] Activation already in progress for ${mode}, skipping duplicate call.`);
      return;
    }

    // If stream is already active for this mode, do not prompt the user again
    if (
      visionStream &&
      visionStream.active &&
      visionStream.getVideoTracks().some(t => t.readyState === 'live') &&
      visionMode === mode
    ) {
      console.log(`[Vision] ${mode} is already streaming, skipping prompt.`);
      setIsVisionActive(true);
      setIsLiveStreaming(true);
      return;
    }

    isStartingVisionRef.current = true;

    try {
      if (visionStream) {
        visionStream.getTracks().forEach(track => track.stop());
        setVisionStream(null);
      }

      let stream: MediaStream;
      if (mode === 'camera') {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
      } else {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'monitor' } } as any);
      }

      setVisionStream(stream);
      setVisionMode(mode);
      setIsVisionActive(true);
      setIsLiveStreaming(true);

      stream.getVideoTracks()[0].onended = () => {
        stopVision();
      };
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
        console.log(`[Vision] User cancelled ${mode} selection.`);
      } else {
        console.error("Vision mode access failed:", err);
        setErrorMsg(`Failed to start ${mode} vision: ${err.message || 'Permission denied'}`);
      }
    } finally {
      isStartingVisionRef.current = false;
    }
  };

  const handleToggleVision = (mode: 'camera' | 'screen') => {
    if (isVisionActive && visionMode === mode) {
      stopVision();
    } else {
      startVision(mode);
    }
  };

  const handleCaptureAndSend = (base64Image: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'image',
        image: base64Image,
        mimeType: 'image/jpeg'
      }));
    }
    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        sender: 'user',
        text: `[Sent ${visionMode || 'live stream'} snapshot to ${selectedPersona.name}]`,
        imageUrl: `data:image/jpeg;base64,${base64Image}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const handleLiveStreamFrame = (base64Image: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      if (wsRef.current.bufferedAmount > 65536) {
        return; // Drop frame if congested to maintain sub-50ms audio latency
      }
      wsRef.current.send(JSON.stringify({
        type: 'image',
        image: base64Image,
        mimeType: 'image/jpeg'
      }));
    }
  };

  const [messages, setMessages] = useState<ConversationMessage[]>([]);

  const [agentConfig, setAgentConfig] = useState<AgentConfig>({
    selectedPersonaId: PERSONAS[0].id,
    voiceName: PERSONAS[0].voiceName,
    customInstruction: '',
    micSensitivity: 5,
    enableTranscription: true,
    enableNoiseFilter: true,
    model: 'gemini-3.1-flash-live-preview'
  });

  const wsRef = useRef<WebSocket | null>(null);
  const audioQueuePlayerRef = useRef<AudioQueuePlayer | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const isMutedRef = useRef(isMuted);
  const lastAudioProcessTimeRef = useRef<number>(Date.now());

  // Keep refs in sync with state for event listeners
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Initialize AudioQueuePlayer for output playback with continuous watchdog
  useEffect(() => {
    audioQueuePlayerRef.current = new AudioQueuePlayer(
      (vol) => setOutputVolume(vol),
      (isPlaying) => {
        if (isPlaying) {
          setConnectionState((prev) => (prev !== 'disconnected' && prev !== 'error' ? 'speaking' : prev));
        } else {
          setConnectionState((prev) => (prev === 'speaking' ? 'listening' : prev));
          if (
            inputAudioCtxRef.current &&
            (inputAudioCtxRef.current.state === 'suspended' || (inputAudioCtxRef.current as any).state === 'interrupted')
          ) {
            inputAudioCtxRef.current.resume().catch(() => {});
          }
        }
      }
    );

    const watchdogTimer = setInterval(() => {
      if (
        micStreamRef.current &&
        inputAudioCtxRef.current &&
        !isMutedRef.current &&
        wsRef.current &&
        wsRef.current.readyState === WebSocket.OPEN
      ) {
        if (
          inputAudioCtxRef.current.state === 'suspended' ||
          (inputAudioCtxRef.current as any).state === 'interrupted'
        ) {
          inputAudioCtxRef.current.resume().catch(() => {});
        }

        const tracks = micStreamRef.current.getAudioTracks();
        const isTrackDead = tracks.length === 0 || !tracks.some((t) => t.readyState === 'live' && t.enabled);
        if (isTrackDead && Date.now() - lastAudioProcessTimeRef.current > 3000) {
          console.warn('[ClassicApp] Microphone track interrupted. Auto-recovering mic stream...');
          startMicStream().catch(() => {});
        }
      }
    }, 1000);

    return () => {
      clearInterval(watchdogTimer);
      audioQueuePlayerRef.current?.close();
      stopMicStream();
      closeWebSocket();
    };
  }, []);

  const appendTranscriptChunk = (sender: 'user' | 'agent', textChunk: string) => {
    if (sender === 'user' && textChunk) {
      setAgentMemoryState((prevMem) => autoExtractMemoriesFromText(textChunk, prevMem));
      const nluRes = analyzeUtterance(textChunk);
      setLatestNluResult(nluRes);

      // Safety Net Voice Transfer Interceptor
      const transferCheck = detectVoiceTransfer(textChunk, selectedPersona.id);
      if (transferCheck.isTransfer && transferCheck.targetId) {
        const matching = PERSONAS.find(p => p.id === transferCheck.targetId);
        if (matching && matching.id !== selectedPersona.id) {
          console.log(`[Safety Net Interceptor] Swapping voice persona to ${matching.name}`);
          performVoiceTransfer(matching);
        }
      }
    }
    setMessages((prev) => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg && lastMsg.sender === sender && !lastMsg.isFinal) {
        return [
          ...prev.slice(0, -1),
          {
            ...lastMsg,
            text: lastMsg.text + textChunk,
            isStreaming: true,
            personaId: sender === 'agent' ? selectedPersona.id : undefined
          }
        ];
      } else {
        return [
          ...prev,
          {
            id: `${sender}-${Date.now()}`,
            sender,
            text: textChunk,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isStreaming: true,
            personaId: sender === 'agent' ? selectedPersona.id : undefined
          }
        ];
      }
    });
  };

  const finalizeLastMessage = () => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((m) => (m.isStreaming || !m.isFinal ? { ...m, isFinal: true, isStreaming: false } : m));
    });
  };

  const stopMicStream = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close();
      inputAudioCtxRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    setInputVolume(0);
  };

  const startMicStream = async () => {
    try {
      stopMicStream();
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error("Microphone capture API is unsupported in this browser.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      micStreamRef.current = stream;

      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          console.warn('[ClassicApp] Microphone track ended unexpectedly. Auto-recovering...');
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !isMutedRef.current) {
            startMicStream().catch(() => {});
          }
        };
      });

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      let inputAudioCtx: AudioContext;
      try {
        inputAudioCtx = new AudioCtx({ sampleRate: 16000 });
      } catch {
        inputAudioCtx = new AudioCtx();
      }
      inputAudioCtxRef.current = inputAudioCtx;

      inputAudioCtx.onstatechange = () => {
        if (inputAudioCtx.state === "suspended" || (inputAudioCtx as any).state === "interrupted") {
          inputAudioCtx.resume().catch(() => {});
        }
      };

      if (inputAudioCtx.state === "suspended") {
        await inputAudioCtx.resume();
      }

      const source = inputAudioCtx.createMediaStreamSource(stream);
      const processor = inputAudioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(inputAudioCtx.destination);

      const actualSampleRate = inputAudioCtx.sampleRate;

      processor.onaudioprocess = (e) => {
        lastAudioProcessTimeRef.current = Date.now();
        if (isMutedRef.current) {
          setInputVolume(0);
          return;
        }

        const inputBuffer = e.inputBuffer.getChannelData(0);
        const vol = calculateVolume(inputBuffer);
        setInputVolume(vol);

        // Convert Float32 PCM to 16kHz Int16 Base64 for Live API
        const resampled16k = resampleTo16k(inputBuffer, actualSampleRate);
        const base64Pcm = float32ToInt16Base64(resampled16k);
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'audio',
            audio: base64Pcm
          }));
        }
      };
      return true;
    } catch (err: any) {
      console.error("Microphone access failed:", err);
      const isPermError = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message?.includes('Permission denied') || err.message?.includes('permission');
      if (isPermError) {
        setErrorMsg("Microphone permission denied. Click the lock icon in your browser address bar to allow microphone access.");
      } else {
        setErrorMsg(`Microphone access failed: ${err.message || 'Microphone unavailable'}.`);
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        setConnectionState('listening');
      } else {
        setConnectionState('error');
      }
      return false;
    }
  };

  const closeWebSocket = () => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {
        // ignore
      }
      wsRef.current = null;
    }
  };

  const connectWebSocket = () => {
    setErrorMsg(null);
    setConnectionState('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/live`;

    closeWebSocket();

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    const pingStart = Date.now();

    ws.onopen = () => {
      setLatencyMs(Math.max(20, Date.now() - pingStart));
      const languageInstruction = TELGISH_LANGUAGE_SYSTEM_INSTRUCTION;
      const memoryInstruction = formatMemoryForSystemInstruction(agentMemoryState);
      const combinedInstruction = `${selectedPersona.systemInstruction}\n${VOICE_TRANSFER_SYSTEM_INSTRUCTION}\n${languageInstruction}\n${memoryInstruction}\n${agentConfig.customInstruction || ''}`;

      ws.send(JSON.stringify({
        type: 'init',
        voiceName: agentConfig.voiceName || selectedPersona.voiceName,
        systemInstruction: combinedInstruction,
        model: 'gemini-3.1-flash-live-preview',
        googleAccessToken: localStorage.getItem('g_access_token') || googleAccessToken || ''
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'connected') {
          setConnectionState('connected');
          const initialProfile = selectedPersona.audioProfile || getPersonaAudioProfile(selectedPersona.id);
          audioQueuePlayerRef.current?.setAudioProfile(initialProfile);
          startMicStream();

          // Trigger activation-triggered dynamic greeting
          const greetingContext = assistantGreeterInstance.getGreetingContext(selectedPersona.name);
          const greetingPrompt = greetingContext.generateDynamicPrompt();
          ws.send(JSON.stringify({
            type: 'text',
            text: greetingPrompt
          }));
        }

        if (msg.type === 'workspace_action') {
          const tn = (msg.toolName || '').toLowerCase();
          const category =
            tn.includes('volume') || tn.includes('brightness') || tn.includes('battery') || tn.includes('power') ? 'hardware' :
            tn.includes('thermal') || tn.includes('log') ? 'thermals' :
            tn.includes('storage') ? 'storage' :
            tn.includes('process') ? 'process' :
            tn.includes('media') ? 'media' :
            tn.includes('network') || tn.includes('connection') || tn.includes('firewall') ? 'network' :
            tn.includes('email') ? 'gmail' :
            tn.includes('calendar') ? 'calendar' :
            tn.includes('doc') ? 'docs' :
            tn.includes('sheet') ? 'sheets' :
            tn.includes('task') ? 'tasks' :
            tn.includes('drive') ? 'drive' : 'system';

          const actionItem: WorkspaceActionItem = {
            id: msg.id || Date.now().toString(),
            toolName: msg.toolName,
            category,
            title: msg.result?.summary || `${msg.toolName?.replace(/_/g, ' ')}`,
            summary: msg.status === 'started' ? `Executing ${msg.toolName?.replace(/_/g, ' ')}...` :
                     msg.status === 'completed' ? (msg.result?.summary || 'Completed successfully') :
                     `Failed: ${msg.result?.error || 'Execution error'}`,
            status: msg.status,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            resultData: msg.result,
            linkUrl: msg.result?.linkUrl,
            error: msg.result?.error
          };

          setWorkspaceActions((prev) => [actionItem, ...prev.filter(a => a.id !== actionItem.id)]);
          if (msg.status === 'completed' || msg.status === 'error') {
            setLatestActionToast(actionItem);
          }

          // Real-time main view & HUD synchronization for hardware adjustments
          if (msg.result?.brightness?.brightnessPercent !== undefined) {
            setLiveBrightness(msg.result.brightness.brightnessPercent);
          }
          if (msg.result?.volumePercent !== undefined) {
            setLiveVolume(prev => ({ ...prev, volumePercent: msg.result.volumePercent, muted: msg.result.muted ?? prev.muted }));
          } else if (msg.result?.volume?.volumePercent !== undefined) {
            setLiveVolume({ volumePercent: msg.result.volume.volumePercent, muted: msg.result.volume.muted ?? false });
          }
          if (msg.result?.battery?.percent !== undefined) {
            setLiveBatteryPercent(msg.result.battery.percent);
          }

          // Broadcast to any open modals/tabs
          window.dispatchEvent(new CustomEvent('jarvis-hardware-updated', { detail: msg.result }));
        }

        // Dedicated vision_control push event from server
        if (msg.type === 'vision_control') {
          console.log('[Vision Control Push Event]', msg);
          if (msg.action === 'start_screen' || (msg.action === 'start' && msg.mode === 'screen')) {
            startVision('screen');
          } else if (msg.action === 'start_camera' || (msg.action === 'start' && msg.mode === 'camera')) {
            startVision('camera');
          } else if (msg.action === 'stop' || msg.action === 'stop_all' || msg.action === 'stop_screen' || msg.action === 'stop_camera') {
            stopVision();
          }
        }

        // Phase 4: Persona Swapped Event from Orchestrator
        if (msg.type === 'persona_swapped') {
          console.log('[Persona Swapped Event]', msg);
          const targetId = msg.newPersonaId || msg.targetPersonaId || msg.persona?.id;
          if (targetId) {
            setActiveOrchestratorPersonaId(targetId);
            const matching = PERSONAS.find(p => p.id === targetId.toLowerCase());
            if (matching) {
              setSelectedPersona(matching);
              const profile = msg.audioProfile || matching.audioProfile || getPersonaAudioProfile(matching.id);
              audioQueuePlayerRef.current?.setAudioProfile(profile);
            }
          }
          if (msg.personas) {
            setOrchestratorPersonas(msg.personas);
          }
        }

        // Phase 4: Voice Transfer Tool Call from Gemini Live
        if (msg.type === 'switch_persona_tool_call' && msg.targetPersonaId) {
          console.log('[Switch Persona Tool Call]', msg);
          const matching = PERSONAS.find(p => p.id === msg.targetPersonaId.toLowerCase());
          if (matching && matching.id !== selectedPersona.id) {
            performVoiceTransfer(matching);
          }
        }

        // Phase 4: Muted Relay Alert Event from Background Manager
        if (msg.type === 'muted_relay_alert') {
          console.log('[Muted Relay Alert]', msg);
          setMutedRelayEvents(prev => [msg, ...prev].slice(0, 20));
          setMutedRelayToast(msg);
        }

        if (msg.type === 'audio' && (msg.audio || msg.data)) {
          setConnectionState('speaking');
          audioQueuePlayerRef.current?.enqueueChunk(msg.audio || msg.data);
        }

        if ((msg.type === 'output_transcription' || msg.type === 'outputTranscript') && msg.text) {
          appendTranscriptChunk('agent', msg.text);
        }

        if ((msg.type === 'input_transcription' || msg.type === 'inputTranscript') && msg.text) {
          appendTranscriptChunk('user', msg.text);
        }

        if (msg.type === 'interrupted') {
          audioQueuePlayerRef.current?.stopAndClear();
          finalizeLastMessage();
          setConnectionState('listening');
        }

        if (msg.type === 'turn_complete' || msg.type === 'turnComplete') {
          finalizeLastMessage();
          setConnectionState('listening');
        }

        if (msg.type === 'error') {
          console.error("Live API Session Error:", msg.message);
          setErrorMsg(msg.message || "Failed to establish Gemini Live voice session.");
          setConnectionState('error');
        }
      } catch (err) {
        console.error("Error parsing WS message:", err);
      }
    };

    ws.onclose = () => {
      setConnectionState((prev) => (prev === 'error' ? 'error' : 'disconnected'));
      stopMicStream();
    };

    ws.onerror = (evt) => {
      console.warn("WebSocket connection state change or disconnect:", evt);
      setErrorMsg("Realtime session disconnected or unavailable. Click Retry to reconnect.");
      setConnectionState('error');
    };
  };

  const handleStartSession = () => {
    audioQueuePlayerRef.current?.getAudioContext();
    connectWebSocket();
  };

  const handleStopSession = () => {
    audioQueuePlayerRef.current?.stopAndClear();
    closeWebSocket();
    stopMicStream();
    setConnectionState('disconnected');
  };

  const handleInterrupt = () => {
    audioQueuePlayerRef.current?.stopAndClear();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'interrupt' }));
    }
    setConnectionState('listening');
  };

  const performVoiceTransfer = (targetPersona: VoicePersona) => {
    console.log(`[Voice Transfer] Executing transfer to ${targetPersona.name} (voice: ${targetPersona.voiceName})`);
    setSelectedPersona(targetPersona);
    setActiveOrchestratorPersonaId(targetPersona.id);
    setAgentConfig((prev) => ({
      ...prev,
      selectedPersonaId: targetPersona.id,
      voiceName: targetPersona.voiceName
    }));

    // Stop and clear audio queue
    audioQueuePlayerRef.current?.stopAndClear();

    // Set persona acoustic profile
    const profile = targetPersona.audioProfile || getPersonaAudioProfile(targetPersona.id);
    audioQueuePlayerRef.current?.setAudioProfile(profile);

    // If connected to Gemini Live, gracefully re-initialize session with target agent's voice and system instruction
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const languageInstruction = TELGISH_LANGUAGE_SYSTEM_INSTRUCTION;
      const memoryInstruction = formatMemoryForSystemInstruction(agentMemoryState);
      const combinedInstruction = `${targetPersona.systemInstruction}\n${VOICE_TRANSFER_SYSTEM_INSTRUCTION}\n${languageInstruction}\n${memoryInstruction}\n${agentConfig.customInstruction || ''}`;

      wsRef.current.send(JSON.stringify({
        type: 'reinit',
        voiceName: targetPersona.voiceName,
        systemInstruction: combinedInstruction,
        model: 'gemini-3.1-flash-live-preview',
        googleAccessToken: localStorage.getItem('g_access_token') || googleAccessToken || ''
      }));

      // Send silent wake-up prompt to force immediate in-character greeting
      wsRef.current.send(JSON.stringify({
        type: 'text',
        text: `[VOICE_TRANSFER_PROTOCOL_ACTIVE]: Voice transfer complete. You are now active as ${targetPersona.name} with voice ID '${targetPersona.voiceName}'. Greet the user immediately in character with 1 short greeting sentence.`
      }));
    }

    // Sync state with backend orchestrator
    fetch('/api/orchestrator/swap-persona', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personaId: targetPersona.id })
    }).catch((e) => console.warn('Failed to sync swap with orchestrator:', e));
  };

  const handleSwapPersona = (personaId: string) => {
    const matching = PERSONAS.find((p) => p.id === personaId.toLowerCase());
    if (matching) {
      performVoiceTransfer(matching);
    }
  };

  const handleDelegateTask = async (task: string, managerId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'delegate_task',
        task,
        managerId
      }));
    } else {
      const res = await fetch('/api/orchestrator/delegate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task,
          managerId,
          googleAccessToken: localStorage.getItem('g_access_token') || googleAccessToken || ''
        })
      });
      const data = await res.json();
      if (data.relayedEvent) {
        setMutedRelayEvents(prev => [data.relayedEvent, ...prev].slice(0, 20));
        setMutedRelayToast(data.relayedEvent);
      }
    }
  };

  const handleSelectPersona = (persona: VoicePersona) => {
    handleSwapPersona(persona.id);
  };

  const handleSyncMemoryWithAgent = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const memoryContext = formatMemoryForSystemInstruction(agentMemoryState);
      wsRef.current.send(JSON.stringify({
        type: 'text',
        text: `[SYSTEM CONTEXT REFRESH]: Memory updated:\n${memoryContext}`
      }));
    }
  };

  const handleSendTextMessage = async (text: string) => {
    setAgentMemoryState((prevMem) => autoExtractMemoriesFromText(text, prevMem));
    const nluRes = analyzeUtterance(text);
    setLatestNluResult(nluRes);

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        sender: 'user',
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'text',
        text
      }));
    } else {
      // REST fallback
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            systemInstruction: selectedPersona.systemInstruction,
            googleAccessToken: localStorage.getItem('g_access_token') || googleAccessToken || ''
          })
        });
        const data = await res.json();
        if (data.actions && Array.isArray(data.actions)) {
          for (const act of data.actions) {
            const tn = (act.toolName || '').toLowerCase();
            const category =
              tn.includes('volume') || tn.includes('brightness') || tn.includes('battery') || tn.includes('power') ? 'hardware' :
              tn.includes('thermal') || tn.includes('log') ? 'thermals' :
              tn.includes('storage') ? 'storage' :
              tn.includes('process') ? 'process' :
              tn.includes('media') ? 'media' :
              tn.includes('network') || tn.includes('connection') || tn.includes('firewall') ? 'network' :
              tn.includes('email') ? 'gmail' :
              tn.includes('calendar') ? 'calendar' :
              tn.includes('doc') ? 'docs' :
              tn.includes('sheet') ? 'sheets' :
              tn.includes('task') ? 'tasks' :
              tn.includes('drive') ? 'drive' : 'system';

            const actItem: WorkspaceActionItem = {
              id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
              toolName: act.toolName,
              category,
              title: act.result?.summary || `${act.toolName?.replace(/_/g, ' ')}`,
              summary: act.result?.summary || 'Executed via chat command',
              status: act.result?.success ? 'completed' : 'error',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              resultData: act.result,
              linkUrl: act.result?.linkUrl,
              error: act.result?.error
            };
            setWorkspaceActions(prev => [actItem, ...prev]);
            setLatestActionToast(actItem);
          }
        }
        if (data.text) {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              sender: 'agent',
              text: data.text,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ]);
        }
      } catch (e: any) {
        console.error("REST chat failed:", e);
      }
    }
  };

  return (
    <div className="h-screen w-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans antialiased relative overflow-hidden">
      {/* Vibrant Background Floating Glowing Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-gradient-to-br from-rose-600/25 via-pink-600/20 to-purple-600/10 blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-indigo-600/25 via-cyan-600/20 to-blue-600/15 blur-[140px] pointer-events-none" />
      <div className="absolute top-[40%] right-[30%] w-[400px] h-[400px] rounded-full bg-gradient-to-r from-emerald-600/15 to-teal-600/10 blur-[100px] pointer-events-none" />

      {/* Header */}
      <Header
        connectionState={connectionState}
        latencyMs={latencyMs}
        selectedPersonaName={selectedPersona.name}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenWorkspace={() => setIsWorkspaceOpen(true)}
        onOpenMemory={() => setIsMemoryOpen(true)}
        onOpenNlu={() => setIsNluModalOpen(true)}
        onOpenSystemControl={() => setIsSystemControlOpen(true)}
        onOpenOrchestrator={() => setIsOrchestratorOpen(true)}
        onSwitchToModern={onSwitchToModern}
        memoryCount={agentMemoryState.facts.length}
        mutedRelayCount={mutedRelayEvents.length}
        batteryPercent={liveBatteryPercent}
        brightnessPercent={liveBrightness}
        volumePercent={liveVolume.volumePercent}
        volumeMuted={liveVolume.muted}
      />

      {/* Live Stark HUD Workspace Action Toast Banner */}
      {latestActionToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-zinc-900/95 border border-cyan-500/40 rounded-2xl shadow-2xl p-4 backdrop-blur-xl animate-fade-in flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">J.A.R.V.I.S. Action</span>
            </div>
            <button onClick={() => setLatestActionToast(null)} className="text-zinc-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-xs text-zinc-100 font-medium">
            {latestActionToast.title}
          </div>
          <p className="text-[11px] text-zinc-400">{latestActionToast.summary}</p>
          {latestActionToast.linkUrl && (
            <a
              href={latestActionToast.linkUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-cyan-600/20"
            >
              Open in Google Workspace <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}

      {/* Main App Layout */}
      <div className="flex-1 min-h-0 w-full relative z-10 overflow-hidden">
        {/* Central Main Voice Workspace */}
        <main className="w-full h-full min-h-0 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto relative">
          {/* Error Banner if any */}
          {errorMsg && (
            <div className="w-full max-w-xl mb-4 p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-2xl text-xs flex items-center justify-between gap-3 backdrop-blur-md animate-fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    setErrorMsg(null);
                    connectWebSocket();
                  }}
                  className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-200 rounded-lg text-xs font-medium transition-all"
                >
                  Retry
                </button>
                <button
                  onClick={() => setErrorMsg(null)}
                  className="p-1 text-rose-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Persona Selection Bar */}
          <PersonaCard
            personas={PERSONAS}
            selectedPersonaId={selectedPersona.id}
            onSelectPersona={handleSelectPersona}
            disabled={connectionState === 'connecting'}
          />

          {/* Central Holographic Voice Visualizer */}
          <VoiceVisualizer
            connectionState={connectionState}
            inputVolume={inputVolume}
            outputVolume={outputVolume}
            personaName={selectedPersona.name}
            personaColor={selectedPersona.accentColor}
            isMuted={isMuted}
            onToggleMute={() => setIsMuted(!isMuted)}
            onStartSession={handleStartSession}
            onStopSession={handleStopSession}
            onInterrupt={handleInterrupt}
            isVisionActive={isVisionActive}
            visionMode={visionMode}
            onToggleVision={handleToggleVision}
          />

          {/* Text Message & Command Input Bar */}
          <div className="w-full max-w-2xl mt-4 flex items-center gap-2">
            <input
              type="text"
              placeholder={`Message ${selectedPersona.name} or type a command...`}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && textInput.trim()) {
                  handleSendTextMessage(textInput.trim());
                  setTextInput('');
                }
              }}
              className="flex-1 bg-zinc-900/80 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40 backdrop-blur-md transition-all"
            />
            <button
              onClick={() => {
                if (textInput.trim()) {
                  handleSendTextMessage(textInput.trim());
                  setTextInput('');
                }
              }}
              disabled={!textInput.trim()}
              className="p-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 text-white rounded-2xl shadow-lg shadow-cyan-600/20 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </main>
      </div>

      {/* System OS & Computer Control Hub Modal */}
      <SystemControlModal
        isOpen={isSystemControlOpen}
        onClose={() => setIsSystemControlOpen(false)}
        onRefresh={() => {}}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={agentConfig}
        onUpdateConfig={(updates) => {
          setAgentConfig((prev) => ({ ...prev, ...updates }));
          if (updates.voiceName) {
            const matchedPersona = PERSONAS.find(p => p.voiceName === updates.voiceName);
            if (matchedPersona) {
              setSelectedPersona(matchedPersona);
            }
          }
        }}
      />

      {/* Vision Preview PiP Widget */}
      <VisionPreviewModal
        isOpen={isVisionActive}
        mode={visionMode}
        stream={visionStream}
        onClose={stopVision}
        onSwitchMode={(newMode) => startVision(newMode)}
        onCaptureAndSend={handleCaptureAndSend}
        isLiveStreaming={isLiveStreaming}
        onToggleLiveStreaming={() => setIsLiveStreaming(!isLiveStreaming)}
        onLiveStreamFrame={handleLiveStreamFrame}
      />

      {/* Google Workspace Hub */}
      <WorkspaceHub
        isOpen={isWorkspaceOpen}
        onClose={() => setIsWorkspaceOpen(false)}
        onTokenUpdate={(token) => {
          setGoogleAccessToken(token);
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'update_token',
              googleAccessToken: token
            }));
          }
        }}
        actionHistory={workspaceActions}
      />

      {/* Agent Memory & Context Modal */}
      <AgentMemoryModal
        isOpen={isMemoryOpen}
        onClose={() => setIsMemoryOpen(false)}
        memoryState={agentMemoryState}
        onUpdateMemory={(newState) => setAgentMemoryState(newState)}
        onSyncWithAgent={handleSyncMemoryWithAgent}
        isConnected={connectionState !== 'disconnected'}
      />

      {/* NLU & Intent Engine Modal */}
      <NluInsightModal
        isOpen={isNluModalOpen}
        onClose={() => setIsNluModalOpen(false)}
        latestNluResult={latestNluResult}
      />

      {/* Phase 4: Multi-Agent Orchestrator Modal */}
      <MultiAgentStatusModal
        isOpen={isOrchestratorOpen}
        onClose={() => setIsOrchestratorOpen(false)}
        personas={orchestratorPersonas}
        activePersonaId={activeOrchestratorPersonaId}
        onSwapPersona={handleSwapPersona}
        onDelegateTask={handleDelegateTask}
        mutedRelayEvents={mutedRelayEvents}
      />

      {/* Muted Relay Notification Toast */}
      {mutedRelayToast && (
        <div className="fixed bottom-24 right-6 z-50 max-w-sm w-full bg-zinc-950/95 border border-indigo-500/40 rounded-2xl shadow-2xl p-4 backdrop-blur-xl animate-fade-in flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400 animate-pulse" />
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                Muted Relay Briefing
              </span>
            </div>
            <button onClick={() => setMutedRelayToast(null)} className="text-zinc-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-xs text-zinc-200 leading-relaxed font-medium">
            {mutedRelayToast.relayedSummary}
          </div>
          <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-white/5">
            <span>Source: {mutedRelayToast.sourceManagerName}</span>
            <span className="font-mono">{mutedRelayToast.timestamp}</span>
          </div>
        </div>
      )}
    </div>
  );
}
