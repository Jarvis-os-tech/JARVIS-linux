// Hermes-Grade Persistent Cron & Autonomous Daily Operations Engine for J.A.R.V.I.S.
// Implements 24/7 persistent background scheduling, fire-once locks, execution auditing,
// and the 8 JARVIS Autonomous Fleet daily operational loops from SOUL.md.

import { cronRepo, CronJobRecord } from '../db/db';
import { eventBus } from './event_bus';
import { logCron } from './logger';
import { HermesAgentRuntime } from './hermes_agent_runtime';

export class CronEngine {
  private static instance: CronEngine;
  private timer: NodeJS.Timeout | null = null;
  private isTicking = false;
  private activeJobs = new Set<string>();

  public static getInstance(): CronEngine {
    if (!CronEngine.instance) {
      CronEngine.instance = new CronEngine();
    }
    return CronEngine.instance;
  }

  constructor() {
    this.seedDefaultFleetJobs();
  }

  /**
   * Seed default 24/7 autonomous daily fleet routines if not already registered.
   */
  private seedDefaultFleetJobs(): void {
    const defaultJobs: Array<Omit<CronJobRecord, 'created_at' | 'updated_at'>> = [
      {
        id: 'jarvis-morning-brief',
        name: 'JARVIS 06:00 Morning Brief',
        prompt: `Run the 06:00 morning brief:
1. Check overnight performance across active tasks and research pipelines.
2. Verify fleet health: check active background processes, APIs, and audio daemon.
3. Check calendar and schedule commitments for today.
4. Flag top 3 anomalies or items needing attention.
5. Save summary to memory: 'overnight_status'.`,
        schedule_expr: '0 6 * * *',
        schedule_kind: 'cron',
        enabled: 1,
        deliver: 'local',
      },
      {
        id: 'jarvis-strategy-sync',
        name: 'JARVIS 06:30 Strategy Sync',
        prompt: `Run the 06:30 strategy sync:
1. Review capital allocation across operations (trading, content, research, dev, infra).
2. Scan overnight research notes in /JARVIS-MEMORY/ and Obsidian vault.
3. Update allocation and priorities in memory.`,
        schedule_expr: '30 6 * * *',
        schedule_kind: 'cron',
        enabled: 1,
        deliver: 'local',
      },
      {
        id: 'jarvis-content-pipeline',
        name: 'JARVIS 07:00 Content Pipeline',
        prompt: `Run the 07:00 daily content research pipeline:
1. Research trending engineering and AI topics.
2. Generate daily drafting notes and code examples.
3. Log results to Obsidian vault memory.`,
        schedule_expr: '0 7 * * *',
        schedule_kind: 'cron',
        enabled: 1,
        deliver: 'local',
      },
      {
        id: 'jarvis-midday-review',
        name: 'JARVIS 12:00 Mid-Day Health Review',
        prompt: `Run the 12:00 mid-day status check:
1. Telemetry and thermal checks on host system.
2. Inspect active background tasks.
3. Consolidate working memory.`,
        schedule_expr: '0 12 * * *',
        schedule_kind: 'cron',
        enabled: 1,
        deliver: 'local',
      },
      {
        id: 'jarvis-evening-synthesis',
        name: 'JARVIS 20:00 Evening Learning Synthesis',
        prompt: `Run the 20:00 evening synthesis:
1. Consolidate daily interaction logs into long-term structured facts.
2. Auto-extract new skills from repeated workflows.
3. Sync Obsidian memory vault.`,
        schedule_expr: '0 20 * * *',
        schedule_kind: 'cron',
        enabled: 1,
        deliver: 'local',
      },
      {
        id: 'jarvis-fleet-maintenance',
        name: 'JARVIS 22:00 Fleet Maintenance',
        prompt: `Run the 22:00 fleet maintenance routine:
1. Database WAL checkpoint and vacuum.
2. Expire obsolete cache entries.
3. Rotate and prune old log files.`,
        schedule_expr: '0 22 * * *',
        schedule_kind: 'cron',
        enabled: 1,
        deliver: 'local',
      },
    ];

    const now = Date.now();
    for (const job of defaultJobs) {
      const existing = cronRepo.getById(job.id);
      if (!existing) {
        cronRepo.upsert({
          ...job,
          created_at: now,
          updated_at: now,
          next_run_at: this.calculateNextRun(job.schedule_expr, job.schedule_kind),
        });
      }
    }
  }

  /**
   * Start the background cron ticker (checks every 30 seconds).
   */
  public start(): void {
    if (this.timer) return;
    logCron.info('Autonomous Cron Engine started (30s tick cycle).');
    this.timer = setInterval(() => this.tick(), 30000);
    // Initial check
    setTimeout(() => this.tick(), 2000);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logCron.info('Autonomous Cron Engine stopped.');
    }
  }

  /**
   * Evaluate scheduled jobs and trigger eligible executions.
   */
  public async tick(): Promise<void> {
    if (this.isTicking) return;
    this.isTicking = true;

    try {
      const now = Date.now();
      const enabledJobs = cronRepo.getEnabled();

      for (const job of enabledJobs) {
        // If next_run_at is not set or in the past, trigger execution
        if (!job.next_run_at || job.next_run_at <= now) {
          if (this.activeJobs.has(job.id)) continue; // Already running

          const nextRun = this.calculateNextRun(job.schedule_expr, job.schedule_kind);
          cronRepo.updateRunStatus(job.id, nextRun, 'running');

          this.runJob(job).catch((err) => {
            logCron.error(`Job ${job.name} execution failed: ${err.message}`);
          });
        }
      }
    } catch (err: any) {
      logCron.error(`Cron ticker error: ${err.message}`);
    } finally {
      this.isTicking = false;
    }
  }

  /**
   * Execute a single cron job using the HermesAgentRuntime.
   */
  public async runJob(job: CronJobRecord): Promise<{ success: boolean; output: string; error?: string }> {
    const execId = `exec_${job.id}_${Date.now()}`;
    const startTime = Date.now();
    this.activeJobs.add(job.id);
    logCron.info(`Firing scheduled job: [${job.name}]`);

    cronRepo.logExecution({
      id: execId,
      job_id: job.id,
      job_name: job.name,
      started_at: startTime,
      status: 'running',
    });

    try {
      const runtime = new HermesAgentRuntime({
        systemInstruction: `You are J.A.R.V.I.S. executing an automated scheduled routine: "${job.name}".
Execute all required steps cleanly, verify results, and save key outputs.`,
        maxIterations: 15,
        sessionId: `cron_${job.id}`,
      });

      const turnResult = await runtime.runTurn(job.prompt);
      const durationMs = Date.now() - startTime;

      cronRepo.logExecution({
        id: execId,
        job_id: job.id,
        job_name: job.name,
        started_at: startTime,
        completed_at: Date.now(),
        duration_ms: durationMs,
        status: turnResult.success ? 'ok' : 'error',
        output_text: turnResult.finalResponse,
        error: turnResult.error,
      });

      const nextRun = this.calculateNextRun(job.schedule_expr, job.schedule_kind);
      cronRepo.updateRunStatus(job.id, nextRun, turnResult.success ? 'ok' : 'error', turnResult.error);

      eventBus.emit('cron:executed', {
        jobId: job.id,
        jobName: job.name,
        status: turnResult.success ? 'ok' : 'error',
        output: turnResult.finalResponse,
        error: turnResult.error,
      });

      logCron.info(`Completed scheduled job [${job.name}] in ${durationMs}ms with status: ${turnResult.success ? 'ok' : 'error'}`);
      return { success: turnResult.success, output: turnResult.finalResponse, error: turnResult.error };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      cronRepo.logExecution({
        id: execId,
        job_id: job.id,
        job_name: job.name,
        started_at: startTime,
        completed_at: Date.now(),
        duration_ms: durationMs,
        status: 'error',
        error: err.message,
      });

      const nextRun = this.calculateNextRun(job.schedule_expr, job.schedule_kind);
      cronRepo.updateRunStatus(job.id, nextRun, 'error', err.message);

      eventBus.emit('cron:executed', {
        jobId: job.id,
        jobName: job.name,
        status: 'error',
        error: err.message,
      });

      return { success: false, output: '', error: err.message };
    } finally {
      this.activeJobs.delete(job.id);
    }
  }

  /**
   * Calculate next run timestamp from a cron or interval expression.
   */
  public calculateNextRun(expr: string, kind: string): number {
    const now = Date.now();

    // Interval mode (e.g. "every 30m", "every 2h", "15m")
    if (kind === 'interval' || expr.startsWith('every ') || /^\d+[smhd]$/.test(expr)) {
      const cleaned = expr.replace(/^every\s+/, '').trim();
      const match = cleaned.match(/^(\d+)([smhd])$/);
      if (match) {
        const val = parseInt(match[1], 10);
        const unit = match[2];
        const msMap: Record<string, number> = {
          s: 1000,
          m: 60 * 1000,
          h: 60 * 60 * 1000,
          d: 24 * 60 * 60 * 1000,
        };
        return now + val * (msMap[unit] || 60000);
      }
    }

    // Standard 5-field cron parsing: "min hour day month dayOfWeek" (e.g. "0 6 * * *")
    const parts = expr.trim().split(/\s+/);
    if (parts.length === 5) {
      const targetMin = parts[0] === '*' ? -1 : parseInt(parts[0], 10);
      const targetHour = parts[1] === '*' ? -1 : parseInt(parts[1], 10);

      const d = new Date(now);
      d.setSeconds(0, 0);

      if (targetHour !== -1 && targetMin !== -1) {
        d.setHours(targetHour, targetMin, 0, 0);
        if (d.getTime() <= now) {
          d.setDate(d.getDate() + 1); // Next day
        }
        return d.getTime();
      }

      if (targetMin !== -1) {
        d.setMinutes(targetMin, 0, 0);
        if (d.getTime() <= now) {
          d.setHours(d.getHours() + 1); // Next hour
        }
        return d.getTime();
      }
    }

    // Default fallback: 1 hour from now
    return now + 3600000;
  }
}

export const cronEngine = CronEngine.getInstance();
