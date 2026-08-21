import { eventBus } from '../core/event_bus';
import { logTool, logOrchestrator } from '../core/logger';
import { HermesAgentRuntime } from '../core/hermes_agent_runtime';
import { subagentRepo } from '../db/db';
import { subagentWorktreeManager } from '../core/subagent_worktree';
import { delegationLiveLog } from '../core/delegation_live_log';

export interface DelegationTask {
  goal: string;
  context?: string;
  role?: 'friday' | 'ultron' | 'edith' | 'hermes' | 'leaf' | 'orchestrator';
  isolated_worktree?: boolean;
  output_schema?: Record<string, any>;
}

export interface DelegationOptions {
  tasks?: DelegationTask[];
  goal?: string;
  context?: string;
  role?: 'friday' | 'ultron' | 'edith' | 'hermes' | 'leaf' | 'orchestrator';
  isolated_worktree?: boolean;
  output_schema?: Record<string, any>;
  background?: boolean;
}

export interface SubagentRecord {
  subagent_id: string;
  goal: string;
  context: string;
  role: string;
  status: 'dispatched' | 'running' | 'completed' | 'failed' | 'stalled';
  start_time: number;
  worktree_path?: string;
  worktree_branch?: string;
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
    role: string;
    goal: string;
    result: any;
    success: boolean;
    worktree?: { path: string; branch: string; commitsAhead: number; isDirty: boolean };
    error?: string;
  }>;
  error?: string;
}

const FORBIDDEN_CHILD_TOOLS = [
  'delegate_subagent',
  'spawn_subagent',
  'reset_system_state',
  'shutdown_system'
];

export class DelegationDispatcher {
  private static instance: DelegationDispatcher;
  private activeSubagents: Map<string, SubagentRecord> = new Map();

  public static getInstance(): DelegationDispatcher {
    if (!DelegationDispatcher.instance) {
      DelegationDispatcher.instance = new DelegationDispatcher();
    }
    return DelegationDispatcher.instance;
  }

  constructor() {
    // Registered explicitly via registerDelegationTool()
  }

  public registerTool(): void {
    const delegateToolDef: ToolDefinition = {
      name: 'delegate_subagent',
      description: 'Delegate an autonomous engineering, security, research, or operational task to a specialized subagent (FRIDAY: Code/Build, ULTRON: Security/Audit, EDITH: Research/CDP, HERMES: 24/7 Ops) with optional Git worktree isolation.',
      tier: 'tier2_system_shell',
      parameters: {
        type: 'object',
        properties: {
          goal: { type: 'string', description: 'Clear, concise description of the task objective.' },
          context: { type: 'string', description: 'Relevant technical background, file paths, and constraints.' },
          role: {
            type: 'string',
            enum: ['friday', 'ultron', 'edith', 'hermes', 'leaf'],
            description: 'Specialist persona to assign (friday = Code Engineer, ultron = Security Auditor, edith = Researcher, hermes = Ops)'
          },
          isolated_worktree: { type: 'boolean', description: 'Whether to isolate filesystem modifications in a dedicated Git worktree branch.' },
          background: { type: 'boolean', description: 'Run asynchronously in background (recommended for long tasks) vs synchronously.' },
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                goal: { type: 'string' },
                context: { type: 'string' },
                role: { type: 'string', enum: ['friday', 'ultron', 'edith', 'hermes', 'leaf'] },
                isolated_worktree: { type: 'boolean' }
              },
              required: ['goal']
            },
            description: 'Batch of parallel tasks to delegate concurrently.'
          }
        },
        required: []
      },
      handler: async (args: DelegationOptions) => this.handleDelegation(args)
    };

    toolRegistry.register(delegateToolDef);
    toolRegistry.register({
      ...delegateToolDef,
      name: 'delegate',
      description: 'Alias for delegate_subagent'
    });
  }

  public async handleDelegation(options: DelegationOptions): Promise<DelegationResult> {
    const rawTasks: DelegationTask[] = options.tasks && options.tasks.length > 0
      ? options.tasks
      : options.goal
        ? [{
            goal: options.goal,
            context: options.context,
            role: options.role || 'friday',
            isolated_worktree: options.isolated_worktree ?? true,
            output_schema: options.output_schema
          }]
        : [];

    if (rawTasks.length === 0) {
      return { success: false, error: 'Must provide either "goal" or "tasks" list.' };
    }

    const isBackground = options.background ?? (rawTasks.length > 1);
    const subagentIds: string[] = [];

    const executionPromises = rawTasks.map(async (t) => {
      const subagentId = `sub_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
      subagentIds.push(subagentId);
      const role = t.role || 'friday';

      // 1. Setup isolated worktree if requested
      const worktreeInfo = t.isolated_worktree
        ? await subagentWorktreeManager.createWorktree(subagentId)
        : { worktreePath: process.cwd(), branch: 'main', repoRoot: process.cwd(), isIsolated: false };

      const record: SubagentRecord = {
        subagent_id: subagentId,
        goal: t.goal,
        context: t.context || '',
        role,
        status: 'dispatched',
        start_time: Date.now(),
        worktree_path: worktreeInfo.worktreePath,
        worktree_branch: worktreeInfo.branch,
        progress: { api_calls: 0, current_tool: null, last_progress_time: Date.now() },
        accepting_steer: true
      };

      this.activeSubagents.set(subagentId, record);
      subagentRepo.createSubagent({
        subagent_id: subagentId,
        parent_session_id: 'jarvis_main',
        goal: t.goal,
        context: t.context || '',
        role
      });

      eventBus.emit('subagent:dispatched', { subagentId, goal: t.goal, role, worktree: worktreeInfo.worktreePath });
      delegationLiveLog.record(subagentId, role, 'status', `Subagent dispatched with goal: ${t.goal}`);

      const runWorker = async () => {
        record.status = 'running';
        eventBus.emit('subagent:started', { subagentId, role });

        const runtime = new HermesAgentRuntime({
          systemInstruction: `You are specialist agent ${role.toUpperCase()}. Context:\n${t.context || ''}\nWorking Directory: ${worktreeInfo.worktreePath}`,
          blockedTools: FORBIDDEN_CHILD_TOOLS,
          agentRole: role as any,
          maxIterations: 20
        });

        try {
          const res = await runtime.runTurn(t.goal, (prog) => {
            record.progress.api_calls = prog.iteration;
            record.progress.current_tool = prog.toolName || null;
            record.progress.last_progress_time = Date.now();
            delegationLiveLog.record(subagentId, role, 'status', prog.status, { tool: prog.toolName });
            eventBus.emit('subagent:progress', { subagentId, role, ...prog });
          });

          // Inspect and clean/keep worktree
          const worktreeCleanup = await subagentWorktreeManager.cleanupWorktree(worktreeInfo);

          record.status = res.success ? 'completed' : 'failed';
          record.result = res.finalResponse;
          record.error = res.error;

          subagentRepo.updateSubagentStatus(subagentId, record.status, record.result, record.error);
          eventBus.emit('subagent:completed', { subagentId, role, success: res.success, result: res.finalResponse });
          delegationLiveLog.record(subagentId, role, 'status', `Task completed: ${res.finalResponse.slice(0, 150)}`);

          return {
            subagent_id: subagentId,
            role,
            goal: t.goal,
            result: res.finalResponse,
            success: res.success,
            worktree: {
              path: worktreeInfo.worktreePath,
              branch: worktreeInfo.branch,
              commitsAhead: worktreeCleanup.commitsAhead,
              isDirty: worktreeCleanup.isDirty
            },
            error: res.error
          };
        } catch (err: any) {
          record.status = 'failed';
          record.error = err.message;
          subagentRepo.updateSubagentStatus(subagentId, 'failed', null, err.message);
          eventBus.emit('subagent:failed', { subagentId, role, error: err.message });
          delegationLiveLog.record(subagentId, role, 'error', `Task failed: ${err.message}`);
          return {
            subagent_id: subagentId,
            role,
            goal: t.goal,
            result: null,
            success: false,
            error: err.message
          };
        }
      };

      if (isBackground) {
        runWorker(); // Fire and forget
        return {
          subagent_id: subagentId,
          role,
          goal: t.goal,
          result: `Dispatched in background as ${subagentId}`,
          success: true
        };
      } else {
        return await runWorker();
      }
    });

    if (isBackground) {
      return {
        success: true,
        background: true,
        status: 'dispatched',
        subagent_ids: subagentIds,
        voice_instruction: `Dispatched ${rawTasks.length} specialist task${rawTasks.length > 1 ? 's' : ''} in the background. I will notify you once complete.`
      };
    }

    const results = await Promise.all(executionPromises);
    return {
      success: results.every(r => r.success),
      background: false,
      status: 'completed',
      subagent_ids: subagentIds,
      results
    };
  }

  public getActiveSubagents(): SubagentRecord[] {
    return Array.from(this.activeSubagents.values());
  }
}

export const delegationDispatcher = DelegationDispatcher.getInstance();

export function registerDelegationTool(): void {
  DelegationDispatcher.getInstance().registerTool();
}