import { logSwitch } from './logger';
import { eventBus } from './event_bus';
import { jarvisDb } from '../db/db';

export type FeatureTier = 1 | 2 | 3 | 4;

export interface FeatureSwitch {
  feature_id: string;
  tier: FeatureTier;
  enabled: boolean;
  name: string;
  description: string;
  updated_at: number;
}

export const DEFAULT_FEATURES: Omit<FeatureSwitch, 'updated_at'>[] = [
  // Tier 1: Always Active by Default
  { feature_id: 'system_control', tier: 1, enabled: true, name: 'System Hardware Control', description: 'Volume, Brightness, Power, and Mutter D-Bus actuators.' },
  { feature_id: 'mouse_keyboard_control', tier: 1, enabled: true, name: 'Mouse & Keyboard Actuation', description: 'Wayland virtual input via ydotool and wtype.' },
  { feature_id: 'terminal_control', tier: 1, enabled: true, name: 'Terminal Shell Control', description: 'Ephemeral background PTY shell execution.' },
  { feature_id: 'browser_control', tier: 1, enabled: true, name: 'Browser Automation', description: 'Ephemeral Playwright headless/live Chromium automation.' },
  { feature_id: 'file_control', tier: 1, enabled: true, name: 'File System Operations', description: 'Deep file search, reading, writing, and organization.' },
  { feature_id: 'memory_subsystem', tier: 1, enabled: true, name: 'SQLite Memory & Context', description: 'Persistent long-term facts and entity graph state.' },
  { feature_id: 'obsidian_daily_sync', tier: 1, enabled: true, name: 'Obsidian Daily Memory Sync', description: 'Automatic 2-way markdown vault synchronization.' },
  { feature_id: 'proactive_mode', tier: 1, enabled: true, name: 'Proactive System Alerts', description: 'Morning briefings, hardware warnings, and task notices.' },
  { feature_id: 'multi_agent_mesh', tier: 1, enabled: true, name: 'Multi-Agent Mesh', description: 'Autonomous agent registry and delegation system.' },
  { feature_id: 'task_priority_queue', tier: 1, enabled: true, name: 'Task Priority Queue', description: 'In-process priority queue with SQLite persistence.' },
  { feature_id: 'system_watchdog', tier: 1, enabled: true, name: 'Self-Healing Watchdog', description: 'Continuous health monitoring and memory recovery.' },
  { feature_id: 'structured_logging', tier: 1, enabled: true, name: 'Structured JSON Logging', description: 'Subsystem telemetry and audit trail.' },

  // Tier 2: Unified On-Demand Subsystems
  { feature_id: 'unified_vision', tier: 2, enabled: true, name: 'Unified Ephemeral Vision', description: 'On-demand Screen Sharing, Camera Vision, OCR, and visual reasoning.' },
  { feature_id: 'gesture_control', tier: 2, enabled: false, name: 'Webcam Gesture Control', description: 'Optical hand landmark gesture recognition.' },

  // Tier 3: On-Demand Specialist Micro-Agents
  { feature_id: 'ai_news_agent', tier: 3, enabled: true, name: 'AI News Agent', description: 'Autonomous daily news briefing aggregator & Obsidian logger.' },
  { feature_id: 'research_agent', tier: 3, enabled: true, name: 'Deep Research Agent', description: 'Multi-source web crawler and report synthesizer.' },
  { feature_id: 'hermes_agent', tier: 3, enabled: true, name: 'Hermes Diagnostics Agent', description: 'Deep Linux kernel, D-Bus, and system diagnostics.' },
  { feature_id: 'openclaw_agent', tier: 3, enabled: true, name: 'OpenClaw Coding Agent', description: 'Autonomous git refactoring and code synthesis.' },

  // Tier 4: Deferred Future Extensions
  { feature_id: 'remote_access_pwa', tier: 4, enabled: false, name: 'Remote Access & PWA', description: 'Tailscale VPN and mobile web app connection.' },
  { feature_id: 'messaging_bots', tier: 4, enabled: false, name: 'Telegram & WhatsApp Bots', description: 'Remote messaging bot bridges.' },
  { feature_id: 'command_center_tv', tier: 4, enabled: false, name: 'Multi-Screen Command Center', description: 'Living room TV telemetry split view.' },
  { feature_id: 'offline_local_models', tier: 4, enabled: false, name: 'Offline Local AI Models', description: 'Local LLMs and local offline wake-word detector.' },
];

export class FeatureSwitchManager {
  private static instance: FeatureSwitchManager;
  private cache: Map<string, FeatureSwitch> = new Map();

  public static getInstance(): FeatureSwitchManager {
    if (!FeatureSwitchManager.instance) {
      FeatureSwitchManager.instance = new FeatureSwitchManager();
    }
    return FeatureSwitchManager.instance;
  }

  constructor() {
    this.initDatabaseDefaults();
    this.reloadCache();
    logSwitch.info(`Feature Switch Manager initialized (${this.cache.size} switches loaded).`);
  }

  private initDatabaseDefaults(): void {
    const checkStmt = jarvisDb.db.prepare('SELECT COUNT(*) as count FROM feature_switches');
    const res = checkStmt.get() as { count: number };

    if (res.count === 0) {
      const insertStmt = jarvisDb.db.prepare(`
        INSERT INTO feature_switches (feature_id, tier, enabled, name, description, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const now = Date.now();
      const insertMany = jarvisDb.db.transaction(() => {
        for (const f of DEFAULT_FEATURES) {
          insertStmt.run(f.feature_id, f.tier, f.enabled ? 1 : 0, f.name, f.description, now);
        }
      });
      insertMany();
      logSwitch.info('Populated default 4-tier feature switch registry in SQLite.');
    }
  }

  public reloadCache(): void {
    const stmt = jarvisDb.db.prepare('SELECT * FROM feature_switches');
    const rows = stmt.all() as any[];
    this.cache.clear();
    for (const r of rows) {
      this.cache.set(r.feature_id, {
        feature_id: r.feature_id,
        tier: r.tier as FeatureTier,
        enabled: Boolean(r.enabled),
        name: r.name,
        description: r.description,
        updated_at: r.updated_at,
      });
    }
  }

  public isEnabled(featureId: string): boolean {
    const sw = this.cache.get(featureId);
    if (!sw) return true; // Default allow if unlisted
    return sw.enabled;
  }

  public setFeature(featureId: string, enabled: boolean): boolean {
    const sw = this.cache.get(featureId);
    if (!sw) return false;

    const now = Date.now();
    const stmt = jarvisDb.db.prepare('UPDATE feature_switches SET enabled = ?, updated_at = ? WHERE feature_id = ?');
    stmt.run(enabled ? 1 : 0, now, featureId);

    sw.enabled = enabled;
    sw.updated_at = now;

    logSwitch.info(`Feature switch toggled: ${featureId} -> ${enabled ? 'ENABLED' : 'DISABLED'}`);
    eventBus.emit('switch:changed', { featureId, enabled });
    return true;
  }

  public getAll(): FeatureSwitch[] {
    return Array.from(this.cache.values());
  }

  public getAllSwitches(): FeatureSwitch[] {
    return this.getAll();
  }

  public getByTier(tier: FeatureTier): FeatureSwitch[] {
    return Array.from(this.cache.values()).filter((f) => f.tier === tier);
  }
}

export const switchManager = FeatureSwitchManager.getInstance();
