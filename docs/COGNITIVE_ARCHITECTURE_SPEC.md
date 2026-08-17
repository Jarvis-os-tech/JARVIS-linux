# 🧠 J.A.R.V.I.S. Cognitive Nervous System & Autonomous Evolution — Master Specification

> **Document Version**: 2.0.0 — Production Blueprint  
> **Status**: Approved Architectural Master Specification  
> **Target Subsystem**: J.A.R.V.I.S. Prime Cognitive Core (`src/core/`, `src/memory/`, `workers_cpp/`, `gateway_rust/`)  
> **Architectural Doctrine**: Ephemeral Zero-Idle Footprint, Event-Driven Passive Context, Sub-Millisecond Reflexes, Ada-SI Capability Genesis, and Multi-Repo Synthesis.

---

## 🏛️ 1. System Overview & Macro Architecture

J.A.R.V.I.S. is a voice-first, single-user AI operating system and autonomous companion. This specification establishes the **Cognitive Nervous System & Evolution Engine**, transforming the existing agent framework into a continuously aware, proactively intelligent, self-reflecting, and safely self-extending AI operating system.

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        J.A.R.V.I.S. MASTER COGNITIVE PIPELINE                          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                      WORLD                                             │
│       (Desktop GUI, Mutter D-Bus, Mic Audio, Shell PTY, System /proc, Network)         │
│                                        │                                               │
│                                        ▼                                               │
│                        ARTIFICIAL NERVOUS SYSTEM                                       │
│          (Typed Event Bus + C++/Rust IPC + D-Bus Passive Event Listener)               │
│                                        │                                               │
│             ┌──────────────────────────┼──────────────────────────┐                    │
│             ▼                          ▼                          ▼                    │
│     LIVE WORLD STATE            CONTEXT ENGINE               REFLEX LAYER              │
│   (Active App, Task,       (Model-Aware Token Budget,    (Sub-LLM Instant Actuation:   │
│    Tools, Telemetry)        Knapsack Pruning, Delta)      Audio Cutoff, Tripwires)     │
│             │                          │                          │                    │
│             └──────────────────────────┼──────────────────────────┘                    │
│                                        ▼                                               │
│                                  JARVIS PRIME                                          │
│                                (CEO Router Mesh)                                       │
│                                        │                                               │
│                  ┌─────────────────────┼─────────────────────┐                         │
│                  ▼                     ▼                     ▼                         │
│               FRIDAY                 EDITH                 ULTRON                      │
│            (Research/News)       (Coder/Architect)     (Security/Reflex)               │
│                  │                     │                     │                         │
│                  └─────────────────────┼─────────────────────┘                         │
│                                        ▼                                               │
│                                  SYSTEM ACTION                                         │
│                      (C++ Workers, Wayland ydotool, Browser)                           │
│                                        │                                               │
│                                        ▼                                               │
│                              OBSERVATION & RESULT                                      │
│                                        │                                               │
│                                        ▼                                               │
│                               EXPERIENCE MEMORY                                        │
│               (Situation, Decision, Action, Result, Error, Fix, Lesson)                │
│                                        │                                               │
│                                        ▼                                               │
│                               CONTINUOUS LEARNING                                      │
│                      (System-Wide Reflection & Ledger)                                 │
│                                        │                                               │
│             ┌──────────────────────────┴──────────────────────────┐                    │
│             ▼                                                     ▼                    │
│    ADAPTIVE STRATEGY                                      CAPABILITY FORGE             │
│ (Dynamic Routing & Benchmarks)                        (Ada-SI + bwrap Sandboxing)      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🧬 2. Cross-Repository Architectural Synthesis

This specification synthesizes proven design patterns from 11 top-tier open-source autonomous agent architectures:

| Reference Project | Key Architectural Pattern Integrated | Target Subsystem in J.A.R.V.I.S. |
| :--- | :--- | :--- |
| **[Ada-SI](https://github.com/nazirlouis/Ada-SI)** | Dynamic Capability Gap Analysis, Autonomous Tool Genesis, and 7-stage promotion lifecycle | `src/core/capability_forge.ts` |
| **[public-apis](https://github.com/public-apis/public-apis)** | Curated offline index of 1,400+ zero-auth/free public APIs for instant capability discovery | `data/public_apis.db` |
| **[cloudflare/computer](https://github.com/cloudflare/computer)** | Ephemeral micro-sandboxes with zero resident RAM footprint and strict boundary isolation | `src/core/sandbox_runner.ts` (`bwrap`) |
| **[Agent-Zero](https://github.com/agent0ai/agent-zero)** | Subordinate agent hierarchies, on-demand tool synthesis, and structured experience logs | `src/core/context_engine.ts` |
| **[OpenHands](https://github.com/OpenHands/OpenHands)** | Immutable typed Action/Observation event stream and strict agent finite state machines | `src/core/event_bus.ts`, `src/core/nervous_system.ts` |
| **[xai-org/grok-build](https://github.com/xai-org/grok-build)** | High-throughput asynchronous queues, zero-copy audio buffers, and durable task checkpoints | `gateway_rust/`, `src/core/task_continuity.ts` |
| **[Agent-Zoey/Zoey](https://github.com/Agent-Zoey/Zoey)** | User rapport modeling, fatigue/attention tracking, and nuanced proactive engagement | `src/core/initiative_engine.ts` |
| **[JARVIS-OS V2](https://github.com/MAL19INDUSTRIES/JARVIS-OS-V.2)** | Sub-100ms voice pipeline, barge-in audio cutoffs, Mutter D-Bus hardware actuators | `src/core/reflex_layer.ts`, `workers_cpp/` |
| **[OpenMausBot](https://github.com/milind-soni/OpenMausBot)** | Low-level Wayland mouse/keyboard actuation and accessibility tree semantic coordinate mapping | `src/core/gui_actuator.ts`, `workers_cpp/` |

---

## ⚡ 3. Pillar A: Artificial Nervous System & Sub-Millisecond Reflex Layer

### 3.1 Event Hierarchy & Priority Routing
Every event in J.A.R.V.I.S. is an immutable, strongly-typed envelope processed according to strict priority tiers:

```typescript
export type EventPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL_REFLEX';

export interface SystemEvent<T = any> {
  id: string;
  type: string;
  source: 'USER' | 'SYSTEM' | 'AGENT' | 'HARDWARE' | 'NETWORK' | 'SENSOR';
  priority: EventPriority;
  timestamp: number;
  payload: T;
  correlationId?: string;
}
```

```
[Incoming Event]
       │
       ├── CRITICAL_REFLEX ──► Sub-Millisecond Reflex Layer (Direct C++/Rust execution < 1ms)
       ├── HIGH            ──► JARVIS Prime Orchestrator (Immediate evaluation)
       ├── MEDIUM          ──► Specialist Department Queue (FRIDAY / EDITH / KAREN / ULTRON)
       └── LOW             ──► Telemetry Ring Buffer & SQLite Journal Log
```

### 3.2 Sub-Millisecond Reflex Layer (`src/core/reflex_layer.ts`)
Executes instant, sub-LLM actions using native C++ actuators and Rust audio bridges:
1. **Audio Barge-in Cutoff**: When user speech energy exceeds threshold in Rust CPAL gateway, audio output buffer is dropped in $< 5\text{ms}$.
2. **Thermal & Battery Tripwires**: Direct `/proc` and `upower` checks. If CPU $> 85^\circ\text{C}$ or Battery $< 10\%$, throttles background jobs and triggers emergency cooling protocols.
3. **Subprocess Watchdog**: Detects child process crashes via POSIX signals (`SIGCHLD`, `SIGSEGV`) and auto-recovers state in $< 50\text{ms}$.
4. **Task Timeout Watchdog**: Interrupts runaway commands without hanging the core orchestrator.

### 3.3 Agent Finite State Machine (8 States)
```text
  ┌──────────┐
  │   IDLE   │◄─────────────────────────────┐
  └────┬─────┘                              │
       │ (Task Assigned)                    │
       ▼                                    │
  ┌──────────┐                              │
  │ THINKING │                              │
  └────┬─────┘                              │
       │ (Plan Generated)                   │
       ▼                                    │
  ┌──────────┐       (Waiting Tool)     ┌───┴─────┐
  │ WORKING  ├─────────────────────────►│ WAITING │
  └────┬─────┘                          └───┬─────┘
       │                                    │
       ├── (Subprocess Error) ──► ┌──────────┐
       │                          │ DEGRADED │
       │                          └────┬─────┘
       │ (Resource Exhausted)          │
       ▼                               │
  ┌──────────┐                         │
  │ BLOCKED  │                         │
  └────┬─────┘                         │
       │ (Unrecoverable)               ▼
       └─────────────────────────► ┌────────┐
                                   │ FAILED │
                                   └────────┘
```

---

## 🖥️ 4. Pillar B: Event-Driven Passive Context Engine & Live World State

### 4.1 Event-Driven D-Bus Signal Listener (Zero-CPU Polling)
Rather than executing continuous polling loops that consume CPU and battery, J.A.R.V.I.S. connects directly to system D-Bus signals:
- `org.gnome.Mutter.DisplayConfig` / `org.gnome.Shell.Introspect`: Emits instantly when the active window changes.
- `org.a11y.atspi.Registry`: Emits on `window:activate`, `object:state-changed:focused`, and `object:bounds-changed`.
- `org.freedesktop.UPower`: Emits on power state/battery changes.
- `org.freedesktop.login1`: Emits on session lock/unlock/idle.

```typescript
export interface LiveWorldState {
  activeApplication: {
    wmClass: string;
    windowTitle: string;
    pid: number;
    focusedElement?: string;
  };
  activeTask?: {
    id: string;
    goal: string;
    assignedAgent: string;
    stepIndex: number;
    totalSteps: number;
  };
  activeAgents: Array<{ name: string; state: AgentState; lastHeartbeat: number }>;
  runningTools: string[];
  systemTelemetry: {
    cpuUsagePercent: number;
    ramUsedMb: number;
    ramFreeMb: number;
    batteryPercent?: number;
    isCharging?: boolean;
    temperatureCelsius?: number;
  };
  userAttention: {
    interruptionCost: number; // 0 to 100
    isTyping: boolean;
    isAudioInputActive: boolean;
    idleSeconds: number;
  };
  updatedAt: number;
}
```

### 4.2 Priority-Weighted Knapsack Context Budgeting Algorithm
When an agent is invoked, the Context Engine dynamically computes the token budget according to the target model and packs the highest-value information:

$$\max \sum_{i \in \text{Items}} v_i \cdot x_i \quad \text{subject to} \quad \sum_{i \in \text{Items}} w_i \cdot x_i \le B_{\text{model}}$$

```text
┌────────────────────────────────────────────────────────────────────────┐
│                      KNAPSACK PACKING PRIORITY                         │
├────────────────────────────────────────────────────────────────────────┤
│ TIER 1 (100% Mandatory)                                                │
│  • System Prompt & Core Role Identity                                  │
│  • Active Tool Function Declarations                                   │
│  • Strict Security & Permission Manifest                               │
├────────────────────────────────────────────────────────────────────────┤
│ TIER 2 (High Value — Dynamic Budget Allocation)                        │
│  • Live World State Snapshot                                           │
│  • Immediate Conversation History (Last N turns)                       │
│  • Experience Memories (Cosine Similarity ≥ 0.75)                      │
├────────────────────────────────────────────────────────────────────────┤
│ TIER 3 (Medium Value — Summarized on Demand)                           │
│  • Relevant Long-Term Facts & User Preferences                         │
│  • Recent Decision Ledger Entries                                      │
├────────────────────────────────────────────────────────────────────────┤
│ TIER 4 (Low Value — Pruned First When Budget Constrained)               │
│  • Deep Background Logs & Step Telemetry                               │
│  • Low-Confidence / Distant Historical Memories                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 💾 5. Pillar C: Experience Memory & Continuous Learning Engine

### 5.1 SQLite WAL Database Schemas (`data/jarvis.db`)

```sql
-- 1. Experience Memories (Structured Case-Based Reasoning)
CREATE TABLE IF NOT EXISTS experience_memories (
  id TEXT PRIMARY KEY,
  situation TEXT NOT NULL,
  decision TEXT NOT NULL,
  action TEXT NOT NULL,
  result TEXT NOT NULL,
  is_success INTEGER NOT NULL,
  error_message TEXT,
  fix_applied TEXT,
  lesson_learned TEXT NOT NULL,
  confidence REAL NOT NULL,
  department TEXT NOT NULL,
  embedding BLOB, -- 384-dimensional binary vector
  created_at INTEGER NOT NULL
);

-- Full-Text Search Virtual Table for Experience Memory
CREATE VIRTUAL TABLE IF NOT EXISTS experience_memories_fts USING fts5(
  situation,
  decision,
  action,
  result,
  lesson_learned,
  content='experience_memories',
  content_rowid='rowid'
);

-- 2. Decision Ledger (Cryptographic Audit & Rationale Trail)
CREATE TABLE IF NOT EXISTS decision_ledger (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  chosen_option TEXT NOT NULL,
  alternatives_json TEXT NOT NULL,
  rationale TEXT NOT NULL,
  evidence_json TEXT,
  confidence REAL NOT NULL,
  expected_outcome TEXT NOT NULL,
  actual_outcome TEXT,
  evaluated_at INTEGER,
  agent_responsible TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 3. Event Journal (Immutable Action/Observation Stream for Crash Recovery)
CREATE TABLE IF NOT EXISTS event_journal (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL,
  target TEXT,
  payload_json TEXT NOT NULL,
  priority TEXT NOT NULL,
  checkpoint_id TEXT,
  timestamp INTEGER NOT NULL
);

-- 4. Public API Offline Discovery Catalog
CREATE TABLE IF NOT EXISTS public_apis (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  auth_type TEXT NOT NULL, -- 'NONE', 'API_KEY', 'OAUTH2'
  https_supported INTEGER NOT NULL,
  cors_supported INTEGER NOT NULL,
  base_url TEXT NOT NULL,
  doc_url TEXT,
  sample_call_json TEXT,
  embedding BLOB
);

CREATE VIRTUAL TABLE IF NOT EXISTS public_apis_fts USING fts5(
  title,
  description,
  category,
  content='public_apis',
  content_rowid='rowid'
);
```

### 5.2 Hybrid Semantic Search Formula
When retrieving past experience or public APIs, J.A.R.V.I.S. scores candidates using a balanced combination of BM25 Keyword Relevance and Cosine Vector Similarity:

$$\text{Score}(q, d) = \alpha \cdot \text{BM25}_{\text{norm}}(q, d) + (1 - \alpha) \cdot \cos(\mathbf{e}_q, \mathbf{e}_d) \quad (\alpha = 0.4)$$

---

## 🎯 6. Pillar D: Proactive Intelligence, Attention Modeling & Silence Engine

### 6.1 Real-Time Interruption Cost Score Formula
The Interruption Cost ($I \in [0, 100]$) measures the friction of interrupting the user right now:

$$I = \min\left(100, \, 40 \cdot \mathbb{I}_{\text{typing}} + 35 \cdot \mathbb{I}_{\text{mic\_active}} + 30 \cdot W_{\text{focus}} + \max\left(0, \, 25 - 5 \cdot t_{\text{idle}}\right)\right)$$

Where:
- $\mathbb{I}_{\text{typing}} \in \{0, 1\}$: Detected recent keystrokes in active PTY/terminal within 3s.
- $\mathbb{I}_{\text{mic\_active}} \in \{0, 1\}$: User is currently speaking into microphone or in a call.
- $W_{\text{focus}} \in [0, 1]$: Active window focus weight (e.g. VS Code / Terminal = $1.0$; Desktop / Browser Reader = $0.3$).
- $t_{\text{idle}}$: Seconds since last keyboard or mouse input.

### 6.2 Multi-Tier Proactive Delivery Decision Matrix

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              PROACTIVE DELIVERY POLICY                                 │
├─────────────────┬──────────────────────┬───────────────────────────────────────────────┤
│ Urgency Level   │ Interruption Cost    │ Action Executed by Silence Intelligence       │
├─────────────────┼──────────────────────┼───────────────────────────────────────────────┤
│ CRITICAL        │ Any (0 - 100)        │ Vocalize immediately with emergency tone.     │
│ HIGH            │ Low (0 - 35)         │ Vocalize naturally.                           │
│ HIGH            │ High (36 - 100)      │ Silent Glassmorphic HUD Toast + Audio Buffer  │
│                 │                      │ (Speaks automatically upon next idle window). │
│ MEDIUM          │ Low (0 - 35)         │ Subtle audio chime + Glassmorphic HUD Badge.   │
│ MEDIUM          │ High (36 - 100)      │ Silent HUD Notification.                      │
│ LOW             │ Any (0 - 100)        │ Log silently to Daily Obsidian Note (`.md`).  │
└─────────────────┴──────────────────────┴───────────────────────────────────────────────┘
```

---

## 🛠️ 7. Pillar F: Capability Forge & Sandboxed Self-Extension (Ada-SI)

### 7.1 Automated Capability Gap Decision Tree
```text
[User Request / Tool Requirement]
            │
            ▼
   Does capability exist in Tool Registry?
    ├── YES ──► Execute Tool
    └── NO
         │
         ▼
   Can another Agent or Local Binary fulfill it?
    ├── YES ──► Delegate to Department Agent
    └── NO
         │
         ▼
   Can an existing tool combination satisfy it?
    ├── YES ──► Composite Action Chain
    └── NO
         │
         ▼
   Query `public_apis.db` for zero-auth API provider
    ├── FOUND ──► Synthesize API Tool Wrapper
    └── NOT FOUND ──► Write Custom Python / TypeScript Script
         │
         ▼
   [CAPABILITY FORGE ACTIVATION]
```

### 7.2 The 8-Stage Capability Forge Pipeline
1. **Plan & Interface Definition**: Generate TypeScript tool descriptor, parameter schemas, and expected return types.
2. **Code Generation**: Synthesize lightweight, zero-bloat standalone script.
3. **Static Analysis & Linting**: Syntax validation, AST inspection, forbidden imports check (e.g. raw disk writes outside sandbox).
4. **`bwrap` Native Linux Sandbox Test**:
   - Executes inside an ephemeral tmpfs jail:
     ```bash
     bwrap --ro-bind /usr /usr \
           --ro-bind /lib /lib \
           --ro-bind /lib64 /lib64 \
           --tmpfs /tmp \
           --dir /tmp/sandbox \
           --unshare-all \
           --share-net \
           --timeout 5 \
           python3 /tmp/sandbox/generated_tool.py
     ```
5. **Security & Permission Gate**: Enforce Permission Manifest (Network endpoints, File paths, System APIs).
6. **Integration Verification**: Run automated synthetic test cases with expected inputs.
7. **Graduated Promotion**: Moves through 7 stages:
   $$\text{EXPERIMENTAL} \longrightarrow \text{TESTING} \longrightarrow \text{CANARY} \longrightarrow \text{TRUSTED}$$
8. **Instant Rollback Sentinel**: If a tool throws unhandled runtime errors in production, it is automatically quarantined and rolled back to the previous stable revision.

---

## 🖱️ 8. GUI Actuation & Wayland Semantic Targeting

### 8.1 Dual-Engine Targeting Hierarchy
1. **Primary Engine — Semantic AT-SPI D-Bus (`at_spi_inspector.cpp`)**:
   - Queries the accessibility tree via `/org/a11y/atspi/accessible/root`.
   - Locates UI components by `name`, `role`, or `description`.
   - Calculates exact screen bounding box $[x, y, w, h]$ without pixel searching.
   - Triggers native Wayland clicks via `ydotool click 0xC0` directly at component center $(x + w/2, y + h/2)$.
2. **Secondary Engine — Vision/OCR Fallback**:
   - For custom OpenGL canvas, Chromium games, or non-accessible apps:
   - Captures screen frame via `grim`.
   - Runs local Tesseract OCR or Gemini Flash bounding-box detection.
   - Scales coordinates by Wayland fractional scaling factor.
3. **Post-Action State Verification**:
   - Probes AT-SPI `object:state-changed` signals to confirm the button was pressed, modal opened, or text box focused.

---

## 📋 9. Multi-Department Knowledge Sharing Mesh

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        INTER-DEPARTMENT KNOWLEDGE MESH                                 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│   FRIDAY (Research / Web / News)                                                       │
│     │                                                                                  │
│     ├── Discovers new API schema or documentation                                      │
│     ▼                                                                                  │
│   EXPERIENCE MEMORY & CAPABILITY FORGE                                                 │
│     │                                                                                  │
│     ├── Synthesizes verified tool wrapper                                              │
│     ▼                                                                                  │
│   EDITH (Software Engineering & Architecture)                                          │
│     │                                                                                  │
│     ├── Integrates tool into project code refactor                                     │
│     ▼                                                                                  │
│   ULTRON (Security & System Watchdog)                                                  │
│     │                                                                                  │
│     └── Audits execution permissions & monitors CPU thermals                           │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🧪 10. Verification & Quality Assurance Contract

Before any cognitive sub-system is promoted to active production:
1. **Zero Memory Regression**: Baseline idle memory footprint must remain under $\approx 200\text{MB}$ RAM on the 8GB Ubuntu workstation.
2. **Reflex Speed**: Hardware barge-in and audio cutoff must execute in $< 10\text{ms}$.
3. **Sandbox Security**: Forged code executing in `bwrap` must never write to host `/home`, `/etc`, or `/var` directories.
4. **Crash Recovery**: Active tasks must resume within $< 500\text{ms}$ after a mock server process termination.
5. **Observability**: 100% of decisions must be recorded in SQLite WAL `decision_ledger` with corresponding rationale and evidence.

---

*Last Updated: 17/08/2026*  
*Authored by J.A.R.V.I.S. Multi-Agent Systems Architecture Core*
