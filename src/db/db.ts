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

      -- Hermes-grade Cron & Scheduled Jobs Engine
      CREATE TABLE IF NOT EXISTS cron_jobs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        schedule_expr TEXT NOT NULL,
        schedule_kind TEXT NOT NULL DEFAULT 'cron',
        enabled INTEGER NOT NULL DEFAULT 1,
        model TEXT,
        provider TEXT,
        skills_json TEXT,
        deliver TEXT NOT NULL DEFAULT 'local',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_run_at INTEGER,
        next_run_at INTEGER,
        last_status TEXT,
        last_error TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_cron_jobs_enabled ON cron_jobs(enabled);
      CREATE INDEX IF NOT EXISTS idx_cron_jobs_next_run ON cron_jobs(next_run_at);

      CREATE TABLE IF NOT EXISTS cron_executions (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        job_name TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        duration_ms INTEGER,
        status TEXT NOT NULL,
        output_text TEXT,
        error TEXT,
        tokens_used INTEGER,
        FOREIGN KEY(job_id) REFERENCES cron_jobs(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_cron_exec_job ON cron_executions(job_id);
      CREATE INDEX IF NOT EXISTS idx_cron_exec_started ON cron_executions(started_at);

      -- Hermes-grade Subagent Delegation Records
      CREATE TABLE IF NOT EXISTS subagents (
        id TEXT PRIMARY KEY,
        parent_task_id TEXT,
        role TEXT NOT NULL,
        goal TEXT NOT NULL,
        context TEXT,
        status TEXT NOT NULL DEFAULT 'running',
        progress INTEGER NOT NULL DEFAULT 0,
        model TEXT,
        provider TEXT,
        result_json TEXT,
        error TEXT,
        iterations INTEGER NOT NULL DEFAULT 0,
        max_iterations INTEGER NOT NULL DEFAULT 25,
        started_at INTEGER NOT NULL,
        completed_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_subagents_status ON subagents(status);
      CREATE INDEX IF NOT EXISTS idx_subagents_started ON subagents(started_at);

      -- Hermes-grade Episodic Conversation History & Search
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        session_key TEXT NOT NULL UNIQUE,
        platform TEXT NOT NULL DEFAULT 'web',
        chat_type TEXT NOT NULL DEFAULT 'dm',
        user_id TEXT NOT NULL DEFAULT 'operator',
        user_name TEXT NOT NULL DEFAULT 'Gopi',
        persona TEXT NOT NULL DEFAULT 'jarvis',
        total_tokens INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at);

      CREATE TABLE IF NOT EXISTS conversation_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tool_calls_json TEXT,
        tool_results_json TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_conv_session ON conversation_messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_conv_created ON conversation_messages(created_at);

      -- Hermes-grade Skills Registry & Usage Tracking
      CREATE TABLE IF NOT EXISTS skills_registry (
        name TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        path TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'bundled',
        usage_count INTEGER NOT NULL DEFAULT 0,
        last_used_at INTEGER,
        content TEXT,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_skills_category ON skills_registry(category);
      CREATE INDEX IF NOT EXISTS idx_skills_usage ON skills_registry(usage_count);
    `);
  }

  public close() {
    this.db.close();
    logDb.info('SQLite database connection closed.');
  }
}

export const jarvisDb = JarvisDatabase.getInstance();
export const db = jarvisDb.db;

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

// ─── Hermes-Grade Cron & Scheduled Job Repository ────────────────────────────

export interface CronJobRecord {
  id: string;
  name: string;
  prompt: string;
  schedule_expr: string;
  schedule_kind: 'cron' | 'interval' | 'once';
  enabled: number;
  model?: string;
  provider?: string;
  skills_json?: string;
  deliver: string;
  created_at: number;
  updated_at: number;
  last_run_at?: number;
  next_run_at?: number;
  last_status?: string;
  last_error?: string;
}

export interface CronExecutionRecord {
  id: string;
  job_id: string;
  job_name: string;
  started_at: number;
  completed_at?: number;
  duration_ms?: number;
  status: 'running' | 'ok' | 'error';
  output_text?: string;
  error?: string;
  tokens_used?: number;
}

export const cronRepo = {
  getAll(): CronJobRecord[] {
    const stmt = jarvisDb.db.prepare('SELECT * FROM cron_jobs ORDER BY created_at ASC');
    return stmt.all() as CronJobRecord[];
  },

  getEnabled(): CronJobRecord[] {
    const stmt = jarvisDb.db.prepare('SELECT * FROM cron_jobs WHERE enabled = 1 ORDER BY next_run_at ASC');
    return stmt.all() as CronJobRecord[];
  },

  getById(id: string): CronJobRecord | null {
    const stmt = jarvisDb.db.prepare('SELECT * FROM cron_jobs WHERE id = ?');
    return (stmt.get(id) as CronJobRecord) || null;
  },

  getByName(name: string): CronJobRecord | null {
    const stmt = jarvisDb.db.prepare('SELECT * FROM cron_jobs WHERE name = ?');
    return (stmt.get(name) as CronJobRecord) || null;
  },

  upsert(job: CronJobRecord): void {
    const stmt = jarvisDb.db.prepare(`
      INSERT INTO cron_jobs (id, name, prompt, schedule_expr, schedule_kind, enabled, model, provider, skills_json, deliver, created_at, updated_at, last_run_at, next_run_at, last_status, last_error)
      VALUES (@id, @name, @prompt, @schedule_expr, @schedule_kind, @enabled, @model, @provider, @skills_json, @deliver, @created_at, @updated_at, @last_run_at, @next_run_at, @last_status, @last_error)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        prompt = excluded.prompt,
        schedule_expr = excluded.schedule_expr,
        schedule_kind = excluded.schedule_kind,
        enabled = excluded.enabled,
        model = excluded.model,
        provider = excluded.provider,
        skills_json = excluded.skills_json,
        deliver = excluded.deliver,
        updated_at = excluded.updated_at,
        last_run_at = excluded.last_run_at,
        next_run_at = excluded.next_run_at,
        last_status = excluded.last_status,
        last_error = excluded.last_error
    `);
    stmt.run({
      id: job.id,
      name: job.name,
      prompt: job.prompt,
      schedule_expr: job.schedule_expr,
      schedule_kind: job.schedule_kind || 'cron',
      enabled: job.enabled ?? 1,
      model: job.model || null,
      provider: job.provider || null,
      skills_json: job.skills_json || null,
      deliver: job.deliver || 'local',
      created_at: job.created_at || Date.now(),
      updated_at: job.updated_at || Date.now(),
      last_run_at: job.last_run_at || null,
      next_run_at: job.next_run_at || null,
      last_status: job.last_status || null,
      last_error: job.last_error || null,
    });
  },

  updateRunStatus(id: string, nextRunAt: number, lastStatus: string, lastError?: string): void {
    const now = Date.now();
    const stmt = jarvisDb.db.prepare(`
      UPDATE cron_jobs 
      SET last_run_at = ?, next_run_at = ?, last_status = ?, last_error = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(now, nextRunAt, lastStatus, lastError || null, now, id);
  },

  toggle(id: string, enabled: boolean): void {
    const stmt = jarvisDb.db.prepare('UPDATE cron_jobs SET enabled = ?, updated_at = ? WHERE id = ?');
    stmt.run(enabled ? 1 : 0, Date.now(), id);
  },

  delete(id: string): boolean {
    const stmt = jarvisDb.db.prepare('DELETE FROM cron_jobs WHERE id = ?');
    return stmt.run(id).changes > 0;
  },

  logExecution(exec: CronExecutionRecord): void {
    const stmt = jarvisDb.db.prepare(`
      INSERT INTO cron_executions (id, job_id, job_name, started_at, completed_at, duration_ms, status, output_text, error, tokens_used)
      VALUES (@id, @job_id, @job_name, @started_at, @completed_at, @duration_ms, @status, @output_text, @error, @tokens_used)
      ON CONFLICT(id) DO UPDATE SET
        completed_at = excluded.completed_at,
        duration_ms = excluded.duration_ms,
        status = excluded.status,
        output_text = excluded.output_text,
        error = excluded.error,
        tokens_used = excluded.tokens_used
    `);
    stmt.run({
      id: exec.id,
      job_id: exec.job_id,
      job_name: exec.job_name,
      started_at: exec.started_at,
      completed_at: exec.completed_at || null,
      duration_ms: exec.duration_ms || null,
      status: exec.status,
      output_text: exec.output_text || null,
      error: exec.error || null,
      tokens_used: exec.tokens_used || 0,
    });
  },

  getRecentExecutions(limit = 50): CronExecutionRecord[] {
    const stmt = jarvisDb.db.prepare('SELECT * FROM cron_executions ORDER BY started_at DESC LIMIT ?');
    return stmt.all(limit) as CronExecutionRecord[];
  },
};

// ─── Hermes-Grade Subagent Delegation Repository ─────────────────────────────

export interface SubagentRecord {
  id: string;
  parent_task_id?: string;
  role: string;
  goal: string;
  context?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  model?: string;
  provider?: string;
  result_json?: string;
  error?: string;
  iterations: number;
  max_iterations: number;
  started_at: number;
  completed_at?: number;
}

export const subagentRepo = {
  create(record: Omit<SubagentRecord, 'iterations' | 'progress'>): SubagentRecord {
    const full: SubagentRecord = {
      ...record,
      iterations: 0,
      progress: 0,
    };
    const stmt = jarvisDb.db.prepare(`
      INSERT INTO subagents (id, parent_task_id, role, goal, context, status, progress, model, provider, result_json, error, iterations, max_iterations, started_at, completed_at)
      VALUES (@id, @parent_task_id, @role, @goal, @context, @status, @progress, @model, @provider, @result_json, @error, @iterations, @max_iterations, @started_at, @completed_at)
    `);
    stmt.run({
      ...full,
      parent_task_id: full.parent_task_id || null,
      context: full.context || null,
      model: full.model || null,
      provider: full.provider || null,
      result_json: full.result_json || null,
      error: full.error || null,
      completed_at: full.completed_at || null,
    });
    return full;
  },

  update(id: string, updates: Partial<SubagentRecord>): void {
    const fields = Object.keys(updates)
      .filter((k) => k !== 'id')
      .map((k) => `${k} = @${k}`)
      .join(', ');
    if (!fields) return;
    const stmt = jarvisDb.db.prepare(`UPDATE subagents SET ${fields} WHERE id = @id`);
    stmt.run({ ...updates, id });
  },

  getById(id: string): SubagentRecord | null {
    const stmt = jarvisDb.db.prepare('SELECT * FROM subagents WHERE id = ?');
    return (stmt.get(id) as SubagentRecord) || null;
  },

  getAll(limit = 100): SubagentRecord[] {
    const stmt = jarvisDb.db.prepare('SELECT * FROM subagents ORDER BY started_at DESC LIMIT ?');
    return stmt.all(limit) as SubagentRecord[];
  },

  getActive(): SubagentRecord[] {
    const stmt = jarvisDb.db.prepare('SELECT * FROM subagents WHERE status = "running" ORDER BY started_at ASC');
    return stmt.all() as SubagentRecord[];
  },
};

// ─── Hermes-Grade Episodic Session & Message Repository ──────────────────────

export interface SessionRecord {
  id: string;
  session_key: string;
  platform: string;
  chat_type: string;
  user_id: string;
  user_name: string;
  persona: string;
  total_tokens: number;
  created_at: number;
  updated_at: number;
}

export interface ConversationMessageRecord {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls_json?: string;
  tool_results_json?: string;
  created_at: number;
}

export const sessionRepo = {
  getOrCreate(sessionKey: string, meta?: Partial<SessionRecord>): SessionRecord {
    const stmt = jarvisDb.db.prepare('SELECT * FROM sessions WHERE session_key = ?');
    const existing = stmt.get(sessionKey) as SessionRecord | undefined;
    if (existing) return existing;

    const now = Date.now();
    const id = `sess_${now}_${Math.random().toString(36).substring(2, 8)}`;
    const newSession: SessionRecord = {
      id,
      session_key: sessionKey,
      platform: meta?.platform || 'web',
      chat_type: meta?.chat_type || 'dm',
      user_id: meta?.user_id || 'operator',
      user_name: meta?.user_name || 'Gopi',
      persona: meta?.persona || 'jarvis',
      total_tokens: 0,
      created_at: now,
      updated_at: now,
    };

    const insertStmt = jarvisDb.db.prepare(`
      INSERT INTO sessions (id, session_key, platform, chat_type, user_id, user_name, persona, total_tokens, created_at, updated_at)
      VALUES (@id, @session_key, @platform, @chat_type, @user_id, @user_name, @persona, @total_tokens, @created_at, @updated_at)
    `);
    insertStmt.run(newSession);
    return newSession;
  },

  addMessage(msg: ConversationMessageRecord): void {
    const stmt = jarvisDb.db.prepare(`
      INSERT INTO conversation_messages (id, session_id, role, content, tool_calls_json, tool_results_json, created_at)
      VALUES (@id, @session_id, @role, @content, @tool_calls_json, @tool_results_json, @created_at)
    `);
    stmt.run({
      id: msg.id,
      session_id: msg.session_id,
      role: msg.role,
      content: msg.content,
      tool_calls_json: msg.tool_calls_json || null,
      tool_results_json: msg.tool_results_json || null,
      created_at: msg.created_at,
    });
    jarvisDb.db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(Date.now(), msg.session_id);
  },

  getMessages(sessionId: string, limit = 50): ConversationMessageRecord[] {
    const stmt = jarvisDb.db.prepare(`
      SELECT * FROM conversation_messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ?
    `);
    return stmt.all(sessionId, limit) as ConversationMessageRecord[];
  },

  searchPastConversations(query: string, limit = 20): Array<{ session_id: string; content: string; role: string; created_at: number }> {
    const q = `%${query}%`;
    const stmt = jarvisDb.db.prepare(`
      SELECT session_id, content, role, created_at
      FROM conversation_messages
      WHERE content LIKE ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(q, limit) as any[];
  },
};

// ─── Hermes-Grade Skills Registry Repository ──────────────────────────────────

export interface SkillRegistryRecord {
  name: string;
  category: string;
  description: string;
  path: string;
  source: 'bundled' | 'user' | 'harvested';
  usage_count: number;
  last_used_at?: number;
  content?: string;
  updated_at: number;
}

export const skillsRegistryRepo = {
  getAll(): SkillRegistryRecord[] {
    const stmt = jarvisDb.db.prepare('SELECT * FROM skills_registry ORDER BY category ASC, name ASC');
    return stmt.all() as SkillRegistryRecord[];
  },

  getByName(name: string): SkillRegistryRecord | null {
    const stmt = jarvisDb.db.prepare('SELECT * FROM skills_registry WHERE name = ?');
    return (stmt.get(name) as SkillRegistryRecord) || null;
  },

  upsert(skill: SkillRegistryRecord): void {
    const stmt = jarvisDb.db.prepare(`
      INSERT INTO skills_registry (name, category, description, path, source, usage_count, last_used_at, content, updated_at)
      VALUES (@name, @category, @description, @path, @source, @usage_count, @last_used_at, @content, @updated_at)
      ON CONFLICT(name) DO UPDATE SET
        category = excluded.category,
        description = excluded.description,
        path = excluded.path,
        source = excluded.source,
        content = excluded.content,
        updated_at = excluded.updated_at
    `);
    stmt.run({
      ...skill,
      last_used_at: skill.last_used_at || null,
      content: skill.content || null,
    });
  },

  incrementUsage(name: string): void {
    const now = Date.now();
    const stmt = jarvisDb.db.prepare(`
      UPDATE skills_registry 
      SET usage_count = usage_count + 1, last_used_at = ?
      WHERE name = ?
    `);
    stmt.run(now, name);
  },

  search(query: string): SkillRegistryRecord[] {
    const q = `%${query}%`;
    const stmt = jarvisDb.db.prepare(`
      SELECT * FROM skills_registry
      WHERE name LIKE ? OR description LIKE ? OR category LIKE ?
      ORDER BY usage_count DESC, name ASC
    `);
    return stmt.all(q, q, q) as SkillRegistryRecord[];
  },
};
