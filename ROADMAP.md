# 🧠 J.A.R.V.I.S. — Master Build Roadmap

> **The Ultimate Single-User AI Operating System & Hands-Free Super-Assistant**  
> Built for **maximum speed, total OS control, multi-agent intelligence, and seamless voice execution**.  
> Architectural Doctrine: **Universal Ephemeral On-Demand Lifecycle (Zero-Idle Footprint).**  
> Personality: **Tony Stark's JARVIS / FRIDAY — witty, sarcastic, adaptive.**

---

## 🎯 Final Vision

**J.A.R.V.I.S. is a single-user, voice-first AI operating system that can:**

* **Talk naturally in real time** with sub-100ms conversational fluidity and dynamic persona switching.
* **See & Understand** the screen, camera, OCR, and visual feeds on-demand via voice.
* **Control the Linux workstation completely hands-free**: launch apps, move mouse, type text, execute terminal workflows, manage files, and operate the browser.
* **Orchestrate specialist AI agents** (Hermes, OpenClaw, Research Agent, AI News Agent) to solve complex workflows.
* **Run long-running autonomous tasks** in the background with continuous verification loops.
* **Gather & Synthesize daily AI knowledge** automatically on boot and on-demand.
* **Remember everything permanently** via structured memory and automatic 2-way Obsidian Vault sync.
* **Monitor system health & self-heal** automatically with zero manual intervention.
* **Operate on a Universal Ephemeral Lifecycle**: Every subsystem spins up instantly on-demand and immediately deactivates after use to guarantee peak speed, zero idle memory consumption, and rock-solid stability.

---

## ⚡ The Ephemeral On-Demand Architecture (Zero-Idle Doctrine)

To guarantee that J.A.R.V.I.S. runs **ultra-fast, silky smooth, and crash-free on an 8GB RAM workstation**, the entire OS adheres to the **Zero-Idle Lifecycle Protocol**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                      UNIVERSAL EPHEMERAL LIFECYCLE PROTOCOL                            │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│   IDLE STATE (0% CPU, ~200MB RAM)                                                      │
│        │                                                                               │
│        ▼ [User Voice Intent / Event Detected]                                         │
│   INSTANT AUTO-ACTIVATION (<10ms)                                                      │
│        │  • Allocates buffers / starts sub-process / mounts socket                     │
│        │                                                                               │
│        ▼                                                                               │
│   HIGH-SPEED EXECUTION                                                                 │
│        │  • Full CPU & RAM allocated exclusively to the active task                    │
│        │  • Tool execution / Web scraping / Vision parsing / Shell commands           │
│        │                                                                               │
│        ▼ [Task Completed OR Idle Grace Timeout (5-10s)]                                │
│   IMMEDIATE AUTO-DEACTIVATION & SWEEPER                                                │
│        │  • Video streams closed & V4L2/PipeWire handles released                      │
│        │  • Browser instances destroyed & Chromium memory wiped                        │
│        │  • Subagent instances garbage-collected                                       │
│        │  • PTY descriptors closed                                                     │
│        │                                                                               │
│        ▼                                                                               │
│   RETURN TO LEAN IDLE STATE (Memory Reclaimed: 100%)                                   │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Dynamic Subsystem Lifecycle Matrix

| Subsystem | Auto-Activation Trigger | Active Work | Auto-Deactivation Trigger | Idle RAM | Active RAM |
|:---|:---|:---|:---|:---:|:---:|
| **Vision Subsystem** | Voice: *"Look at screen"* / *"Turn on camera"* | Capture frames & send to Gemini Live | Voice: *"Stop vision"* / Task answered + 5s idle | **0 MB** | ~40 MB |
| **Gesture Control** | Voice: *"Activate gesture control"* | Optical flow / hand landmark detection | Voice: *"Stop gestures"* / 30s inactivity | **0 MB** | ~60 MB |
| **Browser Agent** | Voice: *"Search web"* / Web action tool call | Launch Chromium via Playwright, scrape/form | Content extracted & tool result returned | **0 MB** | ~180 MB |
| **Terminal Shell** | Voice: Bash command / dev workflow | Spawn PTY session, stream output | Command exited / 10s idle | **0 MB** | ~15 MB |
| **AI News Agent** | JARVIS boot OR Voice: *"What's the news?"* | Scrape feeds, synthesize, save Obsidian | Briefing delivered ➔ Immediate exit | **0 MB** | ~30 MB |
| **Research Agent** | Voice: *"Research [topic]"* | Multi-source search, fact-check, write doc | Report saved to Obsidian ➔ Immediate exit | **0 MB** | ~50 MB |
| **Hermes / OpenClaw** | Delegated deep system or git refactor | Run code review / diagnostic script | Task completed ➔ Immediate exit | **0 MB** | ~40 MB |
| **C++ OS Workers** | System call (`volume`, `brightness`, `proc`) | Sub-millisecond direct kernel/D-Bus execution | Exits immediately after stdout JSON | **0 MB** | < 2 MB |
| **Obsidian 2-Way Sync** | File change event OR daily note trigger | Debounced markdown read/write | File written ➔ Returns to sleep | **0 MB** | < 5 MB |

---

## 🖥️ System Constraints & Design Parameters

| Constraint | Value | Architecture Impact |
|:---|:---|:---|
| **RAM** | 8 GB (→ 16 GB future upgrade) | **Zero-idle lifecycle** keeps baseline idle memory at ~200MB, leaving 7.8GB completely free for apps and user work. |
| **GPU** | None (integrated graphics) | 100% Cloud API inference for deep LLMs and multimodal vision. No local heavy weights. |
| **Display** | Wayland + GNOME (Ubuntu) | Native `ydotool` + `wtype` for input, `grim` for captures, AT-SPI for semantic UI trees. |
| **Budget** | Near-zero (Free tiers + smart rotation) | Multi-account rotation across Gemini, Groq, NVIDIA NIM, with OpenAI as paid fallback. |
| **AI Models (Current)** | Cloud API Key Models ONLY | Gemini 2.5 Flash Live (Voice), Groq Llama 3.3 70B (Fast Tooling), NVIDIA NIM (Deep Systems), OpenAI (Fallback). Local models deferred to future hardware. |
| **Wake Word (Current)** | On-demand voice activation | Voice session starts on connection / user activation. Background offline wake word deferred to future hardware. |
| **Interaction** | Voice-First & Hands-Free | All activations, toggles, and commands execute via natural speech. No button clutter. |
| **User Mode** | Single-user personal OS | Zero multi-tenant bloat, maximum local permissions and operational speed. |

---

## 🎛️ Feature Switch Master Architecture

JARVIS features are categorized by their **activation policy**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          JARVIS MASTER FEATURE SWITCH MATRIX                           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. ALWAYS ACTIVE BY DEFAULT (Core Engine — Built-In Intelligence)                      │
│    • System Control (Volume, Brightness, Power, Apps, Windows)                         │
│    • Mouse & Keyboard Control (ydotool / wtype)                                        │
│    • Terminal Control (PTY background shells — ephemeral spawn)                        │
│    • Browser Control (Playwright headless / live automation — ephemeral spawn)         │
│    • File Control (Search, Read, Write, Organize)                                      │
│    • Memory Subsystem (Facts, Context, Directives)                                     │
│    • Obsidian Daily Memory (Automatic 2-way Markdown sync)                            │
│    • Proactive Mode (Briefings, System Warnings, Task Alerts)                          │
│    • Multi-Agent System (Agent Registry & Manager Mesh)                                │
│    • Background Task & Priority Engine (Internal delegation)                           │
│    • Task Scheduler (Cron & Event triggers)                                            │
│    • System Monitoring & Self-Healing Watchdog                                         │
│    • Security Engine & Permission Trust System                                         │
│    • Cloud API Model Router & Quota Fallback                                           │
│    • Developer Telemetry & Structured Logging                                          │
│                                                                                        │
│ 2. UNIFIED ON-DEMAND SUBSYSTEMS (Auto-Activate on Request ➔ Auto-Teardown)              │
│    • UNIFIED VISION (Screen Sharing + Camera Vision + OCR + Visual Reasoning)          │
│      └─ Activates on voice ("Jarvis, look at my screen", "Turn on camera")             │
│      └─ Auto-deactivates on voice ("Stop vision") OR when query is answered            │
│    • GESTURE CONTROL (Webcam hand gesture recognition)                                │
│      └─ Activates only when user explicitly asks ➔ Auto-deactivates when stopped       │
│                                                                                        │
│ 3. ON-DEMAND SPECIALIST AGENTS (Ephemeral Micro-Agents)                                │
│    • AI NEWS AGENT: Activates on boot ➔ Collects daily news ➔ Writes Obsidian ➔ Exits.│
│      Activates on-demand when user asks about news ➔ Answers ➔ Exits.                  │
│    • RESEARCH AGENT: Activates on-demand when user asks for deep research ➔            │
│      Scrapes, synthesizes, stores report in Obsidian ➔ Exits immediately.              │
│    • HERMES AGENT: Activates when deep system diagnostics/tools are requested ➔ Exits. │
│    • OPENCLAW AGENT: Activates when git refactoring / code tasks are delegated ➔ Exits.│
│                                                                                        │
│ 4. DEFERRED FUTURE EXTENSIONS (Phase 12+ — Designed for Later VPS / Upgrades)         │
│    • Remote Access & Mobile PWA (Tailscale / Web App)                                 │
│    • Telegram & WhatsApp Messaging AI Bots                                            │
│    • Multi-Channel / TV Command Center View                                           │
│    • Offline Local AI Models & Local Wake Word Engine                                 │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🏛️ Multi-Language Architecture (No Limits / Best Tool Per Layer)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    J.A.R.V.I.S. MULTI-LANGUAGE STACK                    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 1: USER INTERFACE                                        │   │
│  │  TypeScript + React 19 + Tailwind 4                             │   │
│  │  → Glassmorphic HUD, Canvas pulsating orb, telemetry header     │   │
│  │  → Voice-first control, zero clutter, real-time audio meters    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              ↕ WebSocket / REST                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 2: PRIME ORCHESTRATOR & LIFECYCLE MANAGER                │   │
│  │  TypeScript + Node.js (current) → Go (future VPS migration)    │   │
│  │  → Express + WebSocket live streaming engine                    │   │
│  │  → Ephemeral Lifecycle Manager & Resource Sweeper               │   │
│  │  → Gemini Live WebSocket proxy & function caller                │   │
│  │  → Multi-agent orchestrator & task priority queue               │   │
│  │  → Event Bus (EventEmitter3) for pub/sub decoupling             │   │
│  │  → Tool Router dispatching C++, Browser & Cloud tools           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                      ↕ TCP / IPC / exec()                               │
│  ┌──────────────────────────┐  ┌──────────────────────────────────┐   │
│  │  LAYER 3: AUDIO GATEWAY  │  │  LAYER 4: SYSTEM ACTUATORS       │   │
│  │  Rust (CPAL + Tokio)     │  │  C++17 (POSIX / D-Bus / /proc)   │   │
│  │                          │  │                                  │   │
│  │  → 16kHz capture (mic)   │  │  → 16 compiled native workers    │   │
│  │  → 24kHz playback (spk)  │  │  → Sub-millisecond execution     │   │
│  │  → Zero-GC lock-free     │  │  → 0MB RAM footprint after exit  │   │
│  │    ring buffers          │  │  → GNOME Mutter brightness D-Bus │   │
│  │  → Microsecond audio TCP │  │  → PulseAudio / PipeWire volume  │   │
│  │    bridge to backend     │  │  → Wayland ydotool / wtype / grim│   │
│  │  → Acoustic clap sensor  │  │  → AT-SPI UI accessibility tree  │   │
│  └──────────────────────────┘  └──────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 5: DATA & MEMORY                                         │   │
│  │  SQLite (better-sqlite3) → Configuration, tasks, logs, facts     │   │
│  │  Obsidian Vault (.md)    → 2-way sync for notes, daily digests  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  LAYER 6: EXTERNAL RUNTIMES (Ephemeral Spawn-on-Demand)         │   │
│  │  Playwright (Node.js)    → Spawns Chromium on-demand, kills on  │   │
│  │                            task completion (0MB idle RAM)       │   │
│  │  n8n (self-hosted)       → Multi-app low-code automation       │   │
│  │  Google APIs (OAuth2)    → Gmail, Calendar, Drive, Docs, Tasks  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🧠 AI Model Routing (Cloud Multi-Account Strategy)

| Task Type | Primary Model | Provider | Cost | Why |
|:---|:---|:---|:---|:---|
| **Real-Time Voice & Vision** | Gemini 2.5 Flash Live | Google AI Studio | Free Tier | Bidirectional WebSockets, sub-100ms audio + screen frames. |
| **Sub-25ms Tactical Dispatch** | Llama 3.3 70B Versatile | Groq Cloud | Free (6,000 req/day) | Ultra-fast intent parsing & rapid tool execution. |
| **Deep Systems Reasoning** | Llama 3.1 70B / Nemotron | NVIDIA NIM | Free Tier | Multi-step architecture planning & code forensics. |
| **Complex Code Generation** | Claude 3.7 Sonnet / Opus | Anthropic | Pay-per-use | Highest fidelity code synthesis for OpenClaw. |
| **High-Volume Fallback** | GPT-4o-mini | OpenAI | Cheap Pay-per-use | Failover when Groq / Gemini rate limits are reached. |
| **Deep Planning** | DeepSeek-R1 | DeepSeek | Very Cheap | Chain-of-thought planning for autonomous loops. |

**Intelligent Failover Chain:**
```
User speaks ➔ Gemini Live (Voice Streaming)
Tool trigger ➔ Groq Llama 3.3 (Sub-25ms) ➔ If rate-limited ➔ NVIDIA NIM ➔ If down ➔ OpenAI GPT-4o-mini
News/Research ➔ Groq / Gemini Pro ➔ Synthesize ➔ Save to Obsidian Vault ➔ Teardown
```

---

## 🗺️ Roadmap at a Glance

| Phase | Milestone Name | Focus Area | Status |
|:---:|:---|:---|:---:|
| **Phase 0** | **Core Architecture & Ephemeral Lifecycle** | Event bus, switch registry, SQLite, task queue, lifecycle manager | 🟢 **100% DONE** |
| **Phase 1** | **Real-Time Voice Core Polish** | Barge-in handling, 16kHz resampler, AudioWorklet noise filter, voice memory, 5 MCU personas & Telgish mode | 🟢 **100% DONE** |
| **Phase 2** | **Unified Ephemeral Vision & Perception** | Voice-toggled screen + camera + OCR screenshots + code inspector (auto-teardown) | 🟢 **90% DONE** |
| **Phase 3** | **Computer & System Control (Primary)** | 17 C++ native workers, Wayland/X11 mouse & keys, Mutter D-Bus, PTY terminal, desktop control, pre-flight diagnostics | 🟢 **100% DONE** |
| **Phase 4** | **Ephemeral Browser & Grounded Web Agent** | Agent Reach Jina Reader extraction, DuckDuckGo/SearXNG search, YouTube transcripts, fact verification | 🟢 **100% DONE** |
| **Phase 5** | **Memory & Obsidian Life OS** | Rust Axum Memory Engine (port 50051), 11-table SQLite WAL, L0→L1→L2 memory tree, 4-signal hybrid search, secret scanner, Obsidian 2-way sync | 🟢 **100% DONE** |
| **Phase 6** | **Daily AI Knowledge & Ephemeral Research Agents**| Autonomous research engine, Rule of N>=2 triangulation, cited Obsidian reports, daily notes logging | 🟢 **85% DONE** |
| **Phase 7** | **Multi-Agent Federation & Connectors** | 5-Agent Persona Mesh (sub-100ms hot-swap), Google Workspace, LinkedIn Cloud, GitHub Intelligence, Hermes autonomous extensions | 🟢 **100% DONE** |
| **Phase 8** | **Cognitive Nervous System & Autonomous Evolution** | 1,440+ Skill Harvester, Latency Response System, Pre-flight Suit Diagnostics, Ground Truth Registry, Context Compressor, Ada-SI Capability Forge | 🟢 **100% DONE** |
| **Phase 9** | **Autonomous Task & Verification Engine** | Priority task queue, async background execution runner, fast handoff | 🟡 **60% DONE** |
| **Phase 10**| **Proactive JARVIS & System Watchdog** | Watchdog self-healing, sound server recovery, hardware telemetry sentinel, morning briefing | 🟢 **85% DONE** |
| **Phase 11**| **n8n Workflow Automation Engine** | Cron Engine & scheduled automation tools | 🟡 **35% DONE** |
| **Phase 12**| **Security Hardening & Permissions** | Security Guard command/path validator, pre-persistence Secret Scanner, graduated trust execution | 🟢 **90% DONE** |
| **Phase 13**| **Future: Remote Access & Mobile PWA** | Tailscale VPN, Telegram / WhatsApp bots, Mobile PWA | 🔵 **FUTURE** |
| **Phase 14**| **Future: Multi-Channel Command Center**| Multi-channel TV dashboard, split telemetry views | 🔵 **FUTURE** |
| **Phase 15**| **Future: Offline Local AI & Wake Word** | OpenWakeWord, local Whisper, Ollama local weights | 🔵 **FUTURE** |

---

## 🔍 Detailed Phase Breakdown

---

### 🏗️ PHASE 0 — Core Architecture & Ephemeral Lifecycle
**Timeline**: Week 1-2 | **Focus**: Central Nervous System & Resource Sweeper | **Status**: 🟢 **100% DONE**

> Establish the rock-solid foundation with automatic resource teardowns so JARVIS stays blazing fast.

#### Core Subsystems Built:
- [x] **Prime JARVIS Orchestrator**: Central router connecting voice, tools, agents, and state (`src/core/prime_orchestrator.ts`, `core_engine/main.py`).
- [x] **Ephemeral Lifecycle & Resource Sweeper Manager (`lifecycle_manager.ts`)**: Automatically shuts down idle browser contexts, video pipelines, PTY shells, and specialist agents after use.
- [x] **Event Bus (`eventemitter3`)**: Decoupled pub/sub event system for all events (`task:created`, `vision:toggle`, `agent:done`, `tool:before_execute`).
- [x] **Feature Switch Manager (`switch_manager.ts`)**: Structured, hot-reloadable system reflecting the 4 operational tiers.
- [x] **SQLite Database Engine (`better-sqlite3` & Rust WAL Engine)**: Single-file storage for tasks, long-term memories, logs, and configuration.
- [x] **Tool Registry (`tool_registry.ts` & `actuator_dispatcher.py`)**: Unified catalog and dispatcher for C++ workers, Playwright browser tools, Agent Reach, Memory, and workspace APIs.
- [x] **Task Priority Queue (`task_queue.ts`)**: In-process priority queue with dependency resolution and timeouts.
- [x] **Health Monitoring & Structured Logger (`logger.ts` / `telemetry_service.py`)**: Real-time heartbeat tracking and structured JSON logging.
- [x] **Self-Healing Watchdog (`watchdog.ts`)**: Automatic detection and recovery for failed subprocesses and sound daemons.

---

### 🎙️ PHASE 1 — Real-Time Voice Core Polish
**Timeline**: Week 2-3 | **Focus**: Fluid Natural Conversation | **Status**: 🟢 **100% DONE**

> Refine the Gemini Live voice system into an uninterrupted, natural conversational experience with multi-persona ecosystem.

#### Features Completed:
- [x] **Barge-in & Interruption Handling**: Cancel outgoing audio instantly when the user starts speaking (`src/utils/audio.ts`, `client_speech_queue.ts`, `core_engine/audio_bridge.py`).
- [x] **AudioWorklet & 16kHz Resampler**: Client-side audio filtering and robust Web Audio API context lifecycle to eliminate hiss with 0 API cost.
- [x] **Silence & VAD Optimization**: Rust audio gateway (`gateway_rust/src/capture.rs`, `playback.rs`) with amplitude metering and lock-free ring buffers.
- [x] **Voice Session Memory**: Dynamic injection of rolling conversation turns, `MEMORY.md`, and `USER.md` into Gemini Live instructions.
- [x] **Dynamic Voice Speed & Persona Timbre**: 5 MCU personas (JARVIS, FRIDAY, ULTRON, EDITH, KAREN) with custom timbres, personality prompts, and Universal Telgish language mode enforcement.

---

### 👁️ PHASE 2 — Unified Ephemeral Vision & Perception
**Timeline**: Week 3-4 | **Focus**: Complete Visual Awareness with Zero Idle Cost | **Status**: 🟢 **90% DONE**

> Merge screen sharing, webcam, OCR, and visual reasoning into **one single voice-controlled subsystem that shuts down immediately after use**.

#### Features Completed & In Progress:
- [x] **Unified Vision Subsystem**: Single switch and tool dispatch controlling screen capture and webcam (`control_vision_mode`, `start_screen_sharing`, `start_camera_vision`, `stop_all_vision`).
- [x] **Voice-Activated Auto-Lifecycle**:
  - *"Jarvis, look at my screen"* ➔ Starts screen capture ➔ Delivers visual reasoning ➔ Stops capture stream on task completion.
  - *"Jarvis, turn on my camera"* ➔ Starts camera capture ➔ Answers visual inquiry ➔ Auto-stops stream.
  - *"Jarvis, stop vision"* ➔ Explicit immediate teardown.
- [x] **Screen OCR & Screenshot Capture**: Local screenshot capture (`gnome-screenshot`, `grim`, `scrot`) with base64 streaming for error codes, terminal text, and documents.
- [x] **Visual Error & Code Inspector**: Multimodal stream inspection for crash dialogs, IDE code errors, and terminal stack traces.
- [ ] **On-Demand Gesture Recognition**: Webcam optical flow / hand landmark detection for gesture-based workstation controls.

---

### 🖥️ PHASE 3 — Computer & System Control (Top Priority)
**Timeline**: Week 4-6 | **Focus**: Hands-Free Workstation Mastery | **Status**: 🟢 **100% DONE**

> Give JARVIS the power to operate your Ubuntu Linux desktop completely hands-free via voice and compiled C++ actuators.

#### Features Completed:
- [x] **Semantic UI Targeting & Desktop Actuators**: C++ native workers (`desktop_control.cpp`, `desktop_ctrl.cpp`) with Mutter D-Bus, Wayland/X11 mouse move, click, drag, scroll, text typing, and hotkeys.
- [x] **Wayland Mouse & Keyboard Actuators (`ydotool` / `wtype` / `xdotool`)**: Virtual input drivers for hands-free desktop navigation and typing.
- [x] **Application & Window Manager**: Launch any installed desktop app (`open_app.cpp`, `.desktop` file parser, `gtk-launch`), switch focus, snap windows, minimize/maximize via Mutter D-Bus.
- [x] **Persistent / Ephemeral PTY Terminal Shell**: Safe command execution (`execute_linux_command`, `actuator_dispatcher.py`) with security validation, fast synchronous execution window (1.2s), and automatic background handoff.
- [x] **Multi-Step Action Chains & Diagnostics**: Iron Man Suit Pre-Flight Diagnostic Sweep (`suit_diagnostics.ts`, `run_full_system_diagnostics`) checking 17 subsystem health points across all tiers.
- [x] **17 Compiled C++ Native Actuators (`workers_cpp/bin/`)**:
  - `hardware_ctrl`, `sys_telemetry`, `pc_spec`, `desktop_control`, `desktop_ctrl`, `file_search`, `firewall_audit`, `jarvis_sysctl`, `media_ctrl`, `memory_tester`, `net_inspector`, `open_app`, `process_ctrl`, `service_ctrl`, `storage_scan`, `thermal_scan`, `wifi_scan`.

---

### 🌐 PHASE 4 — Ephemeral Browser & Grounded Web Agent
**Timeline**: Week 6-7 | **Focus**: Autonomous Web Navigation with Zero Idle RAM | **Status**: 🟢 **100% DONE**

> Grounded internet research and clean content extraction with zero hallucination and zero idle footprint.

#### Features Completed:
- [x] **Agent Reach Verified Web Reader**: Jina Reader clean markdown extraction (`fetch_verified_webpage`) stripping ads, navbars, and boilerplate with 0 token waste.
- [x] **Grounded Internet Search**: Multi-engine search (`search_internet_grounded`, DuckDuckGo, SearXNG) returning verified titles, URLs, and factual snippets.
- [x] **YouTube Transcript Extractor**: Clean subtitle and transcript extraction (`extract_youtube_transcript`) from YouTube video URLs without hallucination.
- [x] **Fact Verification & Fast Voice Check**: Real-time claim verification (`verify_claim`) and sub-1.5s voice fact-check (`fast_fact_check`) with primary source citations.
- [x] **Research Caching & TTL Categorization**: SQLite-backed research caching with domain TTLs (`news`, `repos`, `packages`, `docs`, `rfc`, `academic`, `general`).

---

### 🧠 PHASE 5 — Memory System & Obsidian Life OS
**Timeline**: Week 7-8 | **Focus**: 100% Private Persistent Memory | **Status**: 🟢 **100% DONE**

> JARVIS Universal Memory Engine built in Rust with SQLite WAL, hierarchical tree summaries, 4-signal hybrid search, and 2-way Obsidian sync.

#### Features Completed:
- [x] **Rust Universal Memory Engine (`memory_engine/`)**: High-performance Axum REST & WebSocket server (port 50051) and Model Context Protocol (MCP) JSON-RPC stdio server.
- [x] **11-Table SQLite WAL Database Schema**: Complete schema with `nodes`, `edges`, `knowledge_triples`, `conversations`, `diaries`, `tree_buffers`, `fts5_index`, and automated SQLite triggers.
- [x] **Hierarchical Memory Tree Engine (L0 → L1 → L2)**: Cascade sealing (`tree/cascade.rs`), summarization, drilldown (`jarvis_tree_drilldown`), and buffer flushing (`jarvis_flush_memory`).
- [x] **4-Signal Zero-Hallucination Hybrid Search**: Sub-50ms query ranking combining BM25 FTS5 (0.35) + Cosine Vector (0.35) + Graph Distance (0.15) + Recency (0.15).
- [x] **Pre-Persistence Secret Scanner (`security/scanner.rs`)**: Automated scanning and redacting of API keys, tokens, passwords, and private SSH keys before writing to disk.
- [x] **Obsidian Vault 2-Way Sync (`JARVIS-MEMORY/`)**:
  - Structured canonical hierarchy: `INDEX.md`, `MEMORY.md`, `USER.md`, `facts/`, `knowledge/`, `context/`, `summaries/`, `Research/`, `conversations/`, `skills/`.
  - Real-time indexing, automated daily conversation turn logging, and Map of Content (MOC) generator.
  - Interactive Visual Memory Graph HUD (`InteractiveMemoryGraph.tsx`).

---

### 📰 PHASE 6 — Daily AI Knowledge & Ephemeral Research Agents
**Timeline**: Week 8-9 | **Focus**: Cutting-Edge Intelligence Intake | **Status**: 🟢 **85% DONE**

> Autonomous deep research agent and daily activity synthesis.

#### Features Completed & In Progress:
- [x] **Autonomous Research Agent (`src/research/engine.ts`)**: Multi-source search, fanout scraper, deduplication, Rule of N>=2 fact triangulation, and cited Markdown report generation.
- [x] **Live Voice Fact-Checking**: Sub-1.5s fast fact-check and claim verification for real-time conversation support.
- [x] **Daily Activity & Turn Logging (`obsidian_logger.ts`)**: Continuous logging of conversation turns, tools executed, and user preferences into Obsidian daily notes.
- [ ] **Startup AI News Harvester**: Automated boot worker to scrape arXiv, Hugging Face, Hacker News, and GitHub Trending for morning briefings.

---

### 🤖 PHASE 7 — Multi-Agent Federation & Connectors Ecosystem
**Timeline**: Week 9-10 | **Focus**: Specialist Delegation Mesh & Cloud Integrations | **Status**: 🟢 **100% DONE**

> 5-Agent Persona Ecosystem, sub-100ms voice persona swapping, and native cloud connectors for Google Workspace, LinkedIn, and GitHub.

#### Features Completed:
- [x] **5-Agent Persona Ecosystem**:
  - 🔵 **JARVIS**: Prime Master Orchestrator, system executive, polished British butler.
  - 🟢 **FRIDAY**: Tactical Execution & Rapid Operations Master, swift action taker.
  - 🔴 **ULTRON**: Security Sentinel, permission guardian, and system auditor.
  - 🟣 **EDITH**: Internet Intel, deep researcher, and real-time grounding agent.
  - 🟡 **KAREN**: Systems Engineer, hardware diagnostics, and dev environment specialist.
- [x] **Sub-100ms Persona Hot-Swapping**: Instant voice persona switching (`switch_persona`, `swap-persona`, prompt hot-swapping) without breaking the audio session.
- [x] **Universal Google Workspace Integration (`google_auth_service.ts`, `google_oauth_flow.py`)**:
  - Gmail: Read emails, search inbox, draft and send messages.
  - Google Calendar: List events, create calendar bookings, update schedule.
  - Google Tasks: List, create, complete, and organize task items.
  - Google Drive: Search files, retrieve document metadata.
- [x] **LinkedIn Cloud Integration (`linkedin_service.ts`, `linkedin_service.py`, `linkedin_oauth_flow.py`)**:
  - Profile retrieval, post publishing with custom visibility, people and recruiter search, job listings search, direct messaging, and connection requests.
- [x] **GitHub Developer Integration (`github_service.ts`, `github_service.py`, `github_oauth_flow.py`)**:
  - User profile, repository listing, issue creation, Gist creation, repository details inspection.
- [x] **Hermes Autonomous Intelligence Runtime (`hermes_agent_runtime.ts`)**:
  - Agent delegation tool (`delegation_tool.ts`), cron automation tool (`cron_tool.ts`), skills harvester tool (`skills_tool.ts`), Python plugin runner (`python_plugin_tool.ts`), and memory search tool (`memory_search_tool.ts`).

---

### 🧬 PHASE 8 — Cognitive Nervous System & Autonomous Evolution (Ada-SI)
**Timeline**: Week 10-12 | **Focus**: System-Wide Neural Awareness, Reflection & Runtime Capability Forging | **Status**: 🟢 **100% DONE**

> Continuous awareness, skill harvesting, latency response, ground-truth validation, and Ada-SI dynamic capability forge.

#### Features Completed & In Progress:
- [x] **Artificial Nervous System & Reflex Layer**: EventBus pub/sub, sub-50ms Latency Response System (`latency_response_system.ts`) with conversational fillers, and instant barge-in cutoff.
- [x] **1,440+ Dynamic Skill Harvester (`skill_harvester.ts`, `skills_engine.ts`)**: Dynamic harvesting and prompt context formatting from master skills catalog.
- [x] **Ground Truth Registry (`ground_truth_registry.ts`)**: Strict factual validation preventing hallucination of system specs, files, and hardware states.
- [x] **Pre-Flight Suit Diagnostics (`suit_diagnostics.ts`)**: 17-point automated sweep validating actuators, databases, personas, audio chain, and cloud connectors.
- [x] **Universal Context & Memory Compressor (`context_compressor.ts`, `prompt_loader.ts`, `prompt_engine.py`)**: Dynamic packet compilation with token budget management.
- [x] **Experience Memory Schema**: Structured tracking of situations, actions, results, and lessons in SQLite WAL + Obsidian.
- [x] **Ada-SI Capability Forge & Linux Sandbox (`capability_forge.ts`, `forge_sandbox.py`, `tool_ast_auditor.py`, `ForgeView.tsx`)**:
  - Runtime tool genesis: Autonomously detects capability gaps, generates Python tools + synthetic test suites.
  - ULTRON AST Security Auditor: Statically inspects AST to block forbidden imports, dangerous dynamic calls (`eval`, `exec`), and path traversal.
  - Linux `bwrap` (Bubblewrap) sandbox: Executes and tests code in sterile tmpfs chroot jail with zero master API key leakage.
  - Hot-reload tool registration: Dynamically registers tools into live `tool_registry.ts` and `actuator_dispatcher.py` and syncs with `JARVIS-MEMORY/skills/{name}/SKILL.md`.
  - 7-Stage graduated promotion: `EXPERIMENTAL` ➔ `TESTING` ➔ `CANARY` ➔ `TRUSTED` with automatic quarantine sentinel upon failure.
  - Dedicated Glassmorphic Capability Forge UI in J.A.R.V.I.S. HUD.

---

### ⚡ PHASE 9 — Autonomous Task & Verification Engine
**Timeline**: Week 12-13 | **Focus**: True Autonomy with Feedback | **Status**: 🟡 **60% DONE**

> Long-running background tasks that execute, track state, and report progress asynchronously.

#### Features Completed & In Progress:
- [x] **Task Priority Queue (`task_queue.ts`)**: In-process priority queue with dependency resolution, retry logic, and timeouts.
- [x] **Async Background Execution Runner**: Automatic fast handoff of heavy CLI commands (`npm`, `cargo`, `pip`, `docker`, `git`) to background execution without blocking live voice conversation.
- [x] **Background Task Registry & UI Telemetry**: Real-time tracking of active, completed, and failed background jobs.
- [ ] **Post-Action Visual Verification Loop**: Screenshot capture and multimodal validation confirming that automated actions succeeded on screen.
- [ ] **Self-Correction & Automated Strategy Retry**: Dynamic workflow re-planning when a sub-action encounters an unexpected UI or system state.

---

### 📢 PHASE 10 — Proactive JARVIS & System Watchdog
**Timeline**: Week 13-14 | **Focus**: Alive & Self-Monitoring | **Status**: 🟢 **85% DONE**

> JARVIS speaks when it matters — morning briefings, hardware health warnings, and automatic recovery.

#### Features Completed & In Progress:
- [x] **Proactive Morning Greeting & Briefing (`automatic_greeting.ts`)**: Vocal greeting upon initial daily activation with time, persona personality, and briefing in English or Telgish.
- [x] **System Watchdog & Self-Healing (`watchdog.ts`)**: Automated probe detecting degraded subsystems and sound server healing (`heal_sound_server` for PipeWire/WirePlumber).
- [x] **Hardware Sentinel Telemetry**: Real-time monitoring of CPU, RAM, GPU, storage, battery, thermals, and network metrics via native C++ workers.
- [ ] **Proactive Critical Threshold Audio Alerts**: Voice interrupt alerts when battery drops below 15% or CPU temperature exceeds 80°C.

---

### 🔄 PHASE 11 — n8n Workflow Automation Engine
**Timeline**: Week 14-15 | **Focus**: Low-Code Multi-App Pipelines | **Status**: 🟡 **35% DONE**

> Connect JARVIS to external webhooks, cron jobs, and services.

#### Features Completed & In Progress:
- [x] **Cron Engine & Task Scheduler (`cron_engine.ts`, `cron_tool.ts`)**: In-process cron scheduling and periodic automation runner.
- [ ] **n8n REST Integration**: Voice-triggered execution of self-hosted n8n workflows.
- [ ] **Voice-to-Workflow Generator**: Tell JARVIS a routine to generate n8n JSON nodes and deploy locally.
- [ ] **Bi-Directional Webhook Gateway**: External webhook receiver for third-party triggers.

---

### 🛡️ PHASE 12 — Security Hardening & Permissions
**Timeline**: Week 15-16 | **Focus**: Ironclad Workstation Safety | **Status**: 🟢 **90% DONE**

> Safe autonomous execution with command validation, secret protection, and graduated trust.

#### Features Completed & In Progress:
- [x] **Security Guard Command Validator (`security_guard.ts`, `core_engine/security.py`)**: Strict command whitelisting, dangerous argument blocking (`rm -rf /`, fork bombs), and forbidden path protection.
- [x] **Pre-Persistence Secret Scanner (`memory_engine/src/security/`)**: Automated regex pattern matching for API keys, bearer tokens, passwords, and private keys before memory storage.
- [x] **Graduated Execution Trust & Fast Handoff**: Safe execution separation for read-only vs mutating commands.
- [ ] **Emergency Voice Kill Switch**: Instant voice command (*"Jarvis, abort all tasks"*) terminating all active worker processes.

---

## 🔮 Further Stages (Deferred Future Upgrades)

These phases are designed for future implementation when transitioning to an always-on VPS or upgraded hardware:

---

### 📱 PHASE 13 — Future: Remote Access & Mobile PWA
- [ ] **Tailscale Mesh VPN**: Encrypted private tunnel to your desktop without open ports.
- [ ] **Telegram AI Bot (`grammy`)**: Send voice notes & text from your phone; JARVIS executes on desktop and replies.
- [ ] **Mobile PWA**: Responsive web app for remote voice streaming from your phone browser.
- [ ] **WhatsApp Business API**: WhatsApp gateway for mobile task dispatch.

---

### 📺 PHASE 14 — Future: Multi-Channel / TV Command Center
- [ ] **Voice-Switched TV Channels**: *"Jarvis, switch to news channel"*, *"Switch to security channel"*.
- [ ] **Split-Screen HUD**: Simultaneous monitoring of agent activity, system thermals, and camera feeds.
- [ ] **Picture-in-Picture Visualizer**: Mini-HUD for background desktop work.

---

### 🔋 PHASE 15 — Future: Offline Local AI & Wake Word
- [ ] **Local Neural Wake Word ("Hello Jarvis")**: OpenWakeWord running 24/7 on CPU (~30MB RAM).
- [ ] **Local Whisper STT & Piper TTS**: 100% offline fallback voice conversation.
- [ ] **Ollama Local LLM Integration**: Run Llama 3.2 3B / 8B for local reasoning during internet outages.

---

## 📋 Recommended Build Priority

```
PRIORITY 1  ➔  Phase 0  : Core Architecture & Ephemeral Lifecycle (🟢 100% DONE)
PRIORITY 2  ➔  Phase 1  : Real-Time Voice Core Polish (🟢 100% DONE)
PRIORITY 3  ➔  Phase 3  : Computer & System Control (🟢 100% DONE)
PRIORITY 4  ➔  Phase 5  : Memory & Obsidian Life OS (🟢 100% DONE)
PRIORITY 5  ➔  Phase 4  : Ephemeral Browser & Grounded Web Agent (🟢 100% DONE)
PRIORITY 6  ➔  Phase 7  : Multi-Agent Federation & Connectors (🟢 100% DONE)
PRIORITY 7  ➔  Phase 8  : Capability Forge & Runtime Self-Extension (🟢 100% DONE)
PRIORITY 8  ➔  Phase 9  : Codebase Memory & Real-Time AST Graph MCP (🟢 100% DONE)
PRIORITY 9  ➔  Phase 2  : Unified Ephemeral Vision (🟢 90% DONE)
PRIORITY 10 ➔  Phase 12 : Security Hardening & Permissions (🟢 90% DONE)
PRIORITY 11 ➔  Phase 10 : Proactive JARVIS & System Watchdog (🟢 85% DONE)
PRIORITY 12 ➔  Phase 6  : Daily AI Knowledge & Research Agents (🟢 85% DONE)
PRIORITY 13 ➔  Phase 11 : n8n Workflow Automation (🟡 35% DONE)
FUTURE      ➔  Phases 13–15 : Remote Access, Mobile PWA, Telegram, TV Channels, Local AI
```

---

## 🌟 The Ultimate J.A.R.V.I.S. Daily Workflow

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                             A DAY IN THE LIFE WITH J.A.R.V.I.S.                         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 🌅 MORNING (08:00 AM)                                                                  │
│    • User activates JARVIS ➔ Automatic greeting delivered in English or Telgish.        │
│    • J.A.R.V.I.S. provides proactive morning voice briefing (Calendar, Tasks, System).  │
│    • J.A.R.V.I.S. adjusts screen brightness & volume to optimal morning settings.      │
│                                                                                        │
│ 💻 WORKDAY (11:00 AM)                                                                  │
│    • "Jarvis, open VS Code and start the dev server" ➔ Executed instantly via C++.     │
│    • "Jarvis, look at my screen — why is this build failing?" ➔ Vision spins up,       │
│      inspects terminal output, highlights the missing dependency, and auto-tears down. │
│    • "Check my LinkedIn messages and summarize my unread emails" ➔ Executed via cloud  │
│      connectors and spoken aloud seamlessly.                                           │
│                                                                                        │
│ 🔬 AFTERNOON (03:00 PM)                                                                │
│    • "Jarvis, research the top 3 open-source vector databases and compare them."       │
│    • Research Agent activates ➔ Searches web, extracts specs, triangulates facts,     │
│      saves markdown report directly to Obsidian Vault ➔ Automatically deactivates.     │
│                                                                                        │
│ 🌙 EVENING (08:00 PM)                                                                  │
│    • "Jarvis, what did I accomplish today?"                                            │
│    • J.A.R.V.I.S. reads today's Obsidian daily log and hierarchical memory summaries,  │
│      summarizes completed tasks, and prepares tomorrow's priority queue.               │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

*Last Updated: 20/08/2026*  
*Authored by J.A.R.V.I.S. Multi-Agent Engineering Core*
