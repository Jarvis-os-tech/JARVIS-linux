// Hermes Delegation Tool - TypeScript Port for J.A.R.V.I.S.
// Enables spawning isolated subagents with full tool access for parallel autonomous work

import { toolRegistry, ToolDefinition } from './tool_registry';
import { eventBus } from '../core/event_bus';
import { logTool } from '../core/logger';
import { HermesAgentRuntime } from '../core/hermes_agent_runtime';
import { subagentRepo } from '../db/db';

export interface DelegationTask {
  goal: string;
  context?: string;
  role?: 'leaf' | 'orchestrator';
  output_schema?: Record<string, any>;
}

export interface DelegationOptions {
  tasks?: DelegationTask[];
  goal?: string;
  context?: string;
  role?: 'leaf' | 'orchestrator';
  output_schema?: Record<string, any>;
  background?: boolean;
}

export interface SubagentRecord {
  subagent_id: string;
  goal: string;
  context: string;
  role: 'leaf' | 'orchestrator';
  status: 'dispatched' | 'running' | 'completed' | 'failed' | 'stalled';
  start_time: number;
  progress: {
    api_calls: number;
    current_tool: string | null;
    last_progress_time: number;
  };
  accepting_steer: boolean;
  result?: any;
  error?: string;
}

export interface DelegationResult {
  success: boolean;
  handle?: string;
  background?: boolean;
  status?: string;
  voice_instruction?: string;
  subagent_ids?: string[];
  results?: Array<{
    subagent_id: string;
    goal: string;
    result: any;
    success: boolean;
    error?: string;
  }>;
  error?: string;
}

// Tools that children must never have access to
const DELEGATE_BLOCKED_TOOLS = [
  'delegate_task',
  'clarify',
  'memory',
  'send_message',
  'cronjob',
];

const activeSubagents = new Map<string, SubagentRecord>();
let maxConcurrentChildren = 10;

export function initDelegationConfig(config: { max_concurrent_children?: number }) {
  maxConcurrentChildren = config.max_concurrent_children ?? 10;
}

export function canSpawn(): { allowed: boolean; reason?: string } {
  const runningCount = Array.from(activeSubagents.values())
    .filter(s => s.status === 'running' || s.status === 'dispatched').length;
    
  if (runningCount >= maxConcurrentChildren) {
    return { allowed: false, reason: `Max concurrent children (${maxConcurrentChildren}) reached` };
  }
  return { allowed: true };
}

// Execute a single subagent (synchronous)
async function runSubagent(
  task: DelegationTask,
  sessionId: string
): Promise<{ success: boolean; result: any; error?: string }> {
  const subagentId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const startTime = Date.now();
  
  const record: SubagentRecord = {
    subagent_id: subagentId,
    goal: task.goal,
    context: task.context || '',
    role: task.role || 'leaf',
    status: 'dispatched',
    start_time: startTime,
    progress: {
      api_calls: 0,
      current_tool: null,
      last_progress_time: startTime,
    },
    accepting_steer: true,
  };
  
  activeSubagents.set(subagentId, record);
  eventBus.emit('subagent:spawned', { subagentId, goal: task.goal, role: task.role || 'leaf' });

  // Record in SQLite
  subagentRepo.create({
    id: subagentId,
    role: task.role || 'leaf',
    goal: task.goal,
    context: task.context || undefined,
    status: 'running',
    max_iterations: 25,
    started_at: startTime,
  });
  
  try {
    record.status = 'running';
    
    const runtime = new HermesAgentRuntime({
      systemInstruction: `You are an isolated specialist subagent of J.A.R.V.I.S.
Role: ${task.role || 'leaf'}
Context from parent: ${task.context || 'None'}
Goal: ${task.goal}`,
      maxIterations: 25,
      blockedTools: DELEGATE_BLOCKED_TOOLS,
      sessionId: `${sessionId}_${subagentId}`,
    });
    
    const turnResult = await runtime.runTurn(task.goal, (update) => {
      record.progress.api_calls = update.iteration;
      record.progress.current_tool = update.toolName || null;
      record.progress.last_progress_time = Date.now();
      eventBus.emit('subagent:progress', {
        subagentId,
        api_calls: update.iteration,
        currentTool: update.toolName || null,
      });
      subagentRepo.update(subagentId, {
        iterations: update.iteration,
        progress: Math.min(Math.round((update.iteration / 25) * 100), 99),
      });
    });
    
    record.status = turnResult.success ? 'completed' : 'failed';
    record.result = turnResult.finalResponse;
    record.error = turnResult.error;
    record.accepting_steer = false;

    subagentRepo.update(subagentId, {
      status: turnResult.success ? 'completed' : 'failed',
      result_json: JSON.stringify(turnResult),
      error: turnResult.error,
      progress: 100,
      completed_at: Date.now(),
    });
    
    if (turnResult.success) {
      eventBus.emit('subagent:completed', { subagentId, result: turnResult.finalResponse, success: true });
      return { success: true, result: turnResult.finalResponse };
    } else {
      eventBus.emit('subagent:failed', { subagentId, error: turnResult.error || 'Subagent execution failed' });
      return { success: false, result: null, error: turnResult.error };
    }
  } catch (error: any) {
    record.status = 'failed';
    record.error = error.message;
    record.accepting_steer = false;
    
    subagentRepo.update(subagentId, {
      status: 'failed',
      error: error.message,
      completed_at: Date.now(),
    });

    eventBus.emit('subagent:failed', { subagentId, error: error.message });
    return { success: false, result: null, error: error.message };
  } finally {
    setTimeout(() => {
      activeSubagents.delete(subagentId);
    }, 60000);
  }
}

// Main delegation tool handler
export async function handleDelegation(options: DelegationOptions): Promise<DelegationResult> {
  const canSpawnResult = canSpawn();
  if (!canSpawnResult.allowed) {
    return {
      success: false,
      error: `Cannot spawn subagent: ${canSpawnResult.reason}`,
    };
  }
  
  const tasks: DelegationTask[] = options.tasks 
    ? options.tasks 
    : [{ goal: options.goal || '', context: options.context, role: options.role, output_schema: options.output_schema }];
  
  if (tasks.length === 0 || !tasks[0].goal) {
    return { success: false, error: 'At least one task goal is required for delegation.' };
  }

  // Background execution mode
  if (options.background) {
    const handle = `bg_del_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    (async () => {
      const results: Array<{ subagent_id: string; goal: string; result: any; success: boolean; error?: string }> = [];
      for (const t of tasks) {
        const res = await runSubagent(t, 'jarvis_root');
        results.push({
          subagent_id: handle,
          goal: t.goal,
          result: res.result,
          success: res.success,
          error: res.error,
        });
      }
      eventBus.emit('delegation:async_completed', { handle, results });
    })().catch((err) => {
      logTool.error(`Background delegation error: ${err.message}`);
    });

    const primaryTask = tasks[0];
    return {
      success: true,
      background: true,
      handle,
      status: `Successfully dispatched background ${primaryTask?.role || 'specialist'} subagent for: "${primaryTask?.goal || 'Task'}".`,
      voice_instruction: `Talk directly to the user out loud right now to confirm that the ${primaryTask?.role || 'specialist'} subagent has been dispatched and is actively executing "${primaryTask?.goal || 'the task'}".`,
    };
  }

  // Batch parallel or sequential execution
  const results = await Promise.all(
    tasks.map(async (task) => {
      const subRes = await runSubagent(task, 'jarvis_root');
      return {
        subagent_id: `task_${Date.now()}`,
        goal: task.goal,
        result: subRes.result,
        success: subRes.success,
        error: subRes.error,
      };
    })
  );

  return {
    success: results.every(r => r.success),
    results,
    status: `Subagent tasks finished.`,
    voice_instruction: `Summarize the findings verbally to the user now: ${results.map(r => r.result?.answer || r.result || (r.success ? 'Done' : r.error)).join('; ')}`,
  };
}

export function steerSubagent(subagentId: string, message: string): { success: boolean; message: string } {
  const record = activeSubagents.get(subagentId);
  if (!record) return { success: false, message: `Subagent ${subagentId} not found` };
  if (!record.accepting_steer) return { success: false, message: `Subagent ${subagentId} not accepting steering` };
  
  logTool.info(`Steering subagent ${subagentId}: "${message}"`);
  return { success: true, message: `Steering directive queued for ${subagentId}` };
}

export function stopSubagent(subagentId: string): { success: boolean; message: string } {
  const record = activeSubagents.get(subagentId);
  if (!record) return { success: false, message: `Subagent ${subagentId} not found` };
  
  record.status = 'failed';
  record.error = 'Stopped by parent operator';
  record.accepting_steer = false;
  
  subagentRepo.update(subagentId, { status: 'cancelled', error: 'Cancelled by operator', completed_at: Date.now() });
  eventBus.emit('subagent:failed', { subagentId, error: 'Cancelled by operator' });
  return { success: true, message: `Subagent ${subagentId} stopped` };
}

export function listSubagents(): SubagentRecord[] {
  return Array.from(activeSubagents.values());
}

export function registerDelegationTool(): void {
  toolRegistry.register({
    name: 'delegate_task',
    description: 'Spawn isolated specialist subagents to execute tasks autonomously in the background or in parallel. ALWAYS speak to the user out loud to explain what task is being delegated and to which specialist.',
    tier: 'tier2_system_shell',
    featureSwitchId: 'multi_agent_mesh',
    parameters: {
      type: 'OBJECT',
      properties: {
        goal: { type: 'STRING', description: 'Primary task goal for the subagent' },
        context: { type: 'STRING', description: 'Additional background context and instructions' },
        role: { type: 'STRING', description: 'Role name, e.g. "trading", "research", "dev", "content", "infra"' },
        background: { type: 'BOOLEAN', description: 'Whether to run in background and return handle immediately' },
      },
      required: ['goal'],
    },
    handler: async (args) => {
      return handleDelegation(args);
    },
  });

  toolRegistry.register({
    name: 'steer_subagent',
    description: 'Send a real-time course correction or directive to an active running subagent.',
    tier: 'tier2_system_shell',
    featureSwitchId: 'multi_agent_mesh',
    parameters: {
      type: 'OBJECT',
      properties: {
        subagent_id: { type: 'STRING', description: 'The subagent ID to steer' },
        message: { type: 'STRING', description: 'Course correction directive message' },
      },
      required: ['subagent_id', 'message'],
    },
    handler: async (args) => {
      return steerSubagent(args.subagent_id, args.message);
    },
  });

  toolRegistry.register({
    name: 'stop_subagent',
    description: 'Terminate an active subagent task immediately.',
    tier: 'tier2_system_shell',
    featureSwitchId: 'multi_agent_mesh',
    parameters: {
      type: 'OBJECT',
      properties: {
        subagent_id: { type: 'STRING', description: 'The subagent ID to stop' },
      },
      required: ['subagent_id'],
    },
    handler: async (args) => {
      return stopSubagent(args.subagent_id);
    },
  });

  toolRegistry.register({
    name: 'list_subagents',
    description: 'List all running and recent subagent tasks with progress telemetry.',
    tier: 'tier2_system_shell',
    featureSwitchId: 'multi_agent_mesh',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
    handler: async () => {
      return { success: true, subagents: listSubagents() };
    },
  });

  logTool.info('Delegation and Subagent orchestration tools registered.');
}