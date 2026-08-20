#!/usr/bin/env python3
"""
=============================================================================
J.A.R.V.I.S. Google Workspace OAuth 2.0 Autonomous Authentication Engine
=============================================================================
Local-first, zero-dependency Python script using strictly standard libraries to:
1. Securely generate the Google OAuth 2.0 authorization URL with CSRF protection.
2. Spin up an ephemeral local HTTP server to receive the authorization code redirect.
3. Exchange authorization code for OAuth 2.0 Access & Refresh tokens.
4. Verify the token against Google UserInfo API (https://www.googleapis.com/oauth2/v3/userinfo).
5. Persist credentials locally into data/jarvis.db (SQLite) & data/google_auth.json.
=============================================================================
"""

import argparse
import http.server
import json
import os
import secrets
import socket
import sqlite3
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

# Configuration Defaults
DEFAULT_REDIRECT_HOST = "localhost"
DEFAULT_REDIRECT_PORT = 8080
DEFAULT_REDIRECT_PATH = "/callback"

DEFAULT_SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/tasks",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "openid",
]

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

# Terminal Colors
CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BOLD = "\033[1m"
RESET = "\033[0m"


def load_env_file() -> Dict[str, str]:
    """Parse local .env file if present without external dependencies."""
    env_vars: Dict[str, str] = {}
    env_paths = [
        Path.cwd() / ".env",
        Path("/home/gopi/Downloads/JARVIS-V0/.env"),
    ]
    for env_path in env_paths:
        if env_path.exists():
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#"):
                            continue
                        if "=" in line:
                            k, v = line.split("=", 1)
                            k = k.strip()
                            v = v.strip().strip("'\"")
                            if " #" in v:
                                v = v.split(" #", 1)[0].strip().strip("'\"")
                            if k and v:
                                env_vars[k] = v
                                if k not in os.environ:
                                    os.environ[k] = v
            except Exception:
                pass
            break
    return env_vars


class OAuthCallbackHandler(http.server.BaseHTTPRequestHandler):
    """Ephemeral HTTP handler to catch the OAuth 2.0 redirect callback from Google."""

    server: "OAuthHTTPServer"

    def log_message(self, format: str, *args: Any) -> None:
        # Suppress default HTTP request logging to keep terminal output clean
        pass

    def do_GET(self) -> None:
        parsed_url = urllib.parse.urlparse(self.path)

        if parsed_url.path != self.server.expected_path:
            self.send_response(404)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"Not Found")
            return

        query_params = urllib.parse.parse_qs(parsed_url.query)

        # Check for authorization error
        if "error" in query_params:
            error_code = query_params.get("error", ["Unknown"])[0]
            error_desc = query_params.get("error_description", ["No description provided."])[0]
            self.server.callback_error = f"{error_code}: {error_desc}"

            self.send_response(400)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(self.render_html_response(
                title="Google Authorization Failed",
                message=f"Error: {error_code}<br><br>{error_desc}",
                is_success=False
            ).encode("utf-8"))
            threading.Thread(target=self.server.shutdown, daemon=True).start()
            return

        # Validate CSRF state parameter
        received_state = query_params.get("state", [""])[0]
        if not received_state or received_state != self.server.expected_state:
            self.server.callback_error = "CSRF State Mismatch - Security Validation Failed"
            self.send_response(403)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(self.render_html_response(
                title="Security Alert: State Mismatch",
                message="The state token received did not match the generated CSRF token. Authorization aborted.",
                is_success=False
            ).encode("utf-8"))
            threading.Thread(target=self.server.shutdown, daemon=True).start()
            return

        # Extract authorization code
        code = query_params.get("code", [""])[0]
        if not code:
            self.server.callback_error = "Missing Authorization Code"
            self.send_response(400)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(self.render_html_response(
                title="Authorization Code Missing",
                message="Google did not return an authorization code in the callback.",
                is_success=False
            ).encode("utf-8"))
            threading.Thread(target=self.server.shutdown, daemon=True).start()
            return

        self.server.auth_code = code

        # Return success HTML page to browser
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(self.render_html_response(
            title="Google Workspace Connected Successfully",
            message="Authorization code received by J.A.R.V.I.S. You may now close this browser tab and return to the terminal.",
            is_success=True
        ).encode("utf-8"))

        # Trigger server shutdown on a background thread
        threading.Thread(target=self.server.shutdown, daemon=True).start()

    def render_html_response(self, title: str, message: str, is_success: bool) -> str:
        color = "#10B981" if is_success else "#EF4444"
        badge_text = "GOOGLE WORKSPACE AUTHENTICATION SUCCESSFUL" if is_success else "GOOGLE AUTHENTICATION FAILED"
        icon = "✓" if is_success else "✗"

        return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} | J.A.R.V.I.S.</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }}
        body {{ background: #090a0f; color: #f3f4f6; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }}
        .card {{ background: rgba(18, 20, 29, 0.85); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; max-width: 480px; width: 100%; padding: 36px; text-align: center; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5); }}
        .icon-circle {{ width: 64px; height: 64px; border-radius: 50%; background: {color}22; border: 2px solid {color}; color: {color}; display: flex; align-items: center; justify-content: center; font-size: 28px; margin: 0 auto 20px auto; font-weight: bold; }}
        .badge {{ display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; padding: 4px 12px; border-radius: 9999px; background: rgba(255, 255, 255, 0.05); color: {color}; border: 1px solid {color}44; margin-bottom: 16px; font-family: monospace; }}
        h1 {{ font-size: 20px; font-weight: 700; margin-bottom: 12px; color: #fff; }}
        p {{ font-size: 14px; color: #9ca3af; line-height: 1.6; margin-bottom: 24px; }}
        .hud-footer {{ font-size: 11px; color: #4b5563; font-family: monospace; border-top: 1px solid rgba(255, 255, 255, 0.06); padding-top: 16px; }}
    </style>
</head>
<body>
    <div class="card">
        <div class="icon-circle">{icon}</div>
        <div class="badge">{badge_text}</div>
        <h1>{title}</h1>
        <p>{message}</p>
        <div class="hud-footer">J.A.R.V.I.S. LOCAL-FIRST MCP AUTONOMOUS GATEWAY</div>
    </div>
</body>
</html>"""


class OAuthHTTPServer(http.server.HTTPServer):
    """Custom HTTP server holding expected state and captured code."""

    def __init__(self, server_address: Tuple[str, int], RequestHandlerClass: Any, expected_state: str, expected_path: str):
        super().__init__(server_address, RequestHandlerClass)
        self.expected_state = expected_state
        self.expected_path = expected_path
        self.auth_code: Optional[str] = None
        self.callback_error: Optional[str] = None


def is_port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    """Check if a local TCP port is already in use."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex((host, port)) == 0


def generate_authorization_url(
    client_id: str,
    redirect_uri: str,
    state: str,
    scopes: list[str]
) -> str:
    """Generate the secure Google OAuth 2.0 authorization URL."""
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "state": state,
        "scope": " ".join(scopes),
        "response_type": "code",
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
    }
    return f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"


def exchange_code_for_token(
    client_id: str,
    client_secret: str,
    redirect_uri: str,
    auth_code: str
) -> Dict[str, Any]:
    """Exchange authorization code for access and refresh tokens via Google API."""
    data = urllib.parse.urlencode({
        "client_id": client_id,
        "client_secret": client_secret,
        "code": auth_code,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }).encode("utf-8")

    req = urllib.request.Request(
        GOOGLE_TOKEN_URL,
        data=data,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "User-Agent": "JARVIS-Google-Auth/1.0",
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            res_body = response.read().decode("utf-8")
            return json.loads(res_body)
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        raise RuntimeError(f"Google Token Exchange Failed (HTTP {e.code}): {err_msg}")
    except Exception as e:
        raise RuntimeError(f"Network error during token exchange: {str(e)}")


def refresh_access_token_cli(
    client_id: str,
    client_secret: str,
    refresh_token: str
) -> Dict[str, Any]:
    """Refresh an expired access token using the stored refresh token."""
    data = urllib.parse.urlencode({
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }).encode("utf-8")

    req = urllib.request.Request(
        GOOGLE_TOKEN_URL,
        data=data,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "User-Agent": "JARVIS-Google-Auth/1.0",
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            res_body = response.read().decode("utf-8")
            return json.loads(res_body)
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        raise RuntimeError(f"Google Token Refresh Failed (HTTP {e.code}): {err_msg}")
    except Exception as e:
        raise RuntimeError(f"Network error during token refresh: {str(e)}")


def fetch_google_userinfo(access_token: str) -> Dict[str, Any]:
    """Fetch user profile information from Google UserInfo API."""
    req = urllib.request.Request(
        GOOGLE_USERINFO_URL,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
            "User-Agent": "JARVIS-Google-Auth/1.0",
        },
        method="GET"
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            res_body = response.read().decode("utf-8")
            return json.loads(res_body)
    except Exception as e:
        return {"error": str(e)}


def save_to_jarvis_sqlite(auth_payload: Dict[str, Any], target_db_path: Optional[Path] = None) -> bool:
    """Save token directly into J.A.R.V.I.S. local SQLite database (jarvis.db)."""
    db_paths = [target_db_path] if target_db_path else [
        Path.cwd() / "data" / "jarvis.db",
        Path("/home/gopi/Downloads/JARVIS-V0/data/jarvis.db"),
    ]

    for db_path in db_paths:
        if not db_path:
            continue
        if db_path.parent.exists() or target_db_path:
            try:
                db_path.parent.mkdir(parents=True, exist_ok=True)
                conn = sqlite3.connect(str(db_path))
                cursor = conn.cursor()
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS configs (
                        key TEXT PRIMARY KEY,
                        value_json TEXT NOT NULL,
                        updated_at INTEGER NOT NULL
                    )
                """)
                cursor.execute("""
                    INSERT INTO configs (key, value_json, updated_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(key) DO UPDATE SET
                        value_json = excluded.value_json,
                        updated_at = excluded.updated_at
                """, (
                    "google_auth",
                    json.dumps(auth_payload),
                    int(time.time() * 1000)
                ))
                conn.commit()
                conn.close()
                return True
            except Exception as e:
                print(f"{YELLOW}⚠ SQLite persistence notice:{RESET} {e}")

    return False


def save_to_json_file(auth_payload: Dict[str, Any], target_json_path: Optional[Path] = None) -> str:
    """Save credentials to data/google_auth.json for J.A.R.V.I.S. core engine."""
    if target_json_path:
        json_path = target_json_path
        json_path.parent.mkdir(parents=True, exist_ok=True)
    else:
        data_dir = Path.cwd() / "data"
        data_dir.mkdir(parents=True, exist_ok=True)
        json_path = data_dir / "google_auth.json"

    # Merge with existing file if any
    existing_data: Dict[str, Any] = {}
    if json_path.exists():
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                existing_data = json.load(f)
        except Exception:
            pass

    merged = {**existing_data, **auth_payload}

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(merged, f, indent=2)

    return str(json_path)


def print_diagnostics(client_id: str, redirect_port: int, redirect_path: str) -> None:
    """Print exact configuration needed in Google Cloud Console."""
    print(f"\n{BOLD}{CYAN}══════════════════════════════════════════════════════════════════════════{RESET}")
    print(f"{BOLD}{GREEN}🛠️  GOOGLE CLOUD CONSOLE OAUTH CONFIGURATION DIAGNOSTICS{RESET}")
    print(f"{BOLD}{CYAN}══════════════════════════════════════════════════════════════════════════{RESET}")
    print(f"Client ID: {BOLD}{client_id}{RESET}")
    print(f"Google Cloud Console URL: {CYAN}https://console.cloud.google.com/apis/credentials{RESET}\n")

    print(f"{BOLD}1. AUTHORIZED JAVASCRIPT ORIGINS (Add ALL of the following):{RESET}")
    origins = [
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    for orig in origins:
        print(f"   • {CYAN}{orig}{RESET}")

    print(f"\n{BOLD}2. AUTHORIZED REDIRECT URIS (Add ALL of the following):{RESET}")
    redirect_uris = [
        "http://localhost:8000/api/auth/google/callback",
        "http://127.0.0.1:8000/api/auth/google/callback",
        "http://localhost:8000/api/connectors/callback",
        "http://127.0.0.1:8000/api/connectors/callback",
        f"http://localhost:{redirect_port}{redirect_path}",
        f"http://127.0.0.1:{redirect_port}{redirect_path}",
        "https://developers.google.com/oauthplayground",
    ]
    for uri in redirect_uris:
        print(f"   • {CYAN}{uri}{RESET}")

    print(f"\n{BOLD}{YELLOW}💡 Why 'Error 400: origin_mismatch' occurs:{RESET}")
    print("Google OAuth rejects requests when the calling domain/port is not explicitly listed")
    print("in the Authorized JavaScript Origins section of your OAuth 2.0 Web Client credentials.")
    print(f"{BOLD}{CYAN}══════════════════════════════════════════════════════════════════════════{RESET}\n")


def run_oauth_flow(
    client_id: str,
    client_secret: str,
    redirect_uri: str,
    scopes: list[str],
    no_browser: bool = False,
    timeout_seconds: int = 180
) -> Dict[str, Any]:
    """Execute the full Google OAuth 2.0 Authorization Code Flow."""
    parsed_redirect = urllib.parse.urlparse(redirect_uri)
    host = parsed_redirect.hostname or DEFAULT_REDIRECT_HOST
    port = parsed_redirect.port or DEFAULT_REDIRECT_PORT
    path = parsed_redirect.path or DEFAULT_REDIRECT_PATH

    if is_port_in_use(port, host):
        raise RuntimeError(
            f"Port {port} is already in use by another process. "
            f"Please free port {port} or specify another port via --port."
        )

    state = secrets.token_urlsafe(32)
    auth_url = generate_authorization_url(client_id, redirect_uri, state, scopes)

    print(f"\n{BOLD}{CYAN}╔════════════════════════════════════════════════════════════════════════╗{RESET}")
    print(f"{BOLD}{CYAN}║     🌐 J.A.R.V.I.S. GOOGLE WORKSPACE OAUTH 2.0 GATEWAY                 ║{RESET}")
    print(f"{BOLD}{CYAN}╚════════════════════════════════════════════════════════════════════════╝{RESET}")
    print(f"• Client ID    : {CYAN}{client_id}{RESET}")
    print(f"• Redirect URI : {CYAN}{redirect_uri}{RESET}")
    print(f"• Scopes ({len(scopes)}) : {CYAN}{', '.join(s.split('/')[-1] for s in scopes)}{RESET}")
    print(f"• Local Listener: {GREEN}http://{host}:{port}{path}{RESET}\n")

    server = OAuthHTTPServer((host, port), OAuthCallbackHandler, state, path)

    if not no_browser:
        print(f"{BOLD}Opening Google authorization page in default browser...{RESET}")
        opened = webbrowser.open(auth_url)
        if not opened:
            print(f"{YELLOW}Could not open browser automatically. Please open this URL manually:{RESET}")
            print(f"\n{CYAN}{auth_url}{RESET}\n")
    else:
        print(f"{BOLD}Please visit the following URL to authorize J.A.R.V.I.S.:{RESET}")
        print(f"\n{CYAN}{auth_url}{RESET}\n")

    print(f"{YELLOW}Waiting for Google OAuth callback (timeout: {timeout_seconds}s)...{RESET}")

    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    start_time = time.time()
    try:
        while server.auth_code is None and server.callback_error is None:
            if time.time() - start_time > timeout_seconds:
                server.shutdown()
                raise TimeoutError(f"OAuth flow timed out after {timeout_seconds} seconds.")
            time.sleep(0.5)
    except KeyboardInterrupt:
        server.shutdown()
        print(f"\n{RED}OAuth flow aborted by user.{RESET}")
        sys.exit(1)

    if server.callback_error:
        raise RuntimeError(f"OAuth Callback Failed: {server.callback_error}")

    auth_code = server.auth_code
    if not auth_code:
        raise RuntimeError("No authorization code received.")

    print(f"\n{GREEN}✓ Authorization code successfully received.{RESET}")
    print("Exchanging code for Google Access & Refresh Tokens...")

    token_data = exchange_code_for_token(client_id, client_secret, redirect_uri, auth_code)

    access_token = token_data.get("access_token", "")
    refresh_token = token_data.get("refresh_token", "")
    expires_in = token_data.get("expires_in", 3600)
    expires_at = int(time.time() * 1000) + (expires_in * 1000)

    if not access_token:
        raise RuntimeError(f"Token response did not include access_token: {token_data}")

    print(f"{GREEN}✓ Google OAuth token acquired successfully.{RESET}")
    print("Fetching Google User Profile...")

    user_info = fetch_google_userinfo(access_token)
    email = user_info.get("email", "")
    name = user_info.get("name", "")
    picture = user_info.get("picture", "")

    auth_payload = {
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "expiresAt": expires_at,
        "tokenType": token_data.get("token_type", "Bearer"),
        "scope": token_data.get("scope", " ".join(scopes)),
        "email": email,
        "name": name,
        "picture": picture,
        "updatedAt": int(time.time() * 1000),
    }

    # Save to SQLite and JSON
    save_to_jarvis_sqlite(auth_payload)
    json_path = save_to_json_file(auth_payload)
    os.environ["GOOGLE_ACCESS_TOKEN"] = access_token

    print(f"\n{BOLD}{GREEN}══════════════════════════════════════════════════════════════════════════{RESET}")
    print(f"{BOLD}{GREEN}🎉 GOOGLE WORKSPACE AUTHENTICATION COMPLETE & SYNCHRONIZED{RESET}")
    print(f"{BOLD}{GREEN}══════════════════════════════════════════════════════════════════════════{RESET}")
    print(f"• User Email   : {BOLD}{email or 'Unknown'}{RESET}")
    print(f"• Display Name : {BOLD}{name or 'Unknown'}{RESET}")
    print(f"• Access Token : {CYAN}{access_token[:15]}...{access_token[-5:]}{RESET}")
    print(f"• Refresh Token: {CYAN}{'Present (Permanent Auto-Refresh Active)' if refresh_token else 'None'}{RESET}")
    print(f"• SQLite Sync  : {GREEN}data/jarvis.db (configs.google_auth){RESET}")
    print(f"• JSON Backup  : {GREEN}{json_path}{RESET}")
    print(f"{BOLD}{GREEN}══════════════════════════════════════════════════════════════════════════{RESET}\n")

    return auth_payload


def test_existing_token() -> bool:
    """Verify currently stored Google credentials."""
    env = load_env_file()
    token = os.environ.get("GOOGLE_ACCESS_TOKEN", "")

    json_path = Path.cwd() / "data" / "google_auth.json"
    auth_data: Dict[str, Any] = {}
    if json_path.exists():
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                auth_data = json.load(f)
                token = auth_data.get("accessToken") or token
        except Exception:
            pass

    if not token:
        print(f"{RED}✗ No Google access token found in data/google_auth.json or environment.{RESET}")
        return False

    print(f"Testing Google access token: {CYAN}{token[:15]}...{RESET}")
    user_info = fetch_google_userinfo(token)

    if "error" in user_info:
        print(f"{RED}✗ Token validation failed:{RESET} {user_info.get('error')}")
        if auth_data.get("refreshToken"):
            print(f"{YELLOW}💡 A refresh token is available. Try running: python3 scripts/google_oauth_flow.py --refresh{RESET}")
        return False

    print(f"{GREEN}✓ Google token is valid and active!{RESET}")
    print(f"• Email  : {BOLD}{user_info.get('email')}{RESET}")
    print(f"• Name   : {BOLD}{user_info.get('name')}{RESET}")
    print(f"• Picture: {user_info.get('picture')}")
    return True


def refresh_token_cli_flow() -> bool:
    """Refresh Google access token using stored refresh token."""
    env = load_env_file()
    client_id = os.environ.get("VITE_GOOGLE_CLIENT_ID") or os.environ.get("GOOGLE_CLIENT_ID", "")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET", "")

    json_path = Path.cwd() / "data" / "google_auth.json"
    if not json_path.exists():
        print(f"{RED}✗ data/google_auth.json not found.{RESET}")
        return False

    with open(json_path, "r", encoding="utf-8") as f:
        auth_data = json.load(f)

    refresh_token = auth_data.get("refreshToken")
    if not refresh_token:
        print(f"{RED}✗ No refresh token found in data/google_auth.json.{RESET}")
        return False

    print(f"Refreshing Google access token with client ID: {CYAN}{client_id}{RESET}...")
    try:
        new_tokens = refresh_access_token_cli(client_id, client_secret, refresh_token)
        new_access_token = new_tokens.get("access_token")
        if not new_access_token:
            raise RuntimeError(f"No access token returned: {new_tokens}")

        expires_in = new_tokens.get("expires_in", 3600)
        auth_data["accessToken"] = new_access_token
        auth_data["expiresAt"] = int(time.time() * 1000) + (expires_in * 1000)
        auth_data["updatedAt"] = int(time.time() * 1000)

        # Update profile
        user_info = fetch_google_userinfo(new_access_token)
        if user_info.get("email"):
            auth_data["email"] = user_info["email"]
        if user_info.get("name"):
            auth_data["name"] = user_info["name"]

        save_to_jarvis_sqlite(auth_data)
        save_to_json_file(auth_data)
        os.environ["GOOGLE_ACCESS_TOKEN"] = new_access_token

        print(f"{GREEN}✓ Google access token refreshed successfully!{RESET}")
        print(f"• New Token: {CYAN}{new_access_token[:15]}...{RESET}")
        print(f"• Email    : {BOLD}{auth_data.get('email', 'User')}{RESET}")
        return True
    except Exception as e:
        print(f"{RED}✗ Token refresh failed:{RESET} {e}")
        return False


def main() -> None:
    parser = argparse.ArgumentParser(description="J.A.R.V.I.S. Google Workspace Autonomous OAuth Engine")
    parser.add_argument("--client-id", help="Google OAuth 2.0 Client ID")
    parser.add_argument("--client-secret", help="Google OAuth 2.0 Client Secret")
    parser.add_argument("--port", type=int, default=DEFAULT_REDIRECT_PORT, help=f"Local callback port (default: {DEFAULT_REDIRECT_PORT})")
    parser.add_argument("--path", default=DEFAULT_REDIRECT_PATH, help=f"Callback path (default: {DEFAULT_REDIRECT_PATH})")
    parser.add_argument("--no-browser", action="store_true", help="Do not automatically open browser")
    parser.add_argument("--timeout", type=int, default=180, help="Timeout in seconds to wait for authorization callback")
    parser.add_argument("--test", action="store_true", help="Test currently saved Google credentials")
    parser.add_argument("--refresh", action="store_true", help="Force refresh access token using stored refresh token")
    parser.add_argument("--diagnostics", action="store_true", help="Print exact Authorized Origins and Redirect URIs to add in Google Cloud Console")

    args = parser.parse_args()

    env = load_env_file()
    client_id = (args.client_id or os.environ.get("VITE_GOOGLE_CLIENT_ID") or os.environ.get("GOOGLE_CLIENT_ID") or "").strip()
    client_secret = (args.client_secret or os.environ.get("GOOGLE_CLIENT_SECRET") or "").strip()

    if args.diagnostics:
        print_diagnostics(client_id or "YOUR_CLIENT_ID.apps.googleusercontent.com", args.port, args.path)
        return

    if args.test:
        test_existing_token()
        return

    if args.refresh:
        refresh_token_cli_flow()
        return

    if not client_id:
        print(f"{RED}Error: Google Client ID is required.{RESET}")
        print("Set VITE_GOOGLE_CLIENT_ID in .env or pass --client-id <ID>")
        sys.exit(1)

    redirect_uri = f"http://{DEFAULT_REDIRECT_HOST}:{args.port}{args.path}"

    try:
        run_oauth_flow(
            client_id=client_id,
            client_secret=client_secret,
            redirect_uri=redirect_uri,
            scopes=DEFAULT_SCOPES,
            no_browser=args.no_browser,
            timeout_seconds=args.timeout,
        )
    except Exception as e:
        print(f"\n{RED}✗ Authentication Flow Error:{RESET} {e}")
        print(f"\n{YELLOW}💡 If you received Error 400 (origin_mismatch or redirect_uri_mismatch):{RESET}")
        print(f"Run {CYAN}python3 scripts/google_oauth_flow.py --diagnostics{RESET} to see the exact URLs to add in Google Cloud Console.")
        sys.exit(1)


if __name__ == "__main__":
    main()
