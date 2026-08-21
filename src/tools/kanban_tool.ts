// SQLite-Backed Kanban Board Tool for J.A.R.V.I.S.
// Tracks tasks, dependencies, priorities, and assignments across the multi-agent swarm.
// Ported and enhanced from Hermes (tools/kanban_tools.py)

import { db } from '../db/db';
import { toolRegistry, ToolDefinition } from './tool_registry';
import { logTool } from '../core/logger';
import { eventBus } from '../core/event_bus';

export interface KanbanTask {
  id: string;
  title: string;
  description?: string;
  status: 'backlog' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: 'jarvis' | 'friday' | 'ultron' | 'edith' | 'hermes';
  createdAt: number;
  updatedAt: number;
}

export class KanbanToolManager {
  private static instance: KanbanToolManager;

  public static getInstance(): KanbanToolManager {
    if (!KanbanToolManager.instance) {
      KanbanToolManager.instance = new KanbanToolManager();
    }
    return KanbanToolManager.instance;
  }

  constructor() {
    this.initSchema();
  }

  private initSchema(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS kanban_tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'backlog',
        priority TEXT NOT NULL DEFAULT 'medium',
        assigned_to TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  private registerTools(): void {
    const kanbanTool: ToolDefinition = {
      name: 'kanban_board',
      description: 'Manage tasks on the system Kanban board (list, add, update_status, assign, delete). Used by autonomous agents and user for tracking project milestones.',
      tier: 'tier2_system_shell',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['list', 'add', 'update', 'assign', 'delete'],
            description: 'Action to perform on the Kanban board.'
          },
          taskId: { type: 'string', description: 'ID of task for update/assign/delete.' },
          title: { type: 'string', description: 'Title of the task.' },
          description: { type: 'string', description: 'Detailed description of the task.' },
          status: { type: 'string', enum: ['backlog', 'in_progress', 'review', 'done'] },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          assignedTo: { type: 'string', enum: ['jarvis', 'friday', 'ultron', 'edith', 'hermes'] }
        },
        required: ['action']
      },
      handler: async (args: any) => this.handleKanban(args)
    };

    toolRegistry.register(kanbanTool);
  }

  public async handleKanban(args: any): Promise<any> {
    const action = args.action || 'list';

    switch (action) {
      case 'add': {
        const id = `task_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 5)}`;
        const now = Date.now();
        const stmt = db.prepare(`
          INSERT INTO kanban_tasks (id, title, description, status, priority, assigned_to, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
          id,
          args.title || 'Untitled Task',
          args.description || '',
          args.status || 'backlog',
          args.priority || 'medium',
          args.assignedTo || 'jarvis',
          now,
          now
        );
        eventBus.emit('kanban:created', { id, title: args.title });
        return { success: true, taskId: id, message: `Created task ${id}` };
      }

      case 'update': {
        if (!args.taskId) return { success: false, error: 'taskId is required for update' };
        const stmt = db.prepare(`
          UPDATE kanban_tasks SET
            status = coalesce(?, status),
            priority = coalesce(?, priority),
            description = coalesce(?, description),
            updated_at = ?
          WHERE id = ?
        `);
        stmt.run(args.status || null, args.priority || null, args.description || null, Date.now(), args.taskId);
        eventBus.emit('kanban:updated', { id: args.taskId, status: args.status });
        return { success: true, message: `Updated task ${args.taskId}` };
      }

      case 'assign': {
        if (!args.taskId) return { success: false, error: 'taskId is required for assign' };
        const stmt = db.prepare(`UPDATE kanban_tasks SET assigned_to = ?, updated_at = ? WHERE id = ?`);
        stmt.run(args.assignedTo || 'jarvis', Date.now(), args.taskId);
        eventBus.emit('kanban:assigned', { id: args.taskId, assignedTo: args.assignedTo });
        return { success: true, message: `Assigned task ${args.taskId} to ${args.assignedTo}` };
      }

      case 'delete': {
        if (!args.taskId) return { success: false, error: 'taskId is required for delete' };
        db.prepare('DELETE FROM kanban_tasks WHERE id = ?').run(args.taskId);
        eventBus.emit('kanban:deleted', { id: args.taskId });
        return { success: true, message: `Deleted task ${args.taskId}` };
      }

      case 'list':
      default: {
        const tasks = db.prepare('SELECT * FROM kanban_tasks ORDER BY updated_at DESC').all();
        return {
          success: true,
          count: tasks.length,
          tasks
        };
      }
    }
  }
}

export const kanbanToolManager = KanbanToolManager.getInstance();

export function registerKanbanTools(): void {
  KanbanToolManager.getInstance().registerTools();
}
