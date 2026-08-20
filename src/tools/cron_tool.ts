// Hermes-Grade Cronjob Tool for J.A.R.V.I.S.
// Allows the agent or user to create, list, pause, resume, trigger, or remove scheduled autonomous jobs.

import { toolRegistry } from './tool_registry';
import { cronRepo, CronJobRecord } from '../db/db';
import { cronEngine } from '../core/cron_engine';
import { logTool } from '../core/logger';
import { eventBus } from '../core/event_bus';

export function registerCronTools(): void {
  toolRegistry.register({
    name: 'cronjob',
    description: 'Manage persistent 24/7 scheduled autonomous agent routines. Actions: "list", "create", "pause", "resume", "remove", "run". Schedule formats: "0 6 * * *" (cron), "every 30m" (interval), "1h".',
    tier: 'tier2_system_shell',
    featureSwitchId: 'multi_agent_mesh',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'create', 'pause', 'resume', 'remove', 'run'],
          description: 'The cron management action to perform',
        },
        name: { type: 'string', description: 'Name of the scheduled job' },
        prompt: { type: 'string', description: 'Task prompt / instructions for the autonomous agent' },
        schedule: { type: 'string', description: 'Cron expression (e.g. "0 6 * * *") or interval ("every 30m")' },
        job_id: { type: 'string', description: 'ID of the job for pause/resume/remove/run actions' },
      },
      required: ['action'],
    },
    handler: async (args) => {
      const action = args.action;

      if (action === 'list') {
        const jobs = cronRepo.getAll();
        const recentExecs = cronRepo.getRecentExecutions(10);
        return {
          success: true,
          count: jobs.length,
          jobs: jobs.map((j) => ({
            id: j.id,
            name: j.name,
            schedule: j.schedule_expr,
            enabled: j.enabled === 1,
            last_run: j.last_run_at ? new Date(j.last_run_at).toLocaleString() : 'Never',
            next_run: j.next_run_at ? new Date(j.next_run_at).toLocaleString() : 'Unknown',
            last_status: j.last_status || 'idle',
            prompt_preview: j.prompt.slice(0, 100) + (j.prompt.length > 100 ? '...' : ''),
          })),
          recent_executions: recentExecs.map((e) => ({
            job_name: e.job_name,
            status: e.status,
            started: new Date(e.started_at).toLocaleTimeString(),
            duration_ms: e.duration_ms,
            error: e.error,
          })),
        };
      }

      if (action === 'create') {
        if (!args.name || !args.prompt || !args.schedule) {
          return { success: false, error: '"name", "prompt", and "schedule" are required for creating a cronjob.' };
        }

        const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const kind = args.schedule.startsWith('every ') || /^\d+[smhd]$/.test(args.schedule) ? 'interval' : 'cron';
        const nextRun = cronEngine.calculateNextRun(args.schedule, kind);

        const newJob: CronJobRecord = {
          id,
          name: args.name,
          prompt: args.prompt,
          schedule_expr: args.schedule,
          schedule_kind: kind,
          enabled: 1,
          deliver: 'local',
          created_at: Date.now(),
          updated_at: Date.now(),
          next_run_at: nextRun,
        };

        cronRepo.upsert(newJob);
        eventBus.emit('cron:updated', { jobId: id, action: 'created' });
        logTool.info(`Created new scheduled job: [${args.name}] (${args.schedule})`);

        return {
          success: true,
          message: `Scheduled job "${args.name}" created successfully.`,
          job: {
            id,
            name: newJob.name,
            schedule: newJob.schedule_expr,
            next_run: new Date(nextRun).toLocaleString(),
          },
        };
      }

      if (action === 'pause' || action === 'resume') {
        const id = args.job_id;
        if (!id) return { success: false, error: '"job_id" is required for pause/resume.' };

        const job = cronRepo.getById(id);
        if (!job) return { success: false, error: `Job with ID "${id}" not found.` };

        const enable = action === 'resume';
        cronRepo.toggle(id, enable);
        eventBus.emit('cron:updated', { jobId: id, action: enable ? 'resumed' : 'paused' });

        return {
          success: true,
          message: `Job "${job.name}" has been ${enable ? 'resumed' : 'paused'}.`,
        };
      }

      if (action === 'remove') {
        const id = args.job_id;
        if (!id) return { success: false, error: '"job_id" is required for remove.' };

        const deleted = cronRepo.delete(id);
        if (deleted) {
          eventBus.emit('cron:updated', { jobId: id, action: 'removed' });
          return { success: true, message: `Job "${id}" removed successfully.` };
        }
        return { success: false, error: `Job "${id}" not found.` };
      }

      if (action === 'run') {
        const id = args.job_id;
        if (!id) return { success: false, error: '"job_id" is required to immediately trigger a job.' };

        const job = cronRepo.getById(id);
        if (!job) return { success: false, error: `Job with ID "${id}" not found.` };

        const result = await cronEngine.runJob(job);
        return {
          success: result.success,
          message: `Job "${job.name}" triggered immediately.`,
          output: result.output,
          error: result.error,
        };
      }

      return { success: false, error: `Unknown action "${action}".` };
    },
  });

  logTool.info('Cronjob management tools registered.');
}
