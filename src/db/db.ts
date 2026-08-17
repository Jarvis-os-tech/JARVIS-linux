import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { logDb } from '../core/logger';
import { eventBus } from '../core/event_bus';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'jarvis.db');

export class JarvisDatabase {
  private static instance: JarvisDatabase;
  public db: Database.Database;

  public static getInstance(): JarvisDatabase {
    if (!JarvisDatabase.instance) {
      JarvisDatabase.instance = new JarvisDatabase();
    }
    return JarvisDatabase.instance;
  }

  constructor() {
    this.db = new Database(DB_PATH);
    this.initPragmas();
    this.migrate();
    logDb.info(`SQLite engine active at ${DB_PATH} (WAL mode enabled).`);
  }

  private initPragmas() {
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('temp_store = MEMORY');
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'user_added',
        updated_at TEXT NOT NULL,
        embedding_json TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
      CREATE INDEX IF NOT EXISTS idx_memories_key ON memories(key);

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        priority INTEGER NOT NULL DEFAULT 3,
        progress INTEGER NOT NULL DEFAULT 0,
        result_json TEXT,
        error TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        subsystem TEXT NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        metadata_json TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

      CREATE TABLE IF NOT EXISTS configs (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS feature_switches (
        feature_id TEXT PRIMARY KEY,
        tier INTEGER NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        name TEXT NOT NULL,
        description TEXT,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS schema_info (
        version INTEGER PRIMARY KEY,
        engine_version TEXT NOT NULL,
        initialized_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        tables_count INTEGER NOT NULL,
        status TEXT NOT NULL
      );

      INSERT OR REPLACE INTO schema_info (version, engine_version, initialized_at, updated_at, tables_count, status)
      VALUES (1, '0.1.0', CAST(strftime('%s', 'now') AS INTEGER), CAST(strftime('%s', 'now') AS INTEGER), 8, 'healthy');

      CREATE TABLE IF NOT EXISTS workspace_actions (
        id TEXT PRIMARY KEY,
        tool_name TEXT NOT NULL,
        status TEXT NOT NULL,
        summary TEXT,
        link_url TEXT,
        result_json TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS research_cache (
        hash TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        mode TEXT NOT NULL,
        category TEXT NOT NULL,
        result_json TEXT NOT NULL,
        sources_json TEXT NOT NULL,
        triangulation_json TEXT,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_research_cache_query ON research_cache(query);
      CREATE INDEX IF NOT EXISTS idx_research_cache_expires ON research_cache(expires_at);
    `);
  }

  public close() {
    this.db.close();
    logDb.info('SQLite database connection closed.');
  }
}

export const jarvisDb = JarvisDatabase.getInstance();

// ─── Repository Access Layer ──────────────────────────────────────────────────

export interface MemoryRecord {
  id: string;
  category: 'preference' | 'personal_fact' | 'work_context' | 'topic' | 'custom';
  key: string;
  value: string;
  source: 'auto_extracted' | 'user_added' | 'obsidian_sync';
  updated_at: string;
  embedding_json?: string;
}

export const memoryRepo = {
  getAll(): MemoryRecord[] {
    const stmt = jarvisDb.db.prepare('SELECT * FROM memories ORDER BY updated_at DESC');
    return stmt.all() as MemoryRecord[];
  },

  getById(id: string): MemoryRecord | null {
    const stmt = jarvisDb.db.prepare('SELECT * FROM memories WHERE id = ?');
    return (stmt.get(id) as MemoryRecord) || null;
  },

  upsert(fact: MemoryRecord): void {
    const stmt = jarvisDb.db.prepare(`
      INSERT INTO memories (id, category, key, value, source, updated_at, embedding_json)
      VALUES (@id, @category, @key, @value, @source, @updated_at, @embedding_json)
      ON CONFLICT(id) DO UPDATE SET
        category = excluded.category,
        key = excluded.key,
        value = excluded.value,
        source = excluded.source,
        updated_at = excluded.updated_at,
        embedding_json = excluded.embedding_json
    `);
    stmt.run({
      id: fact.id,
      category: fact.category,
      key: fact.key,
      value: fact.value,
      source: fact.source,
      updated_at: fact.updated_at,
      embedding_json: fact.embedding_json || null,
    });
    eventBus.emit('memory:fact_added', fact);
  },

  delete(id: string): boolean {
    const stmt = jarvisDb.db.prepare('DELETE FROM memories WHERE id = ?');
    const result = stmt.run(id);
    if (result.changes > 0) {
      eventBus.emit('memory:fact_deleted', { id });
      return true;
    }
    return false;
  },

  search(query: string): MemoryRecord[] {
    const q = `%${query}%`;
    const stmt = jarvisDb.db.prepare(`
      SELECT * FROM memories 
      WHERE key LIKE ? OR value LIKE ? OR category LIKE ?
      ORDER BY updated_at DESC
    `);
    return stmt.all(q, q, q) as MemoryRecord[];
  },
};

export interface TaskRecord {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: number; // 1: Critical, 2: High, 3: Normal, 4: Low
  progress: number;
  result_json?: string;
  error?: string;
  created_at: number;
  updated_at: number;
}

export const taskRepo = {
  getAll(limit = 100): TaskRecord[] {
    const stmt = jarvisDb.db.prepare('SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?');
    return stmt.all(limit) as TaskRecord[];
  },

  getPending(): TaskRecord[] {
    const stmt = jarvisDb.db.prepare('SELECT * FROM tasks WHERE status = "pending" ORDER BY priority ASC, created_at ASC');
    return stmt.all() as TaskRecord[];
  },

  getByStatus(status: string): TaskRecord[] {
    const stmt = jarvisDb.db.prepare('SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC');
    return stmt.all(status) as TaskRecord[];
  },

  getById(id: string): TaskRecord | null {
    const stmt = jarvisDb.db.prepare('SELECT * FROM tasks WHERE id = ?');
    return (stmt.get(id) as TaskRecord) || null;
  },

  insert(task: Omit<TaskRecord, 'updated_at'>): TaskRecord {
    const now = Date.now();
    const full: TaskRecord = { ...task, updated_at: now };
    const stmt = jarvisDb.db.prepare(`
      INSERT INTO tasks (id, title, description, status, priority, progress, result_json, error, created_at, updated_at)
      VALUES (@id, @title, @description, @status, @priority, @progress, @result_json, @error, @created_at, @updated_at)
    `);
    stmt.run({
      id: full.id,
      title: full.title,
      description: full.description || null,
      status: full.status,
      priority: full.priority,
      progress: full.progress,
      result_json: full.result_json || null,
      error: full.error || null,
      created_at: full.created_at,
      updated_at: full.updated_at,
    });
    eventBus.emit('task:created', full);
    return full;
  },

  updateStatus(id: string, status: TaskRecord['status'], resultData?: any, error?: string): void {
    const now = Date.now();
    const resultJson = resultData ? JSON.stringify(resultData) : null;
    const stmt = jarvisDb.db.prepare(`
      UPDATE tasks 
      SET status = ?, result_json = COALESCE(?, result_json), error = COALESCE(?, error), updated_at = ?
      WHERE id = ?
    `);
    stmt.run(status, resultJson, error || null, now, id);

    if (status === 'completed') {
      eventBus.emit('task:completed', { taskId: id, result: resultData });
    } else if (status === 'failed') {
      eventBus.emit('task:failed', { taskId: id, error: error || 'Task execution failed' });
    } else if (status === 'cancelled') {
      eventBus.emit('task:cancelled', { taskId: id });
    }
  },

  updateProgress(id: string, progress: number): void {
    const now = Date.now();
    const stmt = jarvisDb.db.prepare('UPDATE tasks SET progress = ?, updated_at = ? WHERE id = ?');
    stmt.run(progress, now, id);
    eventBus.emit('task:progress', { taskId: id, progress });
  },

  delete(id: string): boolean {
    const stmt = jarvisDb.db.prepare('DELETE FROM tasks WHERE id = ?');
    return stmt.run(id).changes > 0;
  },
};

export const auditRepo = {
  log(subsystem: string, level: string, message: string, metadata?: any): void {
    const id = `aud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const stmt = jarvisDb.db.prepare(`
      INSERT INTO audit_logs (id, subsystem, level, message, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, subsystem, level, message, metadata ? JSON.stringify(metadata) : null, Date.now());
  },

  getRecent(limit = 100): any[] {
    const stmt = jarvisDb.db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?');
    return stmt.all(limit);
  },
};

export const configRepo = {
  get<T>(key: string, defaultValue?: T): T | null {
    const stmt = jarvisDb.db.prepare('SELECT value_json FROM configs WHERE key = ?');
    const row = stmt.get(key) as { value_json: string } | undefined;
    if (!row) return defaultValue !== undefined ? defaultValue : null;
    try {
      return JSON.parse(row.value_json);
    } catch {
      return defaultValue !== undefined ? defaultValue : null;
    }
  },

  set(key: string, value: any): void {
    const stmt = jarvisDb.db.prepare(`
      INSERT INTO configs (key, value_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
    `);
    stmt.run(key, JSON.stringify(value), Date.now());
  },

  delete(key: string): boolean {
    const stmt = jarvisDb.db.prepare('DELETE FROM configs WHERE key = ?');
    return stmt.run(key).changes > 0;
  },
};
