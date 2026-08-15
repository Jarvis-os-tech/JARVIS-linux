import { Router, Request, Response } from 'express';
import { executeWorkspaceTool } from '../utils/workspace_tools';
import { executeUnifiedAiChat, AiProvider } from '../utils/ai_engine';
import { analyzeUtterance } from '../utils/nlu_engine';
import { masterOrchestratorInstance } from '../utils/multi_agent_orchestrator';
import { getAllPersonaPrompts } from '../utils/prompt_loader';
import { obsidianDailyLogger } from '../utils/obsidian_logger';
import {
  getSystemTelemetryGroundTruth,
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
} from '../utils/system_controller';
import { memoryRepo, taskRepo, auditRepo } from '../db/db';
import { switchManager } from '../core/switch_manager';
import { taskQueue } from '../core/task_queue';
import { lifecycleManager, ResourceCategory } from '../core/lifecycle_manager';
import { watchdog } from '../core/watchdog';
import { toolRegistry } from '../tools/tool_registry';
import { primeOrchestrator } from '../core/prime_orchestrator';

export function createApiRouter(): Router {
  const router = Router();

  // --- Health & Orchestrator Status ---
  router.get('/health', async (_req: Request, res: Response) => {
    const watchdogReport = await watchdog.probe();
    res.json({
      status: watchdogReport.status === 'critical' ? 'error' : 'ok',
      hasApiKey: !!process.env.GEMINI_API_KEY,
      orchestrator: primeOrchestrator.getSystemSummary(),
      timestamp: new Date().toISOString()
    });
  });

  // --- SQLite Memory Endpoints (Long-Term Vault Synchronization) ---
  router.get('/memory', (_req: Request, res: Response) => {
    try {
      const memories = memoryRepo.getAll();
      res.json({ count: memories.length, memories });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/memory/search', (req: Request, res: Response) => {
    try {
      const query = String(req.query.q || '');
      const results = memoryRepo.search(query);
      res.json({ query, count: results.length, results });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/memory', (req: Request, res: Response) => {
    try {
      const { id, category, key, value, source } = req.body;
      if (!key || !value) {
        return res.status(400).json({ error: 'key and value are required' });
      }
      const factId = id || `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const record = {
        id: factId,
        category: category || 'personal_fact',
        key,
        value,
        source: source || 'user_added',
        updated_at: new Date().toISOString(),
      };
      memoryRepo.upsert(record);
      res.json({ success: true, memory: record });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/memory/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const success = memoryRepo.delete(id);
      res.json({ success, id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Task Queue Endpoints ---
  router.get('/tasks', (_req: Request, res: Response) => {
    try {
      const tasks = taskRepo.getAll();
      const status = taskQueue.getStatus();
      res.json({ tasks, queueStatus: status });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/tasks/enqueue', (req: Request, res: Response) => {
    try {
      const { title, description, priority, toolName, args } = req.body;
      if (!title) {
        return res.status(400).json({ error: 'Task title is required' });
      }
      const taskId = taskQueue.enqueue({
        id: `tsk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title,
        description,
        priority: priority || 3,
        execute: async () => {
          if (toolName) {
            return toolRegistry.execute(toolName, args || {});
          }
          return { status: 'executed' };
        },
      });
      res.json({ success: true, taskId });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/tasks/cancel/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const success = taskQueue.cancel(id);
      res.json({ success, id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Feature Switch Manager ---
  router.get('/switches', (_req: Request, res: Response) => {
    try {
      const switches = switchManager.getAll();
      res.json({ count: switches.length, switches });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/switches/toggle', (req: Request, res: Response) => {
    try {
      const { featureId, enabled } = req.body;
      if (!featureId || enabled === undefined) {
        return res.status(400).json({ error: 'featureId and enabled boolean required' });
      }
      const success = switchManager.setFeature(featureId, Boolean(enabled));
      res.json({ success, featureId, enabled });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Ephemeral Lifecycle Manager ---
  router.get('/lifecycle', (_req: Request, res: Response) => {
    try {
      res.json(lifecycleManager.getStatus());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/lifecycle/sweep', async (_req: Request, res: Response) => {
    try {
      await lifecycleManager.teardownAll('MANUAL_SWEEP_TRIGGERED');
      res.json({ success: true, status: lifecycleManager.getStatus() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Audit Logs ---
  router.get('/audit', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const logs = auditRepo.getRecent(limit);
      res.json({ count: logs.length, logs });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Watchdog Status ---
  router.get('/watchdog', async (_req: Request, res: Response) => {
    try {
      const report = await watchdog.probe();
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Telemetry & System Endpoints ---
  router.get('/system/telemetry', async (_req: Request, res: Response) => {
    try {
      const telemetry = await getSystemTelemetryGroundTruth();
      res.json(telemetry);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/system/hardware', async (_req: Request, res: Response) => {
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

  router.get('/system/thermals', async (_req: Request, res: Response) => {
    try {
      const thermals = await getThermalSensors();
      res.json(thermals);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/system/storage', async (_req: Request, res: Response) => {
    try {
      const storage = await getDetailedStorageUsage();
      res.json({ mounts: storage });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/system/apps', async (_req: Request, res: Response) => {
    try {
      const apps = await listInstalledApplications();
      res.json({ total: apps.length, applications: apps });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/system/processes', async (req: Request, res: Response) => {
    try {
      const sortBy = (req.query.sortBy as any) || 'cpu';
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const processes = await getRunningProcesses({ sortBy, limit });
      res.json({ total: processes.length, processes });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/system/control', async (req: Request, res: Response) => {
    try {
      const { action, percent, relative, mute, toggleMute, target, appNameOrCommand, args, pid, processName, signal, profile, mediaAction, powerAction, title, message, urgency, icon, outputPath, filePath, content, append, maxLines, offset } = req.body;
      switch (action) {
        case 'set_volume':
          return res.json(await setSystemVolume({ percent, relative, mute, toggleMute, target }));
        case 'set_brightness':
          return res.json(await setScreenBrightness({ percent, relative }));
        case 'launch_app':
          return res.json(await launchApplication({ appNameOrCommand, args }));
        case 'manage_process':
          return res.json(await manageProcess({ pid, processName, signal }));
        case 'set_power_profile':
          return res.json(await setPowerProfile(profile));
        case 'control_media':
          return res.json(await controlMediaPlayback(mediaAction || 'toggle'));
        case 'power_action':
          return res.json(await systemPowerAction(powerAction || 'lock'));
        case 'send_notification':
          return res.json(await sendDesktopNotification({ title, message, urgency, icon }));
        case 'take_screenshot':
          return res.json(await takeScreenshot(outputPath));
        case 'read_file':
          return res.json(await readLocalFile({ filePath, maxLines, offset }));
        case 'write_file':
          return res.json(await writeLocalFile({ filePath, content, append }));
        default:
          return res.status(400).json({ error: `Unknown control action: ${action}` });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/system/exec', async (req: Request, res: Response) => {
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

  // --- Workspace Tools ---
  router.post('/workspace/execute', async (req: Request, res: Response) => {
    try {
      const { toolName, args, googleAccessToken } = req.body;
      const token = googleAccessToken || (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : '');
      const result = await executeWorkspaceTool(toolName, args || {}, token);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Tool execution failed' });
    }
  });

  // --- Unified Chat ---
  router.post('/chat', async (req: Request, res: Response) => {
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

      if (message) {
        obsidianDailyLogger.logConversationTurn({ speaker: 'User', role: 'user', text: message });
        obsidianDailyLogger.logConversationTurn({
          speaker: 'JARVIS',
          role: 'assistant',
          text: result.text,
          toolsUsed: result.actions?.map((a: any) => a.toolName)
        });
      }

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to generate response' });
    }
  });

  router.get('/providers/status', async (_req: Request, res: Response) => {
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
          defaultModel: 'gemini-3.1-flash-live-preview'
        }
      }
    });
  });

  router.post('/nlu/analyze', (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Valid text string is required.' });
      }
      res.json(analyzeUtterance(text));
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to analyze text' });
    }
  });

  // --- Orchestrator & Multi-Agent APIs ---
  router.get('/orchestrator/status', (_req: Request, res: Response) => {
    try {
      const activePersona = masterOrchestratorInstance.getActivePersona();
      const personas = masterOrchestratorInstance.getAllPersonas();
      const mutedRelayEvents = masterOrchestratorInstance.getMutedRelayEvents();
      res.json({ activePersonaId: activePersona.id, activePersona, personas, mutedRelayEvents });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/orchestrator/swap-persona', (req: Request, res: Response) => {
    try {
      const { personaId } = req.body;
      if (!personaId) {
        return res.status(400).json({ error: 'personaId is required' });
      }
      res.json(masterOrchestratorInstance.swapActivePersona(personaId));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/orchestrator/delegate', async (req: Request, res: Response) => {
    try {
      const { task, managerId, googleAccessToken } = req.body;
      if (!task || !managerId) {
        return res.status(400).json({ error: 'task and managerId are required' });
      }
      res.json(await masterOrchestratorInstance.delegateTask(task, managerId, googleAccessToken));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/orchestrator/prompts', (_req: Request, res: Response) => {
    try {
      res.json(getAllPersonaPrompts());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // System Hardware and Spec routes
  router.get('/system/spec', async (_req: Request, res: Response) => {
    try {
      res.json(await getPcSpecGroundTruth());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/system/volume', async (req: Request, res: Response) => {
    try {
      res.json(await setSystemVolume(req.body));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/system/brightness', async (req: Request, res: Response) => {
    try {
      res.json(await setScreenBrightness(req.body));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/system/power-profile', async (req: Request, res: Response) => {
    try {
      res.json(await setPowerProfile(req.body.profile));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/system/power-action', async (req: Request, res: Response) => {
    try {
      res.json(await systemPowerAction(req.body.action));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/system/process/kill', async (req: Request, res: Response) => {
    try {
      res.json(await manageProcess(req.body));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/system/network/status', async (_req: Request, res: Response) => {
    try {
      res.json(await getNetworkStatusGroundTruth());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/system/network/connections', async (_req: Request, res: Response) => {
    try {
      res.json(await getNetworkConnections());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/system/firewall', async (_req: Request, res: Response) => {
    try {
      res.json(await getFirewallStatus());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/system/desktop/action', async (req: Request, res: Response) => {
    try {
      res.json(await desktopControlAction(req.body));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/system/service', async (req: Request, res: Response) => {
    try {
      res.json(await manageSystemdService(req.body));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/system/logs', async (req: Request, res: Response) => {
    try {
      const service = req.query.service as string | undefined;
      const lines = parseInt(req.query.lines as string, 10) || 50;
      const priority = req.query.priority as string | undefined;
      res.json(await getSystemLogs({ unit: service, lines, priority }));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/system/packages', async (req: Request, res: Response) => {
    try {
      res.json(await managePackages(req.body));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/system/files/search', async (req: Request, res: Response) => {
    try {
      const query = req.query.query as string;
      const searchPath = req.query.searchPath as string | undefined;
      const maxResults = parseInt(req.query.maxResults as string, 10) || 20;
      res.json(await searchLocalFiles({ pattern: query, rootDir: searchPath, maxResults }));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/system/files/list', async (req: Request, res: Response) => {
    try {
      const dirPath = req.query.dirPath as string || process.env.HOME || '/';
      const showHidden = req.query.showHidden === 'true';
      res.json(await listDirectory({ dirPath, showHidden }));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/system/files/delete', async (req: Request, res: Response) => {
    try {
      res.json(await deleteLocalFile({ filePath: req.body.filePath }));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/system/clipboard', async (req: Request, res: Response) => {
    try {
      res.json(await clipboardControl(req.body));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/system/environment', async (_req: Request, res: Response) => {
    try {
      res.json(await getEnvironmentInfo());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- WebRTC Signaling & Telemetry Hub ---
  router.post('/webrtc/offer', (req: Request, res: Response) => {
    const { clientId } = req.body;
    const effectiveClientId = clientId || 'client_' + Date.now();
    const sessionId = 'session_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    res.json({
      type: 'answer',
      sdp: 'v=0\r\no=- ' + Date.now() + ' 2 IN IP4 127.0.0.1\r\ns=Jarvis-WebRTC-Hub\r\nt=0 0\r\n',
      sessionId,
      clientId: effectiveClientId
    });
  });

  router.post('/webrtc/ice', (_req: Request, res: Response) => {
    res.json({ ok: true, received: true });
  });

  router.post('/webrtc/command', async (req: Request, res: Response) => {
    const { type, personaId, toolName, args, googleAccessToken } = req.body;
    if (type === 'persona_switch') {
      return res.json({ type: 'persona_active', personaId: personaId || 'jarvis', voiceToken: true });
    }
    if (type === 'tool_trigger') {
      const result = await executeWorkspaceTool(toolName, args || {}, googleAccessToken || '');
      return res.json({ type: 'tool_result', toolName, result });
    }
    return res.json({ type: 'command_ack', received: req.body });
  });

  router.get('/webrtc/status', (_req: Request, res: Response) => {
    res.json({
      status: 'online',
      mode: 'webrtc-signaling-hub',
      timestamp: new Date().toISOString()
    });
  });

  return router;
}

