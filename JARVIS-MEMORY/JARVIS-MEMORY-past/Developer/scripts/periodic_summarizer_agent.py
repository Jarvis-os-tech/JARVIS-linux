# Applying Skill: agent-memory-systems from Path 1
# Applying Skill: memory-systems from Path 1

import os
import re
import time
import threading
from datetime import datetime, date
from typing import Dict, List, Tuple

class PeriodicSummarizerAgent:
    """
    Periodic Summarization Agent for J.A.R.V.I.S.
    Periodically reviews daily logs since the last run (every 5 logs or scheduled interval),
    aggregates statistics, themes, preferences, facts, and tasks, and writes a structured
    markdown summary in the 'Memory/Summaries' directory.
    Marks daily logs as summarized to prevent duplicate processing.
    """
    def __init__(self, vault_path: str, run_interval_seconds: int = 5 * 86400, batch_size: int = 5):
        self.vault_path = os.path.abspath(vault_path)
        self.logs_dir = os.path.join(self.vault_path, "Memory", "Daily Logs")
        self.summaries_dir = os.path.join(self.vault_path, "System_Data", "Summaries")
        
        # Ensure directories exist
        os.makedirs(self.summaries_dir, exist_ok=True)
        
        # Concurrency and scheduler control
        self._lock = threading.Lock()
        self.run_interval = run_interval_seconds
        self.batch_size = batch_size
        self._stop_event = threading.Event()
        self._thread = None

    # --- Background Daemon Control ---

    def start(self):
        """Starts the scheduled summarizer agent in a background thread."""
        with self._lock:
            if self._thread is not None and self._thread.is_alive():
                return
            self._stop_event.clear()
            self._thread = threading.Thread(target=self._scheduler_loop, name="PeriodicSummarizerDaemon")
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
                self.summarize()
            except Exception as e:
                # Rule: Handle Every Failure - log exception but keep thread alive
                print(f"[PeriodicSummarizerAgent] Error in scheduled run: {e}")
            
            # Sleep in small increments to respond quickly to stop events
            elapsed = 0
            while elapsed < self.run_interval and not self._stop_event.is_set():
                time.sleep(1)
                elapsed += 1

    # --- Core Summarization Interface ---

    def summarize(self):
        """
        Scans all daily logs in the vault, identifies logs that have not yet been summarized,
        aggregates them, produces a periodic summary file, and marks logs as summarized.
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
            
            unsummarized_files = []
            for f in files:
                log_path = os.path.join(self.logs_dir, f)
                try:
                    content = self._read_file_with_retry(log_path)
                    metadata, remaining = self._parse_frontmatter(content)
                    
                    # We only summarize closed files that have a daily summary block and are consolidated
                    if metadata.get("summarized") is not True and "# Daily Summary" in remaining:
                        unsummarized_files.append((f, log_path, metadata, remaining))
                except Exception as e:
                    print(f"[PeriodicSummarizerAgent] Error reading {f} during scan: {e}")
                    
            if not unsummarized_files:
                return
                
            print(f"[PeriodicSummarizerAgent] Found {len(unsummarized_files)} unsummarized daily logs.")
            
            # Process in batches of batch_size
            while len(unsummarized_files) >= self.batch_size:
                batch = unsummarized_files[:self.batch_size]
                unsummarized_files = unsummarized_files[self.batch_size:]
                self._create_summary_for_batch(batch)
                
            # If there's a remainder (e.g. running manually or less than 5 days but scheduler wake up)
            # We can process it if it's the scheduled time and some logs are outstanding.
            # Let's support running on whatever is outstanding if batch_size is 1 or manually triggered.
            # In a real environment, we'll run on whatever is outstanding when the timer fires.
            # To be safe and compliant, we will process any remaining logs as a summary batch.
            if unsummarized_files:
                self._create_summary_for_batch(unsummarized_files)

    def _create_summary_for_batch(self, batch: List[Tuple[str, str, dict, str]]):
        """Creates a consolidated summary file for a specific batch of logs and updates daily logs."""
        batch_dates = [filename[:-3] for filename, _, _, _ in batch]
        start_date = batch_dates[0]
        end_date = batch_dates[-1]
        
        summary_filename = f"Summary_{start_date}_to_{end_date}.md"
        summary_path = os.path.join(self.summaries_dir, summary_filename)
        
        print(f"[PeriodicSummarizerAgent] Creating periodic summary: {summary_filename}...")
        
        # Aggregation state
        aggregate_stats = {
            "daily_logs": len(batch),
            "sessions": 0,
            "interactions": 0,
            "agent_executions": 0,
            "memory_candidates": 0,
            "errors": 0
        }
        
        themes: List[Tuple[str, str]] = []
        facts: List[Tuple[str, str]] = []
        preferences: List[Tuple[str, str]] = []
        tasks: List[Tuple[str, str]] = []
        
        for filename, _, metadata, remaining in batch:
            log_date = filename[:-3]
            
            # Add stats
            aggregate_stats["sessions"] += metadata.get("session_count", 0)
            aggregate_stats["interactions"] += metadata.get("interaction_count", 0)
            aggregate_stats["memory_candidates"] += metadata.get("memory_candidates", 0)
            
            # Extract daily summary contents
            summary_part = remaining.split("# Daily Summary", 1)[1]
            current_section = None
            for line in summary_part.splitlines():
                stripped = line.strip()
                if stripped.startswith("## Statistics"):
                    current_section = "stats"
                    continue
                elif stripped.startswith("## Key Topics"):
                    current_section = "themes"
                    continue
                elif stripped.startswith("## New Knowledge"):
                    current_section = "facts"
                    continue
                elif stripped.startswith("## User Preferences Learned"):
                    current_section = "preferences"
                    continue
                elif stripped.startswith("## Outstanding Tasks"):
                    current_section = "tasks"
                    continue
                elif stripped.startswith("## ") or stripped.startswith("# "):
                    current_section = None
                    continue
                    
                if current_section == "stats" and line.startswith("- "):
                    if "Agent Executions:" in line:
                        val = line.split(":", 1)[1].strip()
                        if val.isdigit():
                            aggregate_stats["agent_executions"] += int(val)
                    elif "Errors:" in line:
                        val = line.split(":", 1)[1].strip()
                        if val.isdigit():
                            aggregate_stats["errors"] += int(val)
                            
                elif current_section and line.startswith("- "):
                    item = line[2:].strip()
                    if item and item.lower() != "none":
                        entry = (item, log_date)
                        if current_section == "themes":
                            themes.append(entry)
                        elif current_section == "facts":
                            facts.append(entry)
                        elif current_section == "preferences":
                            preferences.append(entry)
                        elif current_section == "tasks":
                            tasks.append(entry)
                            
        # Deduplicate and format entries with source backlinks
        def consolidate_and_format(entries: List[Tuple[str, str]]) -> str:
            if not entries:
                return "- None\n"
            seen = set()
            lines = []
            for item, src in entries:
                normalized = item.lower().strip()
                if normalized not in seen:
                    seen.add(normalized)
                    lines.append(f"- {item} (Source: [[{src}]])")
            return "\n".join(lines) + "\n"
            
        # Compile Summary Markdown
        summary_content = []
        summary_content.append(f"""---
type: periodic-summary
start_date: {start_date}
end_date: {end_date}
generated_by: JARVIS
date_created: {date.today().isoformat()}
---

# Periodic Summary: {start_date} to {end_date}

## Statistics (Aggregate)

- Daily Logs Reviewed: {aggregate_stats["daily_logs"]}
- Total Sessions: {aggregate_stats["sessions"]}
- Total Interactions: {aggregate_stats["interactions"]}
- Agent Executions: {aggregate_stats["agent_executions"]}
- Memory Candidates: {aggregate_stats["memory_candidates"]}
- Accumulated Errors: {aggregate_stats["errors"]}

## Key Themes & Topics

{consolidate_and_format(themes)}
## Consolidated New Knowledge

{consolidate_and_format(facts)}
## Consolidated User Preferences

{consolidate_and_format(preferences)}
## Outstanding Tasks

{consolidate_and_format(tasks)}""")

        # Write Summary File
        self._write_file_with_retry(summary_path, "".join(summary_content))
        
        # Mark all batch logs as summarized
        for filename, path, metadata, remaining in batch:
            metadata["summarized"] = True
            metadata["summary_file"] = summary_filename
            metadata["summarized_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            new_frontmatter = self._serialize_frontmatter(metadata)
            updated_content = f"{new_frontmatter}\n{remaining.lstrip()}"
            self._write_file_with_retry(path, updated_content)
            
        print(f"[PeriodicSummarizerAgent] Marked {len(batch)} logs as summarized under {summary_filename}.")

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
