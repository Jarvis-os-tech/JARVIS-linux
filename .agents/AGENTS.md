# J.A.R.V.I.S. Autonomous Master Execution & Architecture Contract

> **MANDATORY ZERO-PROMPT PROTOCOL**: On EVERY user prompt or command, the agent MUST AUTONOMOUSLY inspect the request, query the knowledge graph (`codebase-memory-mcp`), search the master skill registry at `/home/gopi/Documents/jarvis-agents/`, and enforce the single-user high-performance architecture. NEVER ask permission to follow these protocols.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              AUTONOMOUS EXECUTION PIPELINE                             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. AUTO-DECONSTRUCT (gsd-core) : Break complex tasks into simple, verifiable steps     │
│ 2. CODE DISCOVERY   (mcp-graph): Query codebase-memory-mcp (graph > trace > snippet)   │
│ 3. AUTO-SKILLS      (jarvis)   : Read matching SKILL.md in /home/gopi/Documents/       │
│ 4. AUTO-SIMPLIFY    (ponytail) : Native platform APIs / standard lib / minimal diff    │
│ 5. AUTO-VERIFY      (gstack/qa): Step-by-step local validation & detect_changes sync   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 1. Core Mission: Single-User Personal Super-Assistant

J.A.R.V.I.S. is a **single-user personal AI assistant** built to give the user instantaneous, hands-free, autonomous command over their local Ubuntu Linux environment, hardware controls, development workflows, Google Workspace, and multi-model AI reasoning.

- **Maximizing Power**: Every implementation must make J.A.R.V.I.S. **significantly more powerful, faster, and more capable**.
- **Zero Bloat / YAGNI**: No multi-tenant complexity, no speculative enterprise layers, no unnecessary third-party packages.
- **Hands-Free Fluidity**: Real-time voice visualizer HUD, background daemon continuous operation, and sub-100ms multi-agent voice hot-swapping.

---

## 🏛️ 2. Multi-Language & Best-Tool-for-the-Job Architecture

Always select and use the absolute fastest and most optimal technology for each tier:

| Subsystem / Layer | Technology | Operational Mandate |
| :--- | :--- | :--- |
| **Instant System Workers** | **C++ / POSIX C** (`workers_cpp/`) | Sub-millisecond direct kernel, Mutter D-Bus, X11, PulseAudio, and `/proc` actuators. Isolated binaries that execute instantly and exit to free 100% RAM. |
| **Microsecond Audio Gateway** | **Rust** (`gateway_rust/`) | Zero-GC, ultra-low-buffer hardware audio capture (CPAL/ALSA) and local TCP IPC socket. |
| **Tactical Reasoning & Fast Tooling** | **Groq Cloud** (Llama 3.1 8B / 3.3 70B) | Sub-25ms ultra-fast execution, short command parsing, and high-throughput tool dispatch. |
| **Deep Systems Architecture & Code** | **NVIDIA NIM** (Llama 3.1 70B / Nemotron) | Multi-step architecture planning, deep code analysis, and system forensics. |
| **Real-Time Voice & Multimodal Vision** | **Google Gemini Live API** (WebSockets) | 16kHz/24kHz bidirectional live conversational streaming, camera vision, and screen sharing. |
| **Interactive UI & Visualizer** | **React 19 + TypeScript + Tailwind 4** | Ultra-responsive, glassmorphism HUD with canvas orb visualizer and real-time hardware synchronization. |

---

## 🧠 3. Codebase Memory & Graph Intelligence (`codebase-memory-mcp`)

**NEVER fallback to grep/find before querying the knowledge graph.**

### Priority Discovery Order:
1. `search_graph(project="JARVIS-V0", name_pattern="...")` — Find functions, classes, routes, handlers, and variables.
2. `trace_path(project="JARVIS-V0", function_name="...", direction="inbound"|"outbound")` — Trace caller/callee paths.
3. `get_code_snippet(project="JARVIS-V0", qualified_name="...")` — Read exact function/class implementations.
4. `query_graph(project="JARVIS-V0", cypher_query="...")` — Run complex Cypher pattern queries.
5. `get_architecture(project="JARVIS-V0", aspects=["all"])` — System-wide high-level summaries.
6. `detect_changes(project="JARVIS-V0")` — **MANDATORY**: Trigger after code edits to keep the graph in sync.

---

## 📚 4. Autonomous Master Skill Registry Auto-Load

Before writing code, automatically inspect and load relevant skills from `/home/gopi/Documents/jarvis-agents/`:
- **Specialist Roles (`gstack`)**: Specialist engineer, QA tester, CSO security auditor, and code reviewer.
- **Decomposition (`gsd-core`)**: Spec-driven milestone breakdowns and incremental verification loops.
- **Domain Skills (`skills/`)**: 1,440+ domain skills covering Linux internals, C++, Rust, WebRTC, Gemini Live, NLU, and Security.

---

## ⚡ 5. The Ponytail Minimalist Quality Standard

Always apply the minimalist filter before adding lines of code:
1. **Does this need to exist at all?** (Eliminate unneeded work).
2. **Already in codebase?** (Reuse existing helpers, tools, and types).
3. **Standard library does it?** (POSIX / D-Bus / standard library before third-party packages).
4. **Native platform feature covers it?** (Linux kernel, ALSA, PulseAudio, Mutter D-Bus).
5. **Shortest working diff**: Minimal lines changed, maximum reliability, and zero performance regression.

---

## 🔄 6. Mandatory Step-by-Step Local Verification

- Verify every code change with local builds (`npm run build`, `make -C workers_cpp`, `cargo build`).
- Run relevant unit tests or verification commands.
- Trigger `detect_changes` on `codebase-memory-mcp` after modifications.
