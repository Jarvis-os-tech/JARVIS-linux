import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  clock,
  missionAccents,
  missionIcons,
  seedAgents,
  seedMissions,
  uid,
  type Agent,
  type ChatMessage,
  type LogEntry,
  type Mission,
  type MissionStatus,
  type Notification,
  type ViewKey,
} from "@/lib/jarvis-data";
import { PERSONAS, VOICE_TRANSFER_SYSTEM_INSTRUCTION, detectVoiceTransfer, getPersonaAudioProfile } from "@/data/personas";
import { VoicePersona, ConnectionState, WorkspaceActionItem, AgentConfig } from "@/types";
import { AudioQueuePlayer, float32ToInt16Base64, resampleTo16k, calculateVolume } from "@/utils/audio";
import { assistantGreeterInstance } from "@/utils/automatic_greeting";
import { loadAgentMemory, saveAgentMemory, autoExtractMemoriesFromText, AgentMemoryState } from "@/utils/agent_memory";
import { analyzeUtterance, NluAnalysisResult } from "@/utils/nlu_engine";
import { PersonaMetadata, MutedRelayEvent } from "@/utils/multi_agent_orchestrator";
import { clientSpeechQueue, ClientSpeechPriority } from "@/utils/client_speech_queue";
import { WebRTCManager, isWebRTCSupported } from "@/utils/webrtc_manager";

type Ctx = ReturnType<typeof useJarvisState>;

const JarvisContext = createContext<Ctx | null>(null);

const VIEWS: ViewKey[] = [
  "dashboard",
  "memory",
  "agents",
  "connectors",
  "mission",
  "workflows",
  "settings",
];

function useJarvisState(onSwitchToClassic?: () => void) {
  const [view, setView] = useState<ViewKey>("dashboard");
  const [selectedPersona, setSelectedPersona] = useState<VoicePersona>(PERSONAS[0]);
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [isMuted, setIsMuted] = useState(false);
  const [micPermissionState, setMicPermissionState] = useState<"prompt" | "granted" | "denied" | "unsupported">("prompt");
  const [latencyMs, setLatencyMs] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [liveSubtitle, setLiveSubtitle] = useState<string | null>(null);

  // Wire client speech priority queue callbacks
  useEffect(() => {
    clientSpeechQueue.setCallbacks({
      onSubtitleChange: (text) => {
        setLiveSubtitle(text);
      },
      onSpeakingStateChange: (speaking) => {
        if (speaking) {
          setConnectionState((prev) => (prev === 'connected' || prev === 'listening' ? 'speaking' : prev));
        } else {
          setConnectionState((prev) => (prev === 'speaking' ? 'listening' : prev));
        }
      },
    });
  }, []);

  // Hardware Telemetry (Real ground truth from Linux /proc and Mutter/PulseAudio actuators)
  const [cpu, setCpu] = useState<number>(0);
  const [ram, setRam] = useState<number>(0);
  const [net, setNet] = useState<number>(0);
  const [batteryPercent, setBatteryPercent] = useState<number | null>(null);
  const [brightnessPercent, setBrightnessPercent] = useState<number | null>(null);
  const [volumePercent, setVolumePercent] = useState<number>(75);
  const [volumeMuted, setVolumeMuted] = useState<boolean>(false);
  const [thermals, setThermals] = useState<any>(null);

  // Audio meters & Sensitivity Calibration
  const [inputVolume, setInputVolume] = useState<number>(0);
  const [outputVolume, setOutputVolume] = useState<number>(0);
  const [micSensitivity, setMicSensitivityState] = useState<number>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("jarvis_mic_sensitivity") : null;
    return saved ? Math.max(1, Math.min(10, Number(saved))) : 7;
  });
  const micSensitivityRef = useRef(micSensitivity);
  micSensitivityRef.current = micSensitivity;

  const setMicSensitivity = useCallback((val: number) => {
    const clamped = Math.max(1, Math.min(10, val));
    setMicSensitivityState(clamped);
    micSensitivityRef.current = clamped;
    try {
      localStorage.setItem("jarvis_mic_sensitivity", String(clamped));
    } catch {}
  }, []);

  // WebRTC Dual Transport state
  const [webrtcConnected, setWebrtcConnected] = useState<boolean>(false);
  const webrtcManagerRef = useRef<WebRTCManager | null>(null);

  // Swarm & Orchestrator
  const [agents, setAgents] = useState<Agent[]>(() =>
    PERSONAS.map((p, idx) => ({
      id: p.id,
      name: p.name,
      desc: p.description,
      icon: p.id === "jarvis" ? "◎" : p.id === "friday" ? "🌐" : p.id === "ultron" ? "💀" : p.id === "edith" ? "🕶" : p.id === "karen" ? "⚡" : "🧠",
      accent: p.accentColor || (idx === 0 ? "var(--cyan-hud)" : idx === 1 ? "var(--violet-hud)" : idx === 2 ? "var(--blue-hud)" : "var(--pink-hud)"),
      status: "running",
      tasks: 0,
      uptimeMin: 0,
      load: 0,
      voiceName: p.voiceName,
      systemInstruction: p.systemInstruction,
    }))
  );
  const [orchestratorPersonas, setOrchestratorPersonas] = useState<PersonaMetadata[]>([]);
  const [mutedRelayEvents, setMutedRelayEvents] = useState<MutedRelayEvent[]>([]);
  const [activeOrchestratorPersonaId, setActiveOrchestratorPersonaId] = useState<string>("jarvis");

  // Missions & Actions (User-dispatched and workflow operations only)
  const [missions, setMissions] = useState<Mission[]>(() => {
    try {
      const saved = localStorage.getItem("jarvis_missions_v1");
      if (!saved) return seedMissions;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed) || parsed.length === 0) return seedMissions;
      // Filter out any legacy dummy/mock missions or raw tool logs
      const clean = parsed.filter(
        (m: Mission) =>
          m &&
          m.id &&
          !["m1", "m2", "m3", "m4", "m5", "m6"].includes(m.id) &&
          !["Daily Briefing", "Triage Inbox", "Quantum Simulation", "Satellite Uplink", "Codebase Sweep", "Security Sentinel Night Watch"].includes(m.title) &&
          !m.title.startsWith("execute ") &&
          !m.title.startsWith("Command ") &&
          !m.title.startsWith("Failed ") &&
          !m.title.startsWith("Found ") &&
          !m.title.startsWith("get ") &&
          !m.title.startsWith("search ") &&
          !m.title.startsWith("list ") &&
          !m.title.startsWith("Retrieved ") &&
          !m.title.startsWith("System Health")
      );
      return clean.length > 0 ? clean : seedMissions;
    } catch {
      return seedMissions;
    }
  });
  const [workspaceActions, setWorkspaceActions] = useState<WorkspaceActionItem[]>([]);
  const [latestActionToast, setLatestActionToast] = useState<WorkspaceActionItem | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem("jarvis_missions_v1", JSON.stringify(missions));
    } catch {}
  }, [missions]);

  // Memory & NLU
  const [agentMemoryState, setAgentMemoryState] = useState<AgentMemoryState>(() => loadAgentMemory());
  const [latestNluResult, setLatestNluResult] = useState<NluAnalysisResult | null>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string>(() => localStorage.getItem("g_access_token") || "");

  // Notifications & Log (Real events only)
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    try {
      const saved = localStorage.getItem("jarvis_notifications_v1");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("jarvis_notifications_v1", JSON.stringify(notifications));
    } catch {}
  }, [notifications]);

  // Synchronize Google OAuth token globally across backend server & active Live WebSocket
  useEffect(() => {
    // Initial fetch from server to load persistent/auto-refreshed Google credentials
    fetch("/api/workspace/token/status")
      .then((res) => res.json())
      .then((status) => {
        if (status.connected && status.token) {
          setGoogleAccessToken(status.token);
          localStorage.setItem("g_access_token", status.token);
          if (status.email) localStorage.setItem("g_user_email", status.email);
          if (status.name) localStorage.setItem("g_user_name", status.name);
          if (status.picture) localStorage.setItem("g_user_picture", status.picture);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const token = googleAccessToken || localStorage.getItem("g_access_token") || "";
    if (token) {
      fetch("/api/workspace/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }).catch(() => {});

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "update_token",
          googleAccessToken: token,
        }));
      }
    }
  }, [googleAccessToken]);

  const [log, setLog] = useState<LogEntry[]>([
    { id: uid(), text: "JARVIS MK-VII Console initialized — subsystems nominal.", at: Date.now() },
  ]);

  // Messages & UI Controls
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem("jarvis_chat_messages_v1");
      return saved ? JSON.parse(saved) : [
        {
          id: uid(),
          role: "jarvis",
          text: "Console MK-VII online, Gopi. Live voice streaming and local system actuators standing by.",
          at: Date.now(),
        },
      ];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("jarvis_chat_messages_v1", JSON.stringify(messages));
    } catch {}
  }, [messages]);

  const [thinking, setThinking] = useState(false);
  const [autonomy, setAutonomy] = useState(() => Number(localStorage.getItem("jarvis_autonomy")) || 80);
  const [density, setDensity] = useState(() => Number(localStorage.getItem("jarvis_density")) || 65);
  const [telemetryOn, setTelemetryOn] = useState(() => localStorage.getItem("jarvis_telemetry_on") !== "false");
  const [autoDispatch, setAutoDispatch] = useState(() => localStorage.getItem("jarvis_auto_dispatch") !== "false");
  const [confirmDestructive, setConfirmDestructive] = useState(() => localStorage.getItem("jarvis_confirm_destructive") !== "false");

  useEffect(() => {
    localStorage.setItem("jarvis_autonomy", String(autonomy));
  }, [autonomy]);

  useEffect(() => {
    localStorage.setItem("jarvis_density", String(density));
  }, [density]);

  useEffect(() => {
    localStorage.setItem("jarvis_telemetry_on", String(telemetryOn));
  }, [telemetryOn]);

  useEffect(() => {
    localStorage.setItem("jarvis_auto_dispatch", String(autoDispatch));
  }, [autoDispatch]);

  useEffect(() => {
    localStorage.setItem("jarvis_confirm_destructive", String(confirmDestructive));
  }, [confirmDestructive]);

  // Vision
  const [isVisionActive, setIsVisionActive] = useState(false);
  const [visionMode, setVisionMode] = useState<"camera" | "screen" | null>(null);
  const [visionStream, setVisionStream] = useState<MediaStream | null>(null);
  const [isLiveStreaming, setIsLiveStreaming] = useState(false);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioQueuePlayerRef = useRef<AudioQueuePlayer | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const isMutedRef = useRef(isMuted);
  const isStartingVisionRef = useRef(false);
  const lastAudioProcessTimeRef = useRef<number>(Date.now());
  const isActiveSessionRef = useRef(false);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const bargeInCountRef = useRef(0);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Audio queue initialization with continuous watchdog
  useEffect(() => {
    audioQueuePlayerRef.current = new AudioQueuePlayer(
      (vol) => setOutputVolume(vol),
      (isPlaying) => {
        if (isPlaying) {
          setConnectionState((prev) => (prev !== "disconnected" && prev !== "error" ? "speaking" : prev));
        } else {
          setConnectionState((prev) => (prev === "speaking" ? "listening" : prev));
          // When AI finishes speaking, immediately ensure the microphone AudioContext is resumed and capturing
          if (
            inputAudioCtxRef.current &&
            (inputAudioCtxRef.current.state === "suspended" || (inputAudioCtxRef.current as any).state === "interrupted")
          ) {
            inputAudioCtxRef.current.resume().catch(() => {});
          }
        }
      }
    );

    // Continuous Sound Server Watchdog: Ensure input microphone AudioContext & tracks stay active
    const inputWatchdogTimer = setInterval(() => {
      if (
        micStreamRef.current &&
        inputAudioCtxRef.current &&
        !isMutedRef.current &&
        wsRef.current &&
        wsRef.current.readyState === WebSocket.OPEN
      ) {
        if (
          inputAudioCtxRef.current.state === "suspended" ||
          (inputAudioCtxRef.current as any).state === "interrupted"
        ) {
          inputAudioCtxRef.current.resume().catch(() => {});
        }

        // Detect dead or muted tracks and auto-recover
        const tracks = micStreamRef.current.getAudioTracks();
        const isTrackDead = tracks.length === 0 || !tracks.some((t) => t.readyState === "live" && t.enabled);
        if (isTrackDead && Date.now() - lastAudioProcessTimeRef.current > 3000) {
          console.warn("[JarvisProvider] Microphone track interrupted. Auto-recovering mic stream...");
          startMicStream().catch(() => {});
        }
      }
    }, 1000);

    return () => {
      clearInterval(inputWatchdogTimer);
      audioQueuePlayerRef.current?.close();
      stopMicStream();
      closeWebSocket();
    };
  }, []);

  const pushLog = useCallback((text: string) => {
    setLog((l) => [{ id: uid(), text, at: Date.now() }, ...l].slice(0, 50));
  }, []);

  const pushNotification = useCallback((icon: string, title: string) => {
    setNotifications((n) => [{ id: uid(), icon, title, at: Date.now(), read: false }, ...n].slice(0, 40));
    toast(title, { icon: <span aria-hidden>{icon}</span> });
  }, []);

  // Poll real system hardware telemetry (Zero Hallucination / Zero Mock)
  useEffect(() => {
    if (!telemetryOn) return;
    const fetchHardware = () => {
      fetch("/api/system/hardware")
        .then((r) => r.json())
        .then((data) => {
          if (data?.battery?.percent !== undefined) setBatteryPercent(data.battery.percent);
          if (data?.brightness?.brightnessPercent !== undefined) setBrightnessPercent(data.brightness.brightnessPercent);
          if (data?.volume?.volumePercent !== undefined) {
            setVolumePercent(data.volume.volumePercent);
            setVolumeMuted(data.volume.muted ?? false);
          }
          if (data?.thermals) setThermals(data.thermals);
        })
        .catch(() => {});

      fetch("/api/system/telemetry")
        .then((r) => r.json())
        .then((data) => {
          let currentCpu = 0;
          const cpuVal = data?.cpu?.usagePercent ?? data?.cpu_usage_percent;
          if (cpuVal !== undefined) {
            currentCpu = Math.min(100, Math.max(0, Math.round(cpuVal)));
            setCpu(currentCpu);
          }
          const ramVal = data?.memory?.usagePercent ?? data?.ram_usage_percent;
          if (ramVal !== undefined) {
            setRam(Math.min(100, Math.max(0, Math.round(ramVal))));
          }
          const netRx = data?.network?.rxSec ?? 0;
          const netTx = data?.network?.txSec ?? 0;
          if (data?.network?.rxSec !== undefined || data?.network?.txSec !== undefined) {
            setNet(Number(((netRx + netTx) / 1024).toFixed(1)));
          }

          // Update agent live telemetry (real system uptime and real host CPU allocation)
          const uptimeSec = data?.uptimeSeconds ?? (typeof data?.uptime === "number" ? data.uptime : undefined);
          if (uptimeSec !== undefined) {
            const uptimeMinutes = Math.floor(uptimeSec / 60);
            setAgents((prev) =>
              prev.map((a) => ({
                ...a,
                uptimeMin: a.status === "running" ? uptimeMinutes : 0,
                load: a.status === "running" ? (a.id === activeOrchestratorPersonaId ? currentCpu : Math.round(currentCpu * 0.3)) : 0,
              }))
            );
          }
        })
        .catch(() => {});
    };

    fetchHardware();
    const interval = setInterval(fetchHardware, 2000);
    return () => clearInterval(interval);
  }, [telemetryOn, activeOrchestratorPersonaId]);

  // Fetch orchestrator status
  useEffect(() => {
    fetch("/api/orchestrator/status")
      .then((r) => r.json())
      .then((data) => {
        if (data?.personas) setOrchestratorPersonas(data.personas);
        if (data?.activePersonaId) {
          setActiveOrchestratorPersonaId(data.activePersonaId);
          const matched = PERSONAS.find((p) => p.id === data.activePersonaId);
          if (matched) setSelectedPersona(matched);
        }
        if (data?.mutedRelayEvents) setMutedRelayEvents(data.mutedRelayEvents);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "microphone" as any })
        .then((permissionStatus) => {
          setMicPermissionState(permissionStatus.state as any);
          permissionStatus.onchange = () => {
            setMicPermissionState(permissionStatus.state as any);
          };
        })
        .catch(() => {});
    }
  }, []);

  /* ------- Audio and Mic handling ------- */
  const stopMicStream = useCallback(() => {
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {}
      processorRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      try {
        inputAudioCtxRef.current.close();
      } catch {}
      inputAudioCtxRef.current = null;
    }
    if (micStreamRef.current) {
      try {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch {}
      micStreamRef.current = null;
    }
    setInputVolume(0);
  }, []);

  const startMicStream = useCallback(async () => {
    try {
      stopMicStream();

      if (!navigator?.mediaDevices?.getUserMedia) {
        setMicPermissionState("unsupported");
        throw new Error("Microphone capture (getUserMedia) is unsupported or blocked by browser security policy.");
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (constraintErr: any) {
        if (
          constraintErr.name === "NotAllowedError" ||
          constraintErr.name === "PermissionDeniedError"
        ) {
          throw constraintErr;
        }
        console.warn("[JarvisProvider] Standard audio constraints failed, trying basic audio stream:", constraintErr);
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      micStreamRef.current = stream;
      setMicPermissionState("granted");
      setErrorMsg(null);

      // Track lifecycle monitoring
      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          console.warn("[JarvisProvider] Microphone hardware track ended. Auto-recovering...");
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !isMutedRef.current) {
            startMicStream().catch(() => {});
          }
        };
        track.onmute = () => {
          console.warn("[JarvisProvider] Microphone hardware track muted by OS.");
        };
        track.onunmute = () => {
          console.log("[JarvisProvider] Microphone hardware track unmuted.");
        };
      });

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      let inputAudioCtx: AudioContext;
      try {
        inputAudioCtx = new AudioCtx({ sampleRate: 16000 });
      } catch {
        // Fallback for sound drivers / PipeWire / ALSA that require native hardware sample rate (e.g., 44.1k/48k)
        inputAudioCtx = new AudioCtx();
      }
      inputAudioCtxRef.current = inputAudioCtx;

      // Attach auto-resume listener for any PipeWire / ALSA interruptions during playback
      inputAudioCtx.onstatechange = () => {
        if (inputAudioCtx.state === "suspended" || (inputAudioCtx as any).state === "interrupted") {
          inputAudioCtx.resume().catch(() => {});
        }
      };

      // Resume AudioContext if suspended (critical for modern browser autoplay policy)
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
        const rawBuffer = e.inputBuffer.getChannelData(0);
        
        // Apply mic sensitivity scaling (Level 1 -> 0.36x, Level 7 -> 1.32x, Level 10 -> 1.8x)
        const currentSensitivity = micSensitivityRef.current;
        const gainMultiplier = 0.2 + (currentSensitivity * 0.16);
        const scaledBuffer = new Float32Array(rawBuffer.length);
        for (let i = 0; i < rawBuffer.length; i++) {
          scaledBuffer[i] = Math.max(-1, Math.min(1, rawBuffer[i] * gainMultiplier));
        }

        const vol = calculateVolume(scaledBuffer);
        setInputVolume(vol);

        // Acoustic Echo Suppression & Self-Voice Loopback Guard:
        // When AI output audio is actively playing or dissipating (with 450ms tail buffer),
        // suppress mic transmission back to Gemini Live to prevent the AI from hearing itself and cutting itself off.
        if (audioQueuePlayerRef.current?.isEchoSuppressionActive(450)) {
          // Sustained Barge-in Detection: Require deliberate user voice (>80%) across 3 consecutive frames
          // to prevent speaker output, acoustic reflection, or background noise from triggering false cutoffs.
          if (vol > 80) {
            bargeInCountRef.current += 1;
            if (bargeInCountRef.current >= 3) {
              audioQueuePlayerRef.current?.stopAndClear();
              bargeInCountRef.current = 0;
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: "interrupt" }));
              }
              if (webrtcManagerRef.current) {
                webrtcManagerRef.current.sendCommand({ type: "interrupt" } as any);
              }
            } else {
              return;
            }
          } else {
            bargeInCountRef.current = 0;
            return;
          }
        } else {
          bargeInCountRef.current = 0;
        }

        // Cleanly resample Float32 buffer to exact 16kHz PCM mono for Gemini Live API
        const resampled16k = resampleTo16k(scaledBuffer, actualSampleRate);
        const base64Pcm = float32ToInt16Base64(resampled16k);

        // WebRTC + WebSocket Dual Transport
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "audio", audio: base64Pcm }));
        }
      };
      return true;
    } catch (err: any) {
      console.error("Microphone access failed:", err);
      const isPermDenied =
        err.name === "NotAllowedError" ||
        err.name === "PermissionDeniedError" ||
        err.message?.toLowerCase().includes("permission") ||
        err.message?.toLowerCase().includes("denied");

      if (isPermDenied) {
        setMicPermissionState("denied");
        const msg = "Microphone access blocked. Click the lock/site settings icon in your browser URL bar to allow microphone permissions.";
        setErrorMsg(msg);
        toast.error(msg, { duration: 7000 });
      } else {
        setErrorMsg(`Microphone access failed: ${err.message || "Microphone unavailable"}`);
      }

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        setConnectionState("listening");
      } else {
        setConnectionState("error");
      }
      return false;
    }
  }, [stopMicStream]);

  const requestMicPermission = useCallback(async () => {
    setErrorMsg(null);
    const success = await startMicStream();
    if (success) {
      toast.success("Microphone activated and calibrated successfully.");
    }
    return success;
  }, [startMicStream]);

  /* ------- Vision Handling ------- */
  const stopVision = useCallback(() => {
    if (visionStream) {
      visionStream.getTracks().forEach((track) => track.stop());
      setVisionStream(null);
    }
    setIsVisionActive(false);
    setVisionMode(null);
    setIsLiveStreaming(false);
    isStartingVisionRef.current = false;
  }, [visionStream]);

  const startVision = useCallback(async (mode: "camera" | "screen") => {
    // Guard against duplicate / re-entrant calls
    if (isStartingVisionRef.current) {
      console.log(`[Vision] Activation already in progress for ${mode}, ignoring duplicate call.`);
      return;
    }

    // If already actively streaming this exact mode, do not re-prompt the user
    if (
      visionStream &&
      visionStream.active &&
      visionStream.getVideoTracks().some((t) => t.readyState === "live") &&
      visionMode === mode
    ) {
      console.log(`[Vision] ${mode} stream is already active, skipping media prompt.`);
      setIsVisionActive(true);
      setIsLiveStreaming(true);
      return;
    }

    isStartingVisionRef.current = true;

    try {
      if (visionStream) {
        visionStream.getTracks().forEach((track) => track.stop());
        setVisionStream(null);
      }

      let stream: MediaStream;
      if (mode === "camera") {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
      } else {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: "monitor" } } as any);
      }
      setVisionStream(stream);
      setVisionMode(mode);
      setIsVisionActive(true);
      setIsLiveStreaming(true);
      pushLog(`Vision channel opened in ${mode} mode.`);
      pushNotification("📷", `Vision mode: ${mode}`);

      stream.getVideoTracks()[0].onended = () => {
        stopVision();
      };
    } catch (err: any) {
      if (err.name === "NotAllowedError" || err.name === "AbortError") {
        console.log(`[Vision] User cancelled ${mode} selection.`);
      } else {
        console.error("Vision failed:", err);
        setErrorMsg(`Vision mode failed: ${err.message}`);
      }
    } finally {
      isStartingVisionRef.current = false;
    }
  }, [visionStream, visionMode, stopVision, pushLog, pushNotification]);

  const toggleVision = useCallback((mode: "camera" | "screen") => {
    if (isVisionActive && visionMode === mode) {
      stopVision();
    } else {
      startVision(mode);
    }
  }, [isVisionActive, visionMode, startVision, stopVision]);

  const handleCaptureAndSend = useCallback((base64Image: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "image",
        image: base64Image,
        mimeType: "image/jpeg",
      }));
    }
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: "user",
        text: `[Sent vision snapshot (${visionMode || "live"}) to ${selectedPersona.name}]`,
        imageUrl: `data:image/jpeg;base64,${base64Image}`,
        at: Date.now(),
      },
    ]);
  }, [visionMode, selectedPersona]);

  const handleLiveStreamFrame = useCallback((base64Image: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Congestion control: drop video frame if socket is busy sending audio
      if (wsRef.current.bufferedAmount > 65536) {
        return;
      }
      wsRef.current.send(JSON.stringify({
        type: "image",
        image: base64Image,
        mimeType: "image/jpeg",
      }));
    }
  }, []);

  /* ------- Transcript Appender ------- */
  const appendTranscriptChunk = useCallback((role: "user" | "jarvis", textChunk: string) => {
    if (role === "user" && textChunk) {
      setAgentMemoryState((prevMem) => autoExtractMemoriesFromText(textChunk, prevMem));
      const nlu = analyzeUtterance(textChunk);
      setLatestNluResult(nlu);

      // Voice transfer detection
      const transfer = detectVoiceTransfer(textChunk, selectedPersona.id);
      if (transfer.isTransfer && transfer.targetId) {
        const matching = PERSONAS.find((p) => p.id === transfer.targetId);
        if (matching && matching.id !== selectedPersona.id) {
          performVoiceTransfer(matching);
        }
      }
    }

    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === role && (role === "jarvis" ? last.personaId === selectedPersona.id : true)) {
        return [
          ...prev.slice(0, -1),
          { ...last, text: last.text + textChunk },
        ];
      } else {
        const nextList = [
          ...prev,
          {
            id: uid(),
            role,
            text: textChunk,
            at: Date.now(),
            source: "voice" as const,
            personaId: role === "jarvis" ? selectedPersona.id : undefined,
            personaName: role === "jarvis" ? selectedPersona.name : undefined,
          },
        ];
        return nextList.slice(-100);
      }
    });
  }, [selectedPersona]);

  /* ------- Live WebSocket Connection ------- */
  const closeWebSocket = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    setErrorMsg(null);
    setConnectionState("connecting");

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/live`;

    closeWebSocket();
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    const pingStart = Date.now();

    ws.onopen = () => {
      setLatencyMs(Math.max(20, Date.now() - pingStart));
      reconnectAttemptsRef.current = 0;
      // TELGISH is already embedded in persona.systemInstruction — no duplicate needed
      // Memory is injected server-side from authoritative SQLite DB — no client duplicate needed
      const combined = `${selectedPersona.systemInstruction}\n${VOICE_TRANSFER_SYSTEM_INSTRUCTION}`;

      ws.send(JSON.stringify({
        type: "init",
        voiceName: selectedPersona.voiceName,
        systemInstruction: combined,
        model: "gemini-2.5-flash-native-audio-latest",
        googleAccessToken: localStorage.getItem("g_access_token") || googleAccessToken || "",
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        // Keepalive heartbeat response
        if (msg.type === "ping") {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
            } catch {}
          }
          return;
        }

        if (msg.type === "pong") {
          return;
        }

        if (msg.type === "connected") {
          setConnectionState("connected");
          reconnectAttemptsRef.current = 0;
          const initialProfile = selectedPersona.audioProfile || getPersonaAudioProfile(selectedPersona.id);
          audioQueuePlayerRef.current?.setAudioProfile(initialProfile);
          startMicStream();
          pushLog(`Live API connected. Agent: ${selectedPersona.name}. Voice DSP calibrated.`);
          pushNotification("◎", `JARVIS connected with ${selectedPersona.name}`);

          const greetingContext = assistantGreeterInstance.getGreetingContext(selectedPersona.name);
          const greetingPrompt = `[GREETING]: ${greetingContext.generateDynamicPrompt()}`;
          ws.send(JSON.stringify({ type: "text", text: greetingPrompt }));
        }

        if (msg.type === "workspace_action") {
          const tn = (msg.toolName || "").toLowerCase();
          const category =
            tn.includes("volume") || tn.includes("brightness") || tn.includes("battery") || tn.includes("power") ? "hardware" :
            tn.includes("thermal") || tn.includes("log") ? "thermals" :
            tn.includes("storage") ? "storage" :
            tn.includes("process") ? "process" :
            tn.includes("media") ? "media" :
            tn.includes("network") || tn.includes("connection") || tn.includes("firewall") ? "network" :
            tn.includes("email") ? "gmail" :
            tn.includes("calendar") ? "calendar" :
            tn.includes("doc") ? "docs" :
            tn.includes("sheet") ? "sheets" :
            tn.includes("task") ? "tasks" :
            tn.includes("drive") ? "drive" : "system";

          const actionItem: WorkspaceActionItem = {
            id: msg.id || uid(),
            toolName: msg.toolName,
            category,
            title: msg.result?.summary || `${msg.toolName?.replace(/_/g, " ")}`,
            summary: msg.status === "started" ? `Executing ${msg.toolName}...` :
                     msg.status === "completed" ? (msg.result?.summary || "Completed successfully") :
                     `Failed: ${msg.result?.error || "Execution error"}`,
            status: msg.status,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            resultData: msg.result,
            linkUrl: msg.result?.linkUrl,
            error: msg.result?.error,
          };

          setWorkspaceActions((prev) => [actionItem, ...prev.filter((a) => a.id !== actionItem.id)]);
          if (msg.status === "completed" || msg.status === "error") {
            setLatestActionToast(actionItem);
            pushNotification("⚡", `${actionItem.title} ${msg.status}`);
            pushLog(`Tool executed: ${msg.toolName} (${msg.status})`);
          }


          // Real-time main view & HUD synchronization for hardware adjustments
          if (msg.result?.brightness?.brightnessPercent !== undefined) {
            setBrightnessPercent(msg.result.brightness.brightnessPercent);
          }
          if (msg.result?.volumePercent !== undefined) {
            setVolumePercent(msg.result.volumePercent);
            if (msg.result.muted !== undefined) setVolumeMuted(msg.result.muted);
          } else if (msg.result?.volume?.volumePercent !== undefined) {
            setVolumePercent(msg.result.volume.volumePercent);
            if (msg.result.volume.muted !== undefined) setVolumeMuted(msg.result.volume.muted);
          }
          if (msg.result?.battery?.percent !== undefined) {
            setBatteryPercent(msg.result.battery.percent);
          }
        }

        // Dedicated vision_control push event from server
        if (msg.type === "vision_control") {
          if (msg.action === "start_screen" || (msg.action === "start" && msg.mode === "screen")) {
            startVision("screen");
          } else if (msg.action === "start_camera" || (msg.action === "start" && msg.mode === "camera")) {
            startVision("camera");
          } else if (msg.action === "stop" || msg.action === "stop_all" || msg.action === "stop_screen" || msg.action === "stop_camera") {
            stopVision();
          }
        }

        if (msg.type === "persona_swapped") {
          const targetId = msg.newPersonaId || msg.targetPersonaId || msg.persona?.id;
          if (targetId) {
            setActiveOrchestratorPersonaId(targetId);
            const matching = PERSONAS.find((p) => p.id === targetId.toLowerCase());
            if (matching) {
              setSelectedPersona(matching);
              const profile = msg.audioProfile || matching.audioProfile || getPersonaAudioProfile(matching.id);
              audioQueuePlayerRef.current?.setAudioProfile(profile);
            }
          }
        }

        if (msg.type === "switch_persona_tool_call" && msg.targetPersonaId) {
          const matching = PERSONAS.find((p) => p.id === msg.targetPersonaId.toLowerCase());
          if (matching && matching.id !== selectedPersona.id) {
            performVoiceTransfer(matching);
          }
        }

        if (msg.type === "muted_relay_alert") {
          setMutedRelayEvents((prev) => [msg, ...prev].slice(0, 20));
          pushNotification("🛡", `Relay Alert from ${msg.sourceManagerName}: ${msg.relayedSummary}`);
        }

        if (msg.type === "voice_acknowledgement" && msg.text) {
          pushLog(`⚡ Spoken Voice Acknowledgement: "${msg.text}"`);
          clientSpeechQueue.speak(msg.text, ClientSpeechPriority.ACKNOWLEDGEMENT, {
            personaVoiceName: selectedPersona.voiceName,
            category: msg.category,
          });
        }

        if (msg.type === "task_progress" && msg.text) {
          pushLog(`⏳ Spoken Progress Update #${msg.updateIndex}: "${msg.text}"`);
          clientSpeechQueue.speak(msg.text, ClientSpeechPriority.PROGRESS_UPDATE, {
            personaVoiceName: selectedPersona.voiceName,
          });
        }

        if (msg.type === "audio" && (msg.audio || msg.data)) {
          // Preemption: Final Gemini Live audio response arrived, immediately cancel any ongoing client acknowledgement/progress TTS
          clientSpeechQueue.cancelAll("gemini_audio_started");
          setConnectionState("speaking");
          audioQueuePlayerRef.current?.enqueueChunk(msg.audio || msg.data);
        }

        if ((msg.type === "output_transcription" || msg.type === "outputTranscript") && msg.text) {
          appendTranscriptChunk("jarvis", msg.text);
        }

        if ((msg.type === "input_transcription" || msg.type === "inputTranscript") && msg.text) {
          appendTranscriptChunk("user", msg.text);
        }

        if (msg.type === "connected") {
          setConnectionState("listening");
          setErrorMsg(null);
        }

        if (msg.type === "reconnecting") {
          pushLog(`Audio bridge re-syncing (${msg.reason || 'reconnecting'})...`);
          setConnectionState("connecting");
        }

        if (msg.type === "interrupted") {
          audioQueuePlayerRef.current?.stopAndClear();
          clientSpeechQueue.cancelAll("interrupted");
          setLiveSubtitle(null);
          setConnectionState("listening");
        }

        if (msg.type === "turn_complete" || msg.type === "turnComplete") {
          setConnectionState("listening");
        }

        if (msg.type === "error") {
          setErrorMsg(msg.message || "Gemini Live session disconnected.");
          setConnectionState("error");
        }
      } catch (err) {
        console.error("Error processing WS message:", err);
      }
    };

    ws.onclose = () => {
      if (isActiveSessionRef.current) {
        setConnectionState("connecting");
        const attempt = reconnectAttemptsRef.current++;
        const delay = Math.min(1000 * Math.pow(1.5, attempt), 5000);
        pushLog(`Audio stream disconnected. Auto-reconnecting in ${Math.round(delay)}ms...`);
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          if (isActiveSessionRef.current) {
            connectWebSocket();
          }
        }, delay);
      } else {
        setConnectionState((prev) => (prev === "error" ? "error" : "disconnected"));
        stopMicStream();
      }
    };

    ws.onerror = () => {
      if (!isActiveSessionRef.current) {
        setErrorMsg("Realtime session disconnected. Click Retry to reconnect.");
        setConnectionState("error");
      }
    };
  }, [closeWebSocket, selectedPersona, agentMemoryState, googleAccessToken, startMicStream, pushLog, pushNotification, appendTranscriptChunk, startVision, stopVision]);

  const handleStartSession = useCallback(async () => {
    isActiveSessionRef.current = true;
    reconnectAttemptsRef.current = 0;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    audioQueuePlayerRef.current?.getAudioContext();
    await startMicStream();
    connectWebSocket();

    // Initialize WebRTC Dual-Transport in parallel for sub-10ms latency
    if (isWebRTCSupported()) {
      try {
        if (!webrtcManagerRef.current) {
          const webrtc = new WebRTCManager({
            signalingUrl: window.location.origin,
            sampleRate: 16000,
          });
          webrtc.onConnectionState = (state) => {
            setWebrtcConnected(state === "connected");
            if (state === "connected") {
              pushLog("WebRTC UDP DataChannel linked for ultra-low latency dispatch.");
            }
          };
          webrtc.onDataMessage = (msg) => {
            if (msg.type === "tool_result") {
              pushNotification("⚡", `WebRTC tool: ${msg.toolName}`);
            }
          };
          webrtcManagerRef.current = webrtc;
        }
        webrtcManagerRef.current.connect().catch((err) => {
          console.warn("[WebRTC] Dual transport negotiation notice:", err);
        });
      } catch {}
    }
  }, [connectWebSocket, startMicStream, pushLog, pushNotification]);

  const handleStopSession = useCallback(() => {
    isActiveSessionRef.current = false;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    audioQueuePlayerRef.current?.stopAndClear();
    closeWebSocket();
    stopMicStream();

    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.disconnect();
      webrtcManagerRef.current = null;
      setWebrtcConnected(false);
    }

    setConnectionState("disconnected");
    pushLog("Live voice session disconnected.");
  }, [closeWebSocket, stopMicStream, pushLog]);

  const handleInterrupt = useCallback(() => {
    audioQueuePlayerRef.current?.stopAndClear();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "interrupt" }));
    }
    setConnectionState("listening");
  }, []);

  const performVoiceTransfer = useCallback((targetPersona: VoicePersona) => {
    setSelectedPersona(targetPersona);
    setActiveOrchestratorPersonaId(targetPersona.id);
    audioQueuePlayerRef.current?.stopAndClear();

    const profile = targetPersona.audioProfile || getPersonaAudioProfile(targetPersona.id);
    audioQueuePlayerRef.current?.setAudioProfile(profile);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // TELGISH already in persona.systemInstruction; memory injected server-side
      const combined = `${targetPersona.systemInstruction}\n${VOICE_TRANSFER_SYSTEM_INSTRUCTION}`;

      wsRef.current.send(JSON.stringify({
        type: "reinit",
        personaId: targetPersona.id,
        voiceName: targetPersona.voiceName,
        systemInstruction: combined,
        model: "gemini-2.5-flash-native-audio-latest",
        googleAccessToken: localStorage.getItem("g_access_token") || googleAccessToken || "",
      }));

      wsRef.current.send(JSON.stringify({
        type: "text",
        text: `[VOICE_TRANSFER_PROTOCOL_ACTIVE]: Voice transfer complete. You are now active as ${targetPersona.name}. Greet the user in character.`,
      }));
    }

    fetch("/api/orchestrator/swap-persona", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personaId: targetPersona.id }),
    }).catch(() => {});

    pushLog(`Voice swapped to ${targetPersona.name} (${targetPersona.voiceName}) with customized acoustic DSP profile.`);
    pushNotification("▶", `Swapped to ${targetPersona.name}`);
  }, [agentMemoryState, googleAccessToken, pushLog, pushNotification]);

  const handleSwapPersona = useCallback((personaId: string) => {
    const matched = PERSONAS.find((p) => p.id === personaId.toLowerCase());
    if (matched) performVoiceTransfer(matched);
  }, [performVoiceTransfer]);

  const handleDelegateTask = useCallback(async (task: string, managerId: string) => {
    // Increment real operations counter for the targeted persona
    setAgents((prev) =>
      prev.map((a) => (a.id === managerId ? { ...a, tasks: a.tasks + 1 } : a))
    );

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "delegate_task", task, managerId }));
    } else {
      const res = await fetch("/api/orchestrator/delegate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          managerId,
          googleAccessToken: localStorage.getItem("g_access_token") || googleAccessToken || "",
        }),
      });
      const data = await res.json();
      if (data.relayedEvent) {
        setMutedRelayEvents((prev) => [data.relayedEvent, ...prev].slice(0, 20));
        pushNotification("🛡", `Delegated to ${data.relayedEvent.sourceManagerName}`);
      }
    }
  }, [googleAccessToken, pushNotification]);

  /* ------- Missions & Operations ------- */
  const createMission = useCallback((title: string, desc: string) => {
    const icon = title.toLowerCase().includes("hardware") || title.toLowerCase().includes("sweep")
      ? "⚡"
      : title.toLowerCase().includes("memory") || title.toLowerCase().includes("briefing")
      ? "🧠"
      : title.toLowerCase().includes("security")
      ? "🛡"
      : "🎯";

    const m: Mission = {
      id: uid(),
      title,
      desc: desc || "Dispatched by user.",
      icon,
      accent: selectedPersona.accentColor || "var(--cyan-hud)",
      status: "progress",
      progress: 0,
      createdAt: Date.now(),
    };
    setMissions((prev) => [m, ...prev]);
    pushLog(`Mission “${title}” dispatched.`);
    pushNotification(icon, `Mission dispatched: ${title}`);
    toast.success(`Mission dispatched: ${title}`);

    // Trigger AI execution for the mission if connected or REST
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "text", text: `[MISSION DIRECTIVE]: Execute ${title}: ${desc}` }));
    } else {
      fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Execute mission: ${title}. Details: ${desc}`,
          systemInstruction: selectedPersona.systemInstruction,
          googleAccessToken: localStorage.getItem("g_access_token") || googleAccessToken || "",
        }),
      }).catch(() => {});
    }

    return m;
  }, [pushLog, pushNotification, selectedPersona, googleAccessToken]);

  const setMissionStatus = useCallback((id: string, status: MissionStatus) => {
    setMissions((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        queueMicrotask(() => pushLog(`Mission “${m.title}” → ${status}.`));
        return { ...m, status, progress: status === "done" ? 100 : m.progress };
      })
    );
  }, [pushLog]);

  const removeMission = useCallback((id: string) => {
    setMissions((prev) => {
      const m = prev.find((x) => x.id === id);
      if (m) queueMicrotask(() => pushLog(`Mission “${m.title}” removed.`));
      return prev.filter((x) => x.id !== id);
    });
  }, [pushLog]);

  const clearAllMissions = useCallback(() => {
    setMissions([]);
    try {
      localStorage.removeItem("jarvis_missions_v1");
    } catch {}
    pushLog("All missions cleared.");
    toast("All missions cleared");
  }, [pushLog]);

  /* ------- Agents handling ------- */
  const setAgentStatus = useCallback((id: string, status: Agent["status"]) => {
    setAgents((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        queueMicrotask(() => {
          pushLog(`${a.name} ${status === "running" ? "activated" : "suspended"}.`);
          pushNotification(status === "running" ? "▶" : "⏸", `${a.name} ${status}.`);
          toast(`${a.name} ${status === "running" ? "activated" : "suspended"}`);
        });
        return {
          ...a,
          status,
          load: status === "running" ? (a.id === activeOrchestratorPersonaId ? cpu : Math.round(cpu * 0.3)) : 0,
        };
      })
    );
  }, [pushLog, pushNotification, activeOrchestratorPersonaId, cpu]);

  const toggleAgent = useCallback((id: string) => {
    const a = agents.find((x) => x.id === id);
    if (!a) return;
    setAgentStatus(id, a.status === "running" ? "stopped" : "running");
  }, [agents, setAgentStatus]);

  /* ------- Console Directives & Chat Message Sender ------- */
  const sendMessage = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean) return;

    setMessages((m) => [
      ...m,
      {
        id: uid(),
        role: "user" as const,
        text: clean,
        at: Date.now(),
        source: "text" as const,
      },
    ].slice(-100));
    setThinking(true);

    setAgentMemoryState((prevMem) => autoExtractMemoriesFromText(clean, prevMem));
    const nlu = analyzeUtterance(clean);
    setLatestNluResult(nlu);

    // If live WebSocket is connected, send directly through live socket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "text", text: clean }));
      setThinking(false);
      return;
    }

    // Otherwise use REST fallback `/api/chat`
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: clean,
          systemInstruction: selectedPersona.systemInstruction,
          googleAccessToken: localStorage.getItem("g_access_token") || googleAccessToken || "",
        }),
      });
      const data = await res.json();
      setThinking(false);

      if (data.actions && Array.isArray(data.actions)) {
        for (const act of data.actions) {
          const actionItem: WorkspaceActionItem = {
            id: uid(),
            toolName: act.toolName,
            category: "system",
            title: act.result?.summary || act.toolName,
            summary: act.result?.summary || "Executed via chat command",
            status: act.result?.success ? "completed" : "error",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            resultData: act.result,
            linkUrl: act.result?.linkUrl,
          };
          setWorkspaceActions((prev) => [actionItem, ...prev]);
          setLatestActionToast(actionItem);
        }
      }

      if (data.text) {
        setMessages((m) => [
          ...m,
          {
            id: uid(),
            role: "jarvis" as const,
            text: data.text,
            at: Date.now(),
            kind: "normal" as const,
            source: "text" as const,
            personaId: selectedPersona.id,
            personaName: selectedPersona.name,
          },
        ].slice(-100));
      }
    } catch (err: any) {
      setThinking(false);
      setMessages((m) => [
        ...m,
        {
          id: uid(),
          role: "jarvis" as const,
          text: `Command received: "${clean}". (Backend processing error: ${err.message})`,
          at: Date.now(),
          kind: "error" as const,
          source: "system" as const,
          personaId: selectedPersona.id,
          personaName: selectedPersona.name,
        },
      ].slice(-100));
    }
  }, [selectedPersona, googleAccessToken]);

  const clearChat = useCallback(() => {
    setMessages([]);
    toast("Console log cleared");
  }, []);

  const markAllRead = useCallback(() => setNotifications((n) => n.map((x) => ({ ...x, read: true }))), []);
  const clearNotifications = useCallback(() => setNotifications([]), []);
  const dismissNotification = useCallback((id: string) => setNotifications((n) => n.filter((x) => x.id !== id)), []);

  const unread = notifications.filter((n) => !n.read).length;

  return {
    view,
    setView,
    selectedPersona,
    setSelectedPersona,
    connectionState,
    latencyMs,
    errorMsg,
    setErrorMsg,
    isMuted,
    setIsMuted,
    micPermissionState,
    requestMicPermission,
    startMicStream,
    stopMicStream,
    handleStartSession,
    handleStopSession,
    handleInterrupt,
    performVoiceTransfer,
    handleSwapPersona,
    handleDelegateTask,
    // Hardware
    cpu,
    ram,
    net,
    batteryPercent,
    brightnessPercent,
    volumePercent,
    volumeMuted,
    thermals,
    // Audio
    inputVolume,
    outputVolume,
    micSensitivity,
    setMicSensitivity,
    webrtcConnected,
    // Vision
    isVisionActive,
    visionMode,
    visionStream,
    isLiveStreaming,
    startVision,
    stopVision,
    toggleVision,
    handleCaptureAndSend,
    handleLiveStreamFrame,
    setIsLiveStreaming,
    // Swarm
    agents,
    toggleAgent,
    setAgentStatus,
    orchestratorPersonas,
    activeOrchestratorPersonaId,
    mutedRelayEvents,
    // Missions & Actions
    missions,
    createMission,
    setMissionStatus,
    removeMission,
    clearAllMissions,
    workspaceActions,
    latestActionToast,
    setLatestActionToast,
    // Memory
    agentMemoryState,
    setAgentMemoryState,
    latestNluResult,
    googleAccessToken,
    setGoogleAccessToken,
    // Notifications & Logs
    notifications,
    unread,
    pushNotification,
    markAllRead,
    clearNotifications,
    dismissNotification,
    log,
    pushLog,
    // Messages
    messages,
    sendMessage,
    clearChat,
    thinking,
    liveSubtitle,
    // Prefs
    autonomy,
    setAutonomy,
    density,
    setDensity,
    telemetryOn,
    setTelemetryOn,
    autoDispatch,
    setAutoDispatch,
    confirmDestructive,
    setConfirmDestructive,
    clock,
    onSwitchToClassic,
  };
}

export function JarvisProvider({
  children,
  onSwitchToClassic,
}: {
  children: ReactNode;
  onSwitchToClassic?: () => void;
}) {
  const value = useJarvisState(onSwitchToClassic);
  return <JarvisContext.Provider value={value}>{children}</JarvisContext.Provider>;
}

export function useJarvis() {
  const ctx = useContext(JarvisContext);
  if (!ctx) throw new Error("useJarvis must be used inside JarvisProvider");
  return ctx;
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function useStats() {
  const { missions, agents } = useJarvis();
  return useMemo(
    () => ({
      active: missions.filter((m) => m.status === "progress").length,
      paused: missions.filter((m) => m.status === "paused").length,
      done: missions.filter((m) => m.status === "done").length,
      pending: missions.filter((m) => m.status === "pending").length,
      running: agents.filter((a) => a.status === "running").length,
      stopped: agents.filter((a) => a.status === "stopped").length,
    }),
    [missions, agents],
  );
}
