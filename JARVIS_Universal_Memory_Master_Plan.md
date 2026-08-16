# 🧠 JARVIS-V0 Universal Memory + Context System
## Master Architecture Blueprint & Developer Implementation Guide

> **Target System**: `/home/gopi/Downloads/JARVIS-V0/`  
> **Memory Root**: `~/.jarvis/memory/` (Dedicated, persistent storage outside workspace)  
> **Status**: Architecture Specification & Complete Planning Document (Pre-Implementation)

---

## 📑 Table of Contents

1. [Executive Summary & Vision](#1-executive-summary--vision)
2. [Multi-Agent Memory Audit & Extracted Patterns](#2-multi-agent-memory-audit--extracted-patterns)
3. [Continuous Growth Engine (Lifelong Learning)](#3-continuous-growth-engine-lifelong-learning)
4. [Storage Architecture: SQLite WAL + Obsidian Vault](#4-storage-architecture-sqlite-wal--obsidian-vault)
5. [Visual Memory Graph (OpenHuman WebGL + D3-Force)](#5-visual-memory-graph-openhuman-webgl--d3-force)
6. [Zero-Hallucination Retrieval & Prompt Architecture](#6-zero-hallucination-retrieval--prompt-architecture)
7. [Security Guardrails & Secret Interception](#7-security-guardrails--secret-interception)
8. [Communication Protocols (gRPC / HTTP / MCP)](#8-communication-protocols-grpc--http--mcp)
9. [Complete 8-Phase Implementation Roadmap](#9-complete-8-phase-implementation-roadmap)
10. [Verification, Quality Gates & Failure Modes](#10-verification-quality-gates--failure-modes)

---

## 1. Executive Summary & Vision

JARVIS-V0 requires a **Universal Memory and Context Layer** that guarantees:
- **Zero Hallucination & Confusion**: Facts are grounded in persistent cryptographic truth with multi-signal semantic verification.
- **Continuous Autonomous Growth**: The system learns from every conversation, Git commit, terminal interaction, and project decision without requiring manual maintenance.
- **Bi-Directional Visual Graph**: An interactive, Obsidian-style force-directed WebGL graph where both the user and JARVIS can explore, inspect, and edit connected nodes.
- **Cross-Platform Compatibility**: A single memory daemon that serves JARVIS native voice/task agents today, and easily exposes standard MCP tools to external agents (Claude Code, Antigravity, Cursor, Codex) tomorrow.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           JARVIS-V0 UNIFIED BRAIN                               │
├───────────────────────────────┬─────────────────────────────────────────────────┤
│        INGESTION & WATCHERS   │  • Real-time conversation turn logger           │
│                               │  • Git commit & inotify file change watchers    │
│                               │  • Periodic Archivist consolidation daemon      │
├───────────────────────────────┼─────────────────────────────────────────────────┤
│        MEMORY ENGINE CORE     │  • Hierarchical Memory Tree (L0 → L1 → L2)      │
│        (Rust / Tokio Daemon)  │  • Typed Knowledge Graph (8 nodes, 8 edges)     │
│                               │  • Secret Scanner write gate (15+ patterns)     │
│                               │  • 4-Signal Hybrid Search (Vector, BM25, Graph) │
├───────────────────────────────┼─────────────────────────────────────────────────┤
│        DUAL-PERSISTENCE       │  • SQLite WAL (Single Source of Truth)          │
│                               │  • Obsidian Vault (Real-time Markdown Projection│
├───────────────────────────────┼─────────────────────────────────────────────────┤
│        VISUALIZATION & UI     │  • Pixi.js (v8) 60fps WebGL Graph               │
│                               │  • d3-force physics + Web Worker SVG Fallback   │
└───────────────────────────────┴─────────────────────────────────────────────────┘
```

---

## 2. Multi-Agent Memory Audit & Extracted Patterns

By auditing 7 major assistant architectures, we identified both the golden standards to adopt and the critical bugs to eliminate:

| Agent | Architecture | Score | Gold Pattern Adopted | Fatal Flaw Avoided |
|---|---|:---:|---|---|
| **OpenHuman** | Rust `memory_tree` + WebGL graph | **9.5/10** | **Hierarchical Summary Cascade (L0 $\to$ L1 $\to$ L2)** & Dual Markdown/SQLite persistence | Brute-force $O(N)$ vector BLOB iteration |
| **zeroclaw** | Rust `crates/zeroclaw-memory` | **9.0/10** | **Typed Knowledge Graph** (`Decision`, `Pattern`, `Lesson`, `Uses`, `Replaces`) & Soft Superseding | Heavy multi-crate abstraction overhead |
| **Hermes** | Python `agent/context_compressor.py` | **8.0/10** | **Frozen Prompt Snapshot** (preserves KV prefix cache) + 4-phase context compaction | Character-based hard limits instead of tokens |
| **NemoClaw** | TypeScript `secret-scanner.ts` | **4.0/10** | **Pre-Write Secret Scanner Gate** (`before_tool_call`) | Ephemeral sandbox data loss on restart |
| **codebase-memory-mcp**| Pure C AST Graph | **3.0/10** | **Local Inotify Watchers & Zstd Snapshots** | Code-only scope; no conversation memory |
| **JARVIS-V1** | TypeScript + Python scripts | **5.0/10** | 3-Tier Deduplication (Exact $\to$ Jaccard $\to$ Cosine) | **Split-Brain Desync**, 15-turn hard cutoff, Windows paths |
| **Mark-L** | Python single JSON file | **2.0/10** | Pop-on-read morning briefing (`pop_last_session`) | 2,200 character hard cap; zero vector search |

---

## 3. Continuous Growth Engine (Lifelong Learning)

To ensure JARVIS grows seamlessly alongside the user over months and years without context degradation:

### 3.1 The 4-Tier Memory Hierarchy
1. **Tier 0 (Session RAM)**: Active conversation turns, sub-millisecond access.
2. **Tier 1 (Working Memory)**: Active tasks, scratchpad facts, and in-flight goal tracking.
3. **Tier 2 (Persistent Vault)**: Long-term user preferences, instructions, project decisions, and verified lessons.
4. **Tier 3 (Knowledge Base)**: Abstracted concepts, domain mastery models (0–100% progress score), and coding patterns.

### 3.2 Autonomic Lifecycle & Memory Compaction
```
[User Turn / Tool Action]
          │
          ▼
┌───────────────────┐      Exceeds Thresholds?
│   Real-Time Log   │ ──── (≥50k tokens / ≥10 tools / ≥5 turns) ────┐
│ (Turn Repository) │                                              │
└───────────────────┘                                              ▼
          │                                              ┌───────────────────┐
          │ (Buffer Full / 30m Idle)                     │  Archivist Daemon │
          ▼                                              │ (LLM Compression) │
┌───────────────────┐                                    └───────────────────┘
│ L0 Leaf Chunks    │                                              │
└───────────────────┘                                              ▼
          │ (Cascade Seal)                               ┌───────────────────┐
          ▼                                              │ Extract Decisions │
┌───────────────────┐                                    │ & Mastered Skills │
│ L1 Summaries      │                                    └───────────────────┘
└───────────────────┘                                              │
          │ (Cascade Seal)                                         ▼
          ▼                                              ┌───────────────────┐
┌───────────────────┐                                    │ Knowledge Graph & │
│ L2 Root Summaries │                                    │ Permanent Vault   │
└───────────────────┘                                    └───────────────────┘
```

### 3.3 Ebbinghaus Memory Decay & Garbage Collection
- **Importance Formula**: $\text{Importance}(t) = I_0 \cdot e^{-\lambda \cdot (t - t_{\text{last\_accessed}})}$
- Pinned memories (rules, core preferences) have $\lambda = 0$ (never decay).
- Fleeting details decay naturally over 30–90 days.
- **Soft Superseding**: Outdated facts are linked via `superseded_by` pointers rather than hard-deleted, preserving full historical auditability.

---

## 4. Storage Architecture: SQLite WAL + Obsidian Vault

To eliminate the split-brain desync bug from JARVIS-V1, we establish a **strict Single Source of Truth with Real-Time File Projection**:

### 4.1 SQLite WAL Database (`~/.jarvis/memory/memory.db`)
- `PRAGMA journal_mode = WAL;` (Concurrent non-blocking reads and writes)
- `PRAGMA synchronous = NORMAL;` (High write speed with crash safety)
- `PRAGMA foreign_keys = ON;`
- **11 Core Tables**:
  - `memory_nodes`: Hierarchical nodes (fact, conversation, decision, lesson, pattern, entity, chunk).
  - `memory_nodes_fts`: FTS5 full-text search with Unicode61 and Porter stemmer.
  - `memory_vectors`: Raw IEEE 754 float32 embeddings with model signature validation.
  - `memory_edges`: Relational graph links (`parent_child`, `references`, `derived_from`, `mentions`).
  - `conversation_turns` & `conversation_turns_fts`: Comprehensive dialogue history.
  - `sessions`: Session tracking, token usage, parent-child delegation lineage.
  - `tree_buffers`: Unsealed buffer accumulators for hierarchical summarization.
  - `knowledge_nodes`: Domain concepts and mastery tracking (0.0 to 1.0).
  - `knowledge_edges`: Typed ontological links (`Uses`, `Replaces`, `Extends`, `DependsOn`).
  - `schema_version`: Versioned database migration registry.

### 4.2 Real-Time Obsidian Vault Projection (`~/.jarvis/memory/vault/`)
- Every SQLite write triggers an asynchronous write to the Obsidian directory.
- Files formatted with standard Obsidian YAML frontmatter and bidirectional wikilinks:
```markdown
---
id: node-9f82b1c4
kind: decision
tier: 2
importance: 0.95
created: 2026-08-16T08:00:00Z
tags: [architecture, memory, rust]
---

# Decision: Rust Core + TypeScript Layer

Decided to implement the memory engine core in Rust for performance and expose it via gRPC/MCP to TypeScript.

## Links
- [[Pattern-Dual-Persistence]]
- [[Session-2026-08-16]]
- [[OpenHuman-Reference]]
```

---

## 5. Visual Memory Graph (OpenHuman WebGL + D3-Force)

Modeled directly after OpenHuman's production-proven visualization stack:

```
                  ┌──────────────────────────────┐
                  │    MemoryGraph Container     │
                  │ (React State & Mode Routing) │
                  └──────────────┬───────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 │ WebGL Context Supported?      │
                 ├───────────────┬───────────────┤
             [YES]              [NO] (Headless / Fallback)
                 │                               │
                 ▼                               ▼
      ┌──────────────────────┐        ┌──────────────────────┐
      │ PixiGraph (Pixi.js)  │        │ SVG Graph Container  │
      │ • GPU Render Loop    │        │ • Web Worker Thread  │
      │ • 1000+ Nodes @ 60fps│        │ • Direct DOM cx/cy   │
      │ • Halo Glow Passes   │        │ • Off-Thread Physics │
      └──────────────────────┘        └──────────────────────┘
```

### 5.1 Visualization Features & Palette
- **8 Color-Coded Node Types**:
  - `root`: Purple (`#8B5CF6`, 24px radius) — Central Brain Hub
  - `knowledge`: Emerald (`#34C77B`, 12px radius) — Core Concepts & Mastery
  - `persistent`: Ocean Blue (`#4A83DD`, 10px radius) — Long-Term Vault
  - `entity`: Violet (`#A78BFA`, 9px radius) — People, Tools, Repositories
  - `conversation`: Teal (`#1FB6C7`, 9px radius) — Session Threads
  - `working`: Orange (`#F97316`, 8px radius) — Active Context
  - `session`: Rose (`#F43F5E`, 7px radius) — Hot Session Turns
  - `chunk`: Slate (`#94A3B8`, 3px radius) — Raw Data Leaves
- **Glow Halos**: Structural nodes render a subtle outer halo (`alpha = 0.18`), while raw chunks stay flat to keep the screen uncluttered.
- **4 View Modes**: `tree` (hierarchy), `entities` (knowledge graph), `knowledge` (mastery map), `timeline` (chronological session flow).
- **Interactive Controls**: Drag to move (pins physics), scroll to zoom (exponential point-anchored), click to preview Markdown in sidebar, live search highlight.

---

## 6. Zero-Hallucination Retrieval & Prompt Architecture

To ensure the LLM never hallucinates or loses instructions:

### 6.1 4-Signal Hybrid Retrieval
Every recall query scores candidates across 4 distinct mathematical signals:
$$\text{Score} = w_v \cdot \text{Cosine}(\vec{q}, \vec{v}) + w_k \cdot \text{BM25}(q, d) + w_g \cdot \text{GraphCentrality}(d) + w_r \cdot e^{-\lambda \cdot \Delta t}$$

- **Balanced Profile**: $w_v = 0.35, w_k = 0.25, w_g = 0.20, w_r = 0.20$
- **Semantic Profile**: $w_v = 0.55, w_k = 0.15, w_g = 0.15, w_r = 0.15$
- **MMR (Maximal Marginal Relevance)**: Eliminates duplicate/redundant facts in the top-$K$ results.

### 6.2 The Frozen Prompt Snapshot Pattern (Hermes Invariant)
- At session start, the top-$K$ facts are compiled into an immutable `[SYSTEM MEMORY SNAPSHOT]` block.
- In-session writes are persisted immediately to disk, but **do not mutate the active system prompt**.
- **Result**: 100% preservation of the LLM's Key-Value (KV) prefix cache $\to$ zero cache misses, lowest possible token cost, and sub-300ms voice response times.
- Mid-session queries use live tool calls (`jarvis_recall`) rather than polluting the system prompt.

---

## 7. Security Guardrails & Secret Interception

Derived from NemoClaw's `secret-scanner.ts` and zeroclaw's `ScannedMemory`:

1. **Pre-Write Interception Hook**: Every memory write passes through a regex security barrier before touching SQLite or Markdown files.
2. **Detection Signatures**:
   - OpenAI (`sk-...`), Anthropic (`sk-ant-...`), Google AI (`AIza...`)
   - AWS Access Keys (`AKIA...`), GitHub Personal Access Tokens (`ghp_...`)
   - Slack/Discord Webhooks, PEM Private Keys (`-----BEGIN RSA PRIVATE KEY-----`)
   - Bearer Tokens and JWT authorization headers.
3. **Action on Detection**: Aborts the write, logs an alert to `audit_logs`, and warns the user without corrupting persistent storage.

---

## 8. Communication Protocols

```
┌────────────────────────────────────────────────────────────┐
│                    JARVIS-V0 APPLICATION                   │
│      (Voice Agent, Task Queue, EDITH Coding Engine)        │
└─────────────────────────────┬──────────────────────────────┘
                              │
                    [Internal gRPC / IPC]
                   (Port 50051 / Unix Socket)
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│                JARVIS MEMORY DAEMON (RUST)                 │
│   • SQLite WAL Engine         • Hybrid Search Pipeline     │
│   • Obsidian Vault Generator  • Memory Tree Cascade        │
└─────────────────────────────┬──────────────────────────────┘
                              │
                      [Standard MCP Stdio]
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│                  EXTERNAL AI AGENTS & TOOLS                │
│    (Claude Code, Antigravity, Cursor, Codex, OpenCode)     │
└────────────────────────────────────────────────────────────┘
```

- **Internal (JARVIS Agents)**: High-speed gRPC / IPC communication via Protocol Buffers.
- **External (Other Coding Tools)**: Standard Model Context Protocol (MCP) server over `stdio` exposing tools: `jarvis_remember`, `jarvis_recall`, `jarvis_search`, `jarvis_forget`, `jarvis_graph_query`, `jarvis_context`.

---

## 9. Complete 8-Phase Implementation Roadmap

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ Phase 1 │ ──► │ Phase 2 │ ──► │ Phase 3 │ ──► │ Phase 4 │
│ SQLite  │     │ Secret  │     │ Hybrid  │     │ Memory  │
│ Schema  │     │ Scanner │     │ Search  │     │ Tree    │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
     │
     ▼
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ Phase 5 │ ──► │ Phase 6 │ ──► │ Phase 7 │ ──► │ Phase 8 │
│ gRPC &  │     │ TS Node │     │ Auto-   │     │ Visual  │
│ MCP Srv │     │ Client  │     │ Capture │     │ Graph   │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
```

### Phase 1: Rust Engine Foundation & SQLite WAL Schema
- Scaffold `memory_engine/` crate.
- Implement `schema.rs` with 11 relational & virtual FTS5 tables.
- Build connection pooling with WAL mode, normal synchrony, and 15s busy timeout.
- Implement core CRUD repositories (`node_repo`, `edge_repo`, `conversation_repo`, `graph_repo`).

### Phase 2: Secret Scanner & Obsidian Real-Time Projection
- Implement `secret_scanner.rs` with 15+ regex credential signatures.
- Build `vault/writer.rs` and `vault/frontmatter.rs` to generate Obsidian `.md` notes and wikilinks.
- Implement directory bootstrapper creating `.obsidian/` configuration files.

### Phase 3: 4-Signal Hybrid Search Engine
- Implement FTS5 BM25 text search (`fts5_search.rs`).
- Implement raw float32 vector cosine similarity search with MMR diversity (`vector_search.rs`).
- Implement graph neighborhood expansion (`graph_search.rs`).
- Build `hybrid_ranker.rs` with weight profile presets (`balanced`, `semantic`, `lexical`, `graph_first`).

### Phase 4: Hierarchical Memory Tree Engine
- Build leaf buffer accumulators (`tree/buffer.rs`).
- Implement cascade sealing triggers at capacity limit (`tree/seal.rs`).
- Implement periodic stale buffer flush daemon (`tree/flush.rs`).
- Implement LLM summarizer prompting to generate L1/L2 summaries.

### Phase 5: gRPC & MCP Server Protocol Surfaces
- Define `proto/memory.proto` interface.
- Implement tonic gRPC server on `127.0.0.1:50051`.
- Implement standalone MCP stdio server with tools (`jarvis_remember`, `jarvis_recall`, etc.).

### Phase 6: TypeScript Client & JARVIS-V0 Integration
- Create `src/memory/client.ts` gRPC client bridge.
- Build `context-builder.ts` for frozen system prompt generation.
- Implement `turn-logger.ts` and wire into `src/core/event_bus.ts`.
- Add health check probe in `server.ts`.

### Phase 7: Background Auto-Capture & Inotify Watchers
- Implement Git watcher (`git_watcher.rs`) monitoring `.git/refs/heads/` to capture commit messages and diffs.
- Implement Archivist background worker triggering auto-consolidation when token thresholds cross.
- Implement daily importance decay worker.

### Phase 8: Visual Memory Graph (Pixi.js WebGL + D3-Force)
- Install `pixi.js` (v8) and `d3-force` in `package.json`.
- Implement `memoryGraphLayout.ts` with color tokens, node radii, and force simulation.
- Implement `pixiGraphRenderer.ts` with dirty-flag WebGL draw loop and glow passes.
- Implement `svgForceLayout.worker.ts` and `useSvgForceLayout.ts` for headless/non-WebGL environments.
- Build `BrainPage.tsx` with graph view, stats, search, and node preview inspector.

---

## 10. Verification, Quality Gates & Failure Modes

### Automated Verification Pipeline
```bash
# 1. Verify Rust Engine Compiles & Tests Pass
cd /home/gopi/Downloads/JARVIS-V0/memory_engine
cargo test --all

# 2. Verify TypeScript Compiles Cleanly
cd /home/gopi/Downloads/JARVIS-V0
npm run lint

# 3. Verify End-to-End Daemon Connectivity
cargo run --release -- --port 50051 &
npm run dev
```

### Critical Quality Gates
1. **Zero Secret Leakage**: Attempting to store an OpenAI/Google API key MUST return a validation error and abort the write.
2. **Zero Split-Brain**: Every record in SQLite MUST have a corresponding valid markdown file in `~/.jarvis/memory/vault/`.
3. **Sub-50ms Search Latency**: Hybrid search queries over 50,000 nodes must complete in under 50 milliseconds.
4. **60 FPS Graph Performance**: The WebGL visual graph must sustain smooth panning and zooming with 1,000+ simultaneous nodes.
5. **Non-Destructive Vault Degradation**: If the memory daemon crashes, JARVIS-V0 falls back gracefully to local session memory without losing user conversations.

---
*Architectural Master Plan is complete and fully aligned with your system requirements.*
