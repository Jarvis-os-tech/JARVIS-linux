import EventEmitter from 'eventemitter3';
import { logOrchestrator } from './logger';

export interface JarvisEventMap {
  // Task Queue Events
  'task:created': (task: any) => void;
  'task:progress': (data: { taskId: string; progress: number; status?: string }) => void;
  'task:completed': (data: { taskId: string; result: any }) => void;
  'task:failed': (data: { taskId: string; error: string }) => void;
  'task:cancelled': (data: { taskId: string }) => void;

  // Vision Events
  'vision:toggle': (data: { mode: 'camera' | 'screen' | null; active: boolean }) => void;
  'vision:frame': (data: { base64: string; mode: string }) => void;

  // Persona & Voice Events
  'persona:swapped': (data: { oldPersonaId?: string; newPersonaId: string; name: string }) => void;
  'voice:state_change': (data: { state: string; personaId?: string }) => void;
  'voice:interrupted': () => void;

  // Tool Execution Events
  'tool:before_execute': (data: { toolName: string; args: any; tier?: string }) => void;
  'tool:after_execute': (data: { toolName: string; success: boolean; durationMs: number; result?: any }) => void;
  'tool:error': (data: { toolName: string; error: string; durationMs: number }) => void;

  // Ephemeral Lifecycle Events
  'lifecycle:register': (data: { id: string; name: string; category: string; ttlMs: number }) => void;
  'lifecycle:touch': (data: { id: string }) => void;
  'lifecycle:teardown': (data: { id: string; name: string; reason: string }) => void;

  // Feature Switch Events
  'switch:changed': (data: { featureId: string; enabled: boolean }) => void;

  // Memory & Obsidian Sync Events
  'memory:created': (data: { content: string; title?: string; kind?: string; tier?: string; importance?: number }) => void;
  'memory:fact_added': (fact: any) => void;
  'memory:fact_deleted': (data: { id: string }) => void;
  'obsidian:synced': (data: { file: string; type: string }) => void;

  // Research & Grounding Events
  'research:start': (data: { query: string; mode: string; category?: string }) => void;
  'research:progress': (data: { query: string; step: string; percent?: number }) => void;
  'research:complete': (data: { query: string; cached?: boolean; factsCount?: number; groundingScore?: number; durationMs?: number }) => void;
  'research:error': (data: { query: string; error: string }) => void;

  // System Health & Watchdog Alerts
  'system:alert': (data: { level: 'info' | 'warn' | 'error'; message: string; source: string }) => void;
  'watchdog:probe': (report: any) => void;

  // Connector & OAuth Events
  'connector:status_changed': (data: { provider: string; connected: boolean }) => void;

  // Conversation & Auto-Capture Events
  'conversation:turn_completed': (data: any) => void;
}

export class JarvisEventBus extends EventEmitter<JarvisEventMap> {
  private static instance: JarvisEventBus;

  public static getInstance(): JarvisEventBus {
    if (!JarvisEventBus.instance) {
      JarvisEventBus.instance = new JarvisEventBus();
    }
    return JarvisEventBus.instance;
  }

  constructor() {
    super();
    logOrchestrator.info('Central Typed Event Bus initialized.');
  }
}

export const eventBus = JarvisEventBus.getInstance();
