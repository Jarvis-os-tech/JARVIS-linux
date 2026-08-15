import { logOrchestrator } from './logger';
import { eventBus } from './event_bus';
import { jarvisDb, memoryRepo, taskRepo, auditRepo, configRepo } from '../db/db';
import { lifecycleManager } from './lifecycle_manager';
import { toolRegistry } from '../tools/tool_registry';
import { taskQueue } from './task_queue';
import { watchdog } from './watchdog';
import { switchManager } from './switch_manager';
import { multiAgentOrchestrator } from '../utils/multi_agent_orchestrator';
import { obsidianSyncBridge } from '../utils/obsidian_sync';

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

    // 2. Perform initial watchdog health probe
    await watchdog.probe();

    this.isInitialized = true;
    logOrchestrator.info('J.A.R.V.I.S. Prime Orchestrator Core is ONLINE and fully synchronized.');
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
