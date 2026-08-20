"""
Dual-Store Memory Engine for J.A.R.V.I.S. Python Core Engine.
Combines SQLite WAL structured facts with Obsidian Vault Markdown files.
"""

import os
import sqlite3
import time
from typing import List, Dict, Any, Optional
from .security import security_guard

MEMORY_DIR = os.path.join(os.getcwd(), "JARVIS-MEMORY")
MEMORY_MD_PATH = os.path.join(MEMORY_DIR, "MEMORY.md")
USER_MD_PATH = os.path.join(MEMORY_DIR, "USER.md")
DB_DIR = os.path.join(os.getcwd(), "data")
DB_PATH = os.path.join(DB_DIR, "jarvis.db")

MEMORY_CHAR_LIMIT = 2200
USER_CHAR_LIMIT = 1375


class DualStoreMemory:
    _instance = None

    @classmethod
    def get_instance(cls) -> "DualStoreMemory":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        self._init_dirs()
        self._init_sqlite()
        self._cached_snapshot: Optional[Dict[str, Any]] = None

    def _init_dirs(self):
        os.makedirs(MEMORY_DIR, exist_ok=True)
        os.makedirs(DB_DIR, exist_ok=True)

        if not os.path.exists(MEMORY_MD_PATH):
            initial_mem = """# J.A.R.V.I.S. Persistent Knowledge Base
- Operator: Gopi (BTech Engineer)
- AI Identity: JARVIS / FRIDAY autonomous agent fleet
- Local-First Architecture: Ubuntu Linux with native C++ workers and Rust audio gateway
- Mission: 24/7 continuous autonomous agent operations, research, coding, and workflow automation
"""
            with open(MEMORY_MD_PATH, "w", encoding="utf-8") as f:
                f.write(initial_mem)

        if not os.path.exists(USER_MD_PATH):
            initial_user = """# User Profile: Gopi
- Name: Gopi
- Style: Direct, technical depth welcome, concise and proactive
- Persona preference: Telgish / Jarvis witty conversationalist, speaks WITH user
- Primary focus: Autonomous Linux systems, real-time live audio, multi-model AI
"""
            with open(USER_MD_PATH, "w", encoding="utf-8") as f:
                f.write(initial_user)

    def _init_sqlite(self):
        conn = sqlite3.connect(DB_PATH)
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        with conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS memories (
                    id TEXT PRIMARY KEY,
                    category TEXT NOT NULL,
                    key TEXT NOT NULL,
                    value TEXT NOT NULL,
                    source TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS conversation_messages (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at INTEGER NOT NULL
                );
            """)
        conn.close()

    def get_memory_notes(self) -> str:
        if not os.path.exists(MEMORY_MD_PATH):
            return ""
        try:
            with open(MEMORY_MD_PATH, "r", encoding="utf-8") as f:
                content = f.read()
            safe, _ = security_guard.scan_prompt_injection(content)
            if not safe:
                content = content.replace("<", "").replace(">", "")
            return content[:MEMORY_CHAR_LIMIT]
        except Exception:
            return ""

    def get_user_profile(self) -> str:
        if not os.path.exists(USER_MD_PATH):
            return ""
        try:
            with open(USER_MD_PATH, "r", encoding="utf-8") as f:
                content = f.read()
            safe, _ = security_guard.scan_prompt_injection(content)
            if not safe:
                content = content.replace("<", "").replace(">", "")
            return content[:USER_CHAR_LIMIT]
        except Exception:
            return ""

    def get_sqlite_facts(self, limit: int = 15) -> List[Dict[str, Any]]:
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT id, category, key, value, source, updated_at FROM memories ORDER BY updated_at DESC LIMIT ?", (limit,))
            rows = [dict(r) for r in cursor.fetchall()]
            conn.close()
            return rows
        except Exception:
            return []

    def save_memory_fact(self, key: str, value: str, category: str = "custom", source: str = "user_added"):
        fact_id = f"mem_{int(time.time() * 1000)}"
        updated_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        # 1. Save to SQLite
        try:
            conn = sqlite3.connect(DB_PATH)
            with conn:
                conn.execute(
                    "INSERT OR REPLACE INTO memories (id, category, key, value, source, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                    (fact_id, category, key, value, source, updated_at)
                )
            conn.close()
        except Exception as e:
            print(f"[Memory] SQLite error: {e}")

        # 2. Append to MEMORY.md
        try:
            with open(MEMORY_MD_PATH, "a", encoding="utf-8") as f:
                f.write(f"\n- § [{category.upper()}] {key}: {value}")
        except Exception as e:
            print(f"[Memory] File write error: {e}")

        self._cached_snapshot = None

    def search(self, query: str, limit: int = 8) -> List[Dict[str, Any]]:
        tokens = [t.lower() for t in query.split() if len(t) > 2]
        facts = self.get_sqlite_facts(limit=100)
        
        matches = []
        for f in facts:
            text = f"{f.get('key', '')} {f.get('value', '')}".lower()
            score = sum(1 for tok in tokens if tok in text) if tokens else 1
            if score > 0:
                matches.append((score, f))

        matches.sort(key=lambda x: -x[0])
        return [m[1] for m in matches[:limit]]

    def get_frozen_snapshot(self, force_refresh: bool = False) -> Dict[str, Any]:
        if self._cached_snapshot is not None and not force_refresh:
            return self._cached_snapshot

        user_content = self.get_user_profile()
        memory_content = self.get_memory_notes()
        db_facts = self.get_sqlite_facts(limit=15)

        db_facts_str = "\n".join([f"- [{f['category'].upper()}] {f['key']}: {f['value']}" for f in db_facts])
        db_facts_section = f"=== STRUCTURED FACTS (SQLite) ===\n{db_facts_str}" if db_facts_str else ""

        formatted_prompt = f"""
[PERSISTENT LONG-TERM MEMORY & USER PROFILE]
=== OPERATOR PROFILE (USER.md) ===
{user_content}

=== PERSISTENT KNOWLEDGE (MEMORY.md) ===
{memory_content}
{db_facts_section}
""".strip()

        self._cached_snapshot = {
            "user_content": user_content,
            "memory_content": memory_content,
            "formatted_prompt": formatted_prompt,
            "timestamp": time.time()
        }
        return self._cached_snapshot


memory_engine = DualStoreMemory.get_instance()
