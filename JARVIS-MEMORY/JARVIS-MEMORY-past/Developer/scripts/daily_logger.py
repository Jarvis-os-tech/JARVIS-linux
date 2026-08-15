# Applying Skill: agent-memory-systems from Path 1
# Applying Skill: conversation-memory from Path 1

import os
import re
import time
from datetime import datetime, date, timedelta
import threading
from memory_graph_linker import MemoryGraphLinker

class DailyLogger:
    """
    Daily Interaction Logging System for J.A.R.V.I.S.
    Persists interactions, agent actions, system events, and extracts memory candidates 
    into structured daily markdown logs within an Obsidian vault.
    """
    def __init__(self, vault_path: str):
        self.vault_path = os.path.abspath(vault_path)
        self.logs_dir = os.path.join(self.vault_path, "Memory", "Daily Logs")
        os.makedirs(self.logs_dir, exist_ok=True)
        
        # Instantiate the Memory Graph Linker
        self.linker = MemoryGraphLinker(self.vault_path)
        
        # State to track active logging date and prevent multi-thread conflicts
        self._lock = threading.Lock()
        self._rotation_timer = None
        
        # Determine the initial date
        # If there's an existing log, start from its date to catch up on missed days
        last_date = self._find_last_log_date()
        self._current_date = last_date
        
        # Run rollover catch-up if needed, and make sure today's log is initialized
        with self._lock:
            self._check_and_handle_rollover()
            self._initialize_log_file(self._current_date)
            
        # Start scheduled rotation thread for midnight
        self._start_midnight_scheduler()

    def _find_last_log_date(self) -> date:
        """
        Scans the daily logs folder to find the date of the most recent log file.
        Returns date.today() if no log files exist.
        """
        try:
            files = os.listdir(self.logs_dir)
            log_dates = []
            for f in files:
                if f.endswith(".md"):
                    name = f[:-3]
                    try:
                        d = date.fromisoformat(name)
                        log_dates.append(d)
                    except ValueError:
                        pass
            if log_dates:
                return max(log_dates)
        except Exception:
            pass
        return date.today()

    # --- File Operation Helpers with Retry Pattern (Rule: Handle Every Failure) ---
    
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
                # Write to a temp file first and rename to ensure atomicity
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

    # --- Frontmatter YAML Parsers ---
    
    def _parse_frontmatter(self, content: str) -> tuple[dict, str]:
        """
        Parses the YAML frontmatter.
        Returns a tuple of (metadata_dict, remaining_content).
        """
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
                    # Type conversions
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

    # --- Internal Management ---

    def _get_log_path(self, log_date: date) -> str:
        return os.path.join(self.logs_dir, f"{log_date.isoformat()}.md")

    def _initialize_log_file(self, log_date: date) -> str:
        """
        Creates a new daily log file if it does not exist.
        Returns the path to the daily log.
        """
        path = self._get_log_path(log_date)
        if not os.path.exists(path):
            metadata = {
                "date": log_date.isoformat(),
                "session_count": 0,
                "interaction_count": 0,
                "memory_candidates": 0,
                "generated_by": "JARVIS"
            }
            metadata = self.linker.enforce_session_frontmatter(log_date.isoformat(), metadata)
            frontmatter = self._serialize_frontmatter(metadata)
            initial_content = f"{frontmatter}\n# Daily Interaction Log\n"
            self._write_file_with_retry(path, initial_content)
        return path

    def _get_metadata_and_content(self, log_date: date) -> tuple[dict, str, str]:
        path = self._initialize_log_file(log_date)
        content = self._read_file_with_retry(path)
        metadata, remaining = self._parse_frontmatter(content)
        
        # Enforce compliant dev-session frontmatter structure on the metadata
        updated_metadata = self.linker.enforce_session_frontmatter(log_date.isoformat(), metadata)
        if updated_metadata != metadata:
            self._write_file_with_retry(path, f"{self._serialize_frontmatter(updated_metadata)}\n{remaining.lstrip()}")
            metadata = updated_metadata
            
        return metadata, remaining, content

    # --- Log Appenders (Thread-Safe with Auto Rollover) ---

    def _check_and_handle_rollover(self):
        """
        Verifies if date has rolled over. If so, runs the rotation logic.
        Must be called from locked contexts. Handles multi-day gaps sequentially.
        """
        today = date.today()
        while today > self._current_date:
            self._rotate_logs_internal(self._current_date)
            self._current_date += timedelta(days=1)

    def append_interaction(self, user_msg: str, assistant_msg: str, agent_actions: list[dict] = None, memory_updates: dict[str, list[str]] = None):
        """
        Appends a user interaction block to the current daily log file.
        Updates metadata counts.
        """
        with self._lock:
            self._check_and_handle_rollover()
            log_date = self._current_date
            
            # Load metadata to update counts
            metadata, remaining, _ = self._get_metadata_and_content(log_date)
            
            interaction_count = metadata.get("interaction_count", 0) + 1
            
            # Count candidates
            new_candidates = 0
            if memory_updates:
                for val in memory_updates.values():
                    if isinstance(val, list):
                        new_candidates += len(val)
                    elif val:
                        new_candidates += 1
            memory_candidates = metadata.get("memory_candidates", 0) + new_candidates
            
            # Update metadata dict
            metadata.update({
                "interaction_count": interaction_count,
                "memory_candidates": memory_candidates
            })
            
            # Format markdown entries
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            entry = []
            entry.append(f"\n## [{timestamp}]")
            entry.append("\n### User\n")
            entry.append(user_msg.strip())
            entry.append("\n### JARVIS\n")
            entry.append(assistant_msg.strip())
            
            entry.append("\n### Agent Actions\n")
            if agent_actions:
                for action in agent_actions:
                    entry.append(f"- Agent: {action.get('agent', 'Unknown')}")
                    entry.append(f"  Action: {action.get('action', 'Unknown')}")
                    entry.append(f"  Result: {action.get('result', 'Success')}")
                    
                    if "input" in action:
                        entry.append(f"  Input: {action['input']}")
                    if "output" in action:
                        entry.append(f"  Output: {action['output']}")
                    if "status" in action:
                        entry.append(f"  Status: {action['status']}")
                    if "duration" in action:
                        entry.append(f"  Duration: {action['duration']}")
                    if "errors" in action:
                        entry.append(f"  Errors: {action['errors']}")
                    entry.append("")
            else:
                entry.append("- None")
                
            entry.append("\n### Memory Updates\n")
            if memory_updates:
                pref = memory_updates.get("new_preference", [])
                fact = memory_updates.get("new_fact", [])
                task = memory_updates.get("new_task", [])
                inst = memory_updates.get("updated_instruction", [])
                
                def format_list(label, items):
                    if not items:
                        return f"- {label}:"
                    if isinstance(items, list):
                        lines = [f"- {label}:"]
                        for item in items:
                            lines.append(f"  - {item}")
                        return "\n".join(lines)
                    return f"- {label}: {items}"
                    
                entry.append(format_list("New Preference", pref))
                entry.append(format_list("New Fact", fact))
                entry.append(format_list("New Task", task))
                entry.append(format_list("Updated Instruction", inst))
            else:
                entry.append("- New Preference:")
                entry.append("- New Fact:")
                entry.append("- New Task:")
                entry.append("- Updated Instruction:")
                
            entry.append("\n### Tags\n")
            entry.append("#conversation #memory #agent-action\n")
            
            entry_text = "\n".join(entry)
            
            # Insert entry before daily summary block if it exists
            if "# Daily Summary" in remaining:
                parts = remaining.split("# Daily Summary", 1)
                updated_remaining = parts[0].rstrip() + "\n" + entry_text + "\n# Daily Summary" + parts[1]
            else:
                updated_remaining = remaining.rstrip() + "\n" + entry_text
                
            # Serialize frontmatter and combine
            frontmatter = self._serialize_frontmatter(metadata)
            new_content = f"{frontmatter}\n{updated_remaining.lstrip()}"
            
            path = self._get_log_path(log_date)
            self._write_file_with_retry(path, new_content)

    def log_system_event(self, event_name: str, details: str = None):
        """
        Logs a system-level event to the current daily log.
        Increments session_count if the event is 'Session Started'.
        """
        with self._lock:
            self._check_and_handle_rollover()
            log_date = self._current_date
            
            metadata, remaining, _ = self._get_metadata_and_content(log_date)
            
            session_count = metadata.get("session_count", 0)
            if event_name.strip().lower() == "session started":
                session_count += 1
            metadata["session_count"] = session_count
                
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            entry = []
            entry.append(f"\n## [{timestamp}] - System Event: {event_name}")
            if details:
                entry.append(details.strip())
            else:
                entry.append(f"- Event: {event_name}")
            entry.append("\n### Tags\n")
            entry.append("#system-event #log\n")
            
            entry_text = "\n".join(entry)
            
            # Insert entry before daily summary block if it exists
            if "# Daily Summary" in remaining:
                parts = remaining.split("# Daily Summary", 1)
                updated_remaining = parts[0].rstrip() + "\n" + entry_text + "\n# Daily Summary" + parts[1]
            else:
                updated_remaining = remaining.rstrip() + "\n" + entry_text
                
            frontmatter = self._serialize_frontmatter(metadata)
            new_content = f"{frontmatter}\n{updated_remaining.lstrip()}"
            
            path = self._get_log_path(log_date)
            self._write_file_with_retry(path, new_content)

    # --- End of Day Summary Summary ---

    def generate_daily_summary(self, log_date: date) -> str:
        """
        Parses the daily log file to extract statistics, topics, preferences, facts, and tasks,
        returning a formatted End-of-Day Summary Markdown Block.
        """
        path = self._get_log_path(log_date)
        if not os.path.exists(path):
            return ""
            
        content = self._read_file_with_retry(path)
        metadata, remaining = self._parse_frontmatter(content)
        
        sessions = metadata.get("session_count", 0)
        interactions = metadata.get("interaction_count", 0)
        
        agent_executions = 0
        errors = 0
        
        preferences = []
        facts = []
        tasks = []
        
        current_list = None
        user_messages = []
        in_user_block = False
        
        lines = remaining.splitlines()
        for line in lines:
            stripped = line.strip()
            
            # Track user message for Key Topics
            if line.startswith("### User"):
                in_user_block = True
                continue
            elif line.startswith("###") or line.startswith("## "):
                in_user_block = False
                
            if in_user_block and stripped:
                user_messages.append(stripped)
                in_user_block = False
                
            # Scan memory updates
            if stripped.startswith("- New Preference:"):
                current_list = "preferences"
                inline = stripped[len("- New Preference:"):].strip()
                if inline:
                    preferences.append(inline)
                continue
            elif stripped.startswith("- New Fact:"):
                current_list = "facts"
                inline = stripped[len("- New Fact:"):].strip()
                if inline:
                    facts.append(inline)
                continue
            elif stripped.startswith("- New Task:"):
                current_list = "tasks"
                inline = stripped[len("- New Task:"):].strip()
                if inline:
                    tasks.append(inline)
                continue
            elif stripped.startswith("- Updated Instruction:") or stripped.startswith("###") or stripped.startswith("## "):
                current_list = None
                
            if current_list and line.startswith("  - "):
                item = line.replace("  - ", "", 1).strip()
                if item:
                    if current_list == "preferences":
                        preferences.append(item)
                    elif current_list == "facts":
                        facts.append(item)
                    elif current_list == "tasks":
                        tasks.append(item)
                        
            # Count agent actions and failures
            if line.startswith("  Action: "):
                agent_executions += 1
            if line.startswith("  Errors: "):
                err_val = line.replace("  Errors: ", "", 1).strip().lower()
                if err_val not in ("none", "false", "", "null"):
                    errors += 1
                    
        # Extract topics
        topics = []
        for msg in user_messages:
            msg_clean = re.sub(r'[^\w\s\?]', '', msg).strip()
            if not msg_clean:
                continue
            if len(msg_clean) > 60:
                topic = msg_clean[:57] + "..."
            else:
                topic = msg_clean
            if topic not in topics:
                topics.append(topic)
        if not topics:
            topics = ["General interactions"]
            
        preferences = list(dict.fromkeys(preferences))
        facts = list(dict.fromkeys(facts))
        tasks = list(dict.fromkeys(tasks))
        
        # Build Daily Summary Block
        summary = []
        summary.append("# Daily Summary")
        summary.append("\n## Statistics\n")
        summary.append(f"- Sessions: {sessions}")
        summary.append(f"- Interactions: {interactions}")
        summary.append(f"- Agent Executions: {agent_executions}")
        summary.append(f"- Memory Candidates: {len(preferences) + len(facts) + len(tasks)}")
        summary.append(f"- Errors: {errors}")
        
        summary.append("\n## Key Topics\n")
        for topic in topics[:5]:
            summary.append(f"- {topic}")
            
        summary.append("\n## New Knowledge\n")
        if facts:
            for fact in facts:
                summary.append(f"- {fact}")
        else:
            summary.append("- None")
            
        summary.append("\n## User Preferences Learned\n")
        if preferences:
            for pref in preferences:
                summary.append(f"- {pref}")
        else:
            summary.append("- None")
            
        summary.append("\n## Outstanding Tasks\n")
        if tasks:
            for task in tasks:
                summary.append(f"- {task}")
        else:
            summary.append("- None")
            
        return "\n".join(summary)

    # --- Rotation Workflow (Midnight Rotation Logic) ---

    def rotate_logs(self):
        """
        Manually triggers rotation. Closes the current day log and starts the next.
        """
        with self._lock:
            self._rotate_logs_internal(self._current_date)
            self._current_date += timedelta(days=1)

    def _rotate_logs_internal(self, target_date: date):
        """
        Runs rotation tasks for the specified target date.
        Must be called from a locked context.
        """
        path = self._get_log_path(target_date)
        if os.path.exists(path):
            full_content = self._read_file_with_retry(path)
            
            # Append Daily Summary if not already present
            if "# Daily Summary" not in full_content:
                summary_block = self.generate_daily_summary(target_date)
                updated_content = full_content.rstrip() + "\n\n" + summary_block + "\n"
                self._write_file_with_retry(path, updated_content)
                
        # Initialize next day
        next_date = target_date + timedelta(days=1)
        self._initialize_log_file(next_date)
        
        # Log rollover system event in the new file
        # This will increment the session_count for the new day
        self._log_rollover_event(next_date)

    def _log_rollover_event(self, next_date: date):
        """
        Appends standard Session Started event to the rolled over day file.
        Handles offline/skipped catch-up days by adjusting the timestamp.
        """
        path = self._get_log_path(next_date)
        content = self._read_file_with_retry(path)
        metadata, remaining = self._parse_frontmatter(content)
        
        session_count = metadata.get("session_count", 0) + 1
        
        today = date.today()
        if next_date >= today:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        else:
            # Catching up on missed days: use the date of the log at midnight
            timestamp = f"{next_date.isoformat()} 00:00:00"
        
        entry = (
            f"\n## [{timestamp}] - System Event: Session Started\n"
            f"- Automated rotation triggered. Daily log opened.\n"
            f"\n### Tags\n"
            f"#system-event #log\n"
        )
        
        metadata.update({"session_count": session_count})
        frontmatter = self._serialize_frontmatter(metadata)
        
        # Combine new frontmatter, original remaining text, and the new entry
        updated_content = f"{frontmatter}\n{remaining.rstrip()}\n{entry}"
        self._write_file_with_retry(path, updated_content)

    # --- Midnight Rotation Daemon Scheduler ---

    def _start_midnight_scheduler(self):
        """
        Schedules a thread-safe task to trigger log rotation at midnight.
        """
        now = datetime.now()
        tomorrow = datetime.combine(now.date() + timedelta(days=1), datetime.min.time())
        seconds_until_midnight = (tomorrow - now).total_seconds()
        
        # Use a daemon timer thread
        self._rotation_timer = threading.Timer(seconds_until_midnight, self._scheduled_midnight_rotation)
        self._rotation_timer.daemon = True
        self._rotation_timer.start()

    def _scheduled_midnight_rotation(self):
        """
        Midnight timer callback to execute log rotation.
        """
        self.rotate_logs()
        # Reschedule for the next midnight
        self._start_midnight_scheduler()

    def stop(self):
        """
        Stops the background scheduling timer cleanly.
        """
        if self._rotation_timer:
            self._rotation_timer.cancel()
