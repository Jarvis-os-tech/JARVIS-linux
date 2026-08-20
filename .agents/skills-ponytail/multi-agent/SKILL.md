---
name: multi-agent
description: Design, debug, or orchestrate multi-agent workflows (Event Bus, Swarm, EDITH loop)
---
When building or modifying multi-agent collaboration systems:
- Hierarchy: Adhere to the T1 (JARVIS) -> T2 (EDITH) -> T3 (Specialist sub-agents) hierarchical dispatch.
- Event Bus: Use AgentEventBus for decoupled communication. Validate contracts using A2ATaskRequest and A2ATaskResult.
- Concurrency: Ensure SwarmCoordinator maintains concurrency ceilings, resolves DAG dependencies dynamically, and prevents circular worker dependencies.
- State: Keep rolling short-term memory (memory.json) synced with long-term Obsidian markdown files (Tasks.md, Preferences.md) via MemoryFacade.
