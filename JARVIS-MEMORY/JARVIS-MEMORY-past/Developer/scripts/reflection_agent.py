# Applying Skill: agent-memory-systems from Path 1
# Applying Skill: memory-systems from Path 1

import os
import re
import time
import threading
from datetime import datetime, date
from typing import Dict, List, Tuple
from memory_graph_linker import MemoryGraphLinker

class ReflectionAgent:
    """
    Reflection Agent for J.A.R.V.I.S.
    Periodically reviews periodic summary notes, identifies recurring user preferences,
    frequently recurring tasks, and execution errors.
    Synthesizes 'lessons learned' and updates J.A.R.V.I.S.'s internal guidelines.
    Marks processed summaries to avoid duplicate reflection.
    """
    def __init__(self, vault_path: str, run_interval_seconds: int = 7 * 86400):
        self.vault_path = os.path.abspath(vault_path)
        self.summaries_dir = os.path.join(self.vault_path, "System_Data", "Summaries")
        
        # Target memory card paths and directories
        self.pref_dir = os.path.join(self.vault_path, "Memory", "User Preference Memory")
        self.task_dir = os.path.join(self.vault_path, "Memory", "Task Memory")
        self.inst_dir = os.path.join(self.vault_path, "Memory", "Instruction Memory")
        self.skills_dir = os.path.join(self.vault_path, "Developer", "Procedural Memory")
        self.personal_details_dir = os.path.join(self.vault_path, "Memory", "Personal Details Memory")
        
        self.lessons_file = os.path.join(self.inst_dir, "Lessons Learned.md")
        self.instructions_file = os.path.join(self.inst_dir, "Instructions.md")
        self.personal_details_file = os.path.join(self.personal_details_dir, "Personal Details.md")
        
        # Ensure directories exist
        os.makedirs(self.pref_dir, exist_ok=True)
        os.makedirs(self.task_dir, exist_ok=True)
        os.makedirs(self.inst_dir, exist_ok=True)
        os.makedirs(self.skills_dir, exist_ok=True)
        os.makedirs(self.personal_details_dir, exist_ok=True)
        
        # Instantiate the Memory Graph Linker
        self.linker = MemoryGraphLinker(self.vault_path)
        
        # Concurrency control
        self._lock = threading.Lock()
        self.run_interval = run_interval_seconds
        self._stop_event = threading.Event()
        self._thread = None

    # --- Background Daemon Control ---

    def start(self):
        """Starts the scheduled reflection agent in a background thread."""
        with self._lock:
            if self._thread is not None and self._thread.is_alive():
                return
            self._stop_event.clear()
            self._thread = threading.Thread(target=self._scheduler_loop, name="ReflectionDaemon")
            self._thread.daemon = True
            self._thread.start()

    def stop(self):
        """Stops the background scheduler cleanly."""
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=5.0)

    def _scheduler_loop(self):
        """Scheduler loop running on a thread."""
        while not self._stop_event.is_set():
            try:
                self.reflect()
            except Exception as e:
                # Rule: Handle Every Failure - log exception but keep thread alive
                print(f"[ReflectionAgent] Error in scheduled run: {e}")
            
            # Sleep in small increments to respond quickly to stop events
            elapsed = 0
            while elapsed < self.run_interval and not self._stop_event.is_set():
                time.sleep(1)
                elapsed += 1

    # --- Core Reflection Interface ---

    def reflect(self):
        """
        Scans all periodic summaries in the vault, identifies those not yet reflected on,
        analyzes their aggregate content, synthesizes learnings/guidelines, and updates target memories.
        """
        with self._lock:
            if not os.path.exists(self.summaries_dir):
                return
            
            # Find all Summary_*.md files
            files = []
            for f in os.listdir(self.summaries_dir):
                if f.endswith(".md") and f.startswith("Summary_"):
                    files.append(f)
            
            # Sort chronologically
            files.sort()
            
            unreflected_summaries = []
            for f in files:
                summary_path = os.path.join(self.summaries_dir, f)
                try:
                    content = self._read_file_with_retry(summary_path)
                    metadata, remaining = self._parse_frontmatter(content)
                    
                    if metadata.get("reflected") is not True:
                        unreflected_summaries.append((f, summary_path, metadata, remaining))
                except Exception as e:
                    print(f"[ReflectionAgent] Error reading summary {f}: {e}")
                    
            if not unreflected_summaries:
                return
                
            print(f"[ReflectionAgent] Found {len(unreflected_summaries)} unreflected summaries. Initiating analysis...")
            
            # Perform reflection
            self._analyze_and_reflect(unreflected_summaries)

    def _analyze_and_reflect(self, summaries: List[Tuple[str, str, dict, str]]):
        """Analyzes a batch of unreflected summaries and writes results."""
        aggregated_data = {
            "themes": [],
            "facts": [],
            "preferences": [],
            "tasks": [],
            "total_errors": 0
        }
        
        for filename, _, metadata, remaining in summaries:
            summary_name = filename[:-3] # Strip .md
            
            # Sum up errors
            # Look in markdown text: "- Accumulated Errors: <num>"
            err_match = re.search(r"-\s*Accumulated Errors:\s*(\d+)", remaining)
            if err_match:
                aggregated_data["total_errors"] += int(err_match.group(1))
                
            # Extract bullet points from sections
            for section, key in [
                ("## Key Themes & Topics", "themes"),
                ("## Consolidated New Knowledge", "facts"),
                ("## Consolidated User Preferences", "preferences"),
                ("## Outstanding Tasks", "tasks")
            ]:
                if section in remaining:
                    sec_part = remaining.split(section, 1)[1].split("\n\n", 1)[0]
                    for line in sec_part.splitlines():
                        if line.strip().startswith("- "):
                            item = line.strip()[2:]
                            if item and item.lower() != "none":
                                aggregated_data[key].append((item, summary_name))
                                
        # Perform synthesis (Lessons Learned, Guidelines, and Skills)
        lessons, instructions, skills = self._synthesize_reflections(aggregated_data)
        
        # Write Lessons Learned
        self._append_to_reflection_file(
            target_path=self.lessons_file,
            header="Lessons Learned",
            entries=lessons
        )
        
        # Write Instruction Updates
        self._append_to_reflection_file(
            target_path=self.instructions_file,
            header="Agent Instructions",
            entries=instructions
        )
        
        # Flag Skill Acquisitions
        if skills:
            skills_path = os.path.join(self.skills_dir, "Skills To Acquire.md")
            self._append_to_reflection_file(
                target_path=skills_path,
                header="Skills To Acquire",
                entries=skills
            )
            
        # Mark summary files as reflected
        for filename, path, metadata, remaining in summaries:
            metadata["reflected"] = True
            metadata["reflected_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            new_frontmatter = self._serialize_frontmatter(metadata)
            updated_content = f"{new_frontmatter}\n{remaining.lstrip()}"
            self._write_file_with_retry(path, updated_content)
            
        print(f"[ReflectionAgent] Successfully completed reflection for {len(summaries)} summaries.")

    def _synthesize_reflections(self, data: dict) -> Tuple[List[str], List[str], List[str]]:
        """
        Synthesizes reflections based on data.
        In production, this would invoke a LLM with a system prompt.
        Implemented here using a high-quality heuristic synthesis engine for deterministic local execution.
        """
        lessons = []
        instructions = []
        skills = []
        
        # 1. Analyze User Preferences Patterns
        pref_counts = {}
        for pref, src in data["preferences"]:
            # Clean and normalize preference key
            raw_pref = re.sub(r"\s*\(Source:\s*\[\[.*?\]\]\)\s*$", "", pref).strip()
            norm = raw_pref.lower()
            if norm not in pref_counts:
                pref_counts[norm] = {"text": raw_pref, "count": 0, "sources": []}
            pref_counts[norm]["count"] += 1
            if src not in pref_counts[norm]["sources"]:
                pref_counts[norm]["sources"].append(src)
                
        for norm, info in pref_counts.items():
            sources_link = ", ".join([f"[[{s}]]" for s in info["sources"]])
            if info["count"] >= 1:
                lessons.append(f"Preference pattern identified: {info['text']} (Detected in {info['count']} periods; Sources: {sources_link})")
                instructions.append(f"Adapt system defaults to align with user preference: {info['text']} (Derived from: {sources_link})")

        # 2. Analyze Task Recurrence Patterns
        task_counts = {}
        for task, src in data["tasks"]:
            raw_task = re.sub(r"\s*\(Source:\s*\[\[.*?\]\]\)\s*$", "", task).strip()
            norm = raw_task.lower()
            if norm not in task_counts:
                task_counts[norm] = {"text": raw_task, "count": 0, "sources": []}
            task_counts[norm]["count"] += 1
            if src not in task_counts[norm]["sources"]:
                task_counts[norm]["sources"].append(src)
                
        for norm, info in task_counts.items():
            sources_link = ", ".join([f"[[{s}]]" for s in info["sources"]])
            if info["count"] > 1:
                # Task appears in multiple summaries - recurring objective
                lessons.append(f"Recurring task detected: '{info['text']}' requires structural optimization (Active across {info['count']} periods; Sources: {sources_link})")
                instructions.append(f"Prioritize and streamline workflows for recurring user task: '{info['text']}' (Derived from: {sources_link})")
            elif info["count"] == 1:
                # Single task
                lessons.append(f"Outstanding task consolidated: '{info['text']}' (Source: {sources_link})")

        # 3. Analyze Errors & Failures
        if data["total_errors"] > 0:
            sources_link = ", ".join([f"[[{filename}]]" for filename in [p[1] for p in data["themes"] if p[0]]]) # fallback to general summaries list
            lessons.append(f"Agent execution encountered {data['total_errors']} errors during this time frame. Requires diagnostic monitoring.")
            instructions.append("Increase error handling boundaries and add comprehensive diagnostics on agent tools to mitigate execution crashes.")
            skills.append(f"Implement automated error recovery mechanisms for active tools (Identified due to {data['total_errors']} failures)")
            
        # 4. Synthesize Skill Acquisition flags
        # Scan for tasks or themes mentioning skills we might lack
        for theme, src in data["themes"]:
            raw_theme = re.sub(r"\s*\(Source:\s*\[\[.*?\]\]\)\s*$", "", theme).strip()
            if any(keyword in raw_theme.lower() for keyword in ["build", "implement", "develop", "missing", "fail"]):
                skills.append(f"Acquire/enhance skill related to: '{raw_theme}' (Source: [[{src}]])")
                
        return lessons, instructions, skills

    # --- Target Note Appender ---

    def _append_to_reflection_file(self, target_path: str, header: str, entries: List[str]):
        """Appends list of reflection items to target files, ensuring deduplication and proper frontmatter."""
        if not entries:
            return
            
        existing_entries = set()
        metadata = {}
        body = f"# {header}\n\n"
        
        if os.path.exists(target_path):
            metadata, body = self.linker.parse_file(target_path)
            for line in body.splitlines():
                stripped = line.strip()
                if stripped.startswith("- "):
                    raw_entry = stripped[2:].strip()
                    # Strip source link suffix if present
                    raw_entry_clean = re.sub(r"\s*\(Derived\s*from:\s*.*?\)\s*$", "", raw_entry)
                    raw_entry_clean = re.sub(r"\s*\(Sources:\s*.*?\)\s*$", "", raw_entry_clean)
                    raw_entry_clean = re.sub(r"\s*\(Source:\s*.*?\)\s*$", "", raw_entry_clean)
                    existing_entries.add(raw_entry_clean.lower().strip())

        new_lines = []
        for entry in entries:
            # Check for duplication on raw text
            entry_clean = re.sub(r"\s*\(Derived\s*from:\s*.*?\)\s*$", "", entry)
            entry_clean = re.sub(r"\s*\(Sources:\s*.*?\)\s*$", "", entry_clean)
            entry_clean = re.sub(r"\s*\(Source:\s*.*?\)\s*$", "", entry_clean).strip()
            
            if entry_clean.lower() not in existing_entries:
                new_lines.append(f"- {entry}")
                existing_entries.add(entry_clean.lower())
                
        if new_lines:
            updated_body = body.rstrip() + "\n" + "\n".join(new_lines) + "\n"
        else:
            updated_body = body

        basename = os.path.basename(target_path).lower()
        category = "system-prompt"
        if "lessons" in basename:
            category = "design-pattern"
        elif "skills" in basename:
            category = "system-prompt"

        metadata = self.linker.enforce_architecture_frontmatter(category=category, existing_metadata=metadata)
        self.linker.write_file(target_path, metadata, updated_body)

    # --- Frontmatter Parsers ---

    def _parse_frontmatter(self, content: str) -> Tuple[dict, str]:
        match = re.match(r"^---\s*\n(.*?)\n---\s*\n", content, re.DOTALL)
        if not match:
            return {}, content
        
        yaml_text = match.group(1)
        remaining = content[match.end():]
        
        try:
            import yaml
            metadata = yaml.safe_load(yaml_text) or {}
        except Exception:
            metadata = {}
            for line in yaml_text.splitlines():
                if ":" in line:
                    key, val = line.split(":", 1)
                    key = key.strip()
                    val = val.strip()
                    if val.isdigit():
                        metadata[key] = int(val)
                    elif val.lower() == "true":
                        metadata[key] = True
                    elif val.lower() == "false":
                        metadata[key] = False
                    else:
                        metadata[key] = val
        return metadata, remaining

    def _serialize_frontmatter(self, metadata: dict) -> str:
        try:
            import yaml
            yaml_text = yaml.safe_dump(metadata, sort_keys=False, default_flow_style=False).strip()
            return f"---\n{yaml_text}\n---\n"
        except Exception:
            lines = ["---"]
            for k, v in metadata.items():
                lines.append(f"{k}: {v}")
            lines.append("---")
            return "\n".join(lines) + "\n"

    # --- File Operations with Retry Pattern (Rule: Handle Every Failure) ---

    def _read_file_with_retry(self, path: str, retries: int = 5, delay: float = 0.1) -> str:
        for i in range(retries):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return f.read()
            except IOError as e:
                if i == retries - 1:
                    raise IOError(f"Failed to read file {path} after {retries} attempts: {e}")
                time.sleep(delay)
        return ""

    def _write_file_with_retry(self, path: str, content: str, retries: int = 5, delay: float = 0.1):
        for i in range(retries):
            try:
                temp_path = path + ".tmp"
                with open(temp_path, "w", encoding="utf-8") as f:
                    f.write(content)
                if os.path.exists(path):
                    os.remove(path)
                os.rename(temp_path, path)
                return
            except IOError as e:
                if os.path.exists(temp_path):
                    try:
                        os.remove(temp_path)
                    except:
                        pass
                if i == retries - 1:
                    raise IOError(f"Failed to write file {path} after {retries} attempts: {e}")
                time.sleep(delay)
