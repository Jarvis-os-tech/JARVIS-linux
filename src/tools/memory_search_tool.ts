// Hermes-Grade Memory & Episodic Session Search Tools for J.A.R.V.I.S.
// Provides persistent profile editing, MEMORY.md updates, and full-text episodic session recall.

import { toolRegistry } from './tool_registry';
import { dualStoreMemory } from '../memory/dual_store';
import { logTool } from '../core/logger';

export function registerMemorySearchTools(): void {
  toolRegistry.register({
    name: 'jarvis_session_search',
    description: 'Search past episodic conversation history across all sessions to recall previous decisions, code solutions, or user instructions.',
    tier: 'tier2_system_shell',
    featureSwitchId: 'memory_subsystem',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term or question to find in conversation history' },
        limit: { type: 'number', description: 'Max number of past turns to return (default 10)' },
      },
      required: ['query'],
    },
    handler: async (args) => {
      const results = dualStoreMemory.searchEpisodicMemory(args.query, args.limit || 10);
      return {
        success: true,
        count: results.length,
        results: results.map((r) => ({
          role: r.role,
          content: r.content,
          timestamp: new Date(r.created_at).toLocaleString(),
        })),
      };
    },
  });

  toolRegistry.register({
    name: 'jarvis_update_profile',
    description: 'Update the user profile facts in USER.md (preferences, communication style, long-term goals).',
    tier: 'tier2_system_shell',
    featureSwitchId: 'memory_subsystem',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Profile attribute name (e.g. "preferred_language", "workflow_style")' },
        value: { type: 'string', description: 'Fact or preference value' },
      },
      required: ['key', 'value'],
    },
    handler: async (args) => {
      dualStoreMemory.saveMemoryFact(args.key, args.value, 'preference');
      return {
        success: true,
        message: `Profile attribute "${args.key}" saved permanently.`,
      };
    },
  });

  logTool.info('Episodic Session Search and Dual-Store Memory tools registered.');
}
