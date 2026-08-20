"""
Google Workspace OAuth 2.0 & Token Management Service for J.A.R.V.I.S. Python Core.
Handles persistent token storage in data/google_auth.json, profile caching,
authorization code exchange, token auto-refresh, and standard OAuth login URLs.
"""

import os
import json
import sqlite3
import time
import httpx
from typing import Dict, Any, Optional
from urllib.parse import urlencode

DATA_DIR = os.path.join(os.getcwd(), "data")
TOKEN_FILE_PATH = os.path.join(DATA_DIR, "google_auth.json")
DB_PATH = os.path.join(DATA_DIR, "jarvis.db")

DEFAULT_CLIENT_ID = os.environ.get(
    "VITE_GOOGLE_CLIENT_ID",
    "791977848384-q4ljrlj38kepp2crruo4i6vq3j1813ot.apps.googleusercontent.com"
)

GOOGLE_SCOPES = [
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


class GoogleAuthService:
    _instance = None

    @classmethod
    def get_instance(cls) -> "GoogleAuthService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        self.auth_data: Optional[Dict[str, Any]] = None
        self.load_persisted_auth()

    def is_valid_token(self, token: Optional[str]) -> bool:
        if not token or not isinstance(token, str):
            return False
        cleaned = token.strip()
        if not cleaned:
            return False
        # Discard mock/placeholder test tokens
        if cleaned.startswith("ya29.mock_") or cleaned.startswith("test_"):
            return False
        return True

    def load_persisted_auth(self) -> Optional[Dict[str, Any]]:
        """Load credentials from data/google_auth.json, SQLite jarvis.db, or process.env"""
        # 1. JSON file
        try:
            if os.path.exists(TOKEN_FILE_PATH):
                with open(TOKEN_FILE_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                token = (data.get("accessToken") or data.get("access_token") or data.get("token", "")).strip()
                if self.is_valid_token(token):
                    self.auth_data = {
                        "accessToken": token,
                        "refreshToken": data.get("refreshToken") or data.get("refresh_token"),
                        "expiresAt": data.get("expiresAt") or data.get("expires_at"),
                        "email": data.get("email", ""),
                        "name": data.get("name", ""),
                        "picture": data.get("picture", ""),
                        "scope": data.get("scope", ""),
                        "updatedAt": data.get("updatedAt", int(time.time() * 1000)),
                    }
                    os.environ["GOOGLE_ACCESS_TOKEN"] = token
                    return self.auth_data
        except Exception as e:
            print(f"[GoogleAuth] Notice reading google_auth.json: {e}")

        # 2. SQLite jarvis.db configs table (checks google_auth, google_oauth_credentials, google_workspace_auth)
        if os.path.exists(DB_PATH):
            try:
                conn = sqlite3.connect(DB_PATH)
                cur = conn.cursor()
                cur.execute(
                    "SELECT key, value_json FROM configs WHERE key IN ('google_auth', 'google_oauth_credentials', 'google_workspace_auth') ORDER BY updated_at DESC"
                )
                rows = cur.fetchall()
                conn.close()
                for key, val in rows:
                    if val:
                        try:
                            db_data = json.loads(val)
                            token = (db_data.get("accessToken") or db_data.get("access_token") or db_data.get("token", "")).strip()
                            if self.is_valid_token(token):
                                self.auth_data = {
                                    "accessToken": token,
                                    "refreshToken": db_data.get("refreshToken") or db_data.get("refresh_token"),
                                    "expiresAt": db_data.get("expiresAt") or db_data.get("expires_at"),
                                    "email": db_data.get("email", ""),
                                    "name": db_data.get("name", ""),
                                    "picture": db_data.get("picture", ""),
                                    "scope": db_data.get("scope", ""),
                                    "updatedAt": db_data.get("updatedAt", int(time.time() * 1000)),
                                }
                                os.environ["GOOGLE_ACCESS_TOKEN"] = token
                                # Sync to JSON file
                                try:
                                    with open(TOKEN_FILE_PATH, "w", encoding="utf-8") as jf:
                                        json.dump(self.auth_data, jf, indent=2)
                                except Exception:
                                    pass
                                return self.auth_data
                        except Exception:
                            continue
            except Exception as e:
                print(f"[GoogleAuth] SQLite lookup notice: {e}")

        # 3. Environment variable fallback
        env_token = os.environ.get("GOOGLE_ACCESS_TOKEN", "").strip()
        if self.is_valid_token(env_token):
            self.auth_data = {
                "accessToken": env_token,
                "updatedAt": int(time.time() * 1000),
            }
            return self.auth_data

        return None

    def save_auth(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Save auth credentials to data/google_auth.json and update environment & SQLite."""
        os.makedirs(DATA_DIR, exist_ok=True)
        current = self.auth_data or {"accessToken": "", "updatedAt": int(time.time() * 1000)}

        token = (data.get("accessToken") or data.get("token") or current.get("accessToken", "")).strip()
        updated = {
            **current,
            **data,
            "accessToken": token,
            "updatedAt": int(time.time() * 1000),
        }
        # Clean up any duplicate keys
        if "token" in updated and "accessToken" in updated:
            del updated["token"]

        self.auth_data = updated
        if token:
            os.environ["GOOGLE_ACCESS_TOKEN"] = token

        try:
            with open(TOKEN_FILE_PATH, "w", encoding="utf-8") as f:
                json.dump(updated, f, indent=2)
        except Exception as e:
            print(f"[GoogleAuth] Error saving google_auth.json: {e}")

        # Sync to SQLite jarvis.db
        try:
            conn = sqlite3.connect(DB_PATH)
            cur = conn.cursor()
            cur.execute("""
                CREATE TABLE IF NOT EXISTS configs (
                    key TEXT PRIMARY KEY,
                    value_json TEXT NOT NULL,
                    updated_at INTEGER NOT NULL
                )
            """)
            cur.execute("""
                INSERT INTO configs (key, value_json, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    value_json = excluded.value_json,
                    updated_at = excluded.updated_at
            """, ("google_auth", json.dumps(updated), int(time.time() * 1000)))
            conn.commit()
            conn.close()
        except Exception:
            pass

        return updated

    async def fetch_and_cache_profile(self, token: str) -> Optional[Dict[str, Any]]:
        """Fetch user profile from Google UserInfo API."""
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {token}"}
                )
                if resp.status_code == 200:
                    profile = resp.json()
                    if self.auth_data:
                        self.auth_data["email"] = profile.get("email") or self.auth_data.get("email", "")
                        self.auth_data["name"] = profile.get("name") or self.auth_data.get("name", "")
                        self.auth_data["picture"] = profile.get("picture") or self.auth_data.get("picture", "")
                        self.save_auth(self.auth_data)
                    return profile
        except Exception as e:
            print(f"[GoogleAuth] Profile fetch warning: {e}")
        return None

    async def exchange_auth_code(
        self,
        code: str,
        redirect_uri: str = "postmessage",
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None
    ) -> Dict[str, Any]:
        """Exchange authorization code for access & refresh tokens."""
        effective_client_id = (client_id or os.environ.get("VITE_GOOGLE_CLIENT_ID") or DEFAULT_CLIENT_ID).strip()
        effective_client_secret = (client_secret or os.environ.get("GOOGLE_CLIENT_SECRET", "")).strip()

        payload = {
            "code": code,
            "client_id": effective_client_id,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        }
        if effective_client_secret:
            payload["client_secret"] = effective_client_secret

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data=payload,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            if resp.status_code != 200:
                err_body = resp.text
                raise Exception(f"Google token exchange failed (HTTP {resp.status_code}): {err_body}")

            data = resp.json()
            access_token = data.get("access_token", "")
            expires_in = data.get("expires_in", 3600)
            expires_at = int(time.time() * 1000) + (expires_in * 1000)

            saved = self.save_auth({
                "accessToken": access_token,
                "refreshToken": data.get("refresh_token") or (self.auth_data.get("refreshToken") if self.auth_data else None),
                "expiresAt": expires_at,
                "scope": data.get("scope", ""),
            })

            # Fetch profile in background
            try:
                await self.fetch_and_cache_profile(access_token)
            except Exception:
                pass

            return self.auth_data or saved

    async def refresh_access_token(
        self,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None
    ) -> Optional[str]:
        """Refresh an expired access token using the stored refresh token."""
        if not self.auth_data or not self.auth_data.get("refreshToken"):
            return None

        effective_client_id = (client_id or os.environ.get("VITE_GOOGLE_CLIENT_ID") or DEFAULT_CLIENT_ID).strip()
        effective_client_secret = (client_secret or os.environ.get("GOOGLE_CLIENT_SECRET", "")).strip()

        payload = {
            "client_id": effective_client_id,
            "refresh_token": self.auth_data["refreshToken"],
            "grant_type": "refresh_token",
        }
        if effective_client_secret:
            payload["client_secret"] = effective_client_secret

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    "https://oauth2.googleapis.com/token",
                    data=payload,
                    headers={"Content-Type": "application/x-www-form-urlencoded"}
                )
                if resp.status_code != 200:
                    print(f"[GoogleAuth] Token refresh failed: {resp.text}")
                    return None

                data = resp.json()
                new_token = data.get("access_token", "")
                expires_in = data.get("expires_in", 3600)
                expires_at = int(time.time() * 1000) + (expires_in * 1000)

                self.save_auth({
                    "accessToken": new_token,
                    "expiresAt": expires_at,
                    "scope": data.get("scope") or self.auth_data.get("scope", ""),
                })
                return new_token
        except Exception as e:
            print(f"[GoogleAuth] Exception refreshing token: {e}")
            return None

    def get_auth_url(self, redirect_uri: str, client_id: Optional[str] = None) -> str:
        """Generate standard OAuth 2.0 authorization URL."""
        cid = (client_id or os.environ.get("VITE_GOOGLE_CLIENT_ID") or DEFAULT_CLIENT_ID).strip()
        params = {
            "client_id": cid,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(GOOGLE_SCOPES),
            "access_type": "offline",
            "prompt": "consent",
            "state": "goog_jarvis_auth",
        }
        return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"

    def disconnect(self):
        """Disconnect and delete stored credentials."""
        self.auth_data = None
        os.environ.pop("GOOGLE_ACCESS_TOKEN", None)
        if os.path.exists(TOKEN_FILE_PATH):
            try:
                os.remove(TOKEN_FILE_PATH)
            except Exception:
                pass

    def get_status(self) -> Dict[str, Any]:
        """Return structured connection status for frontend and agents."""
        if not self.auth_data or not self.auth_data.get("accessToken"):
            self.load_persisted_auth()

        is_connected = bool(self.auth_data and self.auth_data.get("accessToken"))
        now = int(time.time() * 1000)
        expires_at = self.auth_data.get("expiresAt") if self.auth_data else None
        is_expired = bool(expires_at and now >= expires_at)

        return {
            "connected": is_connected,
            "hasToken": is_connected,
            "hasRefreshToken": bool(self.auth_data and self.auth_data.get("refreshToken")),
            "token": self.auth_data.get("accessToken", "") if self.auth_data else "",
            "email": self.auth_data.get("email", "") if self.auth_data else "",
            "name": self.auth_data.get("name", "") if self.auth_data else "",
            "picture": self.auth_data.get("picture", "") if self.auth_data else "",
            "expiresAt": expires_at,
            "isExpired": is_expired,
            "updatedAt": self.auth_data.get("updatedAt") if self.auth_data else None,
        }


google_auth_service = GoogleAuthService.get_instance()
