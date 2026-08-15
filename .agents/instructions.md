# Autonomous Agent Instructions

Auto-execution instructions for JARVIS-V0:

1. **Codebase Memory Graph (`codebase-memory-mcp`)**:
   - Always prioritize MCP tools: `search_graph`, `trace_path`, `get_code_snippet`, `query_graph`, `get_architecture`.
   - Never search flat files with grep/find if the graph can resolve it.
   - Run `detect_changes` after modifications.

2. **Master Skills Auto-Load**:
   - Auto-discover matching domain skills from `/home/gopi/Documents/jarvis-agents/skills/`.
   - Consult `gstack` and `gsd-core` procedures autonomously.

3. **Ponytail Minimalist Standard**:
   - Minimal diffs, no unnecessary abstractions, reuse existing utilities, verify with tests.
