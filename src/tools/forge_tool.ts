// Capability Forge & Runtime Tool Genesis Tools (Ada-SI Implementation)
// Exposes autonomous skill synthesis, sandbox testing, and promotion tools to the LLM.

import { toolRegistry } from './tool_registry';
import { capabilityForge } from '../core/capability_forge';
import { logTool } from '../core/logger';

export function registerForgeTools(): void {
  toolRegistry.register({
    name: 'forge_capability',
    description: 'Synthesize, verify, and hot-reload a new custom tool at runtime when a capability gap is detected. Runs AST security audit and Linux bwrap sandbox tests before promotion.',
    tier: 'tier2_system_shell',
    featureSwitchId: 'terminal_control',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Identifier for the new tool (e.g. "coingecko_crypto_price", "epub_to_markdown")',
        },
        description: {
          type: 'string',
          description: 'Clear description of what the tool accomplishes and how to use it.',
        },
        code: {
          type: 'string',
          description: 'Python 3 source code defining get_tool_schema() -> dict and run(**kwargs).',
        },
        test_code: {
          type: 'string',
          description: 'Python 3 test code that exercises run() and asserts correct outputs.',
        },
        requirements: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of pip packages required by the tool (e.g. ["requests>=2.31.0", "beautifulsoup4"]).',
        },
        uiLayout: {
          type: 'string',
          enum: ['table', 'calendar', 'list', 'chart', 'custom', 'none'],
          description: 'Optional frontend interactive UI layout template for the tool.',
        },
      },
      required: ['name', 'description', 'code', 'test_code'],
    },
    handler: async (args) => {
      const res = await capabilityForge.installTool(
        args.name,
        args.description,
        args.code,
        args.test_code,
        args.requirements || [],
        args.uiLayout || 'none'
      );
      if (res.success && res.tool) {
        return {
          success: true,
          toolName: res.tool.name,
          status: res.tool.status,
          message: `Tool '${res.tool.name}' successfully forged, verified in Linux sandbox, and hot-registered. You can now execute '${res.tool.name}' directly or via execute_forged_tool(tool_name='${res.tool.name}', args={...}).`,
          tool: res.tool,
        };
      }
      return res;
    },
  });

  toolRegistry.register({
    name: 'execute_forged_tool',
    description: 'Execute any dynamically synthesized/forged custom tool (e.g. "text_hasher", "crypto_calc", etc.) in the secure sandbox with given JSON arguments.',
    tier: 'tier2_system_shell',
    parameters: {
      type: 'object',
      properties: {
        tool_name: {
          type: 'string',
          description: 'Identifier of the forged tool to execute (e.g. "text_hasher").',
        },
        args: {
          type: 'object',
          description: 'Key-value arguments to pass to the tool run() function (e.g. {"text": "Tony Stark"}).',
        },
      },
      required: ['tool_name'],
    },
    handler: async (callArgs) => {
      const toolName = callArgs.tool_name || callArgs.name;
      const toolArguments = callArgs.args || callArgs.arguments || callArgs.parameters || {};
      return capabilityForge.executeForgedTool(toolName, toolArguments);
    },
  });

  toolRegistry.register({
    name: 'list_forged_tools',
    description: 'List all dynamically synthesized tools, their promotion status (EXPERIMENTAL, TESTING, CANARY, TRUSTED), and execution statistics.',
    tier: 'tier2_system_shell',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    handler: async () => {
      const tools = capabilityForge.listTools();
      return {
        success: true,
        count: tools.length,
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          status: t.status,
          executionCount: t.executionCount,
          successRate: t.executionCount > 0 ? `${Math.round((t.successCount / t.executionCount) * 100)}%` : 'N/A',
          requirements: t.requirements,
          uiLayout: t.uiLayout,
        })),
      };
    },
  });

  toolRegistry.register({
    name: 'delete_forged_tool',
    description: 'Safely uninstall and remove a dynamically forged tool from J.A.R.V.I.S.',
    tier: 'tier2_system_shell',
    featureSwitchId: 'terminal_control',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Identifier of the forged tool to remove.',
        },
      },
      required: ['name'],
    },
    handler: async (args) => {
      return capabilityForge.deleteTool(args.name);
    },
  });

  toolRegistry.register({
    name: 'test_forged_tool',
    description: 'Run synthetic sandbox verification tests for an installed forged tool.',
    tier: 'tier2_system_shell',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Identifier of the tool to test.',
        },
      },
      required: ['name'],
    },
    handler: async (args) => {
      const tool = capabilityForge.getTool(args.name);
      if (!tool) {
        return { success: false, error: `Tool '${args.name}' not found.` };
      }
      const res = await capabilityForge.verifyInSandbox(tool.name, tool.code, tool.testCode, tool.requirements);
      return res;
    },
  });

  logTool.info('Capability Forge tools registered.');
}
