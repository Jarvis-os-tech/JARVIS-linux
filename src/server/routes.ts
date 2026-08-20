import { Router, Request, Response } from 'express';
import { executeWorkspaceTool, setGlobalGoogleAccessToken, getGlobalGoogleAccessToken } from '../utils/workspace_tools';
import { googleAuthService } from '../services/google_auth_service';
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

  router.get('/vault/index', (_req: Request, res: Response) => {
    try {
      const { obsidianSyncBridge } = require('../utils/obsidian_sync');
      const indexData = obsidianSyncBridge.getVaultIndex();
      res.json(indexData);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/memory/vault/index', (_req: Request, res: Response) => {
    try {
      const { obsidianSyncBridge } = require('../utils/obsidian_sync');
      const indexData = obsidianSyncBridge.getVaultIndex();
      res.json(indexData);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
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
        case 'close_window':
          return res.json(await desktopControlAction({ action: 'close_window', target: target || appNameOrCommand }));
        case 'focus_window':
          return res.json(await desktopControlAction({ action: 'focus_window', target: target || appNameOrCommand }));
        case 'close_app':
          return res.json(await desktopControlAction({ action: 'close_app', target: target || appNameOrCommand, signal }));
        case 'desktop_control':
          return res.json(await desktopControlAction(req.body));
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

  // --- Workspace Tools & Token Management ---
  router.post('/workspace/token', async (req: Request, res: Response) => {
    try {
      const { token, refreshToken, expiresAt } = req.body;
      const cleanToken = typeof token === 'string' ? token.trim() : '';
      if (cleanToken) {
        await googleAuthService.saveAuth({
          accessToken: cleanToken,
          refreshToken: typeof refreshToken === 'string' ? refreshToken.trim() : undefined,
          expiresAt: typeof expiresAt === 'number' ? expiresAt : undefined,
        });
      } else {
        googleAuthService.disconnect();
      }
      return res.json({
        success: true,
        connected: !!cleanToken,
        status: googleAuthService.getStatus(),
        message: cleanToken
          ? 'Google access token persisted globally across all agents'
          : 'Google access token cleared globally'
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/workspace/token/status', (_req: Request, res: Response) => {
    try {
      const status = googleAuthService.getStatus();
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Direct Google OAuth Code Exchange & Refresh Endpoints ---
  router.post('/auth/google/code', async (req: Request, res: Response) => {
    try {
      const { code, redirectUri } = req.body;
      if (!code) {
        return res.status(400).json({ success: false, error: 'Authorization code is required' });
      }
      const uri = redirectUri || 'postmessage';
      const authData = await googleAuthService.exchangeAuthCode(code, uri);
      res.json({
        success: true,
        connected: true,
        email: authData.email,
        name: authData.name,
        picture: authData.picture,
        hasRefreshToken: !!authData.refreshToken,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/auth/google/refresh', async (_req: Request, res: Response) => {
    try {
      const newToken = await googleAuthService.refreshAccessToken();
      if (!newToken) {
        return res.status(400).json({ success: false, error: 'Token refresh failed. Re-authorization required.' });
      }
      res.json({ success: true, token: newToken, status: googleAuthService.getStatus() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/auth/google/disconnect', (_req: Request, res: Response) => {
    try {
      googleAuthService.disconnect();
      res.json({ success: true, connected: false });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/workspace/execute', async (req: Request, res: Response) => {
    try {
      const { toolName, args, googleAccessToken } = req.body;
      const token = googleAccessToken || (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : '') || (await googleAuthService.getValidToken()) || getGlobalGoogleAccessToken();
      const result = await executeWorkspaceTool(toolName, args || {}, token || undefined);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Tool execution failed' });
    }
  });

  // --- Agent Reach Verified Internet Intelligence Endpoints ---
  router.post('/reach/search', async (req: Request, res: Response) => {
    try {
      const { query, numResults } = req.body;
      if (!query) return res.status(400).json({ success: false, error: 'Query parameter is required' });
      const { agentReachService } = await import('../services/agent_reach_service');
      const results = await agentReachService.searchWeb(query, numResults ? Number(numResults) : 5);
      res.json({ success: true, results });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/reach/fetch', async (req: Request, res: Response) => {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ success: false, error: 'URL parameter is required' });
      const { agentReachService } = await import('../services/agent_reach_service');
      const page = await agentReachService.fetchWebPage(url);
      res.json({ success: true, page });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/reach/youtube', async (req: Request, res: Response) => {
    try {
      const { videoUrl } = req.body;
      if (!videoUrl) return res.status(400).json({ success: false, error: 'videoUrl is required' });
      const { agentReachService } = await import('../services/agent_reach_service');
      const yt = await agentReachService.fetchYouTubeTranscript(videoUrl);
      res.json({ success: true, ...yt });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/reach/research', async (req: Request, res: Response) => {
    try {
      const { query, mode, ttlCategory, targetPlatforms, forceRefresh, minTriangulationSources, saveToObsidian } = req.body;
      if (!query) return res.status(400).json({ success: false, error: 'Query parameter is required' });
      const { researchEngine } = await import('../research/engine');
      const research = await researchEngine.research({
        query,
        mode: mode || 'deep',
        ttlCategory,
        targetPlatforms,
        forceRefresh: Boolean(forceRefresh),
        minTriangulationSources,
        saveToObsidian: saveToObsidian !== false,
      });
      res.json({ success: true, research });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/reach/verify', async (req: Request, res: Response) => {
    try {
      const { claim, context } = req.body;
      if (!claim) return res.status(400).json({ success: false, error: 'claim parameter is required' });
      const { researchEngine } = await import('../research/engine');
      const verification = await researchEngine.verifyClaim(claim, context);
      res.json({ success: true, verification });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/reach/fast-check', async (req: Request, res: Response) => {
    try {
      const { query } = req.body;
      if (!query) return res.status(400).json({ success: false, error: 'query parameter is required' });
      const { researchEngine } = await import('../research/engine');
      const result = await researchEngine.fastFactCheck(query);
      res.json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/reach/cache/stats', async (_req: Request, res: Response) => {
    try {
      const { researchCache } = await import('../research/cache');
      res.json({ success: true, stats: researchCache.getStats() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/reach/cache/clear', async (_req: Request, res: Response) => {
    try {
      const { researchCache } = await import('../research/cache');
      researchCache.clear();
      res.json({ success: true, message: 'Research cache cleared successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/research/reports', async (_req: Request, res: Response) => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const researchDir = path.join(process.cwd(), 'JARVIS-MEMORY', 'Research');
      if (!fs.existsSync(researchDir)) {
        return res.json({ success: true, count: 0, reports: [] });
      }
      const files = fs.readdirSync(researchDir).filter((f) => f.endsWith('.md'));
      const reports = files.map((f) => {
        const fullPath = path.join(researchDir, f);
        const stats = fs.statSync(fullPath);
        return {
          filename: f,
          path: fullPath,
          sizeBytes: stats.size,
          updatedAt: stats.mtime.toISOString(),
        };
      });
      res.json({ success: true, count: reports.length, reports });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- J.A.R.V.I.S. Universal Memory Subsystem Endpoints ---
  router.post('/memory/remember', async (req: Request, res: Response) => {
    try {
      const { content, title, kind, tier, importance, tags } = req.body;
      if (!content) return res.status(400).json({ success: false, error: 'content is required' });
      const { memoryClient } = await import('../memory/client');
      const { memoryContextBuilder } = await import('../memory/context_builder');
      const result = await memoryClient.createNode({ content, title, kind, tier, importance, tags });
      memoryContextBuilder.invalidateCache();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/memory/recall', async (req: Request, res: Response) => {
    try {
      const { query, top_k, profile, scope, min_score } = req.body;
      if (!query) return res.status(400).json({ success: false, error: 'query is required' });
      const { memoryClient } = await import('../memory/client');
      const result = await memoryClient.search({ query, top_k, profile, scope, min_score });
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/memory/status', async (_req: Request, res: Response) => {
    try {
      const { memoryClient } = await import('../memory/client');
      const status = await memoryClient.getStatus();
      res.json({ success: true, ...status });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/memory/flush', async (req: Request, res: Response) => {
    try {
      const { stale_threshold_secs } = req.body;
      const { memoryClient } = await import('../memory/client');
      const { memoryContextBuilder } = await import('../memory/context_builder');
      const result = await memoryClient.flush(stale_threshold_secs ?? 0);
      memoryContextBuilder.invalidateCache();
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/memory/tree/drilldown', async (req: Request, res: Response) => {
    try {
      const { root_id } = req.body;
      if (!root_id) return res.status(400).json({ success: false, error: 'root_id is required' });
      const { memoryClient } = await import('../memory/client');
      const result = await memoryClient.getTreeDrilldown(root_id);
      res.json({ success: !!result, drilldown: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/memory/context', async (req: Request, res: Response) => {
    try {
      const query = req.query.query as string | undefined;
      const { memoryContextBuilder } = await import('../memory/context_builder');
      const snapshot = await memoryContextBuilder.getFrozenPromptSnapshot();
      const dynamic = query ? await memoryContextBuilder.buildDynamicMemoryContext(query) : '';
      res.json({ success: true, frozenSnapshot: snapshot, dynamicContext: dynamic });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/memory/kg/query', async (req: Request, res: Response) => {
    try {
      const { subject, predicate, as_of } = req.body;
      if (!subject) return res.status(400).json({ success: false, error: 'subject is required' });
      const { memoryClient } = await import('../memory/client');
      const triples = await memoryClient.queryKG(subject, predicate, as_of);
      res.json({ success: true, triples });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/memory/kg/supersede', async (req: Request, res: Response) => {
    try {
      const { subject, predicate, old_object, new_object } = req.body;
      if (!subject || !predicate || !old_object || !new_object) {
        return res.status(400).json({ success: false, error: 'subject, predicate, old_object, and new_object are required' });
      }
      const { memoryClient } = await import('../memory/client');
      const triple = await memoryClient.supersedeKG(subject, predicate, old_object, new_object);
      res.json({ success: !!triple, triple });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/memory/diary/write', async (req: Request, res: Response) => {
    try {
      const { content, agent_id, entry_type } = req.body;
      if (!content) return res.status(400).json({ success: false, error: 'content is required' });
      const { memoryClient } = await import('../memory/client');
      const success = await memoryClient.writeDiary(content, agent_id, entry_type);
      res.json({ success });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/memory/diary/read', async (req: Request, res: Response) => {
    try {
      const agentId = req.query.agent_id as string | undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const { memoryClient } = await import('../memory/client');
      const entries = await memoryClient.readDiary(agentId, limit);
      res.json({ success: true, count: entries.length, entries });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/agents/delegate', async (req: Request, res: Response) => {
    try {
      const { targetManagerId, taskDescription } = req.body;
      if (!targetManagerId || !taskDescription) {
        return res.status(400).json({ success: false, error: 'targetManagerId and taskDescription are required' });
      }
      const { multiAgentOrchestrator } = await import('../utils/multi_agent_orchestrator');
      const result = await multiAgentOrchestrator.delegateTask(taskDescription, targetManagerId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- LinkedIn Integration Endpoints ---
  router.get('/linkedin/status', async (_req: Request, res: Response) => {
    try {
      const { linkedinService } = await import('../services/linkedin_service');
      res.json({ success: true, ...linkedinService.getStatus() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/linkedin/auth/url', async (req: Request, res: Response) => {
    try {
      const { linkedinService } = await import('../services/linkedin_service');
      const redirectUri = (req.query.redirectUri as string) || `${req.protocol}://${req.get('host')}/api/linkedin/callback`;
      const clientId = req.query.clientId as string | undefined;
      const url = linkedinService.getAuthorizationUrl(redirectUri, clientId);
      res.json({ success: true, url, redirectUri });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.post('/linkedin/auth/code', async (req: Request, res: Response) => {
    try {
      const { code, redirectUri, clientId, clientSecret } = req.body;
      if (!code) return res.status(400).json({ success: false, error: 'code is required' });
      const uri = redirectUri || `${req.protocol}://${req.get('host')}/api/linkedin/callback`;
      const { linkedinService } = await import('../services/linkedin_service');
      const saved = await linkedinService.exchangeAuthCode(code, uri, clientId, clientSecret);
      res.json({ success: true, message: 'LinkedIn authenticated successfully', status: linkedinService.getStatus(), auth: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/linkedin/callback', async (req: Request, res: Response) => {
    const code = req.query.code as string;
    const error = (req.query.error_description || req.query.error) as string;
    const { linkedinService } = await import('../services/linkedin_service');

    if (error || !code) {
      const html = `<!DOCTYPE html><html><body style="background:#090a0f;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:32px;background:rgba(255,255,255,0.05);border-radius:16px;"><h2>❌ LinkedIn Auth Failed</h2><p style="color:#f87171;">${error || 'Missing code parameter'}</p></div><script>if(window.opener){window.opener.postMessage({type:'LINKEDIN_AUTH_FAILED',error:'${error||'Failed'}'},'*');setTimeout(()=>window.close(),1500);}</script></body></html>`;
      return res.status(400).send(html);
    }

    try {
      const redirectUri = `${req.protocol}://${req.get('host')}/api/linkedin/callback`;
      const saved = await linkedinService.exchangeAuthCode(code, redirectUri);
      const html = `<!DOCTYPE html><html><head><title>LinkedIn Connected | J.A.R.V.I.S.</title></head><body style="background:#090a0f;color:#fff;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:32px;background:rgba(18,20,29,0.9);border:1px solid rgba(10,102,194,0.3);border-radius:16px;max-width:380px;"><div style="font-size:36px;margin-bottom:12px;">💼</div><h2 style="color:#388bfd;margin:0 0 8px 0;">LinkedIn Connected</h2><p style="font-size:13px;color:#9ca3af;margin:0 0 16px 0;">Authenticated as <b>${saved.name || saved.email || 'User'}</b>. Closing popup...</p></div><script>if(window.opener){window.opener.postMessage({type:'LINKEDIN_AUTH_SUCCESS',status:${JSON.stringify(linkedinService.getStatus())}},'*');setTimeout(()=>window.close(),1000);}</script></body></html>`;
      res.send(html);
    } catch (err: any) {
      const html = `<!DOCTYPE html><html><body style="background:#090a0f;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:32px;background:rgba(255,255,255,0.05);border-radius:16px;"><h2>❌ LinkedIn Auth Failed</h2><p style="color:#f87171;">${err.message}</p></div><script>if(window.opener){window.opener.postMessage({type:'LINKEDIN_AUTH_FAILED',error:'${err.message}'},'*');setTimeout(()=>window.close(),2000);}</script></body></html>`;
      res.status(500).send(html);
    }
  });

  router.post('/linkedin/auth/token', async (req: Request, res: Response) => {
    try {
      const { accessToken, linkedApiToken, identificationToken, name, headline, userUrn } = req.body;
      const { linkedinService } = await import('../services/linkedin_service');
      const saved = await linkedinService.saveAuth({
        accessToken,
        linkedApiToken,
        identificationToken,
        name,
        headline,
        userUrn,
      });
      res.json({ success: true, message: 'LinkedIn credentials saved successfully', status: linkedinService.getStatus(), auth: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/linkedin/auth/disconnect', async (_req: Request, res: Response) => {
    try {
      const { linkedinService } = await import('../services/linkedin_service');
      linkedinService.disconnect();
      res.json({ success: true, message: 'LinkedIn credentials disconnected' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/linkedin/profile', async (_req: Request, res: Response) => {
    try {
      const { linkedinService } = await import('../services/linkedin_service');
      const profile = await linkedinService.getMyProfile();
      res.json({ success: true, profile });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/linkedin/post', async (req: Request, res: Response) => {
    try {
      const { text, visibility } = req.body;
      if (!text) return res.status(400).json({ success: false, error: 'text is required' });
      const { linkedinService } = await import('../services/linkedin_service');
      const result = await linkedinService.createPost(text, visibility);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/linkedin/person', async (req: Request, res: Response) => {
    try {
      const { profileUrlOrUsername, sections } = req.body;
      if (!profileUrlOrUsername) return res.status(400).json({ success: false, error: 'profileUrlOrUsername is required' });
      const { linkedinService } = await import('../services/linkedin_service');
      const profile = await linkedinService.fetchPersonProfile(profileUrlOrUsername, sections);
      res.json({ success: true, profile });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/linkedin/company', async (req: Request, res: Response) => {
    try {
      const { companyUrlOrName } = req.body;
      if (!companyUrlOrName) return res.status(400).json({ success: false, error: 'companyUrlOrName is required' });
      const { linkedinService } = await import('../services/linkedin_service');
      const company = await linkedinService.fetchCompany(companyUrlOrName);
      res.json({ success: true, company });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/linkedin/search/people', async (req: Request, res: Response) => {
    try {
      const { term, position, location, limit } = req.body;
      const { linkedinService } = await import('../services/linkedin_service');
      const people = await linkedinService.searchPeople({ term, position, location, limit });
      res.json({ success: true, count: people.length, people });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/linkedin/search/jobs', async (req: Request, res: Response) => {
    try {
      const { keywords, location, limit } = req.body;
      const { linkedinService } = await import('../services/linkedin_service');
      const jobs = await linkedinService.searchJobs({ keywords, location, limit });
      res.json({ success: true, count: jobs.length, jobs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/linkedin/message', async (req: Request, res: Response) => {
    try {
      const { personUrl, message } = req.body;
      if (!personUrl || !message) return res.status(400).json({ success: false, error: 'personUrl and message are required' });
      const { linkedinService } = await import('../services/linkedin_service');
      const result = await linkedinService.sendMessage(personUrl, message);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/linkedin/connect', async (req: Request, res: Response) => {
    try {
      const { personUrl, note } = req.body;
      if (!personUrl) return res.status(400).json({ success: false, error: 'personUrl is required' });
      const { linkedinService } = await import('../services/linkedin_service');
      const result = await linkedinService.sendConnection(personUrl, note);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- GitHub Integration Endpoints ---
  router.get('/github/status', async (_req: Request, res: Response) => {
    try {
      const { githubService } = await import('../services/github_service');
      res.json({ success: true, ...githubService.getStatus() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/github/auth/url', async (req: Request, res: Response) => {
    try {
      const { githubService } = await import('../services/github_service');
      const redirectUri = req.query.redirectUri as string | undefined;
      const clientId = req.query.clientId as string | undefined;
      const url = githubService.getAuthorizationUrl(redirectUri, clientId);
      res.json({ success: true, url, redirectUri: redirectUri || 'registered_app_default' });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.post('/github/auth/code', async (req: Request, res: Response) => {
    try {
      const { code, redirectUri, clientId, clientSecret } = req.body;
      if (!code) return res.status(400).json({ success: false, error: 'code is required' });
      const uri = redirectUri || `${req.protocol}://${req.get('host')}/api/github/callback`;
      const { githubService } = await import('../services/github_service');
      const saved = await githubService.exchangeAuthCode(code, uri, clientId, clientSecret);
      res.json({ success: true, message: 'GitHub authenticated successfully', status: githubService.getStatus(), auth: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/github/callback', async (req: Request, res: Response) => {
    const code = req.query.code as string;
    const error = (req.query.error_description || req.query.error) as string;
    const { githubService } = await import('../services/github_service');

    if (error || !code) {
      const html = `<!DOCTYPE html><html><body style="background:#090a0f;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:32px;background:rgba(255,255,255,0.05);border-radius:16px;"><h2>❌ GitHub Auth Failed</h2><p style="color:#f87171;">${error || 'Missing code parameter'}</p></div><script>if(window.opener){window.opener.postMessage({type:'GITHUB_AUTH_FAILED',error:'${error||'Failed'}'},'*');setTimeout(()=>window.close(),1500);}</script></body></html>`;
      return res.status(400).send(html);
    }

    try {
      const redirectUri = `${req.protocol}://${req.get('host')}/api/github/callback`;
      const saved = await githubService.exchangeAuthCode(code, redirectUri);
      const html = `<!DOCTYPE html><html><head><title>GitHub Connected | J.A.R.V.I.S.</title></head><body style="background:#090a0f;color:#fff;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:32px;background:rgba(18,20,29,0.9);border:1px solid rgba(240,80,50,0.3);border-radius:16px;max-width:380px;"><div style="font-size:36px;margin-bottom:12px;">🐙</div><h2 style="color:#ff7a64;margin:0 0 8px 0;">GitHub Connected</h2><p style="font-size:13px;color:#9ca3af;margin:0 0 16px 0;">Authenticated as <b>@${saved.login || 'User'}</b>. Closing popup...</p></div><script>if(window.opener){window.opener.postMessage({type:'GITHUB_AUTH_SUCCESS',status:${JSON.stringify(githubService.getStatus())}},'*');setTimeout(()=>window.close(),1000);}</script></body></html>`;
      res.send(html);
    } catch (err: any) {
      const html = `<!DOCTYPE html><html><body style="background:#090a0f;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:32px;background:rgba(255,255,255,0.05);border-radius:16px;"><h2>❌ GitHub Auth Failed</h2><p style="color:#f87171;">${err.message}</p></div><script>if(window.opener){window.opener.postMessage({type:'GITHUB_AUTH_FAILED',error:'${err.message}'},'*');setTimeout(()=>window.close(),2000);}</script></body></html>`;
      res.status(500).send(html);
    }
  });

  router.post('/github/auth/token', async (req: Request, res: Response) => {
    try {
      const { accessToken, login, name, email, avatarUrl } = req.body;
      if (!accessToken) return res.status(400).json({ success: false, error: 'accessToken is required' });
      const { githubService } = await import('../services/github_service');
      const saved = await githubService.saveAuth({ accessToken, login, name, email, avatarUrl });
      res.json({ success: true, message: 'GitHub credentials saved successfully', status: githubService.getStatus(), auth: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/github/auth/disconnect', async (_req: Request, res: Response) => {
    try {
      const { githubService } = await import('../services/github_service');
      githubService.disconnect();
      res.json({ success: true, message: 'GitHub credentials disconnected' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/github/profile', async (_req: Request, res: Response) => {
    try {
      const { githubService } = await import('../services/github_service');
      const profile = await githubService.getMyProfile();
      res.json({ success: true, profile });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/github/repos', async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const sort = (req.query.sort as 'updated' | 'created' | 'pushed') || 'updated';
      const { githubService } = await import('../services/github_service');
      const repos = await githubService.listMyRepos(limit, sort);
      res.json({ success: true, count: repos.length, repos });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/github/issue', async (req: Request, res: Response) => {
    try {
      const { owner, repo, title, body, labels } = req.body;
      if (!owner || !repo || !title) {
        return res.status(400).json({ success: false, error: 'owner, repo, and title are required' });
      }
      const { githubService } = await import('../services/github_service');
      const issue = await githubService.createIssue(owner, repo, title, body, labels);
      res.json({ success: true, issue });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/github/gist', async (req: Request, res: Response) => {
    try {
      const { description, filename, content, isPublic } = req.body;
      if (!filename || !content) {
        return res.status(400).json({ success: false, error: 'filename and content are required' });
      }
      const { githubService } = await import('../services/github_service');
      const gist = await githubService.createGist(description || '', filename, content, isPublic);
      res.json({ success: true, gist });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/github/repo', async (req: Request, res: Response) => {
    try {
      const { owner, repo } = req.query;
      if (!owner || !repo) {
        return res.status(400).json({ success: false, error: 'owner and repo query params are required' });
      }
      const { githubService } = await import('../services/github_service');
      const repoData = await githubService.getRepoDetails(String(owner), String(repo));
      res.json({ success: true, repo: repoData });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- Universal Multi-Cloud Connectors Callback Router ---
  const handleUniversalCallback = async (req: Request, res: Response) => {
    const code = req.query.code as string;
    const error = (req.query.error_description || req.query.error) as string;
    const state = ((req.query.state as string) || '').toLowerCase();
    const explicitProvider = ((req.query.provider as string) || '').toLowerCase();

    // 1. Direct browser status visit (No code or error parameter provided)
    if (!code && !error) {
      const { linkedinService } = await import('../services/linkedin_service');
      const { githubService } = await import('../services/github_service');
      const gStatus = googleAuthService.getStatus();
      const liStatus = linkedinService.getStatus();
      const ghStatus = githubService.getStatus();

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>J.A.R.V.I.S. Connectors OAuth Gateway</title>
  <style>
    :root {
      --bg: #090a0f;
      --card-bg: rgba(18, 20, 29, 0.85);
      --border: rgba(255, 255, 255, 0.08);
      --cyan: #00f0ff;
      --emerald: #10b981;
      --text: #f3f4f6;
      --muted: #9ca3af;
    }
    body {
      margin: 0;
      padding: 32px 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: radial-gradient(circle at top center, #131726 0%, var(--bg) 70%);
      color: var(--text);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      box-sizing: border-box;
    }
    .container {
      width: 100%;
      max-width: 600px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 32px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(20px);
    }
    .header {
      text-align: center;
      margin-bottom: 28px;
    }
    .title {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 0.5px;
      background: linear-gradient(135deg, #00f0ff, #3b82f6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin: 0 0 8px 0;
    }
    .subtitle {
      font-size: 13px;
      color: var(--muted);
      margin: 0;
    }
    .provider-grid {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 24px;
    }
    .card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border);
      border-radius: 12px;
    }
    .badge {
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 20px;
    }
    .badge-online {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .badge-offline {
      background: rgba(156, 163, 175, 0.1);
      color: var(--muted);
      border: 1px solid var(--border);
    }
    .urls-box {
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(0, 240, 255, 0.2);
      border-radius: 12px;
      padding: 16px;
      font-size: 12px;
      margin-bottom: 20px;
    }
    .urls-box code {
      display: block;
      color: var(--cyan);
      font-family: monospace;
      font-size: 11.5px;
      margin-top: 4px;
      word-break: break-all;
    }
    .btn {
      display: block;
      text-align: center;
      background: linear-gradient(135deg, #00f0ff, #0284c7);
      color: #000;
      font-weight: 700;
      font-size: 13px;
      text-decoration: none;
      padding: 12px;
      border-radius: 12px;
      transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="font-size:32px;margin-bottom:8px;">⚡</div>
      <h1 class="title">J.A.R.V.I.S. Multi-Cloud OAuth Gateway</h1>
      <p class="subtitle">Universal Callback Endpoint for Third-Party Integrations</p>
    </div>

    <div class="provider-grid">
      <div class="card">
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-size:20px;">🌐</span>
          <div>
            <div style="font-size:13px;font-weight:700;">Google Workspace</div>
            <div style="font-size:11px;color:var(--muted);">${gStatus.email || 'Gmail, Calendar, Drive'}</div>
          </div>
        </div>
        <span class="badge ${gStatus.connected ? 'badge-online' : 'badge-offline'}">
          ${gStatus.connected ? 'Connected' : 'Offline'}
        </span>
      </div>

      <div class="card">
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-size:20px;">💼</span>
          <div>
            <div style="font-size:13px;font-weight:700;">LinkedIn Cloud</div>
            <div style="font-size:11px;color:var(--muted);">${liStatus.name || 'Profile, Social Feed, Search'}</div>
          </div>
        </div>
        <span class="badge ${liStatus.connected ? 'badge-online' : 'badge-offline'}">
          ${liStatus.connected ? 'Connected' : 'Offline'}
        </span>
      </div>

      <div class="card">
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-size:20px;">🐙</span>
          <div>
            <div style="font-size:13px;font-weight:700;">GitHub Intelligence</div>
            <div style="font-size:11px;color:var(--muted);">${ghStatus.login ? '@' + ghStatus.login : 'Repos, Issues, Gists'}</div>
          </div>
        </div>
        <span class="badge ${ghStatus.connected ? 'badge-online' : 'badge-offline'}">
          ${ghStatus.connected ? 'Connected' : 'Offline'}
        </span>
      </div>
    </div>

    <div class="urls-box">
      <div style="font-weight:700;margin-bottom:6px;color:#fff;">Authorized Redirect URIs for Developer Portals:</div>
      <code>${req.protocol}://${req.get('host')}/api/connectors/callback</code>
      <code>${req.protocol}://${req.get('host')}/api/linkedin/callback</code>
      <code>${req.protocol}://${req.get('host')}/api/github/callback</code>
    </div>

    <a href="/" class="btn">Return to J.A.R.V.I.S. Dashboard</a>
  </div>
</body>
</html>`;
      return res.send(html);
    }

    // 2. Error reported by OAuth provider
    if (error || !code) {
      const html = `<!DOCTYPE html><html><body style="background:#090a0f;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:32px;background:rgba(255,255,255,0.05);border-radius:16px;max-width:380px;"><h2>❌ Authorization Failed</h2><p style="color:#f87171;font-size:13px;">${error || 'Missing authorization code'}</p></div><script>if(window.opener){window.opener.postMessage({type:'CONNECTORS_AUTH_FAILED',error:'${error||'Failed'}'},'*');setTimeout(()=>window.close(),2000);}</script></body></html>`;
      return res.status(400).send(html);
    }

    // 3. Provider detection & exchange
    const redirectUri = `${req.protocol}://${req.get('host')}/api/connectors/callback`;

    // A. LinkedIn
    if (explicitProvider === 'linkedin' || state.includes('linkedin') || state.startsWith('li_')) {
      try {
        const { linkedinService } = await import('../services/linkedin_service');
        const saved = await linkedinService.exchangeAuthCode(code, redirectUri);
        const html = `<!DOCTYPE html><html><head><title>LinkedIn Connected | J.A.R.V.I.S.</title></head><body style="background:#090a0f;color:#fff;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:32px;background:rgba(18,20,29,0.9);border:1px solid rgba(10,102,194,0.3);border-radius:16px;max-width:380px;"><div style="font-size:36px;margin-bottom:12px;">💼</div><h2 style="color:#388bfd;margin:0 0 8px 0;">LinkedIn Connected</h2><p style="font-size:13px;color:#9ca3af;margin:0 0 16px 0;">Linked as <b>${saved.name || 'User'}</b>. Closing popup...</p></div><script>if(window.opener){window.opener.postMessage({type:'LINKEDIN_AUTH_SUCCESS',status:${JSON.stringify(linkedinService.getStatus())}},'*');window.opener.postMessage({type:'CONNECTORS_AUTH_SUCCESS',provider:'linkedin',status:${JSON.stringify(linkedinService.getStatus())}},'*');setTimeout(()=>window.close(),1000);}</script></body></html>`;
        return res.send(html);
      } catch (err: any) {
        return res.status(500).send(`<!DOCTYPE html><html><body style="background:#090a0f;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:32px;background:rgba(255,255,255,0.05);border-radius:16px;"><h2 style="color:#f87171;">❌ LinkedIn Auth Error</h2><p style="color:#9ca3af;font-size:13px;">${err.message}</p></div><script>if(window.opener){window.opener.postMessage({type:'LINKEDIN_AUTH_FAILED',error:'${err.message}'},'*');setTimeout(()=>window.close(),2000);}</script></body></html>`);
      }
    }

    // B. GitHub
    if (explicitProvider === 'github' || state.includes('github') || state.startsWith('gh_')) {
      try {
        const { githubService } = await import('../services/github_service');
        const saved = await githubService.exchangeAuthCode(code, redirectUri);
        const html = `<!DOCTYPE html><html><head><title>GitHub Connected | J.A.R.V.I.S.</title></head><body style="background:#090a0f;color:#fff;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:32px;background:rgba(18,20,29,0.9);border:1px solid rgba(240,80,50,0.3);border-radius:16px;max-width:380px;"><div style="font-size:36px;margin-bottom:12px;">🐙</div><h2 style="color:#ff7a64;margin:0 0 8px 0;">GitHub Connected</h2><p style="font-size:13px;color:#9ca3af;margin:0 0 16px 0;">Authenticated as <b>@${saved.login || 'User'}</b>. Closing popup...</p></div><script>if(window.opener){window.opener.postMessage({type:'GITHUB_AUTH_SUCCESS',status:${JSON.stringify(githubService.getStatus())}},'*');window.opener.postMessage({type:'CONNECTORS_AUTH_SUCCESS',provider:'github',status:${JSON.stringify(githubService.getStatus())}},'*');setTimeout(()=>window.close(),1000);}</script></body></html>`;
        return res.send(html);
      } catch (err: any) {
        return res.status(500).send(`<!DOCTYPE html><html><body style="background:#090a0f;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:32px;background:rgba(255,255,255,0.05);border-radius:16px;"><h2 style="color:#f87171;">❌ GitHub Auth Error</h2><p style="color:#9ca3af;font-size:13px;">${err.message}</p></div><script>if(window.opener){window.opener.postMessage({type:'GITHUB_AUTH_FAILED',error:'${err.message}'},'*');setTimeout(()=>window.close(),2000);}</script></body></html>`);
      }
    }

    // C. Google
    if (explicitProvider === 'google' || state.includes('google') || state.startsWith('goog_')) {
      try {
        const saved = await googleAuthService.exchangeAuthCode(code, redirectUri);
        const html = `<!DOCTYPE html><html><head><title>Google Connected | J.A.R.V.I.S.</title></head><body style="background:#090a0f;color:#fff;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:32px;background:rgba(18,20,29,0.9);border:1px solid rgba(0,240,255,0.3);border-radius:16px;max-width:380px;"><div style="font-size:36px;margin-bottom:12px;">🌐</div><h2 style="color:#00f0ff;margin:0 0 8px 0;">Google Connected</h2><p style="font-size:13px;color:#9ca3af;margin:0 0 16px 0;">Authenticated as <b>${saved.email || 'User'}</b>. Closing popup...</p></div><script>if(window.opener){window.opener.postMessage({type:'GOOGLE_AUTH_SUCCESS',status:${JSON.stringify(googleAuthService.getStatus())}},'*');window.opener.postMessage({type:'CONNECTORS_AUTH_SUCCESS',provider:'google',status:${JSON.stringify(googleAuthService.getStatus())}},'*');setTimeout(()=>window.close(),1000);}</script></body></html>`;
        return res.send(html);
      } catch (err: any) {
        return res.status(500).send(`<!DOCTYPE html><html><body style="background:#090a0f;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:32px;background:rgba(255,255,255,0.05);border-radius:16px;"><h2 style="color:#f87171;">❌ Google Auth Error</h2><p style="color:#9ca3af;font-size:13px;">${err.message}</p></div><script>if(window.opener){window.opener.postMessage({type:'GOOGLE_AUTH_FAILED',error:'${err.message}'},'*');setTimeout(()=>window.close(),2000);}</script></body></html>`);
      }
    }

    // D. Resilient Multi-Provider Fallback Auto-Detection
    try {
      const { githubService } = await import('../services/github_service');
      const saved = await githubService.exchangeAuthCode(code, redirectUri);
      const html = `<!DOCTYPE html><html><body style="background:#090a0f;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:32px;background:rgba(18,20,29,0.9);border-radius:16px;"><div style="font-size:36px;margin-bottom:12px;">🐙</div><h2>GitHub Connected</h2><p style="color:#9ca3af;font-size:13px;">Authenticated as <b>@${saved.login || 'User'}</b></p></div><script>if(window.opener){window.opener.postMessage({type:'GITHUB_AUTH_SUCCESS',status:${JSON.stringify(githubService.getStatus())}},'*');window.opener.postMessage({type:'CONNECTORS_AUTH_SUCCESS',provider:'github',status:${JSON.stringify(githubService.getStatus())}},'*');setTimeout(()=>window.close(),1000);}</script></body></html>`;
      return res.send(html);
    } catch {
      try {
        const { linkedinService } = await import('../services/linkedin_service');
        const saved = await linkedinService.exchangeAuthCode(code, redirectUri);
        const html = `<!DOCTYPE html><html><body style="background:#090a0f;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:32px;background:rgba(18,20,29,0.9);border-radius:16px;"><div style="font-size:36px;margin-bottom:12px;">💼</div><h2>LinkedIn Connected</h2><p style="color:#9ca3af;font-size:13px;">Linked as <b>${saved.name || 'User'}</b></p></div><script>if(window.opener){window.opener.postMessage({type:'LINKEDIN_AUTH_SUCCESS',status:${JSON.stringify(linkedinService.getStatus())}},'*');window.opener.postMessage({type:'CONNECTORS_AUTH_SUCCESS',provider:'linkedin',status:${JSON.stringify(linkedinService.getStatus())}},'*');setTimeout(()=>window.close(),1000);}</script></body></html>`;
        return res.send(html);
      } catch (finalErr: any) {
        return res.status(500).send(`<!DOCTYPE html><html><body style="background:#090a0f;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:32px;background:rgba(255,255,255,0.05);border-radius:16px;"><h2 style="color:#f87171;">❌ OAuth Code Exchange Failed</h2><p style="color:#9ca3af;font-size:13px;">${finalErr.message || 'Unable to exchange code with any configured provider.'}</p></div><script>if(window.opener){window.opener.postMessage({type:'CONNECTORS_AUTH_FAILED',error:'${finalErr.message}'},'*');setTimeout(()=>window.close(),2500);}</script></body></html>`);
      }
    }
  };

  router.get('/connectors/callback', handleUniversalCallback);
  router.get('/auth/callback', handleUniversalCallback);

  router.post('/connectors/callback', async (req: Request, res: Response) => {
    try {
      const { code, provider, redirectUri } = req.body;
      if (!code) return res.status(400).json({ success: false, error: 'code is required' });
      const prov = (provider || '').toLowerCase();
      const uri = redirectUri || `${req.protocol}://${req.get('host')}/api/connectors/callback`;

      if (prov === 'linkedin') {
        const { linkedinService } = await import('../services/linkedin_service');
        const saved = await linkedinService.exchangeAuthCode(code, uri);
        return res.json({ success: true, provider: 'linkedin', auth: saved, status: linkedinService.getStatus() });
      }
      if (prov === 'github') {
        const { githubService } = await import('../services/github_service');
        const saved = await githubService.exchangeAuthCode(code, uri);
        return res.json({ success: true, provider: 'github', auth: saved, status: githubService.getStatus() });
      }
      if (prov === 'google') {
        const saved = await googleAuthService.exchangeAuthCode(code, uri);
        return res.json({ success: true, provider: 'google', auth: saved, status: googleAuthService.getStatus() });
      }

      // Default try GitHub then LinkedIn
      try {
        const { githubService } = await import('../services/github_service');
        const saved = await githubService.exchangeAuthCode(code, uri);
        return res.json({ success: true, provider: 'github', auth: saved, status: githubService.getStatus() });
      } catch {
        const { linkedinService } = await import('../services/linkedin_service');
        const saved = await linkedinService.exchangeAuthCode(code, uri);
        return res.json({ success: true, provider: 'linkedin', auth: saved, status: linkedinService.getStatus() });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
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

  // Iron Man Mark Suit Pre-Flight & Full Systems Diagnostic Sweep
  router.get('/diagnostics/full-sweep', async (_req: Request, res: Response) => {
    try {
      const { suitDiagnosticsEngine } = await import('../core/suit_diagnostics');
      res.json(await suitDiagnosticsEngine.runFullPreFlightSweep());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/diagnostics/full-sweep', async (_req: Request, res: Response) => {
    try {
      const { suitDiagnosticsEngine } = await import('../core/suit_diagnostics');
      res.json(await suitDiagnosticsEngine.runFullPreFlightSweep());
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

