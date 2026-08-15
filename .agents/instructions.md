# J.A.R.V.I.S. Autonomous Engineering Directives & Architecture Contract

> **MISSION**: J.A.R.V.I.S. is a **single-user personal AI assistant** designed to grant the user complete, instantaneous, autonomous command over their local Ubuntu Linux host, software workflows, Google Workspace, and multi-model AI reasoning.  
> Every architectural choice, language selection, and implementation must **maximize power, speed, and reliability**, never regressing or adding sluggish bloat.

---

## 🏛️ 1. Multi-Language & Best-Tool-for-the-Job Architecture

Always select and use the absolute fastest and most optimal technology for each layer:

| Layer | Technology | Primary Mandate |
| :--- | :--- | :--- |
| **Instant System Workers** | **C++ / POSIX C** (`workers_cpp/`) | Sub-millisecond direct kernel/D-Bus/X11/sysfs actuators (Mutter D-Bus, PulseAudio, process signals, memory scans). Must exit immediately to return 100% RAM to host. |
| **Microsecond Audio & WebRTC** | **Rust** (`gateway_rust/`) | Zero-GC, low-buffer audio capture (CPAL) and local socket IPC. Tiny memory footprint. |
| **Tactical Reasoning & Fast Tooling** | **Groq Cloud** (Llama 3.1 8B / 3.3 70B) | Sub-25ms tactical execution, fast telemetry queries, and rapid tool dispatch. |
| **Deep Systems Forensics & Heavy Tasks** | **NVIDIA NIM** (Llama 3.1 70B / Nemotron) | Multi-step architecture planning, code forensics, and deep technical reasoning. |
| **Real-Time Voice & Multimodal Vision** | **Google Gemini Live API** (WebSockets) | 16kHz/24kHz bidirectional live conversational voice streaming, live camera, and screen sharing. |
| **Interactive HUD & Frontend** | **React 19 + TypeScript + Tailwind 4** | Ultra-responsive, glassmorphism-themed UI with canvas orb visualizer and real-time telemetry hooks. |

---

## 🧠 2. Codebase Memory & Graph Intelligence (`codebase-memory-mcp`)

**Strict Priority Order for Code Discovery (Zero Grep Fallback Rule)**:
1. `search_graph` — Find functions, classes, routes, and variables by pattern.
2. `trace_path` — Trace call hierarchy (who calls what and inbound/outbound flow).
3. `get_code_snippet` — Read precise implementations.
4. `query_graph` — Complex Cypher pattern queries.
5. `get_architecture` — High-level system summaries.
6. `detect_changes` — **MANDATORY**: Run after significant modifications to keep the graph in sync.

---

## 📚 3. Autonomous Master Skill Registry Auto-Load

Before writing code or architecting solutions, automatically load and follow procedures from the master skill registry at `/home/gopi/Documents/jarvis-agents/`:
- **Specialist Roles (`gstack`)**: Engineer, QA, CSO, Architect, and Reviewer.
- **Decomposition & Milestones (`gsd-core`)**: Break complex features into simple, verifiable steps.
- **Domain Skills (`skills/`)**: 1,440+ specialized domain skills (Linux systems, C++, Rust, WebRTC, Gemini Live, NLU, Security).

---

## ⚡ 4. The Ponytail Minimalist Quality Filter

1. **Single-User First**: Optimized specifically for the single user on a local machine — no unnecessary multi-tenant enterprise bloat.
2. **YAGNI (You Aren't Gonna Need It)**: Do not write speculative, unneeded abstractions.
3. **Standard Library & Native APIs First**: Prefer POSIX/Linux native kernel interfaces, D-Bus, and standard libraries before pulling third-party dependencies.
4. **Shortest Working Diff**: Cleanest, most readable code with highest performance and reliability.
5. **Always Verify**: Verify every build (`npm run build`, C++ Makefiles, Cargo) and run validation tests after code changes.
