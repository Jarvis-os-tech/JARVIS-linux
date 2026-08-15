<div align="center">

```
   ██╗ █████╗ ██████╗ ██╗   ██╗██╗███████╗
   ██║██╔══██╗██╔══██╗██║   ██║██║██╔════╝
   ██║███████║██████╔╝██║   ██║██║███████╗
██ ██║██╔══██║██╔══██╗╚██╗ ██╔╝██║╚════██║
╚████║██║  ██║██║  ██║ ╚████╔╝ ██║███████║
 ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝╚══════╝
```

### **The Sovereign Autonomous AI Operating Engine & Personal Linux Super-Assistant**

[![Platform](https://img.shields.io/badge/OS-Ubuntu_Linux_22.04%2B-E95420?style=for-the-badge&logo=ubuntu&logoColor=white)](https://ubuntu.com/)
[![React 19](https://img.shields.io/badge/Frontend-React_19_+_Vite_6-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript_5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS 4](https://img.shields.io/badge/Styles-Tailwind_CSS_v4-38B2AC?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Gemini Live API](https://img.shields.io/badge/Voice_AI-Gemini_Live_WebSocket-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![C++ Workers](https://img.shields.io/badge/Native_Actuators-POSIX_C%2B%2B17-00599C?style=for-the-badge&logo=c%2B%2B&logoColor=white)](https://isocpp.org/)
[![Rust Audio Gateway](https://img.shields.io/badge/Audio_Gateway-Rust_Zero--GC-DEA584?style=for-the-badge&logo=rust&logoColor=black)](https://www.rust-lang.org/)
[![Obsidian Life OS](https://img.shields.io/badge/Memory_Vault-Obsidian_Markdown-7C3AED?style=for-the-badge&logo=obsidian&logoColor=white)](https://obsidian.md/)

<br />

<p align="center">
  <strong>Instantaneous, hands-free, autonomous command over your local Ubuntu Linux desktop.</strong><br />
  Featuring bidirectional 16kHz audio streaming with sub-200ms turnaround, multimodal live screen/camera vision, sub-millisecond C++ POSIX kernel actuators, a specialized 5-agent departmental swarm, and a 100% private Obsidian Life OS.
</p>

---

[Key Capabilities](#-key-capabilities) •
[System Architecture](#-system-architecture) •
[Agent Swarm Matrix](#-the-multi-agent-swarm-matrix) •
[Native C++ Actuators](#-sub-millisecond-posix-c-workers) •
[Obsidian Life OS](#-100-private-obsidian-life-os) •
[Quickstart Guide](#-quickstart-guide) •
[Repository Layout](#-repository-layout)

---

</div>

## ⚡ Key Capabilities

- 🎙️ **Real-Time Bidirectional Voice Streaming**: Direct 16kHz/24kHz PCM audio pipeline via WebSockets into Google Gemini Live API with sub-200ms conversational latency.
- 👁️ **Multimodal Screen & Camera Vision**: Dynamic desktop window capture and webcam visual analysis for instant code debugging, error diagnostics, and GUI automation.
- 🔄 **Sub-100ms Hot-Swap Voice Transfer**: Instantly switch live conversational floor between all 5 agent personas (`JARVIS` ↔ `FRIDAY` ↔ `ULTRON` ↔ `EDITH` ↔ `KAREN`) with zero audio reconnection delay.
- ⚡ **Sub-Millisecond Direct POSIX Actuators**: High-performance C++ binaries (`workers_cpp/bin/`) that execute directly against Mutter D-Bus, X11, PulseAudio, and `/proc` with 0% idle RAM persistence.
- 🧠 **100% Private Obsidian Life OS**: Bi-directional Markdown memory vault (`JARVIS-MEMORY/`) synced with SQLite and reactive frontend HUD for permanent contextual memory.
- 🌐 **Universal Telgish & Multilingual Intelligence**: Converses naturally in Romanized Telugu mixed with English technical vocabulary by default, switching languages only upon explicit user command.
- 🏢 **Google Workspace Autonomous Ops**: Hands-free triage of Gmail, Google Calendar scheduling, Docs generation, Drive searches, and Sheets data aggregation.

---

## 🏛️ System Architecture

J.A.R.V.I.S. implements a multi-tier, best-tool-for-the-job execution pipeline engineered for maximum speed and zero speculative runtime bloat:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              J.A.R.V.I.S. OPERATING SYSTEM                             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  🖥️ REACT 19 + TAILWIND 4 GLASSMORPHIC HUD                                             │
│     ├── Quantum Canvas Audio Orb & Real-Time Waveform Synthesizer                      │
│     ├── Persistent Interactive Command Console (Sequential Voice/Text History Stream)  │
│     ├── Dynamic Knowledge Hub & Memory Detail Inspector (Unmasked Monospace Raw Text)  │
│     └── System Telemetry Strip (Real-time CPU load, Memory, Network, Port Security)   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  ⚡ MULTI-AGENT DEPARTMENTAL REASONING SWARM                                           │
│     ├── 👑 J.A.R.V.I.S. (CEO)      : Master Voice Anchor & Tactical Linux OS Overlord  │
│     ├── 🔬 F.R.I.D.A.Y. (Research) : Deep Internet Dominator, arXiv & AI Intel Swarm   │
│     ├── 🛡️ U.L.T.R.O.N. (CSO)      : Port Shielding, RAM Cache Purge & Trap Deflection │
│     ├── 🏛️ E.D.I.T.H. (Code)       : 3-Stage Coding Council (Architect/Optimizer/QA)   │
│     └── ⚙️ K.A.R.E.N. (Pipelines)  : YouTube Automation, Webhooks & Messaging Relays   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  🎙️ REAL-TIME STREAMING & MULTIMODAL VISION BRIDGE                                     │
│     ├── Google Gemini Live API (16kHz PCM bidirectional WebSockets)                    │
│     ├── High-Throughput Tactical Fallback: Groq (Llama 3.3 70B) & NVIDIA NIM           │
│     └── Continuous Multimodal Vision Ingestion (Desktop Display & Webcam Frames)       │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  ⚡ LOW-LEVEL NATIVE HARDWARE ACTUATORS                                                 │
│     ├── POSIX C++ Workers (/workers_cpp/bin/): Mutter D-Bus, PulseAudio, /proc         │
│     ├── Rust Audio Gateway (/gateway_rust/): Zero-GC ALSA/CPAL audio capture socket    │
│     └── Google Workspace Actuators: Gmail, Calendar, Drive, Docs, Sheets APIs          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  🧠 100% PRIVATE LOCAL OBSIDIAN LIFE OS (/JARVIS-MEMORY/)                              │
│     ├── Bi-Directional Reactive Memory Sync (Markdown Vault + SQLite Vector Cache)     │
│     └── Automated Daily Logging, Entity Fact Extraction & Task Board Synchronization   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🤖 The Multi-Agent Swarm Matrix

Each department leader possesses a distinct voice timbre, personality demeanor, specialized prompt directive, and operational hierarchy:

| Agent Persona | Department Role | Voice Timbre | Accent Color | Primary Directive & Operational Protocols |
| :--- | :--- | :--- | :--- | :--- |
| **👑 J.A.R.V.I.S.** | **Chief Executive Officer (CEO) & Principal Tactical Architect** | `Puck` *(British Wit)* | **Cyan** (`#06b6d4`) | Real-time conversational anchor, global user intent routing, departmental team delegation, and unrestricted direct Ubuntu Linux OS control via native shell actuators. |
| **🔬 F.R.I.D.A.Y.** | **Supreme AI & Web Research Department Leader** | `Kore` *(Hyper-Fast)* | **Orange** (`#f97316`) | Absolute dominion over the global web, multi-threaded arXiv scraping, GitHub trend forensics, AI model architecture analysis, and dense war-room knowledge briefings. |
| **🛡️ U.L.T.R.O.N.** | **Chief Security & System Performance Architect (CSO)** | `Charon` *(Theatrical)* | **Crimson** (`#ef4444`) | 24/7 continuous kernel safety auditing, port vulnerability shielding, honeypots, RAM/cache reclamation, CPU throttle elimination, and Protocol Omega autonomous exploit override. |
| **🏛️ E.D.I.T.H.** | **Strategic Architecture Planner & Code Chairman** | `Zephyr` *(Methodical)* | **Blue** (`#3b82f6`) | 3-Stage Coding Council *(System Architect, Resource Optimizer, Quality Auditor)*, modular blueprint design, memory leak elimination, and refactoring standards. |
| **⚙️ K.A.R.E.N.** | **Director of Autonomous Workflows & Automation Agency** | `Aoede` *(Snappy)* | **Amber** (`#f59e0b`) | Automated YouTube media rendering pipelines, cross-platform webhooks, headless worker coordination, and automated messaging relays (WhatsApp/Telegram/Email) with sub-500ms latency. |

---

## ⚡ Sub-Millisecond POSIX C++ Workers

All hardware and OS actuators are implemented as standalone, zero-dependency C++17 binaries compiled in `workers_cpp/bin/`. They execute immediately and exit to guarantee **0% idle RAM usage**:

- **`mutter_workspace_switch`**: Direct Mutter D-Bus window management and virtual workspace cycling.
- **`pulseaudio_actuator`**: Microsecond hardware volume adjustment, mute toggling, and sink switching.
- **`brightness_actuator`**: Direct sysfs backlight luminance adjustment.
- **`system_stats`**: Instant zero-overhead `/proc/meminfo`, `/proc/stat`, and thermal telemetry reader.

### Compiling Workers:
```bash
make -C workers_cpp
```

---

## 🧠 100% Private Obsidian Life OS

J.A.R.V.I.S. treats the local Obsidian markdown vault as its central nervous system:

```
JARVIS-MEMORY/
├── .obsidian/                    # Vault graph layout, appearance, and plugin settings
└── memory/
    ├── Daily Logs/               # Chronological daily turn logs & tool executions
    ├── Developer/                # Coding patterns, defuddle, scripts & agent skills
    ├── Instruction Memory/       # System-level automation & execution rules
    ├── Knowledge Base/           # Real-time structured topic nodes & entity graphs
    ├── Personal Details Memory/  # User identity, habits, hardware profiles & work windows
    ├── System Context/           # Multi-agent persona topology & departmental specs
    ├── System_Data/              # Local embedding indices, task histories, and caches
    ├── Task Memory/              # Active, scheduled, and completed task cards
    └── User Preference Memory/   # Preferred tools, browsers (Chrome), paths & settings
```

> [!NOTE]
> **Zero Data Leakage**: All private markdown notes, conversation logs, and task files are ignored by git via `.gitignore`. Only the directory structure (`.gitkeep` and `README.md`) is tracked in version control.

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- **Ubuntu Linux 22.04+** (or modern Linux environment)
- **Node.js**: v20.0.0 or higher
- **Build Tools**: `g++` / `clang++` (C++17), `make`
- **Optional**: `cargo` / `rustc` for low-latency Rust audio gateway

### 2. Installation
```bash
# Clone the repository
git clone git@github.com:Jarvis-os-tech/JARVIS-linux.git
cd JARVIS-linux

# Install NPM dependencies
npm install

# Build native C++ POSIX workers
make -C workers_cpp
```

### 3. Configure Environment Variables
Create a `.env.local` file in the project root:

```env
# Google Gemini API Key (Required for Live WebSocket Audio & Vision)
GEMINI_API_KEY=your_gemini_api_key_here

# Groq Cloud API Key (Optional for ultra-fast tactical fallback)
GROQ_API_KEY=your_groq_api_key_here

# NVIDIA NIM API Key (Optional for deep code analysis)
NVIDIA_NIM_API_KEY=your_nvidia_api_key_here

# Server Port
PORT=3000
```

### 4. Run Development Server
```bash
npm run dev
```

Open your browser and access the J.A.R.V.I.S. HUD at:
```
http://localhost:3000
```

---

## 📁 Repository Layout

```
JARVIS-linux/
├── src/
│   ├── components/
│   │   ├── jarvis/              # Glassmorphic HUD, Orb Visualizer, Views & Controls
│   │   │   ├── views/           # Command View, Memory View, Tasks View, Settings View
│   │   │   ├── JarvisApp.tsx    # Master HUD shell & responsive layout manager
│   │   │   └── JarvisProvider.tsx # Real-time state, WebSockets & persona coordinator
│   │   └── ClassicApp.tsx       # Standalone fallback streaming console
│   ├── data/
│   │   └── personas.ts          # Agent persona definitions & Telgish prompt matrix
│   ├── server/
│   │   ├── ws_handler.ts        # Gemini Live bidirectional WebSocket bridge
│   │   └── routes/              # REST endpoints for memory, tools, and telemetry
│   └── utils/
│       ├── agent_memory.ts      # Reactive memory graph & seed facts
│       ├── ai_engine.ts         # Unified model router (Gemini / Groq / NIM)
│       ├── obsidian_logger.ts   # Daily markdown turn logger & entity extractor
│       └── obsidian_sync.ts     # 2-way Obsidian vault bridge
├── workers_cpp/                 # High-performance C++ POSIX actuators
│   ├── Makefile                 # Binary compilation target
│   └── src/                     # C++ system, Mutter D-Bus, and audio workers
├── gateway_rust/                # Low-latency Rust ALSA/CPAL audio capture socket
├── config/
│   └── prompts/                 # Modular agent system prompts (.txt)
├── JARVIS-MEMORY/               # Local Obsidian Markdown Life OS Vault (Structure only in Git)
│   ├── .obsidian/               # Vault graph, plugins & workspace configuration
│   └── memory/                  # Daily logs, developer patterns, and personal context
├── ROADMAP.md                   # Multi-phase project roadmap & milestone tracker
└── server.ts                    # Production Express HTTP & WebSocket entrypoint
```

---

## 🧪 Quality & Verification

```bash
# TypeScript strict type-checking
npm run lint

# Production compilation (Vite + esbuild bundle)
npm run build

# Start production server
npm run serve
```

---

## 🔒 Security & Privacy

- **Local Execution**: All OS shell commands, windowing controls, and hardware volume adjustments execute entirely on your machine.
- **Vault Privacy**: All files under `JARVIS-MEMORY/memory/` are excluded from Git to keep your notes, habits, and work histories 100% confidential.
- **Zero Telemetry Tracking**: No external telemetry or user tracking services are embedded.

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.

<div align="center">
  <sub>Built with precision for Tony Stark's Linux Workstation. Powered by Google Gemini, C++ POSIX Actuators, and Obsidian Life OS.</sub>
</div>
