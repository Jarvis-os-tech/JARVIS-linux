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
| **Phase 0** | **Core Architecture & Ephemeral Lifecycle** | Event bus, switch registry, SQLite, task queue, lifecycle manager | ⚪ **NEXT** |
| **Phase 1** | **Real-Time Voice Core Polish** | Barge-in handling, noise filtering, voice memory | 🟢 **80% DONE** |
| **Phase 2** | **Unified Ephemeral Vision & Perception** | Voice-toggled screen + camera + OCR + gesture (auto-teardown) | 🟡 **PARTIAL** |
| **Phase 3** | **Computer & System Control (Primary)** | Wayland mouse/keys, AT-SPI UI targeting, PTY terminal, apps | 🟡 **ACTIVE** |
| **Phase 4** | **Ephemeral Browser & Internet Agent** | Playwright on-demand automation, web search, extraction | ⚪ UPCOMING |
| **Phase 5** | **Memory & Obsidian Life OS** | SQLite long-term facts + automatic 2-way Obsidian daily sync | 🟡 **BASIC** |
| **Phase 6** | **Daily AI Knowledge & Research Agents**| Auto-boot AI news digest + on-demand deep research agent | ⚪ UPCOMING |
| **Phase 7** | **Multi-Agent Federation** | Hermes bridge, OpenClaw GitHub coder, specialist delegation | ⚪ UPCOMING |
| **Phase 8** | **Autonomous Task & Verification Engine** | Long-running jobs, priority queue, visual verification loop | ⚪ UPCOMING |
| **Phase 9** | **Proactive JARVIS & System Watchdog** | Morning briefings, proactive health warnings, self-healing | ⚪ UPCOMING |
| **Phase 10**| **n8n Workflow Automation Engine** | Voice-driven multi-app pipelines and webhook automations | ⚪ UPCOMING |
| **Phase 11**| **Security Hardening & Permissions** | Trust-level permission gates, audit logging, kill switch | ⚪ UPCOMING |
| **Phase 12**| **Future: Remote Access & Mobile PWA** | Tailscale VPN, Telegram / WhatsApp bots, Mobile PWA | 🔵 **FUTURE** |
| **Phase 13**| **Future: Multi-Channel Command Center**| Multi-channel TV dashboard, split telemetry views | 🔵 **FUTURE** |
| **Phase 14**| **Future: Offline Local AI & Wake Word** | OpenWakeWord, local Whisper, Ollama local weights | 🔵 **FUTURE** |

---

## 🔍 Detailed Phase Breakdown

---

### 🏗️ PHASE 0 — Core Architecture & Ephemeral Lifecycle
**Timeline**: Week 1-2 | **Focus**: Central Nervous System & Resource Sweeper

> Establish the rock-solid foundation with automatic resource teardowns so JARVIS stays blazing fast.

#### Core Subsystems to Build:
- [ ] **Prime JARVIS Orchestrator**: Central router connecting voice, tools, agents, and state.
- [ ] **Ephemeral Lifecycle & Resource Sweeper Manager (`lifecycle_manager.ts`)**: Automatically shuts down idle browser contexts, video pipelines, PTY shells, and specialist agents after use.
- [ ] **Event Bus (`eventemitter3`)**: Decoupled pub/sub event system for all events (`task:created`, `vision:toggle`, `agent:done`).
- [ ] **Feature Switch Manager**: Structured, hot-reloadable system reflecting the 4 operational tiers.
- [ ] **SQLite Database Engine (`better-sqlite3`)**: Single-file storage for tasks, long-term memories, logs, and configuration.
- [ ] **Tool Registry**: Unified catalog and dispatcher for C++ workers, Playwright browser tools, and workspace APIs.
- [ ] **Task Priority Queue**: In-process priority queue with dependency resolution and timeouts.
- [ ] **Health Monitoring & Structured Logger (`pino`)**: Real-time heartbeat tracking and structured JSON logging.
- [ ] **Self-Healing Watchdog**: Automatic detection and recovery for failed subprocesses.

---

### 🎙️ PHASE 1 — Real-Time Voice Core Polish
**Timeline**: Week 2-3 | **Focus**: Fluid Natural Conversation

> Refine the existing Gemini Live voice system into an uninterrupted, natural conversational experience.

#### Features to Complete:
- [ ] **Barge-in & Interruption Handling**: Cancel outgoing audio instantly when the user starts speaking.
- [ ] **AudioWorklet Background Noise Gate**: Client-side audio filtering to eliminate background hiss with 0 API cost.
- [ ] **Silence & VAD Optimization**: Rust gateway audio amplitude metering to detect speech boundaries.
- [ ] **Voice Session Memory**: Inject rolling conversation context into Gemini Live instructions.
- [ ] **Dynamic Voice Speed & Persona Timbre**: Configure speech pacing and character traits across the 6 MCU personas.

---

### 👁️ PHASE 2 — Unified Ephemeral Vision & Perception
**Timeline**: Week 3-4 | **Focus**: Complete Visual Awareness with Zero Idle Cost

> Merge screen sharing, webcam, OCR, and visual reasoning into **one single voice-controlled subsystem that shuts down immediately after use**.

#### Features to Build:
- [ ] **Unified Vision Subsystem**: Single switch controlling screen capture (`grim` / `getDisplayMedia`) and webcam (`getUserMedia`).
- [ ] **Voice-Activated Auto-Lifecycle**:
  - *"Jarvis, look at my screen"* ➔ Starts screen capture ➔ Delivers visual reasoning ➔ Stops capture stream on task completion.
  - *"Jarvis, turn on my camera"* ➔ Starts camera capture ➔ Answers visual inquiry ➔ Auto-stops stream.
  - *"Jarvis, stop vision"* ➔ Explicit immediate teardown.
- [ ] **Screen OCR Pipeline**: Local Tesseract OCR extraction for reading error codes, terminal text, and document snippets.
- [ ] **Visual Error & Code Inspector**: Automatically detects crash dialogs and syntax errors on screen.
- [ ] **On-Demand Gesture Recognition**: Only activates when user explicitly says *"Jarvis, activate gesture control"*. Shuts down video processing as soon as gesture control is turned off.

---

### 🖥️ PHASE 3 — Computer & System Control (Top Priority)
**Timeline**: Week 4-6 | **Focus**: Hands-Free Workstation Mastery

> Give JARVIS the power to operate your Ubuntu Linux desktop completely hands-free via voice.

#### Features to Build:
- [ ] **Semantic UI Targeting (GNOME AT-SPI)**: Query accessibility tree via D-Bus to find buttons and text boxes by label rather than blind coordinates.
- [ ] **Wayland Mouse & Keyboard Actuators (`ydotool` / `wtype`)**: Virtual kernel input driver for clicking, dragging, typing, and keyboard shortcuts.
- [ ] **Application & Window Manager**: Launch any installed app (`.desktop` parser), switch focus, snap windows, minimize/maximize via Mutter D-Bus.
- [ ] **Persistent / Ephemeral PTY Terminal Shell (`node-pty`)**: Spawns background terminal sessions for bash workflows, streams output, and auto-destroys shell sessions when done.
- [ ] **Multi-Step Action Chains**: *"Jarvis, open VS Code, create a file called test.py, and run it"* ➔ Atomic execution with verification.
- [ ] **C++ Worker Expansion**: Compile `at_spi_inspector.cpp` and `window_manager.cpp` into `workers_cpp/bin/`.

---

### 🌐 PHASE 4 — Ephemeral Browser & Internet Agent
**Timeline**: Week 6-7 | **Focus**: Autonomous Web Navigation with Zero Idle RAM

> Launch Chromium on-demand, extract answers, and destroy the browser instance immediately.

#### Features to Build:
- [ ] **Ephemeral Playwright Browser Controller**: Launches headless Chromium only when a web action is needed; terminates browser process immediately upon result retrieval (~180MB RAM freed).
- [ ] **Smart Content Extractor**: Strip ads, navbars, and boilerplate to extract clean markdown articles.
- [ ] **Autonomous Web Search**: Multi-engine search via DuckDuckGo API and SearXNG with 0 API key costs.
- [ ] **Form Filling & Downloads**: Automatically fill search bars, login prompts, and download files to `~/Downloads`.
- [ ] **Session Storage**: Save cookies/sessions to SQLite so ephemeral browser launches retain logins without staying open in RAM.

---

### 🧠 PHASE 5 — Memory System & Obsidian Life OS
**Timeline**: Week 7-8 | **Focus**: 100% Private Persistent Memory

> JARVIS remembers everything you do, learn, and discuss — synced 2-way with your Obsidian Vault.

#### Features to Build:
- [ ] **Canonical Memory Store (SQLite)**: Store user preferences, ongoing projects, hardware specs, and personal facts.
- [ ] **Automatic Fact Extraction**: Real-time extraction of key details from user voice conversations.
- [ ] **Obsidian Vault 2-Way Sync (Always Active)**:
  - Automatically writes structured daily summaries to `Daily Notes/YYYY-MM-DD.md`.
  - Indexes existing Obsidian markdown notes to answer queries from your personal knowledge base.
  - Automatically appends action items and task checklists to your Obsidian workspace.
- [ ] **Memory Decay & Importance Scoring**: Rank memories by importance and frequency of access.

---

### 📰 PHASE 6 — Daily AI Knowledge & Ephemeral Research Agents
**Timeline**: Week 8-9 | **Focus**: Cutting-Edge Intelligence Intake

> Never fall behind on AI breakthroughs, tools, and research.

#### Features to Build:
- [ ] **AI News Agent (Auto-Boot + On-Demand Ephemeral)**:
  - **On Startup**: Automatically boots, scrapes AI news (Hacker News, arXiv, Hugging Face, GitHub Trending), writes a structured briefing to Obsidian and memory, and **immediately exits**.
  - **On-Demand**: Activates when user asks *"Jarvis, what's new in AI today?"*, provides verbal summary, then **immediately deactivates**.
- [ ] **Research Agent (On-Demand Ephemeral)**:
  - Activates only when user requests deep research (*"Jarvis, research the latest advancements in WebAssembly audio"*).
  - Multi-source search ➔ Deduplicate ➔ Fact-check ➔ Summarize ➔ Save report to Obsidian ➔ **Immediately exits**.
- [ ] **Daily Briefing Structure**:
  ```text
  1. Top AI News & Model Releases
  2. Trending GitHub Repositories
  3. Important arXiv Research Papers
  4. Practical takeaways for J.A.R.V.I.S. development
  ```

---

### 🤖 PHASE 7 — Multi-Agent Federation (Hermes & OpenClaw)
**Timeline**: Week 9-10 | **Focus**: Specialist Delegation Mesh

> JARVIS acts as the CEO, delegating specialist jobs to dedicated subagents that run and terminate cleanly.

#### Features to Build:
- [ ] **Hermes Assistant Bridge (`~/.hermes`)**: Ingest Hermes tool execution heuristics, deep kernel sensors, and rapid bash scripting.
- [ ] **OpenClaw GitHub Commander**: Connect OpenClaw for autonomous code reviews, git commits, PR creation, and branch management.
- [ ] **Ephemeral Agent Lifecycle**: Subagents spin up on-demand, execute their delegated task, report results to JARVIS via Muted Relay, and immediately exit.
- [ ] **Agent Telemetry**: Track latency, token usage, and execution success rates per agent.

---

### ⚡ PHASE 8 — Autonomous Task & Verification Engine
**Timeline**: Week 10-11 | **Focus**: True Autonomy with Feedback

> Long-running tasks that plan, execute, verify results, and self-correct without user hand-holding.

#### Features to Build:
- [ ] **Autonomous Execution Loop**:
  $$\text{User Goal} \longrightarrow \text{Deconstruct} \longrightarrow \text{Delegate} \longrightarrow \text{Execute} \longrightarrow \text{Visual Verify} \longrightarrow \text{Report}$$
- [ ] **Verification Engine**: Take post-action screenshots and use AI vision to confirm that operations succeeded (e.g. confirming a PR was submitted or an app opened).
- [ ] **Self-Correction & Retry**: If verification fails, inspect errors, adjust parameters, and retry with an alternative strategy.
- [ ] **Background Execution**: Tasks run asynchronously in worker threads without interrupting live voice conversations.

---

### 📢 PHASE 9 — Proactive JARVIS & System Watchdog
**Timeline**: Week 11-12 | **Focus**: Alive & Self-Monitoring

> JARVIS speaks when it matters — morning briefings, hardware health warnings, and automatic recovery.

#### Features to Build:
- [ ] **Morning Voice Briefing (Proactive)**: Spoken upon the user's first voice activation of the day (Calendar events, pending tasks, overnight AI news).
- [ ] **Hardware Sentinel**: Proactive voice warnings if CPU temperature exceeds 80°C, battery drops below 15%, or storage exceeds 90%.
- [ ] **Self-Healing Watchdog**: Automatically restarts dead daemons or WebSocket proxies and logs recovery diagnostics.
- [ ] **Task Completion Alerts**: Vocal announcement when a long-running background task finishes.

---

### 🔄 PHASE 10 — n8n Workflow Automation Engine
**Timeline**: Week 12-13 | **Focus**: Low-Code Multi-App Pipelines

> Connect JARVIS to external webhooks and services.

#### Features to Build:
- [ ] **n8n REST Integration**: Trigger self-hosted n8n workflows via voice commands.
- [ ] **Voice-to-Workflow Generator**: Tell JARVIS a multi-step routine; JARVIS generates the n8n JSON nodes and deploys them to localhost.
- [ ] **Bi-Directional Webhook Gateway**: External webhooks post alerts to JARVIS, which vocalizes them to you.

---

### 🛡️ PHASE 11 — Security Hardening & Permissions
**Timeline**: Week 13-14 | **Focus**: Ironclad Workstation Safety

> Safe autonomous execution with a graduated trust model.

#### Features to Build:
- [ ] **Graduated Permission Levels**:
  - `Level 0 (Observe)`: System telemetry & screen reading (always allowed).
  - `Level 1 (Suggest)`: Propose actions to user verbally.
  - `Level 2 (Ask First)`: Prompt for voice confirmation before destructive actions (file deletion, kill process).
  - `Level 3 (Autonomous)`: Execute trusted routines automatically.
- [ ] **Emergency Kill Switch**: Immediate voice trigger (*"Jarvis, abort all tasks and shut down"*) that kills all active worker processes.
- [ ] **Cryptographic Audit Log**: Append-only SQLite audit log recording every system action with timestamp and reason.

---

## 🔮 Further Stages (Deferred Future Upgrades)

These phases are designed for future implementation when transitioning to an always-on VPS or upgraded hardware:

---

### 📱 PHASE 12 — Future: Remote Access & Mobile PWA
- [ ] **Tailscale Mesh VPN**: Encrypted private tunnel to your desktop without open ports.
- [ ] **Telegram AI Bot (`grammy`)**: Send voice notes & text from your phone; JARVIS executes on desktop and replies.
- [ ] **Mobile PWA**: Responsive web app for remote voice streaming from your phone browser.
- [ ] **WhatsApp Business API**: WhatsApp gateway for mobile task dispatch.

---

### 📺 PHASE 13 — Future: Multi-Channel / TV Command Center
- [ ] **Voice-Switched TV Channels**: *"Jarvis, switch to news channel"*, *"Switch to security channel"*.
- [ ] **Split-Screen HUD**: Simultaneous monitoring of agent activity, system thermals, and camera feeds.
- [ ] **Picture-in-Picture Visualizer**: Mini-HUD for background desktop work.

---

### 🔋 PHASE 14 — Future: Offline Local AI & Wake Word
- [ ] **Local Neural Wake Word ("Hello Jarvis")**: OpenWakeWord running 24/7 on CPU (~30MB RAM).
- [ ] **Local Whisper STT & Piper TTS**: 100% offline fallback voice conversation.
- [ ] **Ollama Local LLM Integration**: Run Llama 3.2 3B / 8B for local reasoning during internet outages.

---

## 📋 Recommended Build Priority

```
PRIORITY 1  ➔  Phase 0  : Core Architecture & Ephemeral Lifecycle (Foundation & Sweeper)
PRIORITY 2  ➔  Phase 1  : Real-Time Voice Core Polish (Barge-in & Clarity)
PRIORITY 3  ➔  Phase 3  : Computer & System Control (Hands-Free Wayland Mastery)
PRIORITY 4  ➔  Phase 2  : Unified Ephemeral Vision (Voice-Toggled Vision & Auto-Teardown)
PRIORITY 5  ➔  Phase 5  : Memory & Obsidian Life OS (Automatic Knowledge Base)
PRIORITY 6  ➔  Phase 6  : Daily AI Knowledge & Research Agents (Auto-Boot + Ephemeral)
PRIORITY 7  ➔  Phase 4  : Ephemeral Browser Agent (Playwright Auto-Teardown)
PRIORITY 8  ➔  Phase 7  : Multi-Agent Federation (Hermes & OpenClaw)
PRIORITY 9  ➔  Phase 8  : Autonomous Task & Verification Engine (Reliable Autonomy)
PRIORITY 10 ➔  Phase 9  : Proactive JARVIS & System Watchdog (Alive Personality)
PRIORITY 11 ➔  Phase 10 : n8n Workflow Automation (Multi-App Pipelines)
PRIORITY 12 ➔  Phase 11 : Security Hardening & Permission System (Safety Core)
FUTURE      ➔  Phases 12–14 : Remote Access, Mobile PWA, Telegram, TV Channels, Local AI
```

---

## 🌟 The Ultimate J.A.R.V.I.S. Daily Workflow

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                             A DAY IN THE LIFE WITH J.A.R.V.I.S.                         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 🌅 MORNING (08:00 AM)                                                                  │
│    • User activates JARVIS ➔ AI News Agent has already indexed overnight breakthroughs │
│      and cleanly exited, leaving 100% memory available.                                │
│    • J.A.R.V.I.S. provides proactive morning voice briefing (Calendar, AI News, Tasks)  │
│    • J.A.R.V.I.S. adjusts screen brightness & volume to optimal morning settings.      │
│                                                                                        │
│ 💻 WORKDAY (11:00 AM)                                                                  │
│    • "Jarvis, open VS Code and start the dev server" ➔ Executed instantly.             │
│    • "Jarvis, look at my screen — why is this build failing?" ➔ Vision spins up,       │
│      inspects terminal output, highlights the missing dependency, and auto-tears down. │
│    • "Tell OpenClaw to refactor the database connector" ➔ Delegated in background.     │
│                                                                                        │
│ 🔬 AFTERNOON (03:00 PM)                                                                │
│    • "Jarvis, research the top 3 open-source vector databases and compare them."       │
│    • Research Agent activates ➔ Searches web, extracts specs, generates comparison,   │
│      saves markdown report directly to Obsidian Vault ➔ Automatically deactivates.     │
│                                                                                        │
│ 🌙 EVENING (08:00 PM)                                                                  │
│    • "Jarvis, what did I accomplish today?"                                            │
│    • J.A.R.V.I.S. reads today's Obsidian daily log, summarizes completed tasks, and     │
│      prepares tomorrow's priority queue.                                               │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

*Authored by J.A.R.V.I.S. Multi-Agent Engineering Core — 2026*
