import express from 'express';
import http from 'http';
import path from 'path';
import os from 'os';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import dotenv from 'dotenv';
import { WORKSPACE_FUNCTION_DECLARATIONS, executeWorkspaceTool } from './src/utils/workspace_tools';
import { executeUnifiedAiChat, AiProvider } from './src/utils/ai_engine';
import { analyzeUtterance } from './src/utils/nlu_engine';
import { masterOrchestratorInstance } from './src/utils/multi_agent_orchestrator';
import { getAllPersonaPrompts, loadPersonaPrompt } from './src/utils/prompt_loader';
import {
  getSystemTelemetryGroundTruth,
  getSystemInfoSummaryForLLM,
  getBatteryStatus,
  getSystemVolume,
  setSystemVolume,
  getScreenBrightness,
  setScreenBrightness,
  getThermalSensors,
  getDetailedStorageUsage,
  launchApplication,
  listInstalledApplications,
  getRunningProcesses,
  manageProcess,
  controlMediaPlayback,
  systemPowerAction,
  sendDesktopNotification,
  getPowerProfile,
  setPowerProfile,
  getNetworkStatusGroundTruth,
  executeSystemCommand,
  searchLocalFiles,
  readLocalFile,
  writeLocalFile,
  takeScreenshot,
  getPcSpecGroundTruth,
  getFirewallStatus,
  desktopControlAction,
  manageSystemdService,
  getSystemLogs,
  managePackages,
  getNetworkConnections,
  listDirectory,
  deleteLocalFile,
  clipboardControl,
  getEnvironmentInfo
} from './src/utils/system_controller';

dotenv.config();

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  const server = http.createServer(app);

  const getAi = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not set in environment');
    }
    return new GoogleGenAI({
      apiKey: apiKey || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  };

  // Health check API
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasApiKey: !!process.env.GEMINI_API_KEY,
      timestamp: new Date().toISOString()
    });
  });

  // --- Real-time System Telemetry & Computer Use REST Endpoints ---
  app.get('/api/system/telemetry', async (_req, res) => {
    try {
      const telemetry = await getSystemTelemetryGroundTruth();
      res.json(telemetry);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/system/hardware', async (_req, res) => {
    try {
      const [volume, brightness, battery, powerProfile, thermals] = await Promise.all([
        getSystemVolume(),
        getScreenBrightness(),
        getBatteryStatus(),
        getPowerProfile(),
        getThermalSensors()
      ]);
      res.json({ volume, brightness, battery, powerProfile, thermals });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/system/thermals', async (_req, res) => {
    try {
      const thermals = await getThermalSensors();
      res.json(thermals);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/system/storage', async (_req, res) => {
    try {
      const storage = await getDetailedStorageUsage();
      res.json({ mounts: storage });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/system/apps', async (_req, res) => {
    try {
      const apps = await listInstalledApplications();
      res.json({ total: apps.length, applications: apps });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/system/processes', async (req, res) => {
    try {
      const sortBy = (req.query.sortBy as any) || 'cpu';
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const processes = await getRunningProcesses({ sortBy, limit });
      res.json({ total: processes.length, processes });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/system/control', async (req, res) => {
    try {
      const { action, percent, relative, mute, toggleMute, target, appNameOrCommand, args, pid, processName, signal, profile, mediaAction, powerAction, title, message, urgency, icon, outputPath, filePath, content, append, maxLines, offset } = req.body;
      switch (action) {
        case 'set_volume': {
          const result = await setSystemVolume({ percent, relative, mute, toggleMute, target });
          return res.json(result);
        }
        case 'set_brightness': {
          const result = await setScreenBrightness({ percent, relative });
          return res.json(result);
        }
        case 'launch_app': {
          const result = await launchApplication({ appNameOrCommand, args });
          return res.json(result);
        }
        case 'manage_process': {
          const result = await manageProcess({ pid, processName, signal });
          return res.json(result);
        }
        case 'set_power_profile': {
          const result = await setPowerProfile(profile);
          return res.json(result);
        }
        case 'control_media': {
          const result = await controlMediaPlayback(mediaAction || 'toggle');
          return res.json(result);
        }
        case 'power_action': {
          const result = await systemPowerAction(powerAction || 'lock');
          return res.json(result);
        }
        case 'send_notification': {
          const result = await sendDesktopNotification({ title, message, urgency, icon });
          return res.json(result);
        }
        case 'take_screenshot': {
          const result = await takeScreenshot(outputPath);
          return res.json(result);
        }
        case 'read_file': {
          const result = await readLocalFile({ filePath, maxLines, offset });
          return res.json(result);
        }
        case 'write_file': {
          const result = await writeLocalFile({ filePath, content, append });
          return res.json(result);
        }
        default:
          return res.status(400).json({ error: `Unknown control action: ${action}` });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/system/exec', async (req, res) => {
    try {
      const { command, cwd, timeoutMs } = req.body;
      if (!command) {
        return res.status(400).json({ error: 'Command is required' });
      }
      const result = await executeSystemCommand({ command, cwd, timeoutMs });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Direct Workspace tool execution REST endpoint
  app.post('/api/workspace/execute', async (req, res) => {
    try {
      const { toolName, args, googleAccessToken } = req.body;
      const token = googleAccessToken || (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : '');
      const result = await executeWorkspaceTool(toolName, args || {}, token);
      res.json(result);
    } catch (err: any) {
      console.error('Workspace Execute Error:', err);
      res.status(500).json({ success: false, error: err.message || 'Tool execution failed' });
    }
  });

  // Unified Multi-Engine REST endpoint (Groq Ultra-Fast, NVIDIA Complex Tasks, Gemini Multimodal)
  app.post('/api/chat', async (req, res) => {
    try {
      const { message, systemInstruction, googleAccessToken, provider, model, history } = req.body;
      const token = googleAccessToken || (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : '');

      const result = await executeUnifiedAiChat({
        message,
        systemInstruction,
        googleAccessToken: token,
        provider: (provider as AiProvider) || 'auto',
        model,
        history
      });

      res.json(result);
    } catch (err: any) {
      console.error('API Chat Error:', err);
      res.status(500).json({ error: err.message || 'Failed to generate response' });
    }
  });

  // AI Providers & Engines Live Health Status
  app.get('/api/providers/status', async (_req, res) => {
    res.json({
      activeEngines: {
        groq: {
          configured: !!process.env.GROQ_API_KEY,
          role: 'Ultra-Fast Execution & Instant Tactical Tool Calls (sub-50ms)',
          defaultModel: 'llama-3.3-70b-versatile'
        },
        nvidia: {
          configured: !!process.env.NVIDIA_API_KEY,
          role: 'Complex Systems Automation, Forensics & Deep Multi-Step Tasks',
          defaultModel: 'meta/llama-3.1-70b-instruct'
        },
        gemini: {
          configured: !!process.env.GEMINI_API_KEY,
          role: 'Voice Multimodal Live Audio/Video Stream & Screen Ingestion',
          defaultModel: 'gemini-2.5-flash / gemini-3.1-flash-live-preview'
        }
      }
    });
  });

  // Natural Language Understanding (NLU) Real-Time Utterance Analyzer
  app.post('/api/nlu/analyze', (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Valid text string is required.' });
      }
      const nluResult = analyzeUtterance(text);
      res.json(nluResult);
    } catch (err: any) {
      console.error('NLU API Error:', err);
      res.status(500).json({ error: err.message || 'Failed to analyze text' });
    }
  });

  // =========================================================================
  // --- PHASE 4: MASTER MULTI-AGENT ORCHESTRATOR REST APIS ---
  // =========================================================================

  // 1. Get Ecosystem Multi-Agent Status
  app.get('/api/orchestrator/status', (_req, res) => {
    try {
      const activePersona = masterOrchestratorInstance.getActivePersona();
      const personas = masterOrchestratorInstance.getAllPersonas();
      const mutedRelayEvents = masterOrchestratorInstance.getMutedRelayEvents();
      res.json({
        activePersonaId: activePersona.id,
        activePersona,
        personas,
        mutedRelayEvents
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Hot-Swap Active Persona (Voice Patch-Through)
  app.post('/api/orchestrator/swap-persona', (req, res) => {
    try {
      const { personaId } = req.body;
      if (!personaId) {
        return res.status(400).json({ error: 'personaId is required' });
      }
      const result = masterOrchestratorInstance.swapActivePersona(personaId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Delegate Task to Background Manager (Muted Relay Protocol)
  app.post('/api/orchestrator/delegate', async (req, res) => {
    try {
      const { task, managerId, googleAccessToken } = req.body;
      if (!task || !managerId) {
        return res.status(400).json({ error: 'task and managerId are required' });
      }
      const result = await masterOrchestratorInstance.delegateTask(task, managerId, googleAccessToken);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Get All System Prompts from config/prompts/
  app.get('/api/orchestrator/prompts', (_req, res) => {
    try {
      const prompts = getAllPersonaPrompts();
      res.json(prompts);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =========================================================================
  // --- NATIVE C++ SYSTEM CONTROL & INFORMATION RETRIEVAL REST API ---
  // =========================================================================

  // 1. Full PC Hardware & System Specifications (Zero Hallucination Ground Truth)
  app.get('/api/system/spec', async (_req, res) => {
    try {
      const spec = await getPcSpecGroundTruth();
      res.json(spec);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Real-time System Telemetry Snapshot
  app.get('/api/system/telemetry', async (_req, res) => {
    try {
      const telemetry = await getSystemTelemetryGroundTruth();
      res.json(telemetry);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Hardware Controller (Volume, Brightness, Battery, Power Profile)
  app.get('/api/system/hardware', async (_req, res) => {
    try {
      const [volume, brightness, battery, powerProfile] = await Promise.all([
        getSystemVolume(),
        getScreenBrightness(),
        getBatteryStatus(),
        getPowerProfile()
      ]);
      res.json({ volume, brightness, battery, powerProfile });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/system/volume', async (req, res) => {
    try {
      const result = await setSystemVolume(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/system/brightness', async (req, res) => {
    try {
      const result = await setScreenBrightness(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/system/power-profile', async (req, res) => {
    try {
      const result = await setPowerProfile(req.body.profile);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/system/power-action', async (req, res) => {
    try {
      const result = await systemPowerAction(req.body.action);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Process Manager & Task Controller
  app.get('/api/system/processes', async (req, res) => {
    try {
      const sortBy = (req.query.sortBy as any) || 'memory';
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const processes = await getRunningProcesses({ sortBy, limit });
      res.json({ total: processes.length, processes });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/system/processes/kill', async (req, res) => {
    try {
      const result = await manageProcess(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Thermal Sensors
  app.get('/api/system/thermals', async (_req, res) => {
    try {
      const thermals = await getThermalSensors();
      res.json(thermals);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Detailed Storage & Mounts
  app.get('/api/system/storage', async (_req, res) => {
    try {
      const storage = await getDetailedStorageUsage();
      res.json({ mounts: storage, count: storage.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. Network & WiFi Inspector
  app.get('/api/system/network', async (_req, res) => {
    try {
      const network = await getNetworkStatusGroundTruth();
      res.json(network);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 8. Firewall & Security Audit
  app.get('/api/system/firewall', async (_req, res) => {
    try {
      const firewall = await getFirewallStatus();
      res.json(firewall);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 9. Desktop Control & Computer Use Automation
  app.post('/api/system/desktop', async (req, res) => {
    try {
      const result = await desktopControlAction(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 10. Systemd Service Manager
  app.get('/api/system/services', async (_req, res) => {
    try {
      const result = await manageSystemdService({ action: 'list' });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/system/services/action', async (req, res) => {
    try {
      const result = await manageSystemdService(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 11. System Logs
  app.get('/api/system/logs', async (req, res) => {
    try {
      const source = (req.query.source as any) || 'journalctl';
      const unit = req.query.unit as string | undefined;
      const lines = parseInt(req.query.lines as string, 10) || 50;
      const priority = req.query.priority as string | undefined;
      const since = req.query.since as string | undefined;
      const grep = req.query.grep as string | undefined;
      const result = await getSystemLogs({ source, unit, lines, priority, since, grep });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 12. Package Manager
  app.post('/api/system/packages', async (req, res) => {
    try {
      const result = await managePackages(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 13. Network Connections & Sockets
  app.get('/api/system/connections', async (req, res) => {
    try {
      const filter = (req.query.filter as any) || 'all';
      const limit = parseInt(req.query.limit as string, 10) || 40;
      const result = await getNetworkConnections({ filter, limit });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 14. Directory Listing
  app.post('/api/system/list-dir', async (req, res) => {
    try {
      const result = await listDirectory(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 15. Delete File/Dir
  app.post('/api/system/delete-file', async (req, res) => {
    try {
      const result = await deleteLocalFile(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 16. Clipboard Control
  app.post('/api/system/clipboard', async (req, res) => {
    try {
      const result = await clipboardControl(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 17. Environment Info
  app.get('/api/system/env', async (_req, res) => {
    try {
      const result = await getEnvironmentInfo();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- WebRTC Signaling & Telemetry Hub ---
  interface WebRTCSession {
    id: string;
    clientId: string;
    created: number;
    lastActive: number;
    iceCandidates: any[];
    state: 'offered' | 'connected' | 'disconnected';
    activePersona: string;
    muted: boolean;
  }

  const webrtcSessions = new Map<string, WebRTCSession>();
  const clientSessionMap = new Map<string, string>();

  function getSystemTelemetry() {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePercent = Math.round((usedMem / totalMem) * 100);
    const loadAvg = os.loadavg();
    const uptimeSeconds = Math.round(os.uptime());

    return {
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || 'Unknown',
        speed: cpus[0]?.speed || 0,
        load1m: Math.round(loadAvg[0] * 100) / 100,
        load5m: Math.round(loadAvg[1] * 100) / 100,
        load15m: Math.round(loadAvg[2] * 100) / 100,
        usagePercent: Math.min(100, Math.round((loadAvg[0] / Math.max(1, cpus.length)) * 100))
      },
      memory: {
        totalMb: Math.round(totalMem / (1024 * 1024)),
        usedMb: Math.round(usedMem / (1024 * 1024)),
        freeMb: Math.round(freeMem / (1024 * 1024)),
        usagePercent: memUsagePercent
      },
      uptimeSeconds,
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      timestamp: Date.now()
    };
  }

  function generateSdpAnswer(offerSdp: string, _sessionId: string): string {
    const lines = offerSdp.split(/\r?\n/);
    const mids: string[] = [];
    const mediaSections: { type: string; port: string; proto: string; fmt: string; mid?: string }[] = [];
    let currentMedia: any = null;

    for (const line of lines) {
      if (line.startsWith('m=')) {
        const parts = line.substring(2).split(' ');
        currentMedia = {
          type: parts[0],
          port: parts[1] || '9',
          proto: parts[2] || 'UDP/TLS/RTP/SAVPF',
          fmt: parts.slice(3).join(' ')
        };
        mediaSections.push(currentMedia);
      } else if (line.startsWith('a=mid:') && currentMedia) {
        currentMedia.mid = line.substring(6).trim();
        mids.push(currentMedia.mid);
      }
    }

    const ufrag = 'jarvis_' + Math.random().toString(36).substring(2, 8);
    const pwd = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const fingerprint = '4A:AD:B9:B1:3F:82:18:3B:54:02:12:DF:3E:5D:49:6B:19:E5:7C:AB:0A:7A:B4:42:04:88:C4:4B:B2:D6:17:80';

    const answerLines: string[] = [
      'v=0',
      `o=- ${Date.now()} 2 IN IP4 127.0.0.1`,
      's=Jarvis-WebRTC-Hub',
      't=0 0'
    ];

    if (mids.length > 0) {
      answerLines.push(`a=group:BUNDLE ${mids.join(' ')}`);
    }
    answerLines.push('a=msid-semantic: WMS *');

    for (let i = 0; i < mediaSections.length; i++) {
      const m = mediaSections[i];
      const mid = m.mid !== undefined ? m.mid : String(i);

      if (m.type === 'audio') {
        answerLines.push(`m=audio 9 UDP/TLS/RTP/SAVPF 111 0 8`);
        answerLines.push('c=IN IP4 0.0.0.0');
        answerLines.push(`a=mid:${mid}`);
        answerLines.push(`a=ice-ufrag:${ufrag}`);
        answerLines.push(`a=ice-pwd:${pwd}`);
        answerLines.push(`a=fingerprint:sha-256 ${fingerprint}`);
        answerLines.push('a=setup:active');
        answerLines.push('a=sendrecv');
        answerLines.push('a=rtcp-mux');
        answerLines.push('a=rtpmap:111 opus/48000/2');
        answerLines.push('a=rtcp-fb:111 transport-cc');
        answerLines.push('a=fmtp:111 minptime=10;useinbandfec=1');
        answerLines.push('a=rtpmap:0 PCMU/8000');
        answerLines.push('a=rtpmap:8 PCMA/8000');
      } else if (m.type === 'application') {
        answerLines.push(`m=application 9 UDP/DTLS/SCTP webrtc-datachannel`);
        answerLines.push('c=IN IP4 0.0.0.0');
        answerLines.push(`a=mid:${mid}`);
        answerLines.push(`a=ice-ufrag:${ufrag}`);
        answerLines.push(`a=ice-pwd:${pwd}`);
        answerLines.push(`a=fingerprint:sha-256 ${fingerprint}`);
        answerLines.push('a=setup:active');
        answerLines.push('a=sctp-port:5000');
        answerLines.push('a=max-message-size:262144');
      } else {
        answerLines.push(`m=${m.type} 0 ${m.proto} ${m.fmt}`);
        if (m.mid) {
          answerLines.push(`a=mid:${m.mid}`);
        }
      }
    }

    return answerLines.join('\r\n') + '\r\n';
  }

  // WebRTC Signaling: SDP Offer exchange
  app.post('/api/webrtc/offer', async (req, res) => {
    try {
      const { sdp, type, clientId } = req.body;
      if (!sdp || !type) {
        return res.status(400).json({ error: 'Missing SDP offer or type' });
      }

      const effectiveClientId = clientId || 'client_' + Date.now();
      const sessionId = 'session_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();

      const session: WebRTCSession = {
        id: sessionId,
        clientId: effectiveClientId,
        created: Date.now(),
        lastActive: Date.now(),
        iceCandidates: [],
        state: 'offered',
        activePersona: 'jarvis',
        muted: false
      };

      webrtcSessions.set(sessionId, session);
      clientSessionMap.set(effectiveClientId, sessionId);

      const answerSdp = generateSdpAnswer(sdp, sessionId);

      console.log(`[WebRTC Signaling] Processed SDP offer for client ${effectiveClientId}, assigned session ${sessionId}`);

      res.json({
        type: 'answer',
        sdp: answerSdp,
        sessionId,
        clientId: effectiveClientId
      });
    } catch (err: any) {
      console.error('[WebRTC Offer Error]:', err);
      res.status(500).json({ error: err.message || 'Failed to process SDP offer' });
    }
  });

  // WebRTC Signaling: ICE Candidate Exchange
  app.post('/api/webrtc/ice', (req, res) => {
    try {
      const { candidate, sdpMid, sdpMLineIndex, clientId, sessionId } = req.body;
      if (!candidate) {
        return res.status(400).json({ error: 'Missing ICE candidate' });
      }

      const effectiveSessionId = sessionId || (clientId ? clientSessionMap.get(clientId) : null);
      if (effectiveSessionId && webrtcSessions.has(effectiveSessionId)) {
        const session = webrtcSessions.get(effectiveSessionId)!;
        session.iceCandidates.push({ candidate, sdpMid, sdpMLineIndex, timestamp: Date.now() });
        session.lastActive = Date.now();
      }

      res.json({ ok: true, received: true });
    } catch (err: any) {
      console.error('[WebRTC ICE Error]:', err);
      res.status(500).json({ error: err.message || 'Failed to process ICE candidate' });
    }
  });

  // WebRTC Telemetry / Command Dispatch Endpoint
  app.post('/api/webrtc/command', async (req, res) => {
    try {
      const { type, personaId, toolName, args, muted, active, timestamp, googleAccessToken } = req.body;
      const token = googleAccessToken || (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : '');

      switch (type) {
        case 'latency': {
          return res.json({
            type: 'latency',
            timestamp: timestamp || Date.now(),
            serverTime: Date.now()
          });
        }

        case 'telemetry': {
          const telemetry = getSystemTelemetry();
          return res.json({
            type: 'telemetry',
            ...telemetry
          });
        }

        case 'persona_switch': {
          const newPersona = personaId || 'jarvis';
          console.log(`[WebRTC Command] Swapped active persona to: ${newPersona}`);
          return res.json({
            type: 'persona_active',
            personaId: newPersona,
            voiceToken: true,
            timestamp: Date.now()
          });
        }

        case 'tool_trigger': {
          const startTime = Date.now();
          console.log(`[WebRTC Command] Triggering tool ${toolName} with args:`, args);
          const result = await executeWorkspaceTool(toolName, args || {}, token);
          const duration_ms = Date.now() - startTime;
          return res.json({
            type: 'tool_result',
            toolName,
            result,
            duration_ms
          });
        }

        case 'mute_toggle': {
          return res.json({
            type: 'mute_state',
            muted: !!muted,
            timestamp: Date.now()
          });
        }

        case 'voice_patch': {
          return res.json({
            type: 'voice_patch_ack',
            personaId: personaId || 'jarvis',
            active: active !== undefined ? active : true,
            timestamp: Date.now()
          });
        }

        default: {
          return res.json({
            type: 'command_ack',
            received: req.body,
            timestamp: Date.now()
          });
        }
      }
    } catch (err: any) {
      console.error('[WebRTC Command Error]:', err);
      res.status(500).json({ error: err.message || 'Failed to process command' });
    }
  });

  // WebRTC Hub & System Telemetry Status
  app.get('/api/webrtc/status', (_req, res) => {
    const telemetry = getSystemTelemetry();
    res.json({
      status: 'online',
      mode: 'webrtc-signaling-hub',
      activeSessions: webrtcSessions.size,
      telemetry,
      timestamp: new Date().toISOString()
    });
  });


  // WebSocket Server for Gemini Live API
  const wss = new WebSocketServer({ server, path: '/live' });

  wss.on('error', (err) => {
    console.error('[Live WSS Error]', err);
  });

  wss.on('connection', (clientWs: WebSocket) => {
    console.log('[Live WS] Client connected');
    let session: any = null;
    let currentAccessToken: string = '';

    // Register Multi-Agent Orchestrator Event Listener
    const removeOrchestratorListener = masterOrchestratorInstance.addEventListener((evt) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: evt.type,
          ...evt.data
        }));
      }
    });

    clientWs.on('error', (err) => {
      console.error('[Live WS] Client socket error:', err);
    });

    async function initSession(config: { voiceName?: string; systemInstruction?: string; model?: string; googleAccessToken?: string }) {
      if (session) {
        try {
          await session.close();
        } catch (e) {
          // ignore cleanup errors
        }
        session = null;
      }

      if (config.googleAccessToken) {
        currentAccessToken = config.googleAccessToken;
      }

      try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY is not set in environment variables');
        }

        const ai = getAi();
        const voiceName = config.voiceName || 'Kore';
        const model = config.model || 'gemini-3.1-flash-live-preview';
        const groundTruthContext = await getSystemInfoSummaryForLLM();
        const workspaceInstruction = `You are J.A.R.V.I.S., Tony Stark's primary AI assistant, system administrator, and autonomous tactical operator.
You have FULL, UNRESTRICTED, REAL-TIME capability to perform ANY ACTION and retrieve ANY INFORMATION from the host Linux system.
- Information Retrieval: Inspect hardware specs (get_pc_spec), live telemetry (get_system_telemetry), thermals (get_thermal_sensors), battery (get_battery_status), disk storage (get_storage_usage), network interfaces & WiFi (get_network_status), open socket connections & listening ports (get_network_connections), systemd & kernel logs (get_system_logs), running processes (get_running_processes), installed desktop apps (list_installed_applications), environment & OS details (get_environment_info), clipboard content (clipboard_control), directory listings (list_directory), and file contents (read_local_file).
- Action Execution: Execute any arbitrary bash shell commands (execute_system_command), create/write files (write_local_file), delete files (delete_local_file), launch applications (launch_application), manage processes (manage_process), control volume (set_system_volume), screen brightness (set_screen_brightness), power profiles (set_power_profile), power actions (system_power_action), desktop notifications (send_system_notification), desktop GUI automation clicks/hotkeys/typing (desktop_control), take screenshots (take_screenshot), manage systemd services (manage_systemd_service), and package management (manage_packages), as well as Google Workspace actions (Gmail, Calendar, Docs, Sheets, Tasks, Drive).
- Mandate: When the user asks to perform ANY action or retrieve ANY system info, NEVER say you cannot do it and NEVER ask the user to run it manually. IMMEDIATELY call the corresponding tool. If no dedicated tool exists, use execute_system_command. Confirm crisply with British charm and loyalty.

${groundTruthContext}`;
        const systemInstruction = `${config.systemInstruction || ''}\n${workspaceInstruction}`;

        console.log(`[Live WS] Connecting to Gemini Live with voice ${voiceName}`);

        session = await ai.live.connect({
          model,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName } }
            },
            systemInstruction,
            tools: [{ functionDeclarations: WORKSPACE_FUNCTION_DECLARATIONS as any }]
          },
          callbacks: {
            onmessage: async (message: LiveServerMessage) => {
              if (clientWs.readyState !== WebSocket.OPEN) return;

              try {
                // Handle server content parts
                const parts = message.serverContent?.modelTurn?.parts;
                if (parts && parts.length > 0) {
                  for (const part of parts) {
                    if (part.inlineData?.data) {
                      clientWs.send(JSON.stringify({
                        type: 'audio',
                        audio: part.inlineData.data
                      }));
                    }
                    if (part.text) {
                      clientWs.send(JSON.stringify({
                        type: 'output_transcription',
                        text: part.text
                      }));
                    }
                  }
                }

                // Handle tool calls from Gemini Live
                const functionCalls: any[] = [];
                if (message.toolCall?.functionCalls) {
                  functionCalls.push(...message.toolCall.functionCalls);
                }
                if (parts) {
                  for (const part of parts) {
                    if ((part as any).functionCall) {
                      functionCalls.push((part as any).functionCall);
                    }
                  }
                }

                if (functionCalls.length > 0) {
                  // 1. Notify client immediately for all started actions
                  if (clientWs.readyState === WebSocket.OPEN) {
                    for (const call of functionCalls) {
                      clientWs.send(JSON.stringify({
                        type: 'workspace_action',
                        status: 'started',
                        toolName: call.name,
                        args: call.args,
                        id: call.id
                      }));
                    }
                  }

                  // 2. Execute all tool calls simultaneously in parallel
                  const functionResponses = await Promise.all(
                    functionCalls.map(async (call) => {
                      console.log(`[Live WS Tool Call] ${call.name}:`, call.args);
                      try {
                        const toolResult = await executeWorkspaceTool(
                          call.name,
                          (call.args as Record<string, any>) || {},
                          currentAccessToken
                        );

                        if (clientWs.readyState === WebSocket.OPEN) {
                          clientWs.send(JSON.stringify({
                            type: 'workspace_action',
                            status: toolResult.success ? 'completed' : 'error',
                            toolName: call.name,
                            args: call.args,
                            result: toolResult,
                            id: call.id
                          }));

                          if (toolResult.visionControl) {
                            clientWs.send(JSON.stringify({
                              type: 'vision_control',
                              action: toolResult.visionControl.action,
                              mode: toolResult.visionControl.mode
                            }));
                          }

                          if (call.name === 'switch_persona' && call.args?.targetPersonaId) {
                            const targetPersonaId = call.args.targetPersonaId;
                            const swapResult = masterOrchestratorInstance.swapActivePersona(targetPersonaId);
                            clientWs.send(JSON.stringify({
                              type: 'switch_persona_tool_call',
                              targetPersonaId,
                              ...swapResult
                            }));
                          }
                        }

                        return {
                          id: call.id,
                          name: call.name,
                          response: { output: toolResult }
                        };
                      } catch (execErr: any) {
                        console.error(`[Live WS] Tool ${call.name} execution error:`, execErr);
                        return {
                          id: call.id,
                          name: call.name,
                          response: { output: { success: false, error: execErr.message || 'Execution error' } }
                        };
                      }
                    })
                  );

                  // 3. Send synchronized response batch back to Gemini Live
                  if (session) {
                    try {
                      session.sendToolResponse({ functionResponses });
                    } catch (sendErr) {
                      console.error('[Live WS] Error sending tool response batch:', sendErr);
                    }
                  }
                }

                // Handle input audio transcription if emitted
                const inputTranscript = (message as any).serverContent?.turnComplete ? null : (message as any).inputTranscription?.text;
                if (inputTranscript) {
                  clientWs.send(JSON.stringify({
                    type: 'input_transcription',
                    text: inputTranscript
                  }));
                }

                // Handle Interrupted
                if (message.serverContent?.interrupted) {
                  clientWs.send(JSON.stringify({ type: 'interrupted' }));
                }

                // Handle Turn Complete
                if (message.serverContent?.turnComplete) {
                  clientWs.send(JSON.stringify({ type: 'turn_complete' }));
                }
              } catch (e) {
                console.error('[Live WS] Error processing message callback:', e);
              }
            },
            onerror: (err: any) => {
              console.error('[Live WS] Session error:', err);
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ type: 'error', message: err?.message || 'Live session error' }));
              }
            },
            onclose: () => {
              console.log('[Live WS] Gemini live session closed');
            }
          }
        });

        console.log('[Live WS] Connected successfully to Gemini Live');
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ type: 'connected' }));
        }
      } catch (err: any) {
        console.error('[Live WS] Connection failed:', err);
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ type: 'error', message: err?.message || 'Failed to connect to Live API' }));
        }
      }
    }

    clientWs.on('message', async (data: any) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'init' || msg.type === 'reinit') {
          await initSession({
            voiceName: msg.voiceName,
            systemInstruction: msg.systemInstruction,
            model: msg.model,
            googleAccessToken: msg.googleAccessToken || currentAccessToken
          });
          return;
        }

        if (msg.type === 'update_token') {
          currentAccessToken = msg.googleAccessToken || msg.token || '';
          console.log('[Live WS] Updated Google access token');
          return;
        }

        if (msg.type === 'audio' && msg.audio) {
          if (session) {
            try {
              session.sendRealtimeInput({
                audio: {
                  data: msg.audio,
                  mimeType: 'audio/pcm;rate=16000'
                }
              });
            } catch (err) {
              console.error('[Live WS] Error sending audio input:', err);
            }
          }
        }

        if (msg.type === 'text' && msg.text) {
          if (session) {
            try {
              session.sendRealtimeInput({
                text: msg.text
              });
            } catch (err) {
              console.error('[Live WS] Error sending text input:', err);
            }
          }
        }

        if (msg.type === 'image' && msg.image) {
          if (session) {
            try {
              session.sendRealtimeInput({
                image: {
                  data: msg.image,
                  mimeType: msg.mimeType || 'image/jpeg'
                }
              });
            } catch (err) {
              console.error('[Live WS] Error sending image input:', err);
            }
          }
        }
        if (msg.type === 'swap_persona' && msg.personaId) {
          const swapResult = masterOrchestratorInstance.swapActivePersona(msg.personaId);
          if (session && swapResult.contextShiftDirective) {
            try {
              session.sendRealtimeInput({
                text: swapResult.contextShiftDirective
              });
            } catch (e) {
              console.warn('[Live WS] Failed to send context shift to Gemini Live session:', e);
            }
          }
          clientWs.send(JSON.stringify({
            type: 'persona_swapped',
            ...swapResult
          }));
          return;
        }

        if (msg.type === 'delegate_task' && msg.task && msg.managerId) {
          masterOrchestratorInstance.delegateTask(msg.task, msg.managerId, currentAccessToken).then((result) => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'task_delegated',
                ...result
              }));
            }
          }).catch((err) => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'error',
                message: err.message
              }));
            }
          });
          return;
        }
      } catch (err) {
        console.error('[Live WS] Error handling client message:', err);
      }
    });

    clientWs.on('close', () => {
      console.log('[Live WS] Client disconnected');
      removeOrchestratorListener();
      if (session) {
        try { session.close(); } catch (e) {}
        session = null;
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const HOST = process.env.HOST || 'localhost';
  server.listen(PORT, HOST, async () => {
    const url = `http://${HOST}:${PORT}`;
    console.log(`Server running on ${url}`);

    if (process.env.NODE_ENV !== 'production') {
      try {
        const { exec } = await import('child_process');
        const startCommand =
          process.platform === 'darwin'
            ? `open ${url}`
            : process.platform === 'win32'
            ? `start ${url}`
            : `xdg-open ${url}`;
        exec(startCommand);
      } catch (e) {
        // ignore open browser failure
      }
    }
  });
}

startServer();

