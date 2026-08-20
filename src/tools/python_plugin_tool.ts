// Python Execution & Hermes Specialist Plugin Tools for J.A.R.V.I.S.
// Integrates 270 agency specialist agents and direct Python computation.

import { toolRegistry } from './tool_registry';
import { pythonBridge } from '../core/python_bridge';
import { logTool } from '../core/logger';

export function registerPythonTools(): void {
  toolRegistry.register({
    name: 'execute_python_code',
    description: 'Execute arbitrary Python 3 code in the high-performance local environment. Ideal for data analysis, complex math, text manipulation, and scripting.',
    tier: 'tier2_system_shell',
    featureSwitchId: 'terminal_control',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Python 3 code string to execute' },
      },
      required: ['code'],
    },
    handler: async (args) => {
      const res = await pythonBridge.executeCode(args.code);
      return {
        success: res.success,
        stdout: res.stdout,
        stderr: res.stderr || undefined,
      };
    },
  });

  toolRegistry.register({
    name: 'agency_agents_search',
    description: 'Search The Agency 270-specialist agent roster (engineering, trading, marketing, design, security, ops). Returns matched specialist roles.',
    tier: 'tier2_system_shell',
    featureSwitchId: 'multi_agent_mesh',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language search query (e.g. "rust developer", "crypto trading", "seo optimizer")' },
        limit: { type: 'number', description: 'Max results to return (default 6)' },
      },
      required: ['query'],
    },
    handler: async (args) => {
      const results = await pythonBridge.queryAgencyAgents('search', args.query, args.limit || 6);
      return { success: true, results };
    },
  });

  toolRegistry.register({
    name: 'agency_agents_inspect',
    description: 'Inspect full instructions, checklist, and standards of a specific Agency specialist agent.',
    tier: 'tier2_system_shell',
    featureSwitchId: 'multi_agent_mesh',
    parameters: {
      type: 'object',
      properties: {
        agent: { type: 'string', description: 'Agent slug or display name' },
      },
      required: ['agent'],
    },
    handler: async (args) => {
      const agent = await pythonBridge.queryAgencyAgents('inspect', args.agent);
      return { success: true, agent };
    },
  });

  logTool.info('Python execution and Agency Specialist tools registered.');
}
