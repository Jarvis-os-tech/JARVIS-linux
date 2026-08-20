// Hermes-Grade Skills Tool for J.A.R.V.I.S.
// Implements progressive disclosure: list (token efficient) -> view (full SKILL.md) -> create / search.

import { toolRegistry } from './tool_registry';
import { skillsEngine } from '../core/skills_engine';
import { logTool } from '../core/logger';

export function registerSkillsTools(): void {
  toolRegistry.register({
    name: 'jarvis_skills',
    description: 'Access the progressive skills registry (1,400+ capabilities). Actions: "list" (token-efficient summaries), "view" (full SKILL.md instructions), "search" (find skills by keyword), "create" (save new reusable skill workflow).',
    tier: 'tier2_system_shell',
    featureSwitchId: 'multi_agent_mesh',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'view', 'search', 'create'],
          description: 'Skills management action to perform',
        },
        name: { type: 'string', description: 'Exact skill name for "view" or "create"' },
        query: { type: 'string', description: 'Search term for "search" action' },
        category: { type: 'string', description: 'Category filter for "list" or category name for "create"' },
        description: { type: 'string', description: 'Short summary for "create"' },
        content: { type: 'string', description: 'Full Markdown procedural instructions for "create"' },
      },
      required: ['action'],
    },
    handler: async (args) => {
      const action = args.action;

      if (action === 'list') {
        const skills = skillsEngine.listSkills(args.category);
        return {
          success: true,
          count: skills.length,
          skills: skills.slice(0, 35).map((s) => ({
            name: s.name,
            category: s.category,
            description: s.description,
            usage_count: s.usage_count,
          })),
        };
      }

      if (action === 'view') {
        if (!args.name) {
          return { success: false, error: '"name" is required for viewing a skill.' };
        }
        const res = skillsEngine.getSkill(args.name);
        if (!res.success || !res.skill) {
          return { success: false, error: res.error || `Skill "${args.name}" not found.` };
        }
        return {
          success: true,
          skill: {
            name: res.skill.name,
            category: res.skill.category,
            description: res.skill.description,
            path: res.skill.path,
            usage_count: res.skill.usage_count,
            instructions: res.skill.content,
          },
        };
      }

      if (action === 'search') {
        if (!args.query) {
          return { success: false, error: '"query" is required for searching skills.' };
        }
        const results = skillsEngine.searchSkills(args.query);
        return {
          success: true,
          count: results.length,
          results: results.slice(0, 20),
        };
      }

      if (action === 'create') {
        if (!args.name || !args.content) {
          return { success: false, error: '"name" and "content" are required for creating a skill.' };
        }
        const created = skillsEngine.createSkill(
          args.name,
          args.category || 'general',
          args.description || 'User created skill',
          args.content
        );
        return {
          success: true,
          message: `Skill "${args.name}" created and indexed successfully.`,
          path: created.path,
        };
      }

      return { success: false, error: `Unknown skills action "${action}".` };
    },
  });

  logTool.info('Progressive Skills tools registered.');
}
