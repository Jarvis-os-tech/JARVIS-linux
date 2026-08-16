# 🧠 JARVIS-V0 Universal Memory + Context System — Master Implementation Plan

> **Target Directory**: `/home/gopi/Downloads/JARVIS-V0/`  
> **Memory Root**: `~/.jarvis/memory/` (Persistent dedicated storage: SQLite WAL + Obsidian Vault)  
> **Core Architecture**: Rust Memory Engine Core (`memory_engine/`) + TypeScript Orchestration Layer (`src/memory/`) + React 19 WebGL Visual Brain (`src/components/memory-graph/`)  
> **Execution Protocol**: **Phase-by-Phase Interactive Gate Workflow** — Execute Phase $N$ $\to$ Run 4 CLI checks + voice tests $\to$ User signs off with *"Phase $N$ done / Phase $N+1$ start"* $\to$ Execute Phase $N+1$.

---

## 📋 User Review & Architectural Contract

> [!IMPORTANT]
> **Single Source of Truth with Dual Persistence**: Every memory write is validated by a pre-write secret scanner, committed to SQLite WAL (`memory.db`), and asynchronously projected to a real-time Obsidian markdown vault (`~/.jarvis/memory/vault/`) with YAML frontmatter and `[[wikilinks]]`.
>
> **Hermes Frozen Prompt Invariant**: System prompt memory snapshots are frozen at session start to preserve 100% LLM Key-Value (KV) prefix cache. Mid-session queries use sub-50ms live tool retrieval (`jarvis_recall`).
>
> **Execution Workflow**: We will proceed strictly **one phase at a time**. After each phase is built, we will provide the 4 CLI validation commands and the manual voice commands. Once you test and reply *"Phase X complete / start Phase X+1"*, we advance to the next phase.

---

## 🏛️ System Architecture Diagram

```mermaid
graph TB
    subgraph "Frontend & HUD (React 19 + TypeScript + Pixi.js)"
        UI_HUD[JARVIS Voice HUD / MemoryView]
        UI_BRAIN[BrainPage WebGL Graph : Pixi.js + D3-Force]
        UI_AUDIO[Gateway Audio Visualizer]
        UI_BRAIN <-->|WebSocket / REST| HTTP_SRV
    end

    subgraph "JARVIS-V0 TypeScript Core (Node.js)"
        EV_BUS[Central EventBus]
        TS_LOG[Turn Logger & Auto-Capture]
        TS_CTX[Frozen Prompt Context Builder]
        TS_CLIENT[Memory Engine Client]
        EV_BUS --> TS_LOG
        TS_LOG --> TS_CLIENT
        TS_CTX --> TS_CLIENT
    end

    subgraph "Rust Memory Engine Core (:50051)"
        HTTP_SRV[Axum REST & WebSocket Server]
        MCP_SRV[MCP Stdio Server - Claude/Antigravity/Cursor]
        SEC_GATE[Secret Scanner Gate - 15+ Signatures]
        
        HTTP_SRV --> SEC_GATE
        MCP_SRV --> SEC_GATE
        
        subgraph "Dual Storage & Indexing"
            SQLITE[(SQLite WAL: memory.db)]
            VAULT[(Obsidian Vault: ~/.jarvis/memory/vault/)]
            FTS5[(FTS5 BM25 Engine)]
            VEC[(IEEE 754 Float32 Vector Cosine + MMR)]
            KGRAPH[(Typed Knowledge Graph: 8 Nodes, 8 Edges)]
        end
        
        subgraph "Autonomous Life-Cycle & Growth"
            TREE[Hierarchical Memory Tree: L0 -> L1 -> L2]
            ARCHIVIST[Archivist Compactor Daemon]
            GIT_WATCH[Git Commit Inotify Watcher]
            DECAY[Ebbinghaus Recency Decay Worker]
        end

        SEC_GATE --> SQLITE
        SEC_GATE --> VAULT
        SQLITE --> FTS5
        SQLITE --> VEC
        SQLITE --> KGRAPH
        SQLITE --> TREE
        ARCHIVIST --> TREE
        GIT_WATCH --> SEC_GATE
        DECAY --> SQLITE
    end
```

---

## 🚀 Complete 8-Phase Master Roadmap

---

### 📦 Phase 1: Rust Engine Core, SQLite WAL Schema & Multi-Tier Repositories

#### 🎯 Goal
Scaffold the high-performance `memory_engine/` Rust crate and establish the 11 SQLite WAL tables, foreign keys, virtual FTS5 tables, and database repositories for multi-tier memory storage (Session, Working, Persistent, Knowledge).

#### 📁 Files & Components
- `memory_engine/Cargo.toml` — Dependencies: `rusqlite` (bundled, vtab, blob), `tokio`, `serde`, `serde_json`, `uuid`, `chrono`, `tracing`, `clap`, `dirs`, `thiserror`.
- `memory_engine/src/lib.rs` — Root crate module exports.
- `memory_engine/src/config.rs` — Path resolution (`~/.jarvis/memory/`), directory bootstrapping, and configuration.
- `memory_engine/src/types.rs` — Enums: `NodeKind` (`fact`, `decision`, `lesson`, `pattern`, `conversation`, `entity`, `chunk`), `Tier` (0–3), `EdgeKind`, `KnowledgeKind`.
- `memory_engine/src/db/mod.rs` & `memory_engine/src/db/connection.rs` — SQLite connection pool with `PRAGMA journal_mode = WAL`, `PRAGMA synchronous = NORMAL`, and `PRAGMA busy_timeout = 15000`.
- `memory_engine/src/db/schema.rs` — 11 Relational & Virtual Tables:
  1. `memory_nodes` (Core hierarchical nodes with importance, parent-child, and superseding)
  2. `memory_nodes_fts` (FTS5 full-text index with Porter stemming & Unicode61)
  3. `memory_vectors` (Raw IEEE 754 float32 embeddings)
  4. `memory_edges` (Relational typed graph edges)
  5. `conversation_turns` (Full dialogue turn history)
  6. `conversation_turns_fts` (FTS5 conversation search)
  7. `sessions` (Session metadata, token metrics, agent delegation tracking)
  8. `tree_buffers` (Unsealed L0/L1 hierarchical summary buffers)
  9. `knowledge_nodes` (Domain concepts & mastery tracking 0.0 to 1.0)
  10. `knowledge_edges` (Ontological links: `Uses`, `Replaces`, `Extends`, `DependsOn`)
  11. `schema_version` (Database migration ledger)
- `memory_engine/src/repository/node_repo.rs` — CRUD for memory nodes with transaction safety.
- `memory_engine/src/repository/edge_repo.rs` — Graph edge creation and neighbor querying.
- `memory_engine/src/repository/conversation_repo.rs` — Conversation turn ingestion and session management.
- `memory_engine/src/repository/graph_repo.rs` — Knowledge graph nodes and typed edge traversal.

#### 🧪 4 Automated CLI Verification Commands
```bash
# 1. Compile the Rust memory engine crate
cargo check --manifest-path /home/gopi/Downloads/JARVIS-V0/memory_engine/Cargo.toml

# 2. Run repository unit tests (Schema creation, CRUD, and FTS5 triggers)
cargo test --manifest-path /home/gopi/Downloads/JARVIS-V0/memory_engine/Cargo.toml --lib repository

# 3. Verify SQLite WAL database initialization and tables
sqlite3 ~/.jarvis/memory/memory.db ".tables"

# 4. Verify FTS5 virtual table synchronization triggers
sqlite3 ~/.jarvis/memory/memory.db "SELECT name, type FROM sqlite_master WHERE type='table' AND name LIKE '%fts%';"
```

#### 🎙️ Manual & Hands-Free Voice Commands
- **Command 1**: *"Jarvis, check memory storage status."* (Expect: System reports `memory.db` initialized with 11 tables in WAL mode).
- **Command 2**: *"Jarvis, remember that my preferred editor is Neovim."* (Expect: Stores memory node in Tier 2 Persistent Vault).
- **Command 3**: *"Jarvis, what is my preferred editor?"* (Expect: Recalls Neovim directly from SQLite repo).
- **Command 4**: *"Jarvis, show database schema version."* (Expect: Returns schema version 1).

#### 🏁 Phase 1 Sign-Off Gate
> **User Review Signal**: Run the 4 checks $\to$ Test voice commands $\to$ Reply: `"Phase 1 done"` or `"Phase 2 start"`.

---

### 🛡️ Phase 2: Pre-Write Secret Scanner Gate & Real-Time Obsidian Vault Projection

#### 🎯 Goal
Implement the pre-write security barrier that blocks secret/credential leakage (15+ regex patterns) and build the asynchronous Obsidian vault generator that projects all SQLite writes to formatted markdown files with YAML frontmatter and bidirectional `[[wikilinks]]`.

#### 📁 Files & Components
- `memory_engine/src/security/secret_scanner.rs` — Regex patterns detecting: OpenAI (`sk-...`), Anthropic (`sk-ant-...`), Google (`AIza...`), AWS (`AKIA...`), GitHub PAT (`ghp_...`), Slack/Discord Webhooks, PEM Private Keys, and Bearer/JWT tokens. Aborts writes and returns `SecretDetectedError`.
- `memory_engine/src/vault/mod.rs` — Vault projection module root.
- `memory_engine/src/vault/frontmatter.rs` — Serializes YAML frontmatter (`id`, `kind`, `tier`, `importance`, `created`, `tags`, `aliases`).
- `memory_engine/src/vault/writer.rs` — Generates Markdown notes under `~/.jarvis/memory/vault/{kind}/{id}.md` and `~/.jarvis/memory/vault/knowledge/{kind}/{name}.md` with clickable Obsidian `[[wikilinks]]`.
- `memory_engine/src/vault/bootstrap.rs` — Auto-creates `.obsidian/app.json`, `.obsidian/graph.json` so Obsidian can open `~/.jarvis/memory/vault/` out-of-the-box.

#### 🧪 4 Automated CLI Verification Commands
```bash
# 1. Run Secret Scanner test suite (Ensures all 15+ secret patterns are blocked)
cargo test --manifest-path /home/gopi/Downloads/JARVIS-V0/memory_engine/Cargo.toml test_secret_scanner

# 2. Run Obsidian Vault Writer integration tests
cargo test --manifest-path /home/gopi/Downloads/JARVIS-V0/memory_engine/Cargo.toml test_vault_writer

# 3. Verify real Markdown files generated in the Obsidian vault directory
ls -la ~/.jarvis/memory/vault/

# 4. Verify Obsidian frontmatter and wikilinks formatting on a generated node
head -n 25 ~/.jarvis/memory/vault/facts/*.md 2>/dev/null || echo "Vault initialized and ready for writes"
```

#### 🎙️ Manual & Hands-Free Voice Commands
- **Command 1**: *"Jarvis, remember my OpenAI key is sk-1234567890abcdef1234567890abcdef."* (Expect: Write **blocked** with security alert: *"Secret detected. Memory write rejected to protect credentials."*).
- **Command 2**: *"Jarvis, remember that project Orion uses Rust and React 19."* (Expect: Stores cleanly; Obsidian file created in `~/.jarvis/memory/vault/decisions/` with `[[Rust]]` and `[[React 19]]` wikilinks).
- **Command 3**: *"Jarvis, open memory vault in Obsidian."* (Expect: Opens `~/.jarvis/memory/vault/` in Obsidian or file manager).
- **Command 4**: *"Jarvis, verify vault integrity."* (Expect: Zero split-brain desync between SQLite records and Markdown files).

#### 🏁 Phase 2 Sign-Off Gate
> **User Review Signal**: Run the 4 checks $\to$ Test voice commands $\to$ Reply: `"Phase 2 done"` or `"Phase 3 start"`.

---

### 🔍 Phase 3: 4-Signal Zero-Hallucination Hybrid Search Engine

#### 🎯 Goal
Build the mathematical 4-signal retrieval pipeline combining FTS5 BM25 lexical scoring, float32 Vector Cosine similarity with MMR diversity deduplication, Knowledge Graph neighborhood expansion, and Ebbinghaus Recency decay.

#### 📁 Files & Components
- `memory_engine/src/search/fts5_search.rs` — BM25 ranking across `memory_nodes_fts` and `conversation_turns_fts`.
- `memory_engine/src/search/vector_search.rs` — Dot product / Cosine similarity over IEEE 754 float32 embedding arrays + Maximal Marginal Relevance (MMR) for result diversity.
- `memory_engine/src/search/graph_search.rs` — 1-hop and 2-hop graph traversal to pull contextual parent/child and related entity nodes.
- `memory_engine/src/search/recency_scorer.rs` — Exponential decay scoring: $S_{\text{recency}} = e^{-\lambda \cdot \Delta t_{\text{days}}}$.
- `memory_engine/src/search/hybrid_ranker.rs` — 4-Signal weighted fusion formula:
  $$\text{Score} = w_v \cdot \text{Vector} + w_k \cdot \text{BM25} + w_g \cdot \text{Graph} + w_r \cdot \text{Recency}$$
- `memory_engine/src/search/profiles.rs` — Pre-tuned weight profiles:
  - `balanced`: $w_v=0.35, w_k=0.25, w_g=0.20, w_r=0.20$
  - `semantic`: $w_v=0.55, w_k=0.15, w_g=0.15, w_r=0.15$
  - `lexical`: $w_v=0.15, w_k=0.55, w_g=0.15, w_r=0.15$
  - `graph_first`: $w_v=0.15, w_k=0.15, w_g=0.55, w_r=0.15$

#### 🧪 4 Automated CLI Verification Commands
```bash
# 1. Run FTS5 BM25 search unit tests
cargo test --manifest-path /home/gopi/Downloads/JARVIS-V0/memory_engine/Cargo.toml test_fts5_search

# 2. Run Vector Cosine + MMR diversity tests
cargo test --manifest-path /home/gopi/Downloads/JARVIS-V0/memory_engine/Cargo.toml test_vector_search

# 3. Run Hybrid 4-Signal Ranker integration test
cargo test --manifest-path /home/gopi/Downloads/JARVIS-V0/memory_engine/Cargo.toml test_hybrid_ranker

# 4. Benchmark search latency (Must execute in < 50ms)
cargo test --manifest-path /home/gopi/Downloads/JARVIS-V0/memory_engine/Cargo.toml --release bench_hybrid_search -- --nocapture
```

#### 🎙️ Manual & Hands-Free Voice Commands
- **Command 1**: *"Jarvis, recall everything about Project Orion."* (Expect: Hybrid search returns decisions, tech stack, and linked entities with sub-50ms latency).
- **Command 2**: *"Jarvis, what did we decide about the database yesterday?"* (Expect: Recency-weighted hybrid search pinpoints the exact SQLite decision).
- **Command 3**: *"Jarvis, search memory for keyword Neovim."* (Expect: Lexical FTS5 search finds exact match).
- **Command 4**: *"Jarvis, find concepts related to Rust async."* (Expect: Graph search traverses `DependsOn` and `Uses` edges to return relevant patterns).

#### 🏁 Phase 3 Sign-Off Gate
> **User Review Signal**: Run the 4 checks $\to$ Test voice commands $\to$ Reply: `"Phase 3 done"` or `"Phase 4 start"`.

---

### 🌲 Phase 4: Hierarchical Memory Tree Engine (L0 $\to$ L1 $\to$ L2 Compaction)

#### 🎯 Goal
Implement the continuous memory consolidation hierarchy that prevents context overflow: L0 raw leaf chunks accumulate in unsealed buffers, automatically trigger cascade sealing at capacity (8 items) to generate L1 summaries, and roll up into L2 root summaries with periodic 30-minute stale flush workers.

#### 📁 Files & Components
- `memory_engine/src/tree/buffer.rs` — Leaf accumulator (`tree_buffers` table): tracks unsealed node IDs per `tree_scope` (`session:xxx`, `topic:xxx`).
- `memory_engine/src/tree/seal.rs` — Cascade seal logic: when count $\ge$ 8, triggers summarization, creates parent-child edges, and pushes L1 node to higher-level buffer.
- `memory_engine/src/tree/flush.rs` — Periodic background timer (30 minutes) to seal idle buffers.
- `memory_engine/src/tree/summarizer.rs` — LLM summarization pipeline using Gemini API with structured JSON output.
- `memory_engine/src/tree/retrieval.rs` — Tree-walk drill-down algorithm (L2 $\to$ L1 $\to$ L0) for comprehensive hierarchical context assembly.

#### 🧪 4 Automated CLI Verification Commands
```bash
# 1. Run Memory Tree Buffer append and capacity tests
cargo test --manifest-path /home/gopi/Downloads/JARVIS-V0/memory_engine/Cargo.toml test_tree_buffer_seal

# 2. Run Cascade Sealing (L0 -> L1 -> L2) hierarchy test
cargo test --manifest-path /home/gopi/Downloads/JARVIS-V0/memory_engine/Cargo.toml test_tree_cascade

# 3. Run Stale Buffer Flush timer test
cargo test --manifest-path /home/gopi/Downloads/JARVIS-V0/memory_engine/Cargo.toml test_tree_stale_flush

# 4. Verify tree buffer state in SQLite
sqlite3 ~/.jarvis/memory/memory.db "SELECT tree_scope, level, capacity, max_capacity FROM tree_buffers;"
```

#### 🎙️ Manual & Hands-Free Voice Commands
- **Command 1**: *"Jarvis, summarize our recent work session."* (Expect: Reads L1/L2 summary directly from memory tree without re-reading 50+ raw turns).
- **Command 2**: *"Jarvis, flush memory buffers now."* (Expect: Manually triggers cascade seal and confirms buffers consolidated).
- **Command 3**: *"Jarvis, show memory tree depth."* (Expect: Reports current hierarchy levels: L0 leaf count, L1 session summaries, L2 root milestones).
- **Command 4**: *"Jarvis, drill down into yesterday's architecture discussion."* (Expect: Tree-walk retrieves L1 summary and fetches precise L0 child turns on demand).

#### 🏁 Phase 4 Sign-Off Gate
> **User Review Signal**: Run the 4 checks $\to$ Test voice commands $\to$ Reply: `"Phase 4 done"` or `"Phase 5 start"`.

---

### ⚡ Phase 5: High-Performance Server Protocols (Axum REST/WS + MCP Server)

#### 🎯 Goal
Build the communication surfaces: high-speed Axum HTTP/WebSocket API server on port 50051 for internal JARVIS agents and UI WebGL graph, plus standard Model Context Protocol (MCP) `stdio` server for external AI coding tools (Claude Code, Antigravity, Cursor, Codex).

#### 📁 Files & Components
- `memory_engine/src/main.rs` — CLI daemon runner (`--port 50051`, `--mcp-stdio`, `--daemon`).
- `memory_engine/src/server/mod.rs` & `memory_engine/src/server/routes.rs` — Axum REST endpoints:
  - `POST /api/memory/remember` (Store fact/decision/lesson)
  - `POST /api/memory/recall` (4-Signal Hybrid Search)
  - `POST /api/memory/forget` (Soft-delete / supersede)
  - `GET /api/memory/graph` (Export nodes & edges for WebGL visualization)
  - `POST /api/memory/context` (Get frozen prompt snapshot)
  - `GET /api/memory/health` (Health & stats probe)
  - `GET /api/memory/ws` (WebSocket live event stream for UI graph updates)
- `memory_engine/src/mcp/mod.rs` & `memory_engine/src/mcp/tools.rs` — Standard MCP stdio interface exposing:
  - `jarvis_remember`, `jarvis_recall`, `jarvis_search`, `jarvis_forget`, `jarvis_graph_query`, `jarvis_context`, `jarvis_log_turn`.

#### 🧪 4 Automated CLI Verification Commands
```bash
# 1. Build and run memory engine binary
cargo build --manifest-path /home/gopi/Downloads/JARVIS-V0/memory_engine/Cargo.toml --release

# 2. Test Health endpoint via curl
curl -s http://localhost:50051/api/memory/health | jq .

# 3. Test Remember endpoint via curl
curl -s -X POST http://localhost:50051/api/memory/remember \
  -H "Content-Type: application/json" \
  -d '{"content":"Testing API remember functionality","kind":"fact","tier":1,"importance":0.8}' | jq .

# 4. Test MCP stdio list_tools response
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | /home/gopi/Downloads/JARVIS-V0/memory_engine/target/release/jarvis-memory-engine --mcp-stdio | jq .
```

#### 🎙️ Manual & Hands-Free Voice Commands
- **Command 1**: *"Jarvis, check memory engine daemon health."* (Expect: *"Memory daemon online at port 50051, latency 2ms, zero errors."*).
- **Command 2**: *"Jarvis, ping external MCP memory server."* (Expect: Confirms MCP stdio handler active with 7 tools registered).
- **Command 3**: *"Jarvis, export memory graph metrics."* (Expect: Returns node count, edge count, and active connections).
- **Command 4**: *"Jarvis, list registered MCP memory tools."* (Expect: Enumerates `jarvis_remember`, `jarvis_recall`, `jarvis_search`, etc.).

#### 🏁 Phase 5 Sign-Off Gate
> **User Review Signal**: Run the 4 checks $\to$ Test voice commands $\to$ Reply: `"Phase 5 done"` or `"Phase 6 start"`.

---

### 🔗 Phase 6: TypeScript Client, Frozen Prompt Snapshot & EventBus Wiring

#### 🎯 Goal
Integrate the Rust memory daemon into the JARVIS-V0 TypeScript ecosystem (`server.ts`, `src/core/event_bus.ts`, `src/server/ws_handler.ts`), deprecate old naive SQLite tables in `src/db/db.ts`, and implement the Hermes Frozen Prompt Snapshot pattern to preserve LLM KV prefix cache.

#### 📁 Files & Components
- `src/memory/types.ts` — TypeScript types matching the Rust API (`MemoryNode`, `MemoryEdge`, `HybridSearchQuery`, `GraphExport`).
- `src/memory/client.ts` — High-speed HTTP/WebSocket client wrapper connecting to `localhost:50051` with auto-reconnect and fallback.
- `src/memory/context-builder.ts` — Generates frozen `[SYSTEM MEMORY SNAPSHOT]` on session boot.
- `src/memory/turn-logger.ts` — Intercepts conversation turns and asynchronously pushes to `conversation_repo`.
- `src/memory/embedding-provider.ts` — Gemini `text-embedding-004` / `embedding-2` with local cache.
- `src/db/db.ts` — **[MODIFY]** Remove legacy `memories` table, keep `tasks`/`audit_logs`/`configs`, redirect memory operations to `src/memory/client.ts`.
- `src/core/event_bus.ts` — **[MODIFY]** Register memory event channels (`memory:created`, `memory:recalled`, `memory:graph_updated`).
- `server.ts` — **[MODIFY]** Add startup probe: checks memory daemon connection on port 50051 and logs status.

#### 🧪 4 Automated CLI Verification Commands
```bash
# 1. Type-check TypeScript codebase with new memory client
npx tsc --noEmit

# 2. Run TypeScript client unit test (Tests connection, recall, and context builder)
npx tsx -e "import { memoryClient } from './src/memory/client'; memoryClient.getHealth().then(console.log).catch(console.error);"

# 3. Test Frozen System Prompt snapshot generation
npx tsx -e "import { buildSystemPromptSnapshot } from './src/memory/context-builder'; buildSystemPromptSnapshot('test-sess').then(console.log);"

# 4. Verify JARVIS-V0 dev server boots cleanly and detects memory engine
npm run build
```

#### 🎙️ Manual & Hands-Free Voice Commands
- **Command 1**: *"Jarvis, initialize new conversation session."* (Expect: Logs session start and compiles frozen prompt snapshot).
- **Command 2**: *"Jarvis, what are my core system directives?"* (Expect: Instantly answered from frozen prompt snapshot without cache miss).
- **Command 3**: *"Jarvis, remember my favorite programming language is TypeScript."* (Expect: Dispatched via EventBus to Rust daemon; turns logged seamlessly).
- **Command 4**: *"Jarvis, check memory client connectivity."* (Expect: *"Memory client connected to localhost:50051 with 0ms latency."*).

#### 🏁 Phase 6 Sign-Off Gate
> **User Review Signal**: Run the 4 checks $\to$ Test voice commands $\to$ Reply: `"Phase 6 done"` or `"Phase 7 start"`.

---

### 🔄 Phase 7: Background Auto-Capture, Git Inotify Watcher & Lifelong Learning

#### 🎯 Goal
Implement continuous autonomous memory capture: inotify Git commit watcher, token/turn-threshold Archivist auto-consolidation, and daily Ebbinghaus recency decay with soft-superseding.

#### 📁 Files & Components
- `memory_engine/src/workers/git_watcher.rs` — Inotify file watcher on `.git/refs/heads/`. On `git commit`, automatically parses commit message, author, diff summary, and modified files, inserting a `decision` node with `source='git'`.
- `memory_engine/src/workers/archivist.rs` — Threshold worker: monitors session activity. When $\ge 50\text{k}$ tokens, $\ge 10$ tool calls, or $\ge 5$ turns occur, triggers memory tree consolidation and extracts persistent insights.
- `memory_engine/src/workers/decay_worker.rs` — Daily decay worker: applies Ebbinghaus forgetting curve. Pinned memories ($\lambda=0$) never decay; transient items decay over 30–90 days. Outdated nodes are linked via `superseded_by`.
- `memory_engine/src/workers/vault_sync.rs` — Periodic reconciliation verifying 100% parity between SQLite WAL and Obsidian Markdown files.

#### 🧪 4 Automated CLI Verification Commands
```bash
# 1. Run Git Inotify Watcher unit tests
cargo test --manifest-path /home/gopi/Downloads/JARVIS-V0/memory_engine/Cargo.toml test_git_watcher

# 2. Run Archivist Auto-Consolidation threshold tests
cargo test --manifest-path /home/gopi/Downloads/JARVIS-V0/memory_engine/Cargo.toml test_archivist_worker

# 3. Run Ebbinghaus Memory Decay & Soft-Superseding tests
cargo test --manifest-path /home/gopi/Downloads/JARVIS-V0/memory_engine/Cargo.toml test_decay_worker

# 4. Trigger manual Vault Synchronization reconciliation check
cargo test --manifest-path /home/gopi/Downloads/JARVIS-V0/memory_engine/Cargo.toml test_vault_reconciliation
```

#### 🎙️ Manual & Hands-Free Voice Commands
- **Command 1**: *"Jarvis, what was the last Git commit I made?"* (Expect: Recalls commit hash, message, and changed files captured automatically).
- **Command 2**: *"Jarvis, trigger archivist consolidation."* (Expect: Scans uncompacted turns, extracts key lessons, and seals memory tree).
- **Command 3**: *"Jarvis, run daily memory decay pass."* (Expect: Updates importance weights and soft-archives stale temporary facts).
- **Command 4**: *"Jarvis, show auto-captured activity from today."* (Expect: Summarizes Git commits, terminal actions, and conversation decisions).

#### 🏁 Phase 7 Sign-Off Gate
> **User Review Signal**: Run the 4 checks $\to$ Test voice commands $\to$ Reply: `"Phase 7 done"` or `"Phase 8 start"`.

---

### 🌌 Phase 8: OpenHuman-Style Interactive WebGL Memory Graph (Pixi.js + D3-Force)

#### 🎯 Goal
Build the 60fps Obsidian-style interactive force-directed visual graph in React 19 using Pixi.js (v8) WebGL with D3-Force physics, 8 color-coded node types, halo glow passes, 4 view modes, live search highlight, and SVG Web Worker fallback.

#### 📁 Files & Components
- `package.json` — Add dependencies: `pixi.js@^8.18.1`, `d3-force@^3.0.0`, `@types/d3-force@^3.0.10`.
- `src/components/memory-graph/types.ts` — `GraphNode`, `GraphEdge`, `GraphMode` (`tree` | `entities` | `knowledge` | `timeline`), `SimNode`, `SimLink`.
- `src/components/memory-graph/memoryGraphLayout.ts` — Physics simulation, 8 node color tokens (`#8B5CF6` Root, `#34C77B` Knowledge, `#4A83DD` Persistent, `#A78BFA` Entity, `#1FB6C7` Conversation, `#F97316` Working, `#F43F5E` Session, `#94A3B8` Chunk), node radius sizing, glow flags, hit-testing, and WebGL support detection.
- `src/components/memory-graph/pixiGraphRenderer.ts` — High-performance WebGL draw loop: Barnes-Hut quadtree physics, halo glow pass ($\alpha=0.18$), solid fill pass, point-anchored exponential zoom, node drag & pin physics, dirty-flag render optimization.
- `src/components/memory-graph/svgForceLayout.worker.ts` & `src/components/memory-graph/useSvgForceLayout.ts` — Off-thread SVG fallback for non-WebGL/headless environments.
- `src/components/memory-graph/MemoryControls.tsx` — Glassmorphism HUD controls: mode switcher, search filter, tier toggles, zoom controls, and reset view.
- `src/components/memory-graph/MemoryNodePreview.tsx` — Slide-over markdown inspection panel showing node content, metadata, linked wikilinks, and edit/delete actions.
- `src/components/memory-graph/MemoryGraph.tsx` — Master container switching between WebGL and SVG with live WebSocket updates.
- `src/pages/BrainPage.tsx` & `src/components/jarvis/views/MemoryView.tsx` — Integrate visual graph into JARVIS HUD navigation.

#### 🧪 4 Automated CLI Verification Commands
```bash
# 1. Install frontend visualization dependencies
npm install pixi.js@^8.18.1 d3-force@^3.0.0 @types/d3-force@^3.0.10

# 2. Verify TypeScript compilation of WebGL renderer & components
npx tsc --noEmit

# 3. Verify Vite production build including WebGL and Web Worker bundles
npm run build

# 4. Verify live WebSocket stream between Rust memory engine and frontend
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Host: localhost:50051" -H "Origin: http://localhost:3000" http://localhost:50051/api/memory/ws
```

#### 🎙️ Manual & Hands-Free Voice Commands
- **Command 1**: *"Jarvis, open visual brain graph."* (Expect: Navigates to Brain page; WebGL canvas renders 60fps interactive memory graph).
- **Command 2**: *"Jarvis, switch graph mode to Knowledge Entities."* (Expect: Smoothly transitions force-directed layout to entity-relationship view).
- **Command 3**: *"Jarvis, highlight node Project Orion on graph."* (Expect: Zooms to and glows the Project Orion node with halo glow).
- **Command 4**: *"Jarvis, show memory network statistics."* (Expect: Displays live node count, active links, and tier distribution on HUD).

#### 🏁 Phase 8 Sign-Off Gate
> **User Review Signal**: Run the 4 checks $\to$ Test voice commands $\to$ Reply: `"Phase 8 done - Universal Memory System Fully Operational!"`.

---

## 📊 Summary of Build Metrics

| Phase | Core Deliverables | New/Modified Files | Est. CLI Checks |
|:---:|---|:---:|:---:|
| **Phase 1** | Rust Crate, SQLite WAL Schema (11 tables), Repositories | 12 files | 4 commands |
| **Phase 2** | Pre-Write Secret Scanner (15+ patterns), Obsidian Real-Time Vault | 6 files | 4 commands |
| **Phase 3** | 4-Signal Hybrid Search (FTS5 + Vector + Graph + Recency) | 7 files | 4 commands |
| **Phase 4** | Hierarchical Memory Tree (L0 $\to$ L1 $\to$ L2), Cascade Sealing | 6 files | 4 commands |
| **Phase 5** | Axum REST/WebSocket Server + MCP Stdio Protocol Server | 6 files | 4 commands |
| **Phase 6** | TypeScript Client, Frozen Prompt Snapshot, EventBus Wiring | 8 files | 4 commands |
| **Phase 7** | Background Auto-Capture, Git Inotify Watcher, Archivist | 5 files | 4 commands |
| **Phase 8** | Pixi.js WebGL Interactive Graph, D3-Force Physics, Brain HUD | 10 files | 4 commands |
| **TOTAL** | **Full Autonomous Universal Memory & Context Subsystem** | **~60 files** | **32 checks** |

---

## 🎯 Next Immediate Action

Upon your approval of this implementation plan, we will start **Phase 1 (Rust Engine Core, SQLite WAL Schema & Multi-Tier Storage)** immediately!
