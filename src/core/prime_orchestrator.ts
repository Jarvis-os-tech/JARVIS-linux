import { logOrchestrator } from './logger';
import { eventBus } from './event_bus';
import { jarvisDb, memoryRepo, taskRepo, auditRepo, configRepo } from '../db/db';
import { lifecycleManager } from './lifecycle_manager';
import { toolRegistry, ToolExecutionResult } from '../tools/tool_registry';
import { taskQueue } from './task_queue';
import { watchdog } from './watchdog';
import { switchManager } from './switch_manager';
import { multiAgentOrchestrator } from '../utils/multi_agent_orchestrator';
import { obsidianSyncBridge } from '../utils/obsidian_sync';
import type { MemoryKind, MemoryTier } from '../memory/types';

export class PrimeJarvisOrchestrator {
  private static instance: PrimeJarvisOrchestrator;
  public isInitialized = false;

  public static getInstance(): PrimeJarvisOrchestrator {
    if (!PrimeJarvisOrchestrator.instance) {
      PrimeJarvisOrchestrator.instance = new PrimeJarvisOrchestrator();
    }
    return PrimeJarvisOrchestrator.instance;
  }

  constructor() {}

  public async bootstrap(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    logOrchestrator.info('Bootstrapping J.A.R.V.I.S. Prime Orchestrator Core...');

    // 1. Hook into Event Bus for central audit logging & notifications
    eventBus.on('system:alert', (data) => {
      auditRepo.log('WATCHDOG', data.level, data.message, { source: data.source });
    });

    eventBus.on('persona:swapped', (data) => {
      auditRepo.log('VOICE', 'info', `Persona swapped to ${data.name} (${data.newPersonaId})`);
      logOrchestrator.info(`Persona hot-swapped to: ${data.name}`);
    });

    eventBus.on('lifecycle:teardown', (data) => {
      auditRepo.log('LIFECYCLE', 'info', `Teardown: ${data.name}`, { reason: data.reason });
    });

    // 2. Wire Universal Memory Event Handlers
    eventBus.on('memory:created', async (data) => {
      try {
        const { memoryClient } = await import('../memory/client');
        const { memoryContextBuilder } = await import('../memory/context_builder');
        await memoryClient.createNode({
          content: data.content,
          title: data.title,
          kind: (data.kind || 'fact') as MemoryKind,
          tier: (data.tier || 'working') as MemoryTier,
          importance: data.importance || 0.7,
        });
        memoryContextBuilder.invalidateCache();
      } catch (memErr: any) {
        logOrchestrator.warn(`[PrimeOrchestrator] Memory event auto-sync warning: ${memErr.message}`);
      }
    });

    // 3. Initialize Lifelong Learning Sentinels & Watchers
    const { vaultWatcher } = await import('../memory/watcher');
    const { gitMemorySyncer } = await import('../memory/git_syncer');
    const { autoCaptureEngine } = await import('../memory/auto_capture');
    const { cronEngine } = await import('./cron_engine');
    const { dualStoreMemory } = await import('../memory/dual_store');
    const { skillsEngine } = await import('./skills_engine');
    const { capabilityForge } = await import('./capability_forge');
    const { codebaseWatcher } = await import('./codebase_watcher');

    vaultWatcher.start();
    gitMemorySyncer.start();
    autoCaptureEngine.start();
    cronEngine.start();
    codebaseWatcher.start();
    dualStoreMemory.getFrozenSnapshot(); // Pre-warm memory snapshot
    skillsEngine.listSkills(); // Pre-warm skills index
    capabilityForge.loadInstalledTools(); // Pre-warm and register all custom dynamic tools

    // 4. Perform initial watchdog health probe
    await watchdog.probe();

    logOrchestrator.info('J.A.R.V.I.S. Prime Orchestrator Core is ONLINE and fully synchronized with Universal Memory, Cron Loops, Skills Hub, Capability Forge & Codebase Memory.');
  }

  /**
   * Central tool dispatch entry point.
   * Routes all tool execution through the unified ToolRegistry with
   * audit logging, event bus emissions, feature switch enforcement, and timeouts.
   */
  public async dispatch(toolName: string, args: any = {}, context?: any): Promise<ToolExecutionResult> {
    return toolRegistry.execute(toolName, args, context);
  }

  /**
   * Graceful shutdown: tears down all ephemeral resources, stops the watchdog,
   * and logs the shutdown event.
   */
  public async shutdown(): Promise<void> {
    logOrchestrator.info('Initiating J.A.R.V.I.S. Prime Orchestrator graceful shutdown...');

    // 1. Tear down all ephemeral resources (browser contexts, PTY shells, video streams)
    await lifecycleManager.teardownAll('GRACEFUL_SHUTDOWN');

    // 2. Stop the watchdog probe loop
    watchdog.stop();

    // 3. Log shutdown audit
    auditRepo.log('ORCHESTRATOR', 'info', 'J.A.R.V.I.S. Prime Orchestrator shutdown complete.');

    logOrchestrator.info('J.A.R.V.I.S. Prime Orchestrator shutdown complete.');
    this.isInitialized = false;
  }

  public getSystemSummary() {
    const health = watchdog.getLatestReport();
    const tasks = taskQueue.getStatus();
    const lifecycle = lifecycleManager.getStatus();
    const switches = switchManager.getAll();

    return {
      status: 'online',
      version: 'MK-VII-PHASE-0',
      health,
      taskQueue: tasks,
      lifecycle,
      switchesCount: switches.length,
      timestamp: Date.now(),
    };
  }
}

export const primeOrchestrator = PrimeJarvisOrchestrator.getInstance();
