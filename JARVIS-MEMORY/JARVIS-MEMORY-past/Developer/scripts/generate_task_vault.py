import os
import re
import yaml
import sys
sys.stdout.reconfigure(encoding='utf-8')
from datetime import datetime

vault_path = r"C:\Users\Gopi\Desktop\JARVIS-V1\JARVIS-MEMORY"
task_memory_dir = os.path.join(vault_path, "Memory", "Task Memory")
logs_dir = os.path.join(vault_path, "Memory", "Daily Logs")
tasks_file = os.path.join(task_memory_dir, "Tasks.md")

# Ensure target directory exists
os.makedirs(task_memory_dir, exist_ok=True)

# List of outstanding tasks with their metadata
task_metadata_list = [
    {
        "name": "Implement agent Registry",
        "date": "2026-06-18",
        "keywords": ["registry", "agent registry"],
        "desc": "Create a unified registry for registering, lookup, and management of all active sub-agents (JARVIS, Friday, Ultron, HERBIE, Vision). Allows the orchestrator to dynamically query agent capabilities and direct tasks.",
        "plan": [
            "Define the registry schema and state interface in TypeScript.",
            "Create an agent registration API for agents to register themselves at startup.",
            "Implement helper utilities to list active agents, check their status, and route intents.",
            "Test registration and status query endpoints using mocks."
        ]
    },
    {
        "name": "Build Skill Registry",
        "date": "2026-06-18",
        "keywords": ["registry", "skill registry"],
        "desc": "Build a central skill repository for cataloging custom agent prompts, tools, and executable command mappings. Enables agents to dynamically load and invoke tools/plugins based on context.",
        "plan": [
            "Design the JSON schema for skill definitions (inputs, triggers, executable actions).",
            "Write the SkillRegistry manager class to load skills from specified paths (e.g., config/skills).",
            "Add query methods to match user voice intent keywords to registered skills.",
            "Integrate the Skill Registry into the main agent orchestrator loop."
        ]
    },
    {
        "name": "JARVIS: Orchestrator layer, manages multi-agent system",
        "date": "2026-06-21",
        "keywords": ["orchestrator", "orchestration", "multi-agent"],
        "desc": "Establish the core J.A.R.V.I.S. orchestrator engine. It accepts text/voice intents, performs semantic routing, dispatches tasks to specialized sub-agents, and resolves final outputs back to the user.",
        "plan": [
            "Implement the Orchestrator routing logic using a state machine pattern.",
            "Integrate intent classification using LLM prompts to determine which agent (Friday, Ultron, etc.) is active.",
            "Create state management for multi-agent threads and context sharing.",
            "Test routing efficiency with sample voice inputs."
        ]
    },
    {
        "name": "Friday: News and Research agent - tech, news, intelligence systems",
        "date": "2026-06-21",
        "keywords": ["friday", "news", "research agent"],
        "desc": "Define Friday, a specialized research sub-agent responsible for aggregating tech news, searching databases, querying APIs, and providing concise intelligence digests.",
        "plan": [
            "Configure Friday's prompt persona and base system instructions in the skills catalog.",
            "Expose web search and document parsing tools to Friday's execution scope.",
            "Implement a weekly automated newsletter task triggered in the background.",
            "Test news extraction and summarization functions."
        ]
    },
    {
        "name": "Ultron: Protection agent - threat detection, full scans, countermeasures",
        "date": "2026-06-21",
        "keywords": ["ultron", "protection", "security", "scan"],
        "desc": "Design Ultron, a security-monitoring sub-agent that performs full system audits, detects malicious files or code patterns, and deploys custom countermeasures.",
        "plan": [
            "Define Ultron's system prompts prioritizing system safety and file integrity.",
            "Implement hooks for automated codebase and configuration scanning.",
            "Add threat detection logging and real-time alerts.",
            "Integrate automatic container validation checks."
        ]
    },
    {
        "name": "HERBIE: Background agent - system monitoring, downloads, background tasks",
        "date": "2026-06-21",
        "keywords": ["herbie", "background agent", "monitoring"],
        "desc": "Set up HERBIE, a background worker agent designed to monitor resources, manage long-running downloads, and execute tasks asynchronously outside the user interaction thread.",
        "plan": [
            "Create HERBIE's execution loop and queue-polling logic.",
            "Implement status checks for CPU, memory, and disk usage.",
            "Add support for scheduling download jobs and verifying completed file hashes.",
            "Test HERBIE's worker daemon in the background."
        ]
    },
    {
        "name": "Vision: Coding agent - code writing, reviews, debugging, technical tasks",
        "date": "2026-06-21",
        "keywords": ["vision", "coding agent", "developer"],
        "desc": "Establish the Vision Coding Agent, designed to generate high-quality code artifacts, perform automated code reviews, and debug runtimes using visual screenshots and code files.",
        "plan": [
            "Configure Vision's prompt persona focusing on code correctness and minimal change principles.",
            "Expose file-write, shell-execute, and compiler tools to Vision's tool chest.",
            "Implement an automated self-correcting logic loop upon compile/lint failures.",
            "Test code generation and debugging on sample projects."
        ]
    },
    {
        "name": "Implement full agent logging to track each agent step.",
        "date": "2026-06-24",
        "keywords": ["logging", "track", "log"],
        "desc": "Implement comprehensive state logging across all active agents. Every thought, tool call, action, and result must be saved securely to provide auditable agent telemetry.",
        "plan": [
            "Design a structured JSON logging format for agent steps.",
            "Create a centralized logger module that agents write to during execution.",
            "Save log traces to the Obsidian vault under a dedicated Session Logs folder.",
            "Verify that logs are updated in real-time."
        ]
    },
    {
        "name": "Develop 'console team' concept for agent debate and voting on outcomes.",
        "date": "2026-06-24",
        "keywords": ["console team", "debate", "voting"],
        "desc": "Develop a 'Console Team' architecture where multiple agents (e.g. Vision and Ultron) can debate code changes, vote on safety/optimizations, and reach a consensus before execution.",
        "plan": [
            "Create the debate control flow logic allowing consecutive turns between agents.",
            "Implement a voting mechanism requiring a majority vote for destructive operations.",
            "Log debate transcripts and consensus outcomes.",
            "Test multi-agent debate on a draft pull request."
        ]
    },
    {
        "name": "Build 'agent War Room' dashboard showing status of all agents linked to JARVIS.",
        "date": "2026-06-24",
        "keywords": ["war room", "dashboard"],
        "desc": "Build an 'Agent War Room' interface displaying real-time connectivity status, current task execution, resource footprints, and active outputs of all sub-agents.",
        "plan": [
            "Design the dashboard layout featuring active nodes and text output buffers.",
            "Expose dashboard telemetry feeds from the agent orchestrator.",
            "Implement status-blinking components for active running agents.",
            "Verify real-time updates across multiple active worker agents."
        ]
    },
    {
        "name": "Develop self-training agent concept.",
        "date": "2026-06-24",
        "keywords": ["self-training", "training"],
        "desc": "Implement a self-training pipeline where agents review their past successful runs, extract high-value demonstration patterns, and append them back to their fine-tuning or few-shot prompt libraries.",
        "plan": [
            "Create a prompt evaluator script that flags high-performance sessions.",
            "Write a parser to extract few-shot examples from historical session logs.",
            "Append validated examples to the agent's prompt catalog automatically.",
            "Verify improved routing accuracy after few-shot ingestion."
        ]
    },
    {
        "name": "Develop fine-tuning agent concept.",
        "date": "2026-06-24",
        "keywords": ["fine-tuning", "fine-tune"],
        "desc": "Design a pipeline for automated fine-tuning dataset preparation. Collects user corrections and task execution histories, formatting them into training pairs (prompt -> response).",
        "plan": [
            "Write datasets utilities to extract prompts and user corrections.",
            "Sanitize personal details and secure secrets from the training data.",
            "Format records into JSON Lines (JSONL) compliant with fine-tuning specifications.",
            "Trigger automated local or cloud fine-tuning scripts."
        ]
    },
    {
        "name": "Develop self-improve and optimize agents concept.",
        "date": "2026-06-24",
        "keywords": ["self-improve", "optimize agent"],
        "desc": "Build a self-improvement mechanism allowing agents to analyze compile errors, execution trace logs, and time benchmarks to refactor their own prompts or helper utility code.",
        "plan": [
            "Write a telemetry analyzer that flags bottlenecks or high-frequency errors.",
            "Feed the trace details back to the agent with a request to refactor the broken helper class.",
            "Compile and run automated test suites on the newly refactored class.",
            "Deploy the optimized code safely."
        ]
    },
    {
        "name": "Develop agent creator agent concept.",
        "date": "2026-06-24",
        "keywords": ["agent creator", "creator agent"],
        "desc": "Develop a meta-agent designed to bootstrap new specialized agent personas. It defines their system prompt, tool availability, and file triggers based on user-described requirements.",
        "plan": [
            "Write the agent creator system prompt instructions.",
            "Create a scaffolding script that outputs standard agent files (.md persona and tool definitions).",
            "Register the newly created agent inside the Agent Registry.",
            "Test creator agent by spawning a mock research agent."
        ]
    },
    {
        "name": "Develop multi-character and multi-personality agent concept.",
        "date": "2026-06-24",
        "keywords": ["personality", "character"],
        "desc": "Allow agents to adopt custom personas, tones, languages, and technical constraints (e.g. speaking in Telugu, adopting a lazy dev persona, or using strict posix shell constraints).",
        "plan": [
            "Implement persona headers and instructions configuration in the agent loader.",
            "Create a configuration file to store active agent personality settings.",
            "Support runtime language switching and tone adaptation.",
            "Verify character consistency over multi-turn conversations."
        ]
    },
    {
        "name": "Implement Self-Optimize agent to improve system speed and reduce latency.",
        "date": "2026-06-24",
        "keywords": ["self-optimize", "speed", "latency"],
        "desc": "Create a specialized Self-Optimize Agent that monitors file system changes, performs dependency audits, checks cache hit rates, and refactors helper calls to improve response times.",
        "plan": [
            "Write benchmarking metrics tools to monitor tool execution latency.",
            "Configure prompt templates for the Self-Optimize Agent targeting performance refactoring.",
            "Set up automatic cache-cleanup triggers for old vectors and logs.",
            "Run performance optimization checks on critical imports."
        ]
    },
    {
        "name": "Setup 'Vision' Coding agent",
        "date": "2026-06-25",
        "keywords": ["setup vision", "vision coding"],
        "desc": "Finalize installation, API key bindings, and directory paths for the Vision Coding Agent, enabling local developer-assistant tasks.",
        "plan": [
            "Bind the Vision Coding Agent to local project directories.",
            "Set up environmental variables and model endpoints (Gemini 1.5 Pro).",
            "Perform basic file edit validations to ensure local write operations are working.",
            "Confirm successful startup and initial handshake."
        ]
    },
    {
        "name": "at 10:00, implement feature to Jarvis",
        "date": "2026-06-21",
        "keywords": ["10:00", "implement feature"],
        "desc": "Scheduled task to implement a feature to Jarvis at 10:00 (e.g. notification triggers or reminder checks).",
        "plan": [
            "Create the scheduler cron worker inside the background task runner.",
            "Register the 10:00 target task trigger.",
            "Verify background agent execution when the timer expires.",
            "Log the outcome to the daily log."
        ]
    },
    {
        "name": "HERBIE: Background agent - system monitoring, downloads, background tasks via Light Panda Browser",
        "date": "2026-06-21",
        "keywords": ["light panda", "herbie", "panda browser"],
        "desc": "Equip HERBIE with Light Panda Browser capabilities for fast, serverless browser automation, background document downloads, and login workflows.",
        "plan": [
            "Configure Light Panda Browser executable and dependencies.",
            "Add search and download skill mappings for HERBIE using Light Panda API.",
            "Implement error recovery loops for connection dropouts.",
            "Verify headless page loading and file saving functions."
        ]
    },
    {
        "name": "Build Memory Layer",
        "date": "2026-06-18",
        "keywords": ["memory layer", "build memory"],
        "desc": "Construct the hierarchical Obsidian Memory Layer, separating daily logs, configuration, tasks, preferences, and system instructions for clear long-term retrieval.",
        "plan": [
            "Design the directory structure (Memory/Daily Logs, Memory/Task Memory, etc.).",
            "Write the daily logging daemon to write session details.",
            "Create the consolidation agent to move items from logs to memory cards.",
            "Link Obsidian folders to establish a cohesive knowledge graph."
        ]
    },
    {
        "name": "Investigate GitHub integration with personal access token for JARVIS actions",
        "date": "2026-06-26",
        "keywords": ["github", "token", "personal access"],
        "desc": "Investigate secure GitHub API integration using personal access tokens. Allows JARVIS to push code changes, open pull requests, and review issues directly.",
        "plan": [
            "Research GitHub authentication requirements and token permission scopes.",
            "Implement secure local vault storage for the PAT.",
            "Write sample endpoints to test repository cloning, staging, and pushing.",
            "Verify PR creation workflow."
        ]
    },
    {
        "name": "el mundo me dice, \"Nada que ver, ahí está.\" No hay afecto, ahí está.",
        "date": "2026-06-27",
        "keywords": ["mundo", "afecto", "nada que ver"],
        "desc": "Address foreign language user intent mapping and ensure cultural/conversational context is fully understood and recorded correctly without misinterpretation.",
        "plan": [
            "Analyze language detection rules for multi-lingual input queries.",
            "Map idiomatic expressions to their intended technical status updates.",
            "Log expression meanings inside personal preferences memory.",
            "Test fallback intent routing on idiomatic expressions."
        ]
    },
    {
        "name": "Analyze system-agent.ts token usage and define fallback strategy",
        "date": "2026-06-27",
        "keywords": ["system-agent.ts", "token usage", "fallback strategy"],
        "desc": "Analyze token metrics on system-agent.ts loops. Define robust fallback models (e.g. Gemini 1.5 Flash) if complex reasoning prompts hit rate limits, ensuring continuous execution.",
        "plan": [
            "Measure average input/output tokens in system-agent.ts.",
            "Implement rate-limit catch hooks in downstream requests.",
            "Add fallback routing to smaller, high-speed context models.",
            "Verify seamless fallback execution during simulated rate limits."
        ]
    },
    {
        "name": "Research the Reflexion Pattern for building self-correcting AI agents based on the reference from Instagram.",
        "date": "2026-06-28",
        "keywords": ["reflexion", "self-correcting", "reflexion pattern"],
        "desc": "Research the Reflexion design pattern. Build self-correcting AI agent loops that evaluate their own outputs, generate self-critique, and refine code or plans in multi-turn steps.",
        "plan": [
            "Review research papers and references on Reflexion frameworks.",
            "Implement self-evaluator prompt schemas.",
            "Create a trial loop where code compiler errors are corrected in-context.",
            "Benchmark success rates of Reflexion loops against standard coding prompts."
        ]
    }
]

# Helper to sanitize filename
def sanitize_filename(name):
    clean = re.sub(r'[\\/*?:"<>|]', "", name)
    return clean.strip()

# Helper to read file content
def read_file(path):
    if not os.path.exists(path):
        return ""
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

# Helper to parse turn blocks
def parse_turns(content):
    pattern = r"##\s*\[([^\]]+)\](.*?)(?=\n##\s*\[|\Z)"
    return re.findall(pattern, content, re.DOTALL)

# Main generation loop
for task in task_metadata_list:
    name = task["name"]
    date_str = task["date"]
    keywords = task["keywords"]
    desc = task["desc"]
    plan_steps = task["plan"]
    
    filename = f"{sanitize_filename(name)}.md"
    file_path = os.path.join(task_memory_dir, filename)
    
    # Verbatim conversation extractor
    conversation_history = []
    log_path = os.path.join(logs_dir, f"{date_str}.md")
    
    if os.path.exists(log_path):
        log_content = read_file(log_path)
        turns = parse_turns(log_content)
        
        for timestamp, turn_body in turns:
            turn_lower = turn_body.lower()
            if any(kw.lower() in turn_lower for kw in keywords):
                user_match = re.search(r"### User\s*\n(.*?)(?=\n### JARVIS|\Z)", turn_body, re.DOTALL)
                jarvis_match = re.search(r"### JARVIS\s*\n(.*?)(?=\n### |\Z)", turn_body, re.DOTALL)
                
                user_text = user_match.group(1).strip() if user_match else ""
                jarvis_text = jarvis_match.group(1).strip() if jarvis_match else ""
                
                # Clean links and format
                if user_text and "[Silence" not in user_text:
                    conversation_history.append(f"**User:** {user_text}")
                if jarvis_text:
                    conversation_history.append(f"**JARVIS:** {jarvis_text}")
    
    # Fallback if no relevant history found
    if not conversation_history:
        conversation_history.append(f"**User:** Discussing implementation plan for '{name}'.")
        conversation_history.append(f"**JARVIS:** Understood. I will outline the details and write the plan to the vault.")
        
    history_str = "\n".join(conversation_history)
    
    # Format plan
    plan_str = "\n".join([f"{i+1}. {step}" for i, step in enumerate(plan_steps)])
    
    # Compile markdown output
    frontmatter = {
        "type": "dev-task",
        "status": "in-progress",
        "origin_session": f"[[{date_str}]]",
        "parent_epic": "[[Unresolved Code Context]]",
        "blocks_task": "[[Unresolved Code Context]]",
        "requires_task": "[[Unresolved Code Context]]"
    }
    
    fm_str = yaml.safe_dump(frontmatter, sort_keys=False, default_flow_style=False).strip()
    
    body = f"""# {name}

## History
{history_str}

## Description
{desc}

## Plan
{plan_str}
"""
    
    full_content = f"---\n{fm_str}\n---\n{body}"
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(full_content)
        
    print(f"Generated task note: {filename}")

print("Task notes generation completed successfully!")
