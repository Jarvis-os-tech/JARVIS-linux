#!/usr/bin/env python3
"""
=============================================================================
J.A.R.V.I.S. LinkedIn OAuth 2.0 Autonomous Authentication Engine
=============================================================================
Local-first, zero-dependency Python script using strictly standard libraries to:
1. Securely generate the LinkedIn OAuth 2.0 authorization URL with CSRF protection.
2. Spin up an ephemeral local HTTP server to receive the authorization code redirect.
3. Exchange the authorization code for an OAuth 2.0 access token.
4. Verify the token against LinkedIn OpenID userinfo (/v2/userinfo).
5. Persist credentials locally into data/jarvis.db (SQLite) & data/linkedin_auth.json.
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
DEFAULT_SCOPES = ["openid", "profile", "email", "w_member_social"]

LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization"
LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo"

# Colors for terminal output
CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BOLD = "\033[1m"
RESET = "\033[0m"


class OAuthCallbackHandler(http.server.BaseHTTPRequestHandler):
    """Ephemeral HTTP handler to catch the OAuth 2.0 redirect callback."""

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
                title="LinkedIn Authorization Failed",
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
                message="LinkedIn did not return an authorization code in the callback.",
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
            title="LinkedIn Connected Successfully",
            message="Authorization code received by J.A.R.V.I.S. You may now close this browser tab and return to the terminal.",
            is_success=True
        ).encode("utf-8"))

        # Trigger server shutdown on a background thread so the HTTP response completes
        threading.Thread(target=self.server.shutdown, daemon=True).start()

    def render_html_response(self, title: str, message: str, is_success: bool) -> str:
        color = "#10B981" if is_success else "#EF4444"
        badge_text = "AUTHENTICATION SUCCESSFUL" if is_success else "AUTHENTICATION FAILED"
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
    """Generate the secure LinkedIn OAuth 2.0 authorization URL."""
    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "state": state,
        "scope": " ".join(scopes),
    }
    return f"{LINKEDIN_AUTH_URL}?{urllib.parse.urlencode(params)}"


def exchange_code_for_token(
    client_id: str,
    client_secret: str,
    redirect_uri: str,
    auth_code: str
) -> Dict[str, Any]:
    """Exchange authorization code for access token via LinkedIn API."""
    data = urllib.parse.urlencode({
        "grant_type": "authorization_code",
        "code": auth_code,
        "redirect_uri": redirect_uri,
        "client_id": client_id,
        "client_secret": client_secret,
    }).encode("utf-8")

    req = urllib.request.Request(
        LINKEDIN_TOKEN_URL,
        data=data,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "JARVIS-LinkedIn-Auth/1.0",
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            res_body = response.read().decode("utf-8")
            return json.loads(res_body)
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        raise RuntimeError(f"LinkedIn Token Exchange Failed (HTTP {e.code}): {err_msg}")
    except Exception as e:
        raise RuntimeError(f"Network error during token exchange: {str(e)}")


def fetch_linkedin_userinfo(access_token: str) -> Dict[str, Any]:
    """Fetch user profile information from LinkedIn OpenID UserInfo endpoint."""
    req = urllib.request.Request(
        LINKEDIN_USERINFO_URL,
        headers={
            "Authorization": f"Bearer {access_token}",
            "User-Agent": "JARVIS-LinkedIn-Auth/1.0",
        },
        method="GET"
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            res_body = response.read().decode("utf-8")
            return json.loads(res_body)
    except Exception as e:
        # Userinfo fetch failure is non-fatal for token acquisition
        return {"error": str(e)}


def save_to_jarvis_sqlite(auth_payload: Dict[str, Any]) -> bool:
    """Save token directly into J.A.R.V.I.S. local SQLite database (jarvis.db)."""
    db_paths = [
        Path.cwd() / "data" / "jarvis.db",
        Path("/home/gopi/Downloads/JARVIS-V0/data/jarvis.db"),
    ]

    for db_path in db_paths:
        if db_path.parent.exists():
            try:
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
                    "linkedin_auth",
                    json.dumps(auth_payload),
                    int(time.time() * 1000)
                ))
                conn.commit()
                conn.close()
                return True
            except Exception as e:
                print(f"{YELLOW}⚠ SQLite persistence notice:{RESET} {e}")

    return False


def save_to_json_file(auth_payload: Dict[str, Any]) -> str:
    """Save credentials to local JSON file."""
    data_dir = Path.cwd() / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    out_file = data_dir / "linkedin_auth.json"

    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(auth_payload, f, indent=2)

    return str(out_file)


def sync_with_jarvis_server(access_token: str, user_info: Dict[str, Any]) -> None:
    """Optionally sync with live J.A.R.V.I.S. REST API endpoint if server is online."""
    jarvis_api_url = "http://localhost:3000/api/linkedin/auth/token"
    payload = json.dumps({
        "accessToken": access_token,
        "name": user_info.get("name"),
        "email": user_info.get("email"),
        "userUrn": f"urn:li:person:{user_info.get('sub')}" if user_info.get("sub") else None,
    }).encode("utf-8")

    req = urllib.request.Request(
        jarvis_api_url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=3) as res:
            if res.status == 200:
                print(f"{GREEN}✓ Synced credentials with active J.A.R.V.I.S. server (port 3000).{RESET}")
    except Exception:
        # Server might not be running right now; SQLite persistence covers it.
        pass


def run_oauth_flow(
    client_id: str,
    client_secret: str,
    redirect_uri: str,
    scopes: list[str],
    no_browser: bool = False,
    timeout_seconds: int = 180
) -> Dict[str, Any]:
    """Execute the full OAuth 2.0 Authorization Code Flow."""
    parsed_redirect = urllib.parse.urlparse(redirect_uri)
    host = parsed_redirect.hostname or DEFAULT_REDIRECT_HOST
    port = parsed_redirect.port or (443 if parsed_redirect.scheme == "https" else 80)
    path = parsed_redirect.path or DEFAULT_REDIRECT_PATH

    # Check port availability
    if is_port_in_use(port, host):
        raise RuntimeError(f"Port {port} is already in use by another application. Please choose another port or terminate the blocking process.")

    # Generate cryptographically secure CSRF state token
    state = secrets.token_urlsafe(32)

    auth_url = generate_authorization_url(client_id, redirect_uri, state, scopes)

    print(f"\n{BOLD}{CYAN}══════════════════════════════════════════════════════════════════════════{RESET}")
    print(f"{BOLD}{CYAN}      J.A.R.V.I.S. LINKEDIN OAUTH 2.0 LOCAL AUTHENTICATION ENGINE         {RESET}")
    print(f"{BOLD}{CYAN}══════════════════════════════════════════════════════════════════════════{RESET}\n")

    print(f"{BOLD}1. Requested Scopes:{RESET}")
    for sc in scopes:
        print(f"   • {CYAN}{sc}{RESET}")

    print(f"\n{BOLD}2. Redirect URI:{RESET} {CYAN}{redirect_uri}{RESET}")
    print(f"{BOLD}3. Local Callback Server:{RESET} Listening on {CYAN}http://{host}:{port}{path}{RESET}")

    # Start local HTTP server
    server = OAuthHTTPServer((host, port), OAuthCallbackHandler, expected_state=state, expected_path=path)

    print(f"\n{BOLD}4. Initiating Browser Authorization...{RESET}")
    if not no_browser:
        try:
            opened = webbrowser.open(auth_url)
            if not opened:
                print(f"{YELLOW}Notice: Browser could not be opened automatically.{RESET}")
        except Exception:
            pass

    print(f"\nIf the browser does not open automatically, visit this URL:\n")
    print(f"{BOLD}{CYAN}{auth_url}{RESET}\n")
    print(f"{YELLOW}⏳ Waiting for your authorization in the browser (Timeout: {timeout_seconds}s)...{RESET}")

    # Run HTTP server until callback is received or timeout occurs
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    start_time = time.time()
    while server_thread.is_alive():
        time.sleep(0.5)
        if time.time() - start_time > timeout_seconds:
            server.shutdown()
            server.server_close()
            raise TimeoutError(f"OAuth authorization timed out after {timeout_seconds} seconds.")

    server.server_close()

    if server.callback_error:
        raise RuntimeError(f"Authorization Error: {server.callback_error}")

    if not server.auth_code:
        raise RuntimeError("Authorization Code was not received.")

    print(f"\n{GREEN}✓ Authorization code received successfully!{RESET}")
    print(f"{CYAN}⚙ Exchanging code for long-lived OAuth 2.0 Access Token...{RESET}")

    # Exchange authorization code for token
    token_response = exchange_code_for_token(client_id, client_secret, redirect_uri, server.auth_code)

    access_token = token_response.get("access_token")
    if not access_token:
        raise RuntimeError(f"Invalid token response from LinkedIn: {json.dumps(token_response)}")

    expires_in = token_response.get("expires_in", 5184000)  # Standard LinkedIn 60 days (5184000s)
    expires_at = int((time.time() + expires_in) * 1000)

    print(f"{GREEN}✓ Access Token obtained successfully! (Expires in ~{expires_in // 86400} days){RESET}")
    print(f"{CYAN}⚙ Hydrating user identity from LinkedIn OpenID endpoint...{RESET}")

    # Fetch User Info
    user_info = fetch_linkedin_userinfo(access_token)
    user_name = user_info.get("name") or f"{user_info.get('given_name', '')} {user_info.get('family_name', '')}".strip() or "LinkedIn Member"
    user_email = user_info.get("email") or "Not provided"
    user_sub = user_info.get("sub")
    user_urn = f"urn:li:person:{user_sub}" if user_sub else None

    # Construct final auth payload
    auth_payload: Dict[str, Any] = {
        "accessToken": access_token,
        "refreshToken": token_response.get("refresh_token"),
        "expiresIn": expires_in,
        "expiresAt": expires_at,
        "scope": token_response.get("scope") or " ".join(scopes),
        "name": user_name,
        "email": user_email,
        "picture": user_info.get("picture"),
        "userUrn": user_urn,
        "updatedAt": int(time.time() * 1000),
    }

    # Save to SQLite and JSON
    sqlite_saved = save_to_jarvis_sqlite(auth_payload)
    json_path = save_to_json_file(auth_payload)
    sync_with_jarvis_server(access_token, user_info)

    print(f"\n{BOLD}{GREEN}══════════════════════════════════════════════════════════════════════════{RESET}")
    print(f"{BOLD}{GREEN}                 LINKEDIN AUTHENTICATION COMPLETED                        {RESET}")
    print(f"{BOLD}{GREEN}══════════════════════════════════════════════════════════════════════════{RESET}\n")

    print(f"👤 {BOLD}Member Name:{RESET}  {CYAN}{user_name}{RESET}")
    print(f"📧 {BOLD}Member Email:{RESET} {CYAN}{user_email}{RESET}")
    if user_urn:
        print(f"🆔 {BOLD}Member URN:{RESET}   {CYAN}{user_urn}{RESET}")
    print(f"🔑 {BOLD}Access Token:{RESET} {GREEN}{access_token[:12]}...{access_token[-8:]}{RESET} (Length: {len(access_token)})")
    print(f"💾 {BOLD}SQLite WAL:{RESET}   {'Saved in data/jarvis.db (configs table)' if sqlite_saved else 'N/A'}")
    print(f"📄 {BOLD}JSON Backup:{RESET}  {json_path}\n")

    return auth_payload


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="J.A.R.V.I.S. LinkedIn OAuth 2.0 Local-First Authentication Flow",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run flow with arguments:
  python3 scripts/linkedin_oauth_flow.py --client-id YOUR_ID --client-secret YOUR_SECRET

  # Run on a custom redirect port:
  python3 scripts/linkedin_oauth_flow.py --port 8080

  # Pass environment variables:
  export LINKEDIN_CLIENT_ID="your_client_id"
  export LINKEDIN_CLIENT_SECRET="your_client_secret"
  python3 scripts/linkedin_oauth_flow.py
        """
    )
    parser.add_argument("--client-id", default=os.environ.get("LINKEDIN_CLIENT_ID", ""), help="LinkedIn App Client ID")
    parser.add_argument("--client-secret", default=os.environ.get("LINKEDIN_CLIENT_SECRET", ""), help="LinkedIn App Client Secret")
    parser.add_argument("--redirect-uri", default=os.environ.get("LINKEDIN_REDIRECT_URI", ""), help=f"OAuth Redirect URI (default: http://{DEFAULT_REDIRECT_HOST}:{DEFAULT_REDIRECT_PORT}{DEFAULT_REDIRECT_PATH})")
    parser.add_argument("--port", type=int, default=DEFAULT_REDIRECT_PORT, help=f"Local callback port (default: {DEFAULT_REDIRECT_PORT})")
    parser.add_argument("--scopes", nargs="+", default=DEFAULT_SCOPES, help=f"Scopes to request (default: {' '.join(DEFAULT_SCOPES)})")
    parser.add_argument("--no-browser", action="store_true", help="Do not automatically launch web browser")
    parser.add_argument("--timeout", type=int, default=180, help="Authorization timeout in seconds (default: 180)")

    return parser.parse_args()


def main() -> None:
    args = parse_args()

    client_id = args.client_id.strip()
    client_secret = args.client_secret.strip()

    # If not provided via args or env, prompt interactively
    if not client_id:
        try:
            client_id = input(f"{BOLD}Enter LinkedIn Client ID:{RESET} ").strip()
        except (KeyboardInterrupt, EOFError):
            print(f"\n{RED}Aborted.{RESET}")
            sys.exit(1)

    if not client_secret:
        try:
            import getpass
            client_secret = getpass.getpass(f"{BOLD}Enter LinkedIn Client Secret:{RESET} ").strip()
        except (KeyboardInterrupt, EOFError):
            print(f"\n{RED}Aborted.{RESET}")
            sys.exit(1)

    if not client_id or not client_secret:
        print(f"{RED}Error: Client ID and Client Secret are required.{RESET}")
        sys.exit(1)

    redirect_uri = args.redirect_uri.strip() or f"http://{DEFAULT_REDIRECT_HOST}:{args.port}{DEFAULT_REDIRECT_PATH}"

    try:
        run_oauth_flow(
            client_id=client_id,
            client_secret=client_secret,
            redirect_uri=redirect_uri,
            scopes=args.scopes,
            no_browser=args.no_browser,
            timeout_seconds=args.timeout,
        )
    except KeyboardInterrupt:
        print(f"\n{YELLOW}Authorization cancelled by user.{RESET}")
        sys.exit(130)
    except Exception as e:
        print(f"\n{RED}❌ Error:{RESET} {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
