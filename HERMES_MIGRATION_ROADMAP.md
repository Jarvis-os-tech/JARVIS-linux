# HERMES → JARVIS Migration Roadmap

**Date:** August 20, 2026
**Source:** `/home/gopi/.hermes/hermes-agent/`
**Target:** `/home/gopi/JARVIS-V0/`
**Goal:** Make JARVIS as powerful as Hermes while keeping JARVIS's real-time voice-to-voice architecture

---

## Executive Summary

JARVIS already has the one thing Hermes doesn't — **real-time voice-to-voice with Gemini Live**. That's the advantage. Everything else Hermes does can be grafted into JARVIS's architecture. The merge creates something neither has alone: a **voice-first autonomous agent** with Hermes-grade intelligence, tooling, and autonomous capabilities.

```
JARVIS has:                    Hermes has:
├── Gemini Live voice-to-voice ├── Text-only TUI gateway
├── Rust 16kHz audio capture   ├── No real-time voice
├── 5 MCU persona ecosystem    ├── Single persona
├── WebRTC browser bridge      ├── CLI/TUI only
├── React 19 desktop UI        ├── Terminal UI
├── Barge-in interruption      ├── No interruption
├── 17 C++ native workers      ├── Python shell commands
└── Voice-first architecture   └── Text-first architecture
```

**JARVIS is already MORE advanced in real-time voice. Hermes is MORE advanced in autonomous agent capabilities. Combining them creates something neither has alone.**

---

## Current State: What JARVIS Already Has From Hermes

| Hermes Feature | JARVIS Location | Status |
|---|---|---|
| Agent Runtime (conversation turn loop) | `src/core/hermes_agent_runtime.ts` | ✅ Ported (basic) |
| Subagent Delegation (spawn/steer/stop) | `src/tools/delegation_tool.ts` | ✅ Ported (basic) |
| Cron Scheduler (24/7 autonomous jobs) | `src/core/cron_engine.ts` + `src/tools/cron_tool.ts` | ✅ Ported |
| Skills Engine (1400+ progressive skills) | `src/core/skills_engine.ts` + `src/tools/skills_tool.ts` | ✅ Ported |
| Context Compressor (token budgeting) | `src/core/context_compressor.ts` | ✅ Ported (basic) |
| Tool Guardrails (circuit breakers) | `src/core/tool_guardrails.ts` | ✅ Ported (basic) |
| Security Guard (secret redactor) | `src/core/security_guard.ts` | ✅ Ported (pattern matching only) |
| Dual-Store Memory (MEMORY.md + USER.md) | `src/memory/dual_store.ts` | ✅ Ported |
| Episodic Session Search | `src/tools/memory_search_tool.ts` | ✅ Ported |
| Python Bridge (270 Agency Agents) | `src/core/python_bridge.ts` + `src/tools/python_plugin_tool.ts` | ✅ Ported |
| Hermes System Prompt | `core_engine/templates/system_prompt_hermes.j2` | ✅ Ported |
| Subagent SQLite tracking | `src/db/db.ts` (subagents table) | ✅ Ported |

---

## The Architecture — Merged Voice-First + Hermes Intelligence

```
┌─────────────────────────────────────────────────────────────────┐
│                    J.A.R.V.I.S. (Voice-First)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ Gemini Live   │    │  React 19 UI │    │  Rust Audio   │      │
│  │ Voice-to-Voice│◄──►│  Dashboard   │    │  Gateway      │      │
│  └──────┬───────┘    └──────────────┘    └──────────────┘      │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────────────────────────────────────────┐      │
│  │              TOOL REGISTRY (Unified)                   │      │
│  │                                                        │      │
│  │  Tier 1: C++ Native Workers (sub-ms)                  │      │
│  │  Tier 2: Linux Actuators & Shell                      │      │
│  │  Tier 3: Agent Reach (Web Research)                   │      │
│  │  Tier 4: Cloud Connectors (Google/GitHub/LinkedIn)    │      │
│  │  Tier 5: Rust Memory Engine                           │      │
│  │  Tier 6: Hermes Agent Runtime (upgraded)              │      │
│  │  Tier 7: Hermes Conversation Loop (new)               │      │
│  │  Tier 8: Hermes Security / Tirith (new)               │      │
│  │  Tier 9: Hermes Context Engine (upgraded)             │      │
│  │  Tier 10: Hermes Learning Graph (new)                 │      │
│  └──────────────────────────────────────────────────────┘      │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────────────────────────────────────────┐      │
│  │          HERMES CORE (Python — In-Process)             │      │
│  │                                                        │      │
│  │  ├── conversation_loop.py  (production loop)          │      │
│  │  ├── context_engine.py     (pluggable compression)    │      │
│  │  ├── tool_guardrails.py    (circuit breakers)         │      │
│  │  ├── tirith_security.py    (command scanning)         │      │
│  │  ├── learning_graph.py     (what agent learned)       │      │
│  │  ├── billing_usage.py      (credit detection)         │      │
│  │  ├── error_classifier.py   (structured failover)      │      │
│  │  ├── prompt_caching.py     (Anthropic cache)          │      │
│  │  ├── trajectory.py         (execution replay)         │      │
│  │  └── verification_evidence.py (audit trail)           │      │
│  └──────────────────────────────────────────────────────┘      │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────────────────────────────────────────┐      │
│  │        HERMES TOOLS (Python — via Bridge)              │      │
│  │                                                        │      │
│  │  ├── delegate_tool.py     (subagent spawning)         │      │
│  │  ├── skills_tool.py       (1400+ skills)              │      │
│  │  ├── cronjob_tools.py     (24/7 scheduling)           │      │
│  │  ├── browser_tool.py      (CDP automation)            │      │
│  │  ├── kanban_tools.py      (task management)           │      │
│  │  ├── homeassistant_tool.py (smart home)               │      │
│  │  ├── image_generation_tool.py                          │      │
│  │  └── 270+ Agency Specialist Agents                     │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Design Principle: Voice-First, Text-Second

```
Every Hermes feature MUST work through voice.
Voice pipeline remains PRIMARY, text is SECONDARY.

Example flow: "Jarvis, research quantum computing"
  1. Gemini Live captures voice → text (input_transcription)
  2. Tool call fires (web_research)
  3. Result comes back
  4. Result is SPOKEN via Gemini Live (output_transcription)
  5. Text displayed in UI is SECONDARY

Hermes text-only features (kanban, browser CDP) work in background.
Voice pipeline NEVER blocks on text-only operations.
```

---

## What NOT to Port (Skip These)

| Skip This | Why |
|---|---|
| Hermes TUI Gateway | JARVIS has React 19 UI |
| Hermes CLI (`cli.py`) | JARVIS has voice + web UI |
| Hermes config.yaml | JARVIS uses .env + SQLite configs |
| Hermes provider system | JARVIS already has Groq/NVIDIA/Gemini |
| Hermes session DB | JARVIS already has SQLite WAL |
| Hermes npm/web build | JARVIS uses Vite |
| Hermes display.py (KawaiiSpinner) | JARVIS has React UI |
| Hermes locales/ | JARVIS has no i18n need |

---

## Hermes Source File Map — What to Port Where

### Tier 1: Security (Highest Priority)

| Hermes File | JARVIS Target | Priority | Effort |
|---|---|---|---|
| `tools/tirith_security.py` | `src/core/tirith_security.ts` | 🔴 CRITICAL | Medium |
| `tools/threat_patterns.py` | `src/core/threat_patterns.ts` | 🔴 CRITICAL | Low |
| `tools/approval.py` | `src/core/tool_approval.ts` | 🔴 CRITICAL | Medium |
| `tools/url_safety.py` | `src/core/url_safety.ts` | 🔴 CRITICAL | Low |
| `agent/redact.py` | `src/core/secret_redactor.ts` | 🔴 CRITICAL | Low |
| `agent/secret_scope.py` | `src/core/secret_scope.ts` | 🔴 CRITICAL | Low |
| `tools/file_safety.py` | `src/core/file_safety.ts` | 🟠 HIGH | Low |

### Tier 2: Agent Intelligence

| Hermes File | JARVIS Target | Priority | Effort |
|---|---|---|---|
| `agent/error_classifier.py` | `src/core/error_classifier.ts` | 🔴 CRITICAL | Medium |
| `agent/billing_usage.py` | `src/core/billing_detector.ts` | 🔴 CRITICAL | Medium |
| `agent/billing_links.py` | `src/core/billing_links.ts` | 🟠 HIGH | Low |
| `agent/context_engine.py` | `src/core/context_engine.ts` (upgrade) | 🔴 CRITICAL | High |
| `agent/context_compressor.py` | `src/core/context_compressor.ts` (upgrade) | 🔴 CRITICAL | High |
| `agent/tool_guardrails.py` | `src/core/tool_guardrails.ts` (upgrade) | 🟠 HIGH | Medium |
| `agent/prompt_caching.py` | `src/core/prompt_caching.ts` | 🟠 HIGH | Medium |
| `agent/conversation_loop.py` | `src/core/hermes_agent_runtime.ts` (upgrade) | 🔴 CRITICAL | Very High |
| `agent/conversation_compression.py` | `src/core/conversation_compression.ts` | 🟠 HIGH | High |
| `agent/model_metadata.py` | `src/core/model_metadata.ts` | 🟠 HIGH | Medium |
| `agent/iteration_budget.py` | `src/core/iteration_budget.ts` | 🟠 HIGH | Low |
| `agent/retry_utils.py` | `src/core/retry_utils.ts` | 🟠 HIGH | Low |
| `agent/message_sanitization.py` | `src/core/message_sanitization.ts` | 🟠 HIGH | Medium |

### Tier 3: Learning & Memory

| Hermes File | JARVIS Target | Priority | Effort |
|---|---|---|---|
| `agent/learning_graph.py` | `src/core/learning_graph.ts` | 🟠 HIGH | Medium |
| `agent/learning_mutations.py` | `src/core/learning_mutations.ts` | 🟠 HIGH | Low |
| `agent/insights.py` | `src/core/insights.ts` | 🟡 MEDIUM | Low |
| `agent/background_review.py` | `src/core/background_review.ts` | 🟠 HIGH | Medium |
| `agent/trajectory.py` | `src/core/trajectory.ts` | 🟡 MEDIUM | Medium |
| `agent/verification_evidence.py` | `src/core/verification_evidence.ts` | 🟡 MEDIUM | Medium |
| `agent/turn_summary.py` | `src/core/turn_summary.ts` | 🟡 MEDIUM | Low |

### Tier 4: Tools & Capabilities

| Hermes File | JARVIS Target | Priority | Effort |
|---|---|---|---|
| `tools/delegate_tool.py` | `src/tools/delegation_tool.ts` (upgrade) | 🟠 HIGH | High |
| `tools/skills_tool.py` | `src/tools/skills_tool.ts` (upgrade) | 🟡 MEDIUM | Medium |
| `tools/cronjob_tools.py` | `src/tools/cron_tool.ts` (upgrade) | 🟡 MEDIUM | Medium |
| `tools/browser_cdp_tool.py` | `src/tools/browser_tool.ts` | 🟡 MEDIUM | High |
| `tools/kanban_tools.py` | `src/tools/kanban_tool.ts` | 🔵 LOW | Medium |
| `tools/homeassistant_tool.py` | `src/tools/smart_home_tool.ts` | 🔵 LOW | Medium |
| `tools/image_generation_tool.py` | `src/tools/image_gen_tool.ts` | 🟡 MEDIUM | Medium |
| `tools/video_generation_tool.py` | `src/tools/video_gen_tool.ts` | 🔵 LOW | Medium |
| `tools/todo_tool.py` | `src/tools/todo_tool.ts` | 🟡 MEDIUM | Low |
| `tools/session_search_tool.py` | `src/tools/memory_search_tool.ts` (upgrade) | 🟡 MEDIUM | Low |
| `tools/skill_manager_tool.py` | `src/tools/skills_tool.ts` (upgrade) | 🟡 MEDIUM | Low |
| `agent/moa_loop.py` | `src/core/moa_loop.ts` | 🔵 LOW | High |

### Tier 5: Providers & Transport

| Hermes File | JARVIS Target | Priority | Effort |
|---|---|---|---|
| `agent/anthropic_adapter.py` | Not needed (Gemini Live) | ⏭️ SKIP | — |
| `agent/vertex_adapter.py` | Not needed (Gemini Live) | ⏭️ SKIP | — |
| `agent/codex_responses_adapter.py` | Not needed (Gemini Live) | ⏭️ SKIP | — |
| `agent/bedrock_adapter.py` | Not needed (Gemini Live) | ⏭️ SKIP | — |
| `agent/web_search_provider.py` | Already have Agent Reach | ⏭️ SKIP | — |
| `agent/transcription_provider.py` | Already have Gemini Live | ⏭️ SKIP | — |
| `agent/tts_provider.py` | Already have Gemini Live | ⏭️ SKIP | — |
| `agent/gemini_native_adapter.py` | Not needed (Gemini Live) | ⏭️ SKIP | — |

---

## Implementation Phases

### Phase 1: Foundation (Week 1) — Self-Contained, No Voice Impact

**Goal:** Improve security and error handling without touching voice pipeline.

| Task | Source File | Target File | Description |
|---|---|---|---|
| **1.1** Port Tirith Security | `tools/tirith_security.py` | `src/core/tirith_security.ts` | Auto-install binary + `check_command_security()` API |
| **1.2** Port Threat Patterns | `tools/threat_patterns.py` | `src/core/threat_patterns.ts` | Command injection patterns, homograph detection |
| **1.3** Port Tool Approval | `tools/approval.py` | `src/core/tool_approval.ts` | Dangerous command approval flow |
| **1.4** Port URL Safety | `tools/url_safety.py` | `src/core/url_safety.ts` | URL validation and sanitization |
| **1.5** Port Error Classifier | `agent/error_classifier.py` | `src/core/error_classifier.ts` | Billing, rate limit, content policy detection |
| **1.6** Port Billing Detector | `agent/billing_usage.py` + `billing_links.py` | `src/core/billing_detector.ts` | Credit exhaustion messages per provider |
| **1.7** Upgrade security_guard.ts | `src/core/security_guard.ts` | Modify in-place | Use tirith binary instead of hardcoded paths |
| **1.8** Fix hardcoded paths | `src/core/security_guard.ts` | Modify in-place | Replace `/home/gopi/` with `os.path.expanduser()` |

**Verification:** Run existing tests, verify tirith auto-installs, verify billing detection works.

---

### Phase 2: Agent Intelligence (Week 2) — Upgrades Existing Runtime

**Goal:** Upgrade the core agent loop with Hermes production patterns.

| Task | Source File | Target File | Description |
|---|---|---|---|
| **2.1** Port Context Engine ABC | `agent/context_engine.py` | `src/core/context_engine.ts` | Pluggable ABC with hooks |
| **2.2** Upgrade Context Compressor | `agent/context_compressor.py` | `src/core/context_compressor.ts` | Threshold-based compression, anti-thrash |
| **2.3** Port Conversation Compression | `agent/conversation_compression.py` | `src/core/conversation_compression.ts` | Compression retry logic, status templates |
| **2.4** Upgrade Tool Guardrails | `agent/tool_guardrails.py` | `src/core/tool_guardrails.ts` | Circuit breakers, infinite loop detection |
| **2.5** Port Prompt Caching | `agent/prompt_caching.py` | `src/core/prompt_caching.ts` | Anthropic cache control, cache TTL |
| **2.6** Port Model Metadata | `agent/model_metadata.py` | `src/core/model_metadata.ts` | Token estimation, context length tracking |
| **2.7** Port Retry Utils | `agent/retry_utils.py` | `src/core/retry_utils.ts` | Adaptive backoff, jittered retry |
| **2.8** Port Message Sanitization | `agent/message_sanitization.py` | `src/core/message_sanitization.ts` | Surrogate cleanup, non-ASCII handling |
| **2.9** Port Iteration Budget | `agent/iteration_budget.py` | `src/core/iteration_budget.ts` | Per-turn iteration limits |
| **2.10** Upgrade HermesAgentRuntime | `src/core/hermes_agent_runtime.ts` | Modify in-place | Continuation prompts, tool-call canonicalization |

**Verification:** Run agent with multi-step tool calls, verify compression triggers correctly, verify retry logic works.

---

### Phase 3: Autonomous Capabilities (Week 3) — New Features

**Goal:** Add learning, background review, and audit trail.

| Task | Source File | Target File | Description |
|---|---|---|---|
| **3.1** Port Learning Graph | `agent/learning_graph.py` | `src/core/learning_graph.ts` | Track what agent learned, render visual graph |
| **3.2** Port Learning Mutations | `agent/learning_mutations.py` | `src/core/learning_mutations.ts` | Apply learning updates |
| **3.3** Port Background Review | `agent/background_review.py` | `src/core/background_review.ts` | Post-turn async review, extract lessons |
| **3.4** Port Verification Evidence | `agent/verification_evidence.py` | `src/core/verification_evidence.ts` | Audit trail for decisions |
| **3.5** Port Trajectory | `agent/trajectory.py` | `src/core/trajectory.ts` | Execution trajectory tracking |
| **3.6** Port Turn Summary | `agent/turn_summary.py` | `src/core/turn_summary.ts` | Summarize completed turns |
| **3.7** Port Insights | `agent/insights.py` | `src/core/insights.ts` | Extract insights from interactions |
| **3.8** Upgrade Delegation Tool | `tools/delegate_tool.py` | `src/tools/delegation_tool.ts` | Worktree isolation, steering, owner authority |

**Verification:** Verify learning graph tracks tool usage, verify background review extracts lessons, verify delegation steering works.

---

### Phase 4: Tools & Integrations (Week 4) — Expand Capabilities

**Goal:** Add new tool capabilities from Hermes.

| Task | Source File | Target File | Description |
|---|---|---|---|
| **4.1** Port Browser CDP | `tools/browser_cdp_tool.py` | `src/tools/browser_tool.ts` | Chromium DevTools Protocol automation |
| **4.2** Port Kanban | `tools/kanban_tools.py` | `src/tools/kanban_tool.ts` | Task management with SQLite |
| **4.3** Port Image Gen | `tools/image_generation_tool.py` | `src/tools/image_gen_tool.ts` | AI image generation |
| **4.4** Port Video Gen | `tools/video_generation_tool.py` | `src/tools/video_gen_tool.ts` | AI video generation |
| **4.5** Port Home Assistant | `tools/homeassistant_tool.py` | `src/tools/smart_home_tool.ts` | Smart home control |
| **4.6** Port Todo Tool | `tools/todo_tool.py` | `src/tools/todo_tool.ts` | Task tracking |
| **4.7** Port MoA Loop | `agent/moa_loop.py` | `src/core/moa_loop.ts` | Mixture of Agents reasoning |
| **4.8** Port Session Search Upgrade | `tools/session_search_tool.py` | `src/tools/memory_search_tool.ts` | Enhanced episodic search |
| **4.9** Port Skills Upgrade | `tools/skills_tool.py` | `src/tools/skills_tool.ts` | Enhanced skill management |
| **4.10** Port Cron Upgrade | `tools/cronjob_tools.py` | `src/tools/cron_tool.ts` | Enhanced scheduling |

**Verification:** Verify each new tool works through voice commands, verify background tools don't block voice pipeline.

---

### Phase 5: Integration & Testing (Week 5) — Hardening

**Goal:** Ensure everything works together seamlessly.

| Task | Description |
|---|---|
| **5.1** End-to-end voice test | "Jarvis, research quantum computing and create a kanban task" |
| **5.2** Delegation test | "Jarvis, delegate research to Friday and security audit to Ultron" |
| **5.3** Learning test | Verify learning graph updates after tool executions |
| **5.4** Background test | Verify cron jobs run without blocking voice |
| **5.5** Security test | Verify tirith blocks dangerous commands via voice |
| **5.6** Billing test | Verify credit exhaustion detection works |
| **5.7** Performance test | Verify voice latency stays under 500ms |
| **5.8** Memory test | Verify episodic search works across sessions |

---

## File Structure After Migration

```
/home/gopi/JARVIS-V0/
├── src/                              # TypeScript (React + Node)
│   ├── core/
│   │   ├── hermes_agent_runtime.ts   # UPGRADED: continuation prompts, tool-call repair
│   │   ├── context_engine.ts         # NEW: pluggable ABC with hooks
│   │   ├── context_compressor.ts     # UPGRADED: threshold-based compression
│   │   ├── tirith_security.ts        # NEW: auto-install + scan API
│   │   ├── error_classifier.ts       # NEW: billing/rate-limit/content detection
│   │   ├── billing_detector.ts       # NEW: credit exhaustion per provider
│   │   ├── billing_links.ts          # NEW: per-provider billing URLs
│   │   ├── tool_guardrails.ts        # UPGRADED: circuit breakers
│   │   ├── prompt_caching.ts         # NEW: Anthropic cache control
│   │   ├── model_metadata.ts         # NEW: token estimation
│   │   ├── retry_utils.ts            # NEW: adaptive backoff
│   │   ├── message_sanitization.ts   # NEW: surrogate cleanup
│   │   ├── iteration_budget.ts       # NEW: per-turn limits
│   │   ├── conversation_compression.ts # NEW: compression retry logic
│   │   ├── learning_graph.ts         # NEW: track what agent learned
│   │   ├── learning_mutations.ts     # NEW: apply learning updates
│   │   ├── background_review.ts      # NEW: post-turn async review
│   │   ├── verification_evidence.ts  # NEW: audit trail
│   │   ├── trajectory.ts             # NEW: execution tracking
│   │   ├── turn_summary.ts           # NEW: turn summarization
│   │   ├── insights.ts               # NEW: interaction insights
│   │   ├── threat_patterns.ts        # NEW: command injection patterns
│   │   ├── tool_approval.ts          # NEW: dangerous command approval
│   │   ├── url_safety.ts             # NEW: URL validation
│   │   ├── secret_redactor.ts        # NEW: secret redaction
│   │   ├── secret_scope.ts           # NEW: secret management
│   │   ├── file_safety.ts            # NEW: file safety checks
│   │   ├── moa_loop.ts               # NEW: Mixture of Agents
│   │   ├── prime_orchestrator.ts     # EXISTING: unchanged
│   │   ├── watchdog.ts               # EXISTING: unchanged
│   │   ├── cron_engine.ts            # EXISTING: unchanged
│   │   ├── skills_engine.ts          # EXISTING: unchanged
│   │   ├── lifecycle_manager.ts      # EXISTING: unchanged
│   │   ├── event_bus.ts              # EXISTING: unchanged
│   │   ├── switch_manager.ts         # EXISTING: unchanged
│   │   ├── logger.ts                 # EXISTING: unchanged
│   │   └── ...
│   ├── tools/
│   │   ├── tool_registry.ts          # EXISTING: register new tools
│   │   ├── delegation_tool.ts        # UPGRADED: steering, worktree isolation
│   │   ├── skills_tool.ts            # UPGRADED: enhanced management
│   │   ├── cron_tool.ts              # UPGRADED: enhanced scheduling
│   │   ├── python_plugin_tool.ts     # EXISTING: unchanged
│   │   ├── memory_search_tool.ts     # UPGRADED: enhanced search
│   │   ├── browser_tool.ts           # NEW: CDP automation
│   │   ├── kanban_tool.ts            # NEW: task management
│   │   ├── image_gen_tool.ts         # NEW: image generation
│   │   ├── video_gen_tool.ts         # NEW: video generation
│   │   ├── smart_home_tool.ts        # NEW: Home Assistant
│   │   ├── todo_tool.ts              # NEW: task tracking
│   │   └── forge_tool.ts             # EXISTING: unchanged
│   ├── memory/
│   │   ├── dual_store.ts             # EXISTING: unchanged
│   │   ├── client.ts                 # EXISTING: unchanged
│   │   ├── context_builder.ts        # EXISTING: unchanged
│   │   ├── turn_logger.ts            # EXISTING: unchanged
│   │   └── ...
│   ├── server/
│   │   ├── ws_handler.ts             # EXISTING: unchanged (voice pipeline)
│   │   └── routes.ts                 # EXISTING: unchanged
│   ├── services/
│   │   ├── google_auth_service.ts    # EXISTING: unchanged
│   │   ├── github_service.ts         # EXISTING: unchanged
│   │   ├── linkedin_service.ts       # EXISTING: unchanged
│   │   └── agent_reach_service.ts    # EXISTING: unchanged
│   └── ...
├── core_engine/                      # Python (existing)
│   ├── main.py                       # EXISTING: unchanged
│   ├── server.py                     # EXISTING: unchanged
│   ├── gemini_live.py                # EXISTING: unchanged
│   ├── audio_bridge.py               # EXISTING: unchanged
│   ├── actuator_dispatcher.py        # EXISTING: unchanged
│   ├── security.py                   # EXISTING: unchanged (uses tirith)
│   ├── memory.py                     # EXISTING: unchanged
│   └── ...
├── memory_engine/                    # Rust (existing)
│   └── src/
│       ├── main.rs                   # EXISTING: unchanged
│       ├── lib.rs                    # EXISTING: unchanged
│       └── ...
├── workers_cpp/                      # C++ (existing)
│   └── src/
│       ├── hardware_ctrl.cpp         # EXISTING: unchanged
│       └── ...
├── gateway_rust/                     # Rust audio (existing)
│   └── src/
│       ├── main.rs                   # EXISTING: unchanged
│       ├── capture.rs                # EXISTING: unchanged
│       ├── playback.rs               # EXISTING: unchanged
│       └── ...
├── hermes_source/                    # NEW: Hermes Python source (reference)
│   ├── hermes-agent/
│   │   ├── agent/                    # Reference for porting
│   │   ├── tools/                    # Reference for porting
│   │   ├── cron/                     # Reference for porting
│   │   └── ...
│   ├── plugins/
│   │   ├── agency-agents-router/     # Reference for porting
│   │   └── ...
│   └── skills/                       # Reference for skill catalog
├── JARVIS-MEMORY/                    # Obsidian vault (existing)
├── tests/                            # Tests (existing)
├── scripts/                          # OAuth flows (existing)
├── .env                              # Environment config (existing)
├── package.json                      # Dependencies (existing)
├── tsconfig.json                     # TypeScript config (existing)
├── CODEBASE_ANALYSIS.md              # Analysis report (existing)
├── HERMES_MIGRATION_ROADMAP.md       # THIS FILE
└── README.md                         # Project docs (existing)
```

---

## Risk Assessment

### Low Risk (No Voice Impact)

| Risk | Mitigation |
|---|---|
| Tirith auto-install fails | Fail-open pattern, 24h disk cache |
| Error classifier misclassifies | Structured fallback, never blocks voice |
| Billing detector false positive | "Unverified" flag, conservative messaging |
| Threat patterns miss edge case | Pattern matching is additive, never subtractive |

### Medium Risk (Potential Voice Impact)

| Risk | Mitigation |
|---|---|
| Context compression delays voice response | Use fast compression path, skip LLM summarization |
| Tool guardrails block legitimate tools | Configurable thresholds, voice-friendly error messages |
| Prompt caching breaks system prompt stability | Cache invalidation on persona switch |
| Learning graph grows unbounded | TTL-based pruning, max node limit |

### High Risk (Voice Pipeline)

| Risk | Mitigation |
|---|---|
| Conversation loop upgrade breaks voice flow | Keep voice pipeline separate, upgrade incrementally |
| MoA loop adds latency | Only trigger on complex non-voice tasks |
| Background review blocks voice | Always async, never await in voice path |
| Delegation steering blocks voice | Fire-and-forget with progress events |

---

## Success Criteria

| Criterion | Target | Measurement |
|---|---|---|
| Voice latency | < 500ms | End-to-end voice-to-voice measurement |
| Tool execution | < 2s | Per-tool execution time |
| Context compression | < 5s | Compression cycle time |
| Tirith scan | < 100ms | Command security check time |
| Learning graph | < 50ms | Graph update time |
| Background review | Async | Never blocks voice pipeline |
| Delegation | < 3s | Subagent spawn time |
| Cron execution | Async | Never blocks voice pipeline |

---

## Rollback Plan

If any phase causes voice regression:

1. **Phase 1-4:** Revert specific files, voice pipeline untouched
2. **Phase 5:** Revert `ws_handler.ts` and `hermes_agent_runtime.ts`
3. **Emergency:** `git checkout HEAD~1 -- src/server/ws_handler.ts src/core/hermes_agent_runtime.ts`

---

*Migration roadmap generated on August 20, 2026*
*Source: Hermes Agent vlatest at `/home/gopi/.hermes/hermes-agent/`*
*Target: JARVIS OS v1.0 at `/home/gopi/JARVIS-V0/`*
