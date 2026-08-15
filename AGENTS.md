# JARVIS-V0 Autonomous Execution Contract

## Mandatory Automatic Protocol (Zero-Prompt Enforcement)

On **EVERY** request, the agent MUST autonomously execute this 4-step pipeline without waiting for user commands or reminders:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 1. CODE DISCOVERY : codebase-memory-mcp (search_graph, trace_path, snippet)     │
│ 2. AUTO-SKILLS    : Read matching SKILL.md in /home/gopi/Documents/jarvis-agents │
│ 3. MINIMAL DIFF   : Ponytail rule (Standard lib, native features, zero bloat)   │
│ 4. VERIFICATION   : Step-by-step validation & detect_changes sync               │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Codebase Memory & Graph Intelligence (`codebase-memory-mcp`)
**NEVER fallback to grep/find before querying the knowledge graph.**
- **Finding symbols/routes/handlers**: `search_graph(project="JARVIS-V0", name_pattern="...")`
- **Caller / Callee traces**: `trace_path(project="JARVIS-V0", function_name="...", direction="inbound"|"outbound")`
- **Reading function / class implementations**: `get_code_snippet(project="JARVIS-V0", qualified_name="...")`
- **System overview & Architecture**: `get_architecture(project="JARVIS-V0", aspects=["all"])`
- **Keeping graph updated after edits**: `detect_changes(project="JARVIS-V0")`

---

## 2. Autonomous Skill Discovery & Execution
Before writing code or architecting solutions, automatically load matching skills from `/home/gopi/Documents/jarvis-agents/`:
- **Domain Skills**: `/home/gopi/Documents/jarvis-agents/skills/<domain>/SKILL.md`
- **Framework Specialists (`gstack`)**: `/home/gopi/Documents/jarvis-agents/gstack/` (Engineers, QA, CSO, Review)
- **Phase Breakdown (`gsd-core`)**: `/home/gopi/Documents/jarvis-agents/gsd-core/skills/`

---

## 3. The Ponytail Minimalist Quality Filter
1. **YAGNI**: If it does not directly solve the user request, do not write it.
2. **Reuse First**: Reuse existing types, utilities, and components in the codebase.
3. **Standard Library & Platform**: Prefer standard library and native framework APIs over new dependencies.
4. **Shortest Working Diff**: Minimal lines of code changed, maximum clarity and stability.

---

## 4. Verification & Sync
- Always run local validation (type-check / build / unit tests / execution checks) after code modifications.
- Trigger `detect_changes` on `codebase-memory-mcp` after significant edits to keep the graph in sync.
