import { logTool } from '../core/logger';
import { eventBus } from '../core/event_bus';
import { auditRepo } from '../db/db';
import { executeSystemWorkerDirect, executeLinuxActuator } from '../utils/system_controller';

export type ToolTier = 'tier1_native_cpp' | 'tier2_system_shell' | 'tier3_browser' | 'tier4_workspace_cloud';

export interface ToolDefinition {
  name: string;
  description: string;
  tier: ToolTier;
  parameters: {
    type: 'OBJECT';
    properties: Record<string, any>;
    required?: string[];
  };
  timeoutMs?: number;
  handler: (args: any, context?: any) => Promise<any>;
}

export interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  durationMs: number;
  result?: any;
  error?: string;
}

export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, ToolDefinition> = new Map();

  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  constructor() {
    this.registerCoreTools();
    logTool.info(`Tool Registry initialized with ${this.tools.size} registered tools.`);
  }

  public register(tool: ToolDefinition): void {
    this.tools.set(tool.name, {
      ...tool,
      timeoutMs: tool.timeoutMs || (tool.tier === 'tier1_native_cpp' ? 2000 : 15000),
    });
    logTool.debug(`Registered tool: ${tool.name} [${tool.tier}]`);
  }

  public getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  public getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  public getFunctionDeclarations(): any[] {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  public async execute(name: string, args: any = {}, context?: any): Promise<ToolExecutionResult> {
    const tool = this.tools.get(name);
    const start = performance.now();

    if (!tool) {
      const err = `Tool '${name}' not found in registry.`;
      logTool.error(err);
      auditRepo.log('TOOL', 'error', err, { toolName: name, args });
      return { toolName: name, success: false, durationMs: 0, error: err };
    }

    eventBus.emit('tool:before_execute', { toolName: name, args, tier: tool.tier });
    logTool.info(`Executing tool: ${name} [${tool.tier}]`, { args });

    try {
      // Execute with timeout race
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Tool '${name}' timed out after ${tool.timeoutMs}ms`)), tool.timeoutMs)
      );

      const result = await Promise.race([tool.handler(args, context), timeoutPromise]);
      const durationMs = Math.round(performance.now() - start);

      logTool.info(`Tool ${name} executed successfully in ${durationMs}ms`);
      auditRepo.log('TOOL', 'info', `Tool ${name} executed`, { toolName: name, durationMs, result });

      eventBus.emit('tool:after_execute', { toolName: name, success: true, durationMs, result });

      return {
        toolName: name,
        success: true,
        durationMs,
        result,
      };
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - start);
      const errMsg = err?.message || String(err);

      logTool.error(`Tool ${name} failed after ${durationMs}ms: ${errMsg}`);
      auditRepo.log('TOOL', 'error', `Tool ${name} failed: ${errMsg}`, { toolName: name, durationMs, error: errMsg });

      eventBus.emit('tool:error', { toolName: name, error: errMsg, durationMs });

      return {
        toolName: name,
        success: false,
        durationMs,
        error: errMsg,
      };
    }
  }

  private registerCoreTools() {
    // Tier 1: C++ Native Hardware Actuators
    this.register({
      name: 'set_system_volume',
      description: 'Set system audio volume percentage (0-100) or toggle mute.',
      tier: 'tier1_native_cpp',
      parameters: {
        type: 'OBJECT',
        properties: {
          percent: { type: 'INTEGER', description: 'Volume percent (0-100)' },
          mute: { type: 'BOOLEAN', description: 'Whether to mute' },
        },
      },
      handler: async (args) => {
        if (args.mute !== undefined) {
          return executeSystemWorkerDirect('audio_actuator', [args.mute ? 'mute' : 'unmute']);
        }
        return executeSystemWorkerDirect('audio_actuator', ['set', String(args.percent ?? 50)]);
      },
    });

    this.register({
      name: 'set_display_brightness',
      description: 'Set display screen brightness percentage (0-100).',
      tier: 'tier1_native_cpp',
      parameters: {
        type: 'OBJECT',
        properties: {
          percent: { type: 'INTEGER', description: 'Brightness percent (0-100)' },
        },
        required: ['percent'],
      },
      handler: async (args) => {
        return executeSystemWorkerDirect('brightness_actuator', ['set', String(args.percent)]);
      },
    });

    this.register({
      name: 'get_system_telemetry',
      description: 'Fetch real-time CPU, RAM, Network, Battery, and Disk ground-truth telemetry.',
      tier: 'tier1_native_cpp',
      parameters: {
        type: 'OBJECT',
        properties: {},
      },
      handler: async () => {
        return executeSystemWorkerDirect('sys_telemetry', []);
      },
    });

    // Tier 2: Linux Actuators & Shell
    this.register({
      name: 'execute_linux_command',
      description: 'Execute a verified local Linux shell command or tool.',
      tier: 'tier2_system_shell',
      parameters: {
        type: 'OBJECT',
        properties: {
          command: { type: 'STRING', description: 'Shell command string to execute' },
        },
        required: ['command'],
      },
      handler: async (args) => {
        return executeLinuxActuator('bash', ['-c', args.command]);
      },
    });

    this.register({
      name: 'launch_application',
      description: 'Launch an installed desktop application on Ubuntu Linux.',
      tier: 'tier2_system_shell',
      parameters: {
        type: 'OBJECT',
        properties: {
          appName: { type: 'STRING', description: 'Name of the application e.g. code, google-chrome, nautilus' },
        },
        required: ['appName'],
      },
      handler: async (args) => {
        return executeLinuxActuator('gtk_launch', [args.appName]);
      },
    });
  }
}

export const toolRegistry = ToolRegistry.getInstance();
