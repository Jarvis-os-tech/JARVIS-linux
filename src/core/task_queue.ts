import { logTaskQueue } from './logger';
import { eventBus } from './event_bus';
import { taskRepo, TaskRecord } from '../db/db';

export type TaskPriority = 1 | 2 | 3 | 4; // 1: CRITICAL, 2: HIGH, 3: NORMAL, 4: LOW

export interface QueuedTask {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  execute: () => Promise<any>;
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

  public static getInstance(): TaskPriorityQueue {
    if (!TaskPriorityQueue.instance) {
      TaskPriorityQueue.instance = new TaskPriorityQueue();
    }
    return TaskPriorityQueue.instance;
  }

  constructor() {
    logTaskQueue.info('Task Priority Queue active (Max concurrency: 3, SQLite-backed).');
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

    // Update SQLite state
    taskRepo.updateStatus(task.id, 'running');
    logTaskQueue.info(`Executing task: ${task.title} (Active running: ${this.activeCount})`);

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Task ${task.id} timed out after ${task.timeoutMs}ms`)), task.timeoutMs)
    );

    try {
      const result = await Promise.race([task.execute(), timeoutPromise]);
      taskRepo.updateProgress(task.id, 100);
      taskRepo.updateStatus(task.id, 'completed', result);
      logTaskQueue.info(`Task completed: ${task.title} (${task.id})`);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      logTaskQueue.error(`Task failed: ${task.title} (${task.id}) - ${errMsg}`);

      if ((task.retries || 0) < (task.maxRetries || 2)) {
        task.retries = (task.retries || 0) + 1;
        logTaskQueue.warn(`Retrying task ${task.id} (Attempt ${task.retries}/${task.maxRetries})...`);
        this.queue.push(task);
        this.queue.sort((a, b) => a.priority - b.priority);
      } else {
        taskRepo.updateStatus(task.id, 'failed', null, errMsg);
      }
    } finally {
      this.activeCount--;
      this.processNext();
    }
  }

  public cancel(id: string): boolean {
    const idx = this.queue.findIndex((t) => t.id === id);
    if (idx !== -1) {
      this.queue.splice(idx, 1);
      taskRepo.updateStatus(id, 'cancelled');
      logTaskQueue.info(`Cancelled pending task: ${id}`);
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
