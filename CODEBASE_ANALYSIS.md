# J.A.R.V.I.S. Codebase Analysis Report

**Date:** August 20, 2026
**Scope:** Full codebase audit — TypeScript (React/Node), Python (FastAPI), Rust (Axum), C++ (Workers)
**Files Analyzed:** 213+ source files across `src/`, `core_engine/`, `memory_engine/`, `workers_cpp/`, `gateway_rust/`, `scripts/`

---

## 🔴 CRITICAL ISSUES (Security / Data Loss Risk)

### 1. XSS Injection in OAuth Callback HTML Responses
**Files:**
- `core_engine/server.py` (lines ~550-590, ~690-730, ~800-840)

**Problem:** User-controlled `error`, `err_msg`, and `err` variables are interpolated directly into f-string HTML responses without HTML-escaping. An attacker crafting a malicious OAuth error message could inject arbitrary JavaScript into the callback popup page, potentially stealing session tokens or performing actions on behalf of the user.

**Vulnerable Code Pattern:**
```python
# server.py line ~550 (Google callback)
return HTMLResponse(content=f"""...<p>{error}</p>...<script>window.opener.postMessage({{type:'GOOGLE_AUTH_FAILED',error:'{error}'}}...</script>...""")

# server.py line ~590 (Google callback error)
return HTMLResponse(content=f"""...<p style="color:#9ca3af;font-size:13px;">{err_msg}</p>...""")

# Same pattern for GitHub callback (~line 690-730) and LinkedIn callback (~line 800-840)
```

**Same pattern exists for:**
- `err_msg` in GitHub auth code exchange error (line ~730)
- `err` in GitHub callback error (line ~690)
- `err_msg` in LinkedIn auth code exchange error (line ~840)
- `err` in LinkedIn callback error (line ~800)

**Fix:**
```python
from html import escape

# In every callback endpoint, escape all user-controlled values:
safe_error = escape(str(error))
safe_err_msg = escape(str(err_msg))

return HTMLResponse(content=f"""...<p>{safe_error}</p>...""")
```

---

### 2. Hardcoded Google OAuth Client ID (6 Locations)
**Files:**
- `src/services/google_auth_service.ts` (lines 203, 253)
- `core_engine/google_auth.py` (line 21)
- `src/components/WorkspaceHub.tsx` (line 25)
- `src/components/jarvis/views/ConnectorsView.tsx` (lines 31, 951)

**Problem:** The Google OAuth client ID `791977848384-q4ljrlj38kepp2crruo4i6vq3j1813ot.apps.googleusercontent.com` is hardcoded as a fallback in 6 places across the codebase. While the client ID is technically public, hardcoding it:
1. Defeats environment-based configuration
2. Could leak into unintended deployments
3. Makes it impossible to rotate without code changes

**Locations:**
```typescript
// src/services/google_auth_service.ts:203
const clientId = process.env.VITE_GOOGLE_CLIENT_ID || '791977848384-...apps.googleusercontent.com';

// src/services/google_auth_service.ts:253
const clientId = process.env.VITE_GOOGLE_CLIENT_ID || '791977848384-...apps.googleusercontent.com';

// src/components/WorkspaceHub.tsx:25
const [clientId] = useState<string>('791977848384-...apps.googleusercontent.com');

// src/components/jarvis/views/ConnectorsView.tsx:31
const GOOGLE_CLIENT_ID = "791977848384-...apps.googleusercontent.com";

// core_engine/google_auth.py:21
DEFAULT_CLIENT_ID = "791977848384-...apps.googleusercontent.com"
```

**Fix:** Remove all hardcoded fallbacks. Use only `process.env.VITE_GOOGLE_CLIENT_ID` and fail loudly with a clear error message if missing. Add validation at startup.

---

### 3. Command Injection via f-string in `actuator_dispatcher.py`
**File:** `core_engine/actuator_dispatcher.py` (lines ~306-381)

**Problem:** Multiple shell commands are constructed using f-strings with unsanitized user input. While `security_guard.validate_command()` catches some destructive patterns, it doesn't prevent injection in all cases:

```python
# Line 341 - sortBy comes directly from user HTTP request
sort_flag = "-%cpu" if sortBy == "cpu" else ...
return await self.execute_linux_command(f"ps aux --sort={sort_flag} | head -n {limit + 1}")

# Line 348 - pid comes from user (partially mitigated by int() cast)
return await self.execute_linux_command(f"kill -{signal} {int(pid)}")

# Line 350 - proc_name comes from user
return await self.execute_linux_command(f"pkill -{signal} '{proc_name}'")

# Line 374 - title/message from user — single quote injection possible
return await self.execute_linux_command(f"notify-send -u {urgency} '{title}' '{message}'")

# Line 381 - profile from user
return await self.execute_linux_command(f"powerprofilesctl set {prof}")
```

The `notify-send` call is particularly dangerous: a `title` containing `'` can break out of the single quotes and execute arbitrary commands.

**Fix:**
```python
import shlex

# Always use shlex.quote() for user inputs in shell commands:
safe_title = shlex.quote(title)
safe_message = shlex.quote(message)
return await self.execute_linux_command(f"notify-send -u {urgency} {safe_title} {safe_message}")

# Better yet, use subprocess with argument lists:
# await asyncio.create_subprocess_exec("notify-send", "-u", urgency, title, message)
```

**server.py endpoints that pass raw user input:**
- `/api/system/processes` (sortBy parameter)
- `/api/system/processes/kill` (pid, signal)
- `/api/system/exec` (command — already has security_guard)
- `/api/system/services/action` (unit, action)
- `/api/system/clipboard` (text)

---

### 4. `allow_origins=["*"]` with `allow_credentials=True`
**File:** `core_engine/server.py` (lines 36-40)

**Problem:** CORS middleware is configured to allow ALL origins while also allowing credentials (cookies, auth headers). This is a critical security anti-pattern:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # ANY website can make requests
    allow_credentials=True,    # ...with cookies/auth headers attached
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Combined with `host="0.0.0.0"` in `main.py` (line 85), any device on the network AND any website the user visits can make authenticated API calls to JARVIS.

**Fix:**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # Explicit origins
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
```

Or in `main.py`, bind to `127.0.0.1` instead of `0.0.0.0` unless explicitly configured.

---

## 🟠 HIGH SEVERITY (Bugs / Reliability)

### 5. `forge_sandbox.py` — Static Module-Level `Path(os.getcwd())` Evaluation
**File:** `core_engine/forge_sandbox.py` (lines 15-16)

**Problem:** `CUSTOM_TOOLS_DIR` and `FORGE_VENV_DIR` are computed at import time using `os.getcwd()`. If the working directory changes after import (which happens in some deployment scenarios), these paths point to the wrong location:

```python
# Evaluated ONCE at import time
CUSTOM_TOOLS_DIR = Path(os.getcwd()) / "custom_tools"
FORGE_VENV_DIR = CUSTOM_TOOLS_DIR / ".forge_venv"
```

**Fix:**
```python
PROJECT_ROOT = Path(__file__).parent.parent
CUSTOM_TOOLS_DIR = PROJECT_ROOT / "custom_tools"
FORGE_VENV_DIR = CUSTOM_TOOLS_DIR / ".forge_venv"
```

---

### 6. `forge_sandbox.py` — f-string Code Injection in `verify_tool` / `execute_tool`
**File:** `core_engine/forge_sandbox.py` (lines ~230-330)

**Problem:** `tool_name` and `tool_code` are interpolated directly into f-string Python code that gets executed in a subprocess. If `tool_name` contains `"` or backslashes, the generated script breaks or executes unintended code:

```python
# verify_tool — line ~230
test_wrapper = f"""
...
with open("{tool_name}.py", "w", encoding="utf-8") as f:
    f.write({json.dumps(tool_code)})
...
{test_code}
"""

# execute_tool — line ~290
runner_script = f"""
...
tool_file = Path("{tool_file}")
spec = importlib.util.spec_from_file_location("{tool_name}", tool_file)
...
"""
```

The sandbox mitigates blast radius, but the code injection itself is a design flaw.

**Fix:** Pass dynamic values via `sys.argv` or environment variables:
```python
# Instead of string interpolation, pass via args:
runner_script = '''
import sys, json, importlib.util
from pathlib import Path
tool_file = Path(sys.argv[1])
tool_name = sys.argv[2]
...
'''
res = await self.run_in_sandbox(runner_script, args=[str(tool_file), tool_name, json.dumps(arguments)])
```

---

### 7. Duplicate `load_dotenv()` in `core_engine/main.py`
**File:** `core_engine/main.py` (lines 13-14, 30-31)

**Problem:** `.env` is loaded twice at module level AND again in `load_environment()`:

```python
# Module level (lines 13-14) — runs on import
load_dotenv(os.path.join(os.getcwd(), ".env"))
load_dotenv()

# In load_environment() (lines 30-31) — runs again in main()
def load_environment():
    load_dotenv(os.path.join(os.getcwd(), ".env"))
    load_dotenv()
```

**Fix:** Remove the module-level calls. Keep only `load_environment()` and call it once in `main()`.

---

### 8. `accumulatedUserSpeech` / `accumulatedModelSpeech` Not Reset on Disconnect
**File:** `src/server/ws_handler.ts` (lines ~320-330)

**Problem:** These accumulators grow during a session but are only cleared on `turnComplete` events. If the connection drops mid-turn, the accumulators are lost (scope is per-connection, so no cross-session leak). However, if multiple rapid reconnections reuse any shared state, stale data could appear.

```typescript
let accumulatedUserSpeech = '';
let accumulatedModelSpeech = '';
// Only cleared in the turnComplete handler, not in clientWs.on('close')
```

**Fix:** Clear both in the `close` handler:
```typescript
clientWs.on('close', () => {
  accumulatedUserSpeech = '';
  accumulatedModelSpeech = '';
  // ... rest of cleanup
});
```

---

### 9. Python `DualStoreMemory` — SQLite Connection Leak in `save_memory_fact`
**File:** `core_engine/memory.py` (lines ~133-140)

**Problem:** The SQLite connection is opened manually and closed outside a context manager. If an exception occurs between `connect()` and `close()`, the connection leaks:

```python
def save_memory_fact(self, key, value, category="custom", source="user_added"):
    conn = sqlite3.connect(DB_PATH)      # Opened
    with conn:
        conn.execute(...)                 # Could throw
    conn.close()                          # Never reached on exception
```

**Fix:**
```python
def save_memory_fact(self, key, value, category="custom", source="user_added"):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(...)
```

---

### 10. TypeScript Silent Error Swallowing (116+ Locations)
**Files:**
- `src/components/jarvis/JarvisProvider.tsx` (20+ catches)
- `src/components/SystemControlModal.tsx` (17 catches)
- `src/utils/system_controller.ts` (18 catches)
- `src/services/linkedin_service.ts` (11 catches)
- `src/research/fanout.ts` (6 catches)
- `src/components/ClassicApp.tsx` (6 catches)
- `src/utils/webrtc_manager.ts` (7 catches)
- `src/memory/git_syncer.ts` (2 catches)
- `src/memory/client.ts` (2 catches)
- `src/server/ws_handler.ts` (3 catches)
- `src/utils/obsidian_sync.ts` (2 catches)

**Problem:** Over 116 `catch {}` or `.catch(() => {})` blocks silently swallow ALL errors with zero logging. Critical failures (authentication errors, API failures, file system errors, WebSocket errors) disappear completely, making debugging nearly impossible:

```typescript
// SystemControlModal.tsx — 17 occurrences of:
} catch (e) {}

// JarvisProvider.tsx — 20+ occurrences of:
} catch {}
.catch(() => {})

// system_controller.ts — 18 occurrences of:
} catch (e) {}
```

**Fix:** At minimum, add logging:
```typescript
} catch (e) {
  console.error('Failed to fetch battery status:', e);
}
// Or use the project logger:
} catch (e) {
  logServer.warn(`Battery status fetch failed: ${e}`);
}
```

Reserve truly empty catches for intentional no-ops only (e.g., cleanup of already-failed resources).

---

## 🟡 MEDIUM SEVERITY (Code Quality / Maintainability)

### 11. `print()` Used Instead of Structured Logger in Python Core
**Files:**
- `core_engine/main.py` (15 print calls)
- `core_engine/gemini_live.py` (15 print calls)
- `core_engine/audio_bridge.py` (8 print calls)
- `core_engine/server.py` (2 print calls)
- `core_engine/hud.py` (2 print calls)
- `core_engine/memory.py` (2 print calls)
- `core_engine/google_auth.py` (6 print calls)
- `core_engine/github_service.py` (3 print calls)
- `core_engine/linkedin_service.py` (3 print calls)

**Problem:** 60+ `print()` calls across Python files instead of using structured logging. This means:
- No log levels (debug, info, warn, error)
- No timestamps
- No JSON formatting
- No way to control output in production
- Mixed with the `telemetry_service.py` which already provides structured logging

**Fix:** Replace with Python's `logging` module or a shared logger instance:
```python
import logging
logger = logging.getLogger("jarvis.core")

# Replace: print("[GeminiLive] Connection error: {e}")
# With: logger.error("Connection error: %s", e)
```

---

### 12. Hardcoded User Path in OAuth Flow Scripts
**Files:**
- `scripts/github_oauth_flow.py` (line 57)
- `scripts/google_oauth_flow.py` (line 70)

**Problem:** Hardcoded absolute path to a specific user's directory:
```python
Path("/home/gopi/Downloads/JARVIS-V0/.env"),
```

**Fix:** Use only relative or home-directory-based paths:
```python
from pathlib import Path
env_paths = [
    Path.cwd() / ".env",
    Path.home() / ".env",
]
```

---

### 13. Hardcoded User Identity in Memory/Config
**Files:**
- `core_engine/memory.py` (lines ~67-73)
- `JARVIS-MEMORY/` directory templates

**Problem:** Initial memory files are hardcoded with "Gopi (BTech Engineer)" as the operator:
```python
initial_mem = """# J.A.R.V.I.S. Persistent Knowledge Base
- Operator: Gopi (BTech Engineer)
...
"""
```

**Fix:** Make the operator name configurable via `.env` or interactive setup:
```python
operator_name = os.environ.get("JARVIS_OPERATOR_NAME", "Operator")
```

---

### 14. Server Binds to `0.0.0.0` with Wide-Open CORS
**Files:**
- `core_engine/main.py` (line 85)
- `core_engine/server.py` (lines 36-40)

**Problem:** The FastAPI server binds to all network interfaces (`0.0.0.0`) with wildcard CORS. This means:
1. Any device on the local network can access the API
2. Any website the user visits can make cross-origin requests with credentials

**Fix:**
```python
# main.py — bind to localhost by default
config = uvicorn.Config(app, host="127.0.0.1", port=args.port, ...)

# Or make configurable:
host = os.environ.get("JARVIS_BIND_HOST", "127.0.0.1")
```

---

### 15. `_detect_tirith` Uses Hardcoded Paths
**File:** `core_engine/security.py` (lines ~63-68)

**Problem:** Tirith binary detection uses hardcoded absolute paths for a specific user:
```python
candidates = [
    "/home/gopi/.hermes/bin/tirith",
    "/home/gopi/.local/bin/tirith",
    "/usr/local/bin/tirith",
    "/usr/bin/tirith",
]
```

**Fix:**
```python
import shutil
tirith_path = shutil.which("tirith")

# Or use expanduser:
candidates = [
    os.path.expanduser("~/.hermes/bin/tirith"),
    os.path.expanduser("~/.local/bin/tirith"),
    "/usr/local/bin/tirith",
    "/usr/bin/tirith",
]
```

---

## 🔵 LOW SEVERITY (Improvements)

### 16. Tirith Binary Detection — Silent Failure on Removal
**File:** `core_engine/security.py`

**Problem:** `_detect_tirith()` runs at `__init__` time. If `tirith` is present then later removed, `validate_command()` will try to run a non-existent binary and fail silently (caught by generic `except Exception: pass`).

**Fix:** Add runtime check or re-detect periodically.

---

### 17. `task_queue.ts` — Potential Task ID Collisions
**File:** `src/core/task_queue.ts` (line 79)

**Problem:** Task IDs are generated with `Date.now()` + 4-character random suffix:
```typescript
const id = task.id || `tsk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
```
4 random base-36 characters = ~1.6M possibilities. Two tasks enqueued in the same millisecond could collide.

**Fix:** Use `crypto.randomUUID()`:
```typescript
import { randomUUID } from 'crypto';
const id = task.id || `tsk-${randomUUID()}`;
```

---

### 18. `ws_handler.ts` — Unbounded `pendingLiveMessages` Queue
**File:** `src/server/ws_handler.ts` (lines ~507-512)

**Problem:** Audio messages are capped at 12 items, but text and image messages have no cap:
```typescript
if (pendingLiveMessages.filter(m => m.type === 'audio').length > 12) {
  // Only audio is capped
}
pendingLiveMessages.push({ type: 'text', payload: msg.text });  // No cap
```

A malicious client could flood the queue with text/image messages, consuming unbounded memory.

**Fix:**
```typescript
const MAX_PENDING_MESSAGES = 50;
if (pendingLiveMessages.length >= MAX_PENDING_MESSAGES) {
  // Drop oldest non-audio messages
  const idx = pendingLiveMessages.findIndex(m => m.type !== 'audio');
  if (idx >= 0) pendingLiveMessages.splice(idx, 1);
}
```

---

### 19. `server.py` — Chat Endpoint Is a Stub
**File:** `core_engine/server.py` (line ~385)

**Problem:** The `/api/chat` endpoint returns a hardcoded response without invoking any AI:
```python
@app.post("/api/chat")
async def chat_endpoint(req):
    msg = req.get("message", "")
    return {"success": True, "reply": f"Acknowledged, Gopi: '{msg}'. All subsystems standing by."}
```

This is misleading — callers expect an AI-powered response.

**Fix:** Either route through Gemini Live, remove the endpoint, or mark it clearly as a stub with a TODO.

---

### 20. `gemini_live.py` — Model Version Hardcoded to Preview
**File:** `core_engine/gemini_live.py` (line 11)

**Problem:** The default model is pinned to a preview version:
```python
DEFAULT_MODEL = "models/gemini-3.1-flash-live-preview"
```
Preview models can be deprecated without notice, breaking the voice pipeline silently.

**Fix:** Make the model configurable via `.env` with a stable default:
```python
DEFAULT_MODEL = os.environ.get("GEMINI_MODEL", "models/gemini-2.5-flash-native-audio-latest")
```

---

### 21. `server.ts` — Duplicate `vite` in Dependencies
**File:** `package.json`

**Problem:** `vite` appears in both `dependencies` and `devDependencies` (both `"^6.2.3"`):
```json
{
  "dependencies": {
    "vite": "^6.2.3",
    ...
  },
  "devDependencies": {
    "vite": "^6.2.3",
    ...
  }
}
```
This is a packaging error — Vite is a build tool and should only be in `devDependencies`.

**Fix:** Remove `"vite"` from `dependencies`.

---

## Summary by Severity

| Severity | Count | Key Areas |
|----------|-------|-----------|
| 🔴 Critical | 4 | XSS in OAuth callbacks, hardcoded client ID, command injection, CORS+credentials |
| 🟠 High | 6 | Sandbox code injection, env path evaluation, silent error swallowing (116+), SQLite leak |
| 🟡 Medium | 5 | 60+ print() calls, hardcoded paths/identities, server binding, user identity in memory |
| 🔵 Low | 5 | Queue caps, stub endpoints, model pinning, duplicate vite dep |

---

## Recommended Fix Priority

### Phase 1 — Security Hardening (Immediate)
1. HTML-escape all OAuth callback parameters (Issue #1)
2. Remove hardcoded Google Client ID fallbacks (Issue #2)
3. Sanitize all f-string shell command interpolation with `shlex.quote()` (Issue #3)
4. Fix CORS configuration (Issue #4)
5. Bind to `127.0.0.1` by default (Issue #14)

### Phase 2 — Reliability (This Week)
6. Fix `forge_sandbox.py` static path evaluation (Issue #5)
7. Fix sandbox code injection via argv instead of f-strings (Issue #6)
8. Add logging to empty catch blocks (Issue #10 — 116+ locations)
9. Fix SQLite connection leak in `memory.py` (Issue #9)
10. Clean up duplicate `load_dotenv()` (Issue #7)

### Phase 3 — Code Quality (Next Sprint)
11. Replace `print()` with structured logging (Issue #11)
12. Remove hardcoded user paths (Issues #12, #13, #15)
13. Add queue caps for pending messages (Issue #18)
14. Make chat endpoint functional or remove (Issue #19)
15. Fix duplicate `vite` in package.json (Issue #21)

---

*Report generated by automated codebase analysis on August 20, 2026*
