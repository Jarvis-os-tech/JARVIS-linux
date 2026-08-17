import fs from 'fs';
import path from 'path';
import { memoryClient } from './client';
import { memoryRepo } from '../db/db';
import { logOrchestrator } from '../core/logger';

export class MemoryContextBuilder {
  private static instance: MemoryContextBuilder;
  private frozenSnapshotCache: string | null = null;
  private lastSnapshotTime: number = 0;
  private readonly SNAPSHOT_TTL_MS = 60000; // Refresh frozen snapshot every 60 seconds

  public static getInstance(): MemoryContextBuilder {
    if (!MemoryContextBuilder.instance) {
      MemoryContextBuilder.instance = new MemoryContextBuilder();
    }
    return MemoryContextBuilder.instance;
  }

  constructor() {}

  /**
   * Builds a deterministic, frozen system prompt prefix ensuring 100% LLM KV cache retention
   */
  public async getFrozenPromptSnapshot(): Promise<string> {
    const now = Date.now();
    if (this.frozenSnapshotCache && now - this.lastSnapshotTime < this.SNAPSHOT_TTL_MS) {
      return this.frozenSnapshotCache;
    }

    try {
      const vaultPath = path.join(process.cwd(), 'JARVIS-MEMORY');

      // 1. Load Operating Directives
      let instructionsText = 'Operator Identity: Gopi (BTech Engineer, Architect of J.A.R.V.I.S.).';
      const instructionsFile = path.join(vaultPath, 'knowledge', 'Instructions.md');
      if (fs.existsSync(instructionsFile)) {
        instructionsText = fs.readFileSync(instructionsFile, 'utf-8').trim();
      }

      // 2. Load Core Persistent Facts from SQLite & Obsidian
      const dbMemories = memoryRepo.getAll();
      let factsList: string[] = [];

      if (dbMemories && dbMemories.length > 0) {
        factsList = dbMemories.map((m: any) => `- [${m.category.toUpperCase()}] ${m.key}: ${m.value}`);
      } else {
        factsList = [
          '- [IDENTITY] Operator: Gopi (BTech Engineer)',
          '- [HARDWARE] Host: Ubuntu Linux 64-bit, PulseAudio, Mutter D-Bus, Rust Audio Capture Layer',
          '- [SYSTEM] Universal Memory Vault: Local-first SQLite WAL + Obsidian /JARVIS-MEMORY/'
        ];
      }

      // 3. Assemble Deterministic Hermes Frozen Prompt
      const snapshot = `
=== [HERMES FROZEN UNIVERSAL MEMORY SNAPSHOT] ===
[CORE OPERATING DIRECTIVES & OPERATOR CONTEXT]
${instructionsText}

[PERSISTENT CORE FACTS & ARCHITECTURAL TRUTHS]
${factsList.join('\n')}

[SYSTEM ARCHITECTURE & CAPABILITIES]
- Instant C++ POSIX Actuators: Sub-millisecond hardware audio, brightness, and telemetry workers.
- Rust Audio Gateway: Ultra-low latency CPAL audio streaming layer.
- Agent Reach Grounding: Verified real-time web research, Jina clean reader, YouTube transcript extraction.
- 4-Signal Hybrid Recall: FTS5 BM25 + Cosine Vector + Graph Neighborhood + Ebbinghaus Recency Decay.
- Hierarchical Memory Tree: L0 leaf nodes auto-sealed into L1/L2 intermediate session summaries.
=================================================
`.trim();

      this.frozenSnapshotCache = snapshot;
      this.lastSnapshotTime = now;
      logOrchestrator.debug(`[ContextBuilder] Assembled fresh Hermes Frozen Prompt Snapshot (${snapshot.length} chars)`);
      return snapshot;
    } catch (err: any) {
      logOrchestrator.warn(`[ContextBuilder] Error assembling frozen snapshot: ${err.message}`);
      return `[UNIVERSAL MEMORY] Operator: Gopi. JARVIS Local-First Architecture active.`;
    }
  }

  /**
   * Injects dynamic, high-relevance recalled memory context for an incoming user query
   */
  public async buildDynamicMemoryContext(userQuery: string): Promise<string> {
    if (!userQuery || userQuery.trim().length < 3) return '';

    try {
      const searchRes = await memoryClient.search({
        query: userQuery,
        top_k: 4,
        profile: 'balanced',
        min_score: 0.25,
      });

      if (!searchRes.results || searchRes.results.length === 0) {
        return '';
      }

      const formattedItems = searchRes.results
        .map(
          (r, idx) =>
            `${idx + 1}. [${r.kind.toUpperCase()}] **${r.title}**: ${r.content} (Confidence: ${(r.score * 100).toFixed(0)}%)`
        )
        .join('\n');

      return `\n\n=== [RECALLED UNIVERSAL MEMORY CONTEXT] ===\nRelevant past memories matching current topic:\n${formattedItems}\n==========================================\n`;
    } catch (err: any) {
      logOrchestrator.debug(`[ContextBuilder] Dynamic recall skipped: ${err.message}`);
      return '';
    }
  }

  /**
   * Combines frozen prompt snapshot + dynamic recall context + base prompt
   */
  public async assembleFullSystemPrompt(baseInstruction: string, userMessage?: string): Promise<string> {
    const frozen = await this.getFrozenPromptSnapshot();
    const dynamic = userMessage ? await this.buildDynamicMemoryContext(userMessage) : '';

    return `${baseInstruction}\n\n${frozen}${dynamic}`;
  }

  /**
   * Invalidate snapshot cache when new facts are stored
   */
  public invalidateCache(): void {
    this.frozenSnapshotCache = null;
    this.lastSnapshotTime = 0;
  }
}

export const memoryContextBuilder = MemoryContextBuilder.getInstance();
