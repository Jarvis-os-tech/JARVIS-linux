import { logLifecycle } from './logger';
import { eventBus } from './event_bus';

export type ResourceCategory =
  | 'vision'
  | 'browser'
  | 'terminal'
  | 'specialist_agent'
  | 'audio_pipeline'
  | 'custom';

export interface EphemeralResource {
  id: string;
  name: string;
  category: ResourceCategory;
  ttlMs: number; // Idle time before automatic teardown (e.g. 5000ms - 10000ms)
  lastActivity: number;
  teardownHook: () => Promise<void> | void;
  meta?: Record<string, any>;
}

export class EphemeralLifecycleManager {
  private static instance: EphemeralLifecycleManager;
  private resources: Map<string, EphemeralResource> = new Map();
  private sweeperTimer: NodeJS.Timeout | null = null;
  private isSweeping = false;

  public static getInstance(): EphemeralLifecycleManager {
    if (!EphemeralLifecycleManager.instance) {
      EphemeralLifecycleManager.instance = new EphemeralLifecycleManager();
    }
    return EphemeralLifecycleManager.instance;
  }

  constructor() {
    this.startSweeper(2000);
    logLifecycle.info('Universal Ephemeral Lifecycle Manager initialized (Zero-Idle Sweeper active).');
  }

  public registerResource(resource: Omit<EphemeralResource, 'lastActivity'> & { lastActivity?: number }): void {
    const fullResource: EphemeralResource = {
      ...resource,
      lastActivity: resource.lastActivity || Date.now(),
      ttlMs: resource.ttlMs > 0 ? resource.ttlMs : 10000,
    };

    // If already exists, touch it and replace teardown hook
    this.resources.set(fullResource.id, fullResource);
    logLifecycle.debug(`Registered ephemeral resource: ${fullResource.name} [${fullResource.category}] (TTL: ${fullResource.ttlMs}ms)`);
    
    eventBus.emit('lifecycle:register', {
      id: fullResource.id,
      name: fullResource.name,
      category: fullResource.category,
      ttlMs: fullResource.ttlMs,
    });
  }

  public touch(id: string): boolean {
    const res = this.resources.get(id);
    if (res) {
      res.lastActivity = Date.now();
      logLifecycle.trace(`Resource touched: ${res.name} (${id})`);
      eventBus.emit('lifecycle:touch', { id });
      return true;
    }
    return false;
  }

  public async teardown(id: string, reason = 'manual_teardown'): Promise<boolean> {
    const res = this.resources.get(id);
    if (!res) return false;

    this.resources.delete(id);
    logLifecycle.info(`Tearing down ephemeral resource: ${res.name} (${id}) | Reason: ${reason}`);

    try {
      await Promise.resolve(res.teardownHook());
    } catch (err: any) {
      logLifecycle.error(`Error during teardown of ${res.name}: ${err?.message || err}`);
    }

    eventBus.emit('lifecycle:teardown', {
      id: res.id,
      name: res.name,
      reason,
    });

    return true;
  }

  public async teardownCategory(category: ResourceCategory, reason = 'category_teardown'): Promise<number> {
    let count = 0;
    for (const [id, res] of Array.from(this.resources.entries())) {
      if (res.category === category) {
        await this.teardown(id, reason);
        count++;
      }
    }
    return count;
  }

  public async teardownAll(reason = 'system_shutdown'): Promise<void> {
    logLifecycle.warn(`Emergency teardownAll triggered (${this.resources.size} resources) | Reason: ${reason}`);
    for (const [id] of Array.from(this.resources.entries())) {
      await this.teardown(id, reason);
    }
    this.resources.clear();
  }

  public startSweeper(intervalMs = 2000): void {
    if (this.sweeperTimer) clearInterval(this.sweeperTimer);

    this.sweeperTimer = setInterval(async () => {
      if (this.isSweeping || this.resources.size === 0) return;
      this.isSweeping = true;

      const now = Date.now();
      const expired: EphemeralResource[] = [];

      for (const res of this.resources.values()) {
        if (now - res.lastActivity >= res.ttlMs) {
          expired.push(res);
        }
      }

      for (const res of expired) {
        await this.teardown(res.id, `TTL_EXPIRED_${res.ttlMs}ms`);
      }

      this.isSweeping = false;
    }, intervalMs);
  }

  public stopSweeper(): void {
    if (this.sweeperTimer) {
      clearInterval(this.sweeperTimer);
      this.sweeperTimer = null;
    }
  }

  public getStatus(): { activeCount: number; resources: Array<{ id: string; name: string; category: string; ageMs: number; remainingTtlMs: number }> } {
    const now = Date.now();
    const list = Array.from(this.resources.values()).map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      ageMs: now - r.lastActivity,
      remainingTtlMs: Math.max(0, r.ttlMs - (now - r.lastActivity)),
    }));

    return {
      activeCount: this.resources.size,
      resources: list,
    };
  }
}

export const lifecycleManager = EphemeralLifecycleManager.getInstance();
