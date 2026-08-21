// Learning Made Visible - Dynamic Knowledge Graph for J.A.R.V.I.S.
// Connects skills, memories, tool executions, and sessions into an inspectable node-edge graph.
// Ported and enhanced from Hermes (agent/learning_graph.py)

import { db } from '../db/db';
import { logOrchestrator } from './logger';
import { eventBus } from './event_bus';

export interface GraphNode {
  id: string;
  type: 'skill' | 'memory' | 'tool' | 'agent';
  label: string;
  category?: string;
  useCount: number;
  lastUsedAt?: number;
  metadata?: any;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: 'uses_tool' | 'related_skill' | 'references_memory' | 'learned_from';
  weight: number;
}

export class LearningGraphEngine {
  private static instance: LearningGraphEngine;

  public static getInstance(): LearningGraphEngine {
    if (!LearningGraphEngine.instance) {
      LearningGraphEngine.instance = new LearningGraphEngine();
    }
    return LearningGraphEngine.instance;
  }

  constructor() {
    this.initSchema();
  }

  private initSchema(): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS learning_graph_nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        category TEXT,
        use_count INTEGER DEFAULT 0,
        last_used_at INTEGER,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS learning_graph_edges (
        source TEXT NOT NULL,
        target TEXT NOT NULL,
        relation TEXT NOT NULL,
        weight REAL DEFAULT 1.0,
        PRIMARY KEY (source, target, relation)
      );
    `);
  }

  public addOrUpdateNode(node: GraphNode): void {
    const stmt = db.prepare(`
      INSERT INTO learning_graph_nodes (id, type, label, category, use_count, last_used_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        use_count = use_count + 1,
        last_used_at = ?,
        metadata = coalesce(?, metadata)
    `);
    const now = Date.now();
    stmt.run(
      node.id,
      node.type,
      node.label,
      node.category || null,
      node.useCount || 1,
      now,
      node.metadata ? JSON.stringify(node.metadata) : null,
      now,
      node.metadata ? JSON.stringify(node.metadata) : null
    );
  }

  public addEdge(edge: GraphEdge): void {
    const stmt = db.prepare(`
      INSERT INTO learning_graph_edges (source, target, relation, weight)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(source, target, relation) DO UPDATE SET
        weight = weight + 0.1
    `);
    stmt.run(edge.source, edge.target, edge.relation, edge.weight);
  }

  public recordToolUsage(agentRole: string, toolName: string): void {
    this.addOrUpdateNode({ id: `agent:${agentRole}`, type: 'agent', label: agentRole.toUpperCase(), useCount: 1 });
    this.addOrUpdateNode({ id: `tool:${toolName}`, type: 'tool', label: toolName, useCount: 1 });
    this.addEdge({ source: `agent:${agentRole}`, target: `tool:${toolName}`, relation: 'uses_tool', weight: 1.0 });
  }

  public getFullGraph(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const nodes = db.prepare('SELECT * FROM learning_graph_nodes').all().map((r: any) => ({
      id: r.id,
      type: r.type,
      label: r.label,
      category: r.category,
      useCount: r.use_count,
      lastUsedAt: r.last_used_at,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined
    }));

    const edges = db.prepare('SELECT * FROM learning_graph_edges').all().map((r: any) => ({
      source: r.source,
      target: r.target,
      relation: r.relation,
      weight: r.weight
    }));

    return { nodes, edges };
  }
}

export const learningGraph = LearningGraphEngine.getInstance();
