# Applying Skill: agent-memory-systems from Path 1
# Applying Skill: memory-systems from Path 1

import os
import re
import time
import threading
from datetime import datetime, date
from typing import Dict, List, Tuple
from memory_graph_linker import MemoryGraphLinker

class MemoryConsolidationAgent:
    """
    Memory Consolidation Agent for J.A.R.V.I.S.
    Reads daily logs, extracts user preferences, facts, and tasks,
    and consolidates them into respective memory files within the Obsidian vault.
    Marks processed logs to avoid duplicate runs and ensures transaction safety.
    """
    def __init__(self, vault_path: str, run_interval_seconds: int = 3600):
        self.vault_path = os.path.abspath(vault_path)
        self.logs_dir = os.path.join(self.vault_path, "Memory", "Daily Logs")
        
        # Target memory categories directories
        self.pref_dir = os.path.join(self.vault_path, "Memory", "User Preference Memory")
        self.task_dir = os.path.join(self.vault_path, "Memory", "Task Memory")
        self.inst_dir = os.path.join(self.vault_path, "Memory", "Instruction Memory")
        self.personal_details_dir = os.path.join(self.vault_path, "Memory", "Personal Details Memory")
        
        # Ensure directories exist
        os.makedirs(self.pref_dir, exist_ok=True)
        os.makedirs(self.task_dir, exist_ok=True)
        os.makedirs(self.inst_dir, exist_ok=True)
        os.makedirs(self.personal_details_dir, exist_ok=True)
        
        # Instantiate the Memory Graph Linker
        self.linker = MemoryGraphLinker(self.vault_path)
        self.linker.enforce_all_vault_nodes()
        
        # Concurrency control
        self._lock = threading.Lock()
        self.run_interval = run_interval_seconds
        self._stop_event = threading.Event()
        self._thread = None

    # --- Background Daemon Control ---

    def start(self):
        """Starts the scheduled consolidation agent in a background thread."""
        with self._lock:
            if self._thread is not None and self._thread.is_alive():
                return
            self._stop_event.clear()
            self._thread = threading.Thread(target=self._scheduler_loop, name="MemoryConsolidationDaemon")
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
                self.consolidate()
            except Exception as e:
                # Rule: Handle Every Failure - log exception but keep thread alive
                print(f"[MemoryConsolidationAgent] Error in scheduled run: {e}")
            
            # Sleep in small increments to respond quickly to stop events
            elapsed = 0
            while elapsed < self.run_interval and not self._stop_event.is_set():
                time.sleep(1)
                elapsed += 1

    # --- Core Consolidation Interface ---

    def consolidate(self):
        """
        Scans all daily logs in the vault, extracts memory candidates from
        unprocessed logs, updates the memory categories, and marks the logs as processed.
        """
        with self._lock:
            if not os.path.exists(self.logs_dir):
                return
            
            # Find all YYYY-MM-DD.md log files
            files = []
            for f in os.listdir(self.logs_dir):
                if f.endswith(".md") and re.match(r"^\d{4}-\d{2}-\d{2}\.md$", f):
                    files.append(f)
            
            # Sort chronologically to maintain history order
            files.sort()
            
            for f in files:
                log_path = os.path.join(self.logs_dir, f)
                try:
                    self._process_log_file(log_path)
                except Exception as e:
                    # Catch and log error per file, so one bad file doesn't block others
                    print(f"[MemoryConsolidationAgent] Failed to process {f}: {e}")

    def _process_log_file(self, log_path: str):
        """Processes a single daily log file. Updates target files and marks log as consolidated."""
        content = self._read_file_with_retry(log_path)
        metadata, remaining = self._parse_frontmatter(content)
        
        filename = os.path.basename(log_path)
        log_date_str = filename[:-3] # Extract YYYY-MM-DD
        
        # Enforce dev-session frontmatter
        updated_metadata = self.linker.enforce_session_frontmatter(log_date_str, metadata)
        if updated_metadata != metadata:
            self._write_file_with_retry(log_path, f"{self._serialize_frontmatter(updated_metadata)}\n{remaining.lstrip()}")
            metadata = updated_metadata
        
        # Check if already processed
        if metadata.get("consolidated") is True:
            return
            
        print(f"[MemoryConsolidationAgent] Consolidating memories from {filename}...")
        
        # Extract candidates
        candidates = self._extract_candidates(content, remaining)
        
        # Apply changes to respective files
        has_updates = False
        if candidates.get("preferences"):
            self._append_to_memory_file(
                target_path=os.path.join(self.pref_dir, "Preferences.md"),
                header="User Preferences",
                items=candidates["preferences"],
                log_date_str=log_date_str
            )
            has_updates = True
            
        if candidates.get("facts") or candidates.get("personalDetails"):
            combined_details = list(dict.fromkeys(candidates.get("facts", []) + candidates.get("personalDetails", [])))
            self._append_to_memory_file(
                target_path=os.path.join(self.personal_details_dir, "Personal Details.md"),
                header="Personal Details",
                items=combined_details,
                log_date_str=log_date_str
            )
            has_updates = True
            
        if candidates.get("tasks"):
            self._append_to_memory_file(
                target_path=os.path.join(self.task_dir, "Tasks.md"),
                header="Outstanding Tasks",
                items=candidates["tasks"],
                log_date_str=log_date_str
            )
            has_updates = True
            
        if candidates.get("instructions"):
            self._append_to_memory_file(
                target_path=os.path.join(self.inst_dir, "Instructions.md"),
                header="Agent Instructions",
                items=candidates["instructions"],
                log_date_str=log_date_str
            )
            has_updates = True

        # Update metadata and write back to daily log
        metadata["consolidated"] = True
        metadata["consolidated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        new_frontmatter = self._serialize_frontmatter(metadata)
        updated_content = f"{new_frontmatter}\n{remaining.lstrip()}"
        
        self._write_file_with_retry(log_path, updated_content)
        print(f"[MemoryConsolidationAgent] Log {filename} marked as consolidated.")

    # --- Candidate Extraction Algorithms ---

    def _extract_candidates(self, full_content: str, remaining_content: str) -> Dict[str, List[str]]:
        """
        Extracts candidates from the Daily Summary block first.
        If the Daily Summary block is missing, falls back to parsing turn-by-turn memory updates.
        """
        candidates = {
            "preferences": [],
            "facts": [],
            "tasks": [],
            "instructions": [],
            "personalDetails": []
        }
        
        if "# Daily Summary" in remaining_content:
            summary_part = remaining_content.split("# Daily Summary", 1)[1]
            
            # Parse from Daily Summary sections
            current_section = None
            for line in summary_part.splitlines():
                stripped = line.strip()
                if stripped.startswith("## User Preferences Learned"):
                    current_section = "preferences"
                    continue
                elif stripped.startswith("## New Knowledge") or stripped.startswith("## Personal Details Learned"):
                    current_section = "personalDetails"
                    continue
                elif stripped.startswith("## Outstanding Tasks"):
                    current_section = "tasks"
                    continue
                elif stripped.startswith("## ") or stripped.startswith("# "):
                    current_section = None
                    continue
                
                if current_section and line.startswith("- "):
                    item = line[2:].strip()
                    if item and item.lower() != "none":
                        candidates[current_section].append(item)
        
        # Always parse turns as well to ensure fallback and cross-checking turn-by-turn updates
        turn_candidates = self._extract_from_turns(remaining_content)
        
        # Merge lists, keeping uniqueness
        for key in candidates:
            merged = list(dict.fromkeys(candidates[key] + turn_candidates[key]))
            candidates[key] = merged
            
        return candidates

    def _extract_from_turns(self, content: str) -> Dict[str, List[str]]:
        """Parses individual conversational turn updates to extract memory candidates."""
        candidates = {
            "preferences": [],
            "facts": [],
            "tasks": [],
            "instructions": [],
            "personalDetails": []
        }
        
        # Locate all Memory Updates blocks
        matches = re.finditer(r"### Memory Updates\s*\n(.*?)(?=\n## |\n# Daily Summary|\Z)", content, re.DOTALL)
        for match in matches:
            block = match.group(1)
            current_list = None
            for line in block.splitlines():
                stripped = line.strip()
                
                # Check headers
                if stripped.startswith("- New Preference:"):
                    current_list = "preferences"
                    inline = stripped[len("- New Preference:"):].strip()
                    if inline:
                        candidates[current_list].append(inline)
                    continue
                elif stripped.startswith("- New Fact:") or stripped.startswith("- New Personal Detail:"):
                    current_list = "personalDetails"
                    prefix_len = len("- New Fact:") if stripped.startswith("- New Fact:") else len("- New Personal Detail:")
                    inline = stripped[prefix_len:].strip()
                    if inline:
                        candidates[current_list].append(inline)
                    continue
                elif stripped.startswith("- New Task:"):
                    current_list = "tasks"
                    inline = stripped[len("- New Task:"):].strip()
                    if inline:
                        candidates[current_list].append(inline)
                    continue
                elif stripped.startswith("- Updated Instruction:"):
                    current_list = "instructions"
                    inline = stripped[len("- Updated Instruction:"):].strip()
                    if inline:
                        candidates[current_list].append(inline)
                    continue
                
                # Check list items under headers
                if current_list and line.startswith("  - "):
                    item = line.replace("  - ", "", 1).strip()
                    if item:
                        candidates[current_list].append(item)
                        
        return candidates

    # --- Target Note Appender & Deduplication ---

    def _append_to_memory_file(self, target_path: str, header: str, items: List[str], log_date_str: str):
        """Appends lists of items to target files, ensuring deduplication and adding Obsidian back-links."""
        existing_items = set()
        metadata = {}
        body = f"# {header}\n\n"
        
        # Check if task detail file exists and is completed/removed
        def is_task_completed_or_removed(item_name: str) -> bool:
            clean_name = item_name.replace("[[", "").replace("]]", "")
            clean_spaces = re.sub(r'[\\/*?:"<>|]', "", clean_name).strip()
            clean_underscores = re.sub(r'\s+', '_', clean_spaces)
            
            for name in [clean_spaces, clean_underscores]:
                detail_path = os.path.join(self.task_dir, f"{name}.md")
                if os.path.exists(detail_path):
                    try:
                        with open(detail_path, "r", encoding="utf-8") as f:
                            content = f.read()
                        meta, _ = self._parse_frontmatter(content)
                        status = meta.get("status", "").lower()
                        if status in ["completed", "done", "removed"]:
                            return True
                    except:
                        pass
            return False

        if os.path.exists(target_path):
            metadata, body = self.linker.parse_file(target_path)
            # Find existing lines and normalize them for duplicate checks
            for line in body.splitlines():
                stripped = line.strip()
                if stripped.startswith("- "):
                    raw_item = stripped[2:].strip()
                    # Strip source link suffix if present, e.g., " (Learned: [[YYYY-MM-DD]])"
                    raw_item_clean = re.sub(r"\s*\(Learned:\s*\[\[\d{4}-\d{2}-\d{2}\]\]\)\s*$", "", raw_item)
                    raw_item_clean = re.sub(r"\s*\(Source:\s*\[\[\d{4}-\d{2}-\d{2}\]\]\)\s*$", "", raw_item_clean)
                    raw_item_clean = re.sub(r"^\[(in[- ]progress|progress|completed|done|scheduled|failed|removed)\]\s*", "", raw_item_clean, flags=re.IGNORECASE)
                    raw_item_clean = raw_item_clean.replace("[[", "").replace("]]", "")
                    existing_items.add(raw_item_clean.lower().strip())

        new_entries = []
        for item in items:
            normalized_item = item.strip()
            clean_normalized = re.sub(r"^\[(in[- ]progress|progress|completed|done|scheduled|failed|removed)\]\s*", "", normalized_item, flags=re.IGNORECASE)
            clean_normalized = clean_normalized.replace("[[", "").replace("]]", "").lower().strip()
            
            if clean_normalized not in existing_items:
                if "tasks" in os.path.basename(target_path).lower():
                    if is_task_completed_or_removed(normalized_item):
                        continue
                # Add back-link to original daily log
                new_entries.append(f"- {normalized_item} (Learned: [[{log_date_str}]])")
                existing_items.add(clean_normalized)
                
        if new_entries:
            # Append entries at the bottom
            updated_body = body.rstrip() + "\n" + "\n".join(new_entries) + "\n"
        else:
            updated_body = body

        # Enforce frontmatter depending on target file
        basename = os.path.basename(target_path).lower()
        if "tasks" in basename:
            metadata = self.linker.enforce_task_frontmatter(metadata, origin_session_str=log_date_str)
        elif "instructions" in basename:
            metadata = self.linker.enforce_architecture_frontmatter(category="system-prompt", existing_metadata=metadata)
        elif "preferences" in basename:
            metadata = self.linker.enforce_architecture_frontmatter(category="configuration", existing_metadata=metadata)
        elif "personal details" in basename:
            metadata = self.linker.enforce_architecture_frontmatter(category="configuration", existing_metadata=metadata)

        self.linker.write_file(target_path, metadata, updated_body)

    # --- Frontmatter Parsers (Thread-Safe) ---

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


if __name__ == "__main__":
    import sys
    default_vault = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    vault = sys.argv[1] if len(sys.argv) > 1 else default_vault
    agent = MemoryConsolidationAgent(vault)
    agent.consolidate()
    print("Memory consolidation completed successfully.")
