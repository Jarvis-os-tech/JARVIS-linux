import { logTaskQueue } from './logger';
import { eventBus } from './event_bus';
import { taskRepo, TaskRecord } from '../db/db';

export type TaskPriority = 1 | 2 | 3 | 4; // 1: CRITICAL, 2: HIGH, 3: NORMAL, 4: LOW

export interface QueuedTask {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  execute: (signal?: AbortSignal) => Promise<any>;
  retries?: number;
  maxRetries?: number;
  timeoutMs?: number;
}

export class TaskPriorityQueue {
  private static instance: TaskPriorityQueue;
  private queue: QueuedTask[] = [];
  private activeCount = 0;
  private maxConcurrency = 3;
  private isProcessing = false;
  private runningAbortControllers: Map<string, AbortController> = new Map();

  public static getInstance(): TaskPriorityQueue {
    if (!TaskPriorityQueue.instance) {
      TaskPriorityQueue.instance = new TaskPriorityQueue();
    }
    return TaskPriorityQueue.instance;
  }

  constructor() {
    this.recoverStaleTasks();
    logTaskQueue.info('Task Priority Queue active (Max concurrency: 3, SQLite-backed, cold-boot recovery enabled).');
  }

  /**
   * Cold-boot recovery: mark any tasks left in 'running' state from a previous
   * crash as 'failed', so they don't remain orphaned in SQLite forever.
   */
  private recoverStaleTasks(): void {
    try {
      const staleTasks = taskRepo.getByStatus('running');
      if (staleTasks.length > 0) {
        for (const task of staleTasks) {
          taskRepo.updateStatus(task.id, 'failed', null, 'Recovered on cold-boot: task was interrupted by server shutdown.');
          logTaskQueue.warn(`Cold-boot recovery: Marked stale running task as failed: ${task.title} (${task.id})`);
        }
        logTaskQueue.info(`Cold-boot recovery complete: ${staleTasks.length} stale task(s) marked as failed.`);
      }
    } catch (err: any) {
      logTaskQueue.warn(`Cold-boot recovery skipped: ${err?.message}`);
    }
  }

  public enqueue(task: QueuedTask): string {
    const id = task.id || `tsk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const fullTask: QueuedTask = {
      ...task,
      id,
      retries: 0,
      maxRetries: task.maxRetries ?? 2,
      timeoutMs: task.timeoutMs ?? 30000,
    };

    // Record in SQLite
    taskRepo.insert({
      id,
      title: fullTask.title,
      description: fullTask.description,
      status: 'pending',
      priority: fullTask.priority,
      progress: 0,
      created_at: Date.now(),
    });

    // Insert into memory queue sorted by priority
    this.queue.push(fullTask);
    this.queue.sort((a, b) => a.priority - b.priority);

    logTaskQueue.info(`Enqueued task: ${fullTask.title} [Priority: ${fullTask.priority}, ID: ${id}]`);
    eventBus.emit('task:created', { id, title: fullTask.title, priority: fullTask.priority });
    this.processNext();
    return id;
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.activeCount >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const task = this.queue.shift();
    if (!task) {
      this.isProcessing = false;
      return;
    }

    this.activeCount++;
    this.isProcessing = false;

    // Create AbortController for this running task
    const abortController = new AbortController();
    this.runningAbortControllers.set(task.id, abortController);

    // Update SQLite state
    taskRepo.updateStatus(task.id, 'running');
    logTaskQueue.info(`Executing task: ${task.title} (Active running: ${this.activeCount})`);

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Task ${task.id} timed out after ${task.timeoutMs}ms`)), task.timeoutMs)
    );

    try {
      const result = await Promise.race([task.execute(abortController.signal), timeoutPromise]);
      taskRepo.updateProgress(task.id, 100);
      taskRepo.updateStatus(task.id, 'completed', result);
      logTaskQueue.info(`Task completed: ${task.title} (${task.id})`);
      eventBus.emit('task:completed', { taskId: task.id, result });
    } catch (err: any) {
      const errMsg = err?.message || String(err);

      if (abortController.signal.aborted) {
        taskRepo.updateStatus(task.id, 'cancelled');
        logTaskQueue.info(`Task cancelled (abort signal): ${task.title} (${task.id})`);
        eventBus.emit('task:cancelled', { taskId: task.id });
      } else if ((task.retries || 0) < (task.maxRetries || 2)) {
        task.retries = (task.retries || 0) + 1;
        logTaskQueue.warn(`Retrying task ${task.id} (Attempt ${task.retries}/${task.maxRetries})...`);
        this.queue.push(task);
        this.queue.sort((a, b) => a.priority - b.priority);
      } else {
        logTaskQueue.error(`Task failed: ${task.title} (${task.id}) - ${errMsg}`);
        taskRepo.updateStatus(task.id, 'failed', null, errMsg);
        eventBus.emit('task:failed', { taskId: task.id, error: errMsg });
      }
    } finally {
      this.runningAbortControllers.delete(task.id);
      this.activeCount--;
      this.processNext();
    }
  }

  public cancel(id: string): boolean {
    // Try to cancel from pending queue first
    const idx = this.queue.findIndex((t) => t.id === id);
    if (idx !== -1) {
      this.queue.splice(idx, 1);
      taskRepo.updateStatus(id, 'cancelled');
      logTaskQueue.info(`Cancelled pending task: ${id}`);
      eventBus.emit('task:cancelled', { taskId: id });
      return true;
    }

    // Try to abort an actively running task
    const abortController = this.runningAbortControllers.get(id);
    if (abortController) {
      abortController.abort();
      logTaskQueue.info(`Abort signal sent to running task: ${id}`);
      return true;
    }

    return false;
  }

  public getStatus() {
    return {
      activeCount: this.activeCount,
      queuedCount: this.queue.length,
      maxConcurrency: this.maxConcurrency,
      pendingTasks: this.queue.map((t) => ({ id: t.id, title: t.title, priority: t.priority })),
    };
  }
}

export const taskQueue = TaskPriorityQueue.getInstance();
