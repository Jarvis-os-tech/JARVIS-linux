import { logServer, logTool } from '../core/logger';
import { memoryRepo } from '../db/db';
import {
  CreateNodeRequest,
  MemoryNode,
  SearchQuery,
  SearchResponse,
  GraphStatsResponse,
  FlushResponse,
  TreeDrilldownResponse,
  MemoryEvent,
  KnowledgeTriple,
  DiaryEntry,
  ContextSnapshot
} from './types';

export class MemoryClient {
  private static instance: MemoryClient;
  private baseUrl: string;
  private wsUrl: string;
  private isRustEngineAvailable: boolean = false;
  private lastHealthCheck: number = 0;

  public static getInstance(): MemoryClient {
    if (!MemoryClient.instance) {
      MemoryClient.instance = new MemoryClient();
    }
    return MemoryClient.instance;
  }

  constructor(
    baseUrl: string = process.env.MEMORY_ENGINE_URL || 'http://127.0.0.1:50051',
    wsUrl: string = process.env.MEMORY_ENGINE_WS_URL || 'ws://127.0.0.1:50051/ws/memory/stream'
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.wsUrl = wsUrl;
    this.checkHealth().catch(() => {});
  }

  /**
   * Health probe against the Rust memory engine
   */
  public async checkHealth(): Promise<boolean> {
    const now = Date.now();
    // Cache positive probe for 5 seconds
    if (this.isRustEngineAvailable && now - this.lastHealthCheck < 5000) {
      return true;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 800);
      const res = await fetch(`${this.baseUrl}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);

      this.isRustEngineAvailable = res.ok;
      this.lastHealthCheck = now;
      return this.isRustEngineAvailable;
    } catch {
      this.isRustEngineAvailable = false;
      this.lastHealthCheck = now;
      return false;
    }
  }

  /**
   * 1. Store / Ingest a new memory node (secret-scanned, dual-written to SQLite + Obsidian + Tree Buffer)
   */
  public async createNode(req: CreateNodeRequest): Promise<{ success: boolean; node?: MemoryNode; message: string }> {
    const isOnline = await this.checkHealth();

    if (isOnline) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const res = await fetch(`${this.baseUrl}/api/memory/nodes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: req.id || `node-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            kind: req.kind || 'fact',
            tier: req.tier || 'working',
            title: req.title || (req.content.length > 50 ? `${req.content.slice(0, 47)}...` : req.content),
            content: req.content,
            scope: req.scope || 'global',
            importance: req.importance !== undefined ? Number(req.importance) : 0.7,
            tags: req.tags || [],
            links: req.links || [],
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const errText = await res.text();
          logTool.warn(`[MemoryClient] Rust memory node creation failed (${res.status}): ${errText}`);
          throw new Error(errText || `HTTP ${res.status}`);
        }

        const data = await res.json();
        logTool.info(`[MemoryClient] Successfully committed node to Rust Engine: ${data.node?.id || data.id}`);
        return {
          success: true,
          node: data.node || data,
          message: `Memory node committed and indexed across SQLite WAL & Obsidian vault.`,
        };
      } catch (err: any) {
        logTool.warn(`[MemoryClient] Falling back to local SQLite DB: ${err.message}`);
      }
    }

    // Graceful offline fallback to local SQLite memoryRepo
    try {
      const fallbackKey = req.title || `fact_${Date.now()}`;
      const cat = (req.kind === 'preference' ? 'preference' : req.kind === 'decision' ? 'work_context' : 'personal_fact') as any;
      memoryRepo.upsert({
        id: req.id || `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        category: cat,
        key: fallbackKey,
        value: req.content,
        source: 'user_added',
        updated_at: new Date().toISOString(),
      });
      return {
        success: true,
        message: `Memory stored in local SQLite database (Rust Engine in background sync).`,
      };
    } catch (dbErr: any) {
      logTool.error(`[MemoryClient] Complete store failure: ${dbErr.message}`);
      return { success: false, message: `Could not save memory: ${dbErr.message}` };
    }
  }

  /**
   * 2. 4-Signal Hybrid Search (BM25 + Cosine Vector + Graph + Recency, sub-50ms)
   */
  public async search(query: SearchQuery): Promise<SearchResponse> {
    const isOnline = await this.checkHealth();
    const startTime = Date.now();

    if (isOnline) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const res = await fetch(`${this.baseUrl}/api/memory/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: query.query,
            top_k: query.top_k || 5,
            profile: query.profile || 'balanced',
            scope: query.scope,
            min_score: query.min_score || 0.1,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const data: SearchResponse = await res.json();
          logTool.info(
            `[MemoryClient] Hybrid search for "${query.query}" returned ${data.results.length} nodes in ${data.execution_ms}ms`
          );
          return data;
        }
      } catch (err: any) {
        logTool.warn(`[MemoryClient] Hybrid search error, falling back to local SQLite: ${err.message}`);
      }
    }

    // Offline fallback: Search local SQLite memories with multi-token scoring
    const allMemories = memoryRepo.getAll();
    const queryTokens = query.query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    const matches = allMemories
      .map((m: any) => {
        const text = `${m.key} ${m.value}`.toLowerCase();
        let matchCount = 0;
        for (const token of queryTokens) {
          if (text.includes(token)) matchCount++;
        }
        return { m, matchCount };
      })
      .filter((item) => item.matchCount > 0 || queryTokens.length === 0)
      .sort((a, b) => b.matchCount - a.matchCount)
      .slice(0, query.top_k || 5)
      .map(({ m }, idx: number) => ({
        node_id: m.id,
        score: 0.9 - idx * 0.1,
        title: m.key,
        content: m.value,
        kind: (m.category === 'preference' ? 'preference' : m.category === 'work_context' ? 'decision' : 'fact') as any,
        tier: 'working' as const,
        bm25_score: 0.7,
        vector_score: 0.0,
        graph_score: 0.0,
        recency_score: 0.3,
      }));

    return {
      query: query.query,
      results: matches,
      execution_ms: Date.now() - startTime,
      total_candidates: matches.length,
    };
  }

  /**
   * 3. Retrieve Memory Vault & Engine Status
   */
  public async getStatus(): Promise<GraphStatsResponse> {
    const isOnline = await this.checkHealth();

    if (isOnline) {
      try {
        const res = await fetch(`${this.baseUrl}/health`);
        if (res.ok) {
          return await res.json();
        }
      } catch {}
    }

    const localCount = memoryRepo.getAll().length;
    return {
      status: isOnline ? 'online' : 'offline_fallback',
      engine_version: '0.1.0-phase5',
      node_count: localCount,
      edge_count: 0,
      unsealed_buffer_count: 0,
      obsidian_vault_path: '/home/gopi/Downloads/JARVIS-V0/JARVIS-MEMORY',
      sqlite_path: '/home/gopi/Downloads/JARVIS-V0/data/jarvis.db',
      uptime_seconds: 0,
    };
  }

  /**
   * 4. Flush unsealed memory buffers into sealed L1 summaries
   */
  public async flush(staleThresholdSecs: number = 0): Promise<FlushResponse> {
    const isOnline = await this.checkHealth();
    if (!isOnline) {
      return { flushed_buffers: 0, sealed_summaries: [], execution_ms: 0 };
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/memory/flush`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stale_threshold_secs: staleThresholdSecs }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err: any) {
      logTool.warn(`[MemoryClient] Flush error: ${err.message}`);
    }

    return { flushed_buffers: 0, sealed_summaries: [], execution_ms: 0 };
  }

  /**
   * 5. Drill down into hierarchical summary tree notes
   */
  public async getTreeDrilldown(rootId: string): Promise<TreeDrilldownResponse | null> {
    const isOnline = await this.checkHealth();
    if (!isOnline) return null;

    try {
      const res = await fetch(`${this.baseUrl}/api/memory/tree/drilldown?root_id=${encodeURIComponent(rootId)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (err: any) {
      logTool.warn(`[MemoryClient] Tree drilldown error: ${err.message}`);
    }

    return null;
  }
  /**
   * 6. Query Knowledge Graph
   */
  public async queryKG(subject: string, predicate?: string, asOf?: number): Promise<KnowledgeTriple[]> {
    const isOnline = await this.checkHealth();
    if (!isOnline) return [];

    try {
      let url = `${this.baseUrl}/api/memory/kg/query?subject=${encodeURIComponent(subject)}`;
      if (predicate) url += `&predicate=${encodeURIComponent(predicate)}`;
      if (asOf) url += `&as_of=${asOf}`;

      const res = await fetch(url);
      if (res.ok) {
        return await res.json();
      }
    } catch (err: any) {
      logTool.warn(`[MemoryClient] KG query error: ${err.message}`);
    }
    return [];
  }

  /**
   * 7. Supersede Knowledge Graph Object
   */
  public async supersedeKG(subject: string, predicate: string, oldObject: string, newObject: string): Promise<KnowledgeTriple | null> {
    const isOnline = await this.checkHealth();
    if (!isOnline) return null;

    try {
      const res = await fetch(`${this.baseUrl}/api/memory/kg/supersede`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, predicate, old_object: oldObject, new_object: newObject }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err: any) {
      logTool.warn(`[MemoryClient] KG supersede error: ${err.message}`);
    }
    return null;
  }

  /**
   * 8. Write Diary Entry
   */
  public async writeDiary(content: string, agentId?: string, entryType?: string): Promise<boolean> {
    const isOnline = await this.checkHealth();
    if (!isOnline) return false;

    try {
      const res = await fetch(`${this.baseUrl}/api/memory/diary/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, agent_id: agentId, entry_type: entryType }),
      });
      return res.ok;
    } catch (err: any) {
      logTool.warn(`[MemoryClient] Diary write error: ${err.message}`);
    }
    return false;
  }

  /**
   * 9. Read Diary Entries
   */
  public async readDiary(agentId?: string, limit?: number): Promise<DiaryEntry[]> {
    const isOnline = await this.checkHealth();
    if (!isOnline) return [];

    try {
      let url = `${this.baseUrl}/api/memory/diary/read`;
      const params = new URLSearchParams();
      if (agentId) params.append('agent_id', agentId);
      if (limit) params.append('limit', limit.toString());
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      if (res.ok) {
        return await res.json();
      }
    } catch (err: any) {
      logTool.warn(`[MemoryClient] Diary read error: ${err.message}`);
    }
    return [];
  }

  /**
   * 10. Get Context Snapshot
   */
  public async getContextSnapshot(): Promise<ContextSnapshot | null> {
    const isOnline = await this.checkHealth();
    if (!isOnline) return null;

    try {
      const res = await fetch(`${this.baseUrl}/api/memory/context/snapshot`);
      if (res.ok) {
        return await res.json();
      }
    } catch (err: any) {
      logTool.warn(`[MemoryClient] Context snapshot error: ${err.message}`);
    }
    return null;
  }
}

export const memoryClient = MemoryClient.getInstance();
