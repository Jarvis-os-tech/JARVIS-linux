"""
GitHub Integration & OAuth 2.0 Service for J.A.R.V.I.S. Python Core Engine.
Provides autonomous repository management, issue creation, Gist sharing,
profile synchronization, and OAuth 2.0 token handling.
"""

import os
import json
import time
import sqlite3
import httpx
from pathlib import Path
from typing import Dict, Any, Optional, List
from urllib.parse import urlencode

DATA_DIR = os.path.join(os.getcwd(), "data")
TOKEN_FILE_PATH = os.path.join(DATA_DIR, "github_auth.json")
DB_PATH = os.path.join(DATA_DIR, "jarvis.db")
CONFIG_KEY = "github_auth"


class GitHubService:
    _instance = None

    @classmethod
    def get_instance(cls) -> "GitHubService":
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
        if cleaned.startswith("gho_mock_") or cleaned.startswith("test_"):
            return False
        return True

    def load_persisted_auth(self) -> Optional[Dict[str, Any]]:
        """Load GitHub credentials from JSON file, SQLite database, or environment."""
        # 1. JSON file
        try:
            if os.path.exists(TOKEN_FILE_PATH):
                with open(TOKEN_FILE_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                token = (data.get("accessToken") or data.get("access_token", "")).strip()
                if self.is_valid_token(token):
                    self.auth_data = {
                        "accessToken": token,
                        "tokenType": data.get("tokenType") or data.get("token_type", "bearer"),
                        "scope": data.get("scope", "repo read:user user:email workflow gist"),
                        "login": data.get("login", ""),
                        "name": data.get("name", ""),
                        "email": data.get("email", ""),
                        "avatarUrl": data.get("avatarUrl") or data.get("avatar_url", ""),
                        "htmlUrl": data.get("htmlUrl") or data.get("html_url", ""),
                        "publicRepos": data.get("publicRepos") or data.get("public_repos", 0),
                        "updatedAt": data.get("updatedAt", int(time.time() * 1000)),
                    }
                    os.environ["GITHUB_ACCESS_TOKEN"] = token
                    return self.auth_data
        except Exception:
            pass

        # 2. SQLite jarvis.db configs table
        if os.path.exists(DB_PATH):
            try:
                conn = sqlite3.connect(DB_PATH)
                cur = conn.cursor()
                cur.execute(
                    "SELECT key, value_json FROM configs WHERE key IN ('github_auth', 'github_oauth_credentials') ORDER BY updated_at DESC"
                )
                rows = cur.fetchall()
                conn.close()
                for key, val in rows:
                    if val:
                        try:
                            db_data = json.loads(val)
                            token = (db_data.get("accessToken") or db_data.get("access_token", "")).strip()
                            if self.is_valid_token(token):
                                self.auth_data = db_data
                                os.environ["GITHUB_ACCESS_TOKEN"] = token
                                # Sync to JSON file
                                try:
                                    with open(TOKEN_FILE_PATH, "w", encoding="utf-8") as jf:
                                        json.dump(self.auth_data, jf, indent=2)
                                except Exception:
                                    pass
                                return self.auth_data
                        except Exception:
                            continue
            except Exception:
                pass

        # 3. Environment variable fallback
        env_token = (os.environ.get("GITHUB_ACCESS_TOKEN") or os.environ.get("GITHUB_TOKEN") or "").strip()
        if self.is_valid_token(env_token):
            self.auth_data = {
                "accessToken": env_token,
                "tokenType": "bearer",
                "updatedAt": int(time.time() * 1000),
            }
            return self.auth_data

        return None

    def get_access_token(self) -> str:
        if self.auth_data and self.auth_data.get("accessToken"):
            return self.auth_data["accessToken"]
        auth = self.load_persisted_auth()
        return auth.get("accessToken", "") if auth else ""

    def get_status(self) -> Dict[str, Any]:
        """Return structured connection status for frontend and agent tools."""
        auth = self.auth_data or self.load_persisted_auth()
        is_connected = bool(auth and auth.get("accessToken"))
        return {
            "connected": is_connected,
            "login": auth.get("login", "") if auth else "",
            "name": auth.get("name", "") if auth else "",
            "email": auth.get("email", "") if auth else "",
            "avatarUrl": auth.get("avatarUrl", "") if auth else "",
            "publicRepos": auth.get("publicRepos", 0) if auth else 0,
            "updatedAt": auth.get("updatedAt") if auth else None,
        }

    async def fetch_user_profile(self, token: str) -> Optional[Dict[str, Any]]:
        """Fetch user profile and primary email from GitHub API."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                headers = {
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github.v3+json",
                    "User-Agent": "JARVIS-Python-Core/1.0",
                }
                res = await client.get("https://api.github.com/user", headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    # If email is null/private, attempt to fetch from /user/emails
                    if not data.get("email"):
                        try:
                            em_res = await client.get("https://api.github.com/user/emails", headers=headers)
                            if em_res.status_code == 200:
                                emails = em_res.json()
                                for em in emails:
                                    if em.get("primary"):
                                        data["email"] = em.get("email")
                                        break
                        except Exception:
                            pass
                    return data
        except Exception as e:
            print(f"[GitHubService] User profile fetch notice: {e}")
        return None

    async def save_auth(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Save GitHub credentials to JSON file, SQLite, and environment."""
        os.makedirs(DATA_DIR, exist_ok=True)
        current = self.load_persisted_auth() or {"accessToken": "", "updatedAt": int(time.time() * 1000)}

        token = (data.get("accessToken") or data.get("access_token") or current.get("accessToken", "")).strip()
        merged = {
            **current,
            **data,
            "accessToken": token,
            "updatedAt": int(time.time() * 1000),
        }

        if token:
            os.environ["GITHUB_ACCESS_TOKEN"] = token
            # Fetch profile to enrich metadata
            profile = await self.fetch_user_profile(token)
            if profile:
                merged["login"] = profile.get("login") or merged.get("login", "")
                merged["name"] = profile.get("name") or merged.get("name", "")
                merged["email"] = profile.get("email") or merged.get("email", "")
                merged["avatarUrl"] = profile.get("avatar_url") or merged.get("avatarUrl", "")
                merged["htmlUrl"] = profile.get("html_url") or merged.get("htmlUrl", "")
                merged["publicRepos"] = profile.get("public_repos", merged.get("publicRepos", 0))

        self.auth_data = merged

        # 1. Save JSON backup
        try:
            with open(TOKEN_FILE_PATH, "w", encoding="utf-8") as f:
                json.dump(merged, f, indent=2)
        except Exception as e:
            print(f"[GitHubService] Error saving JSON: {e}")

        # 2. Save to SQLite jarvis.db
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
            """, (CONFIG_KEY, json.dumps(merged), int(time.time() * 1000)))
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"[GitHubService] SQLite save warning: {e}")

        return merged

    def disconnect(self) -> None:
        """Disconnect GitHub credentials."""
        self.auth_data = None
        os.environ.pop("GITHUB_ACCESS_TOKEN", None)
        if os.path.exists(TOKEN_FILE_PATH):
            try:
                os.remove(TOKEN_FILE_PATH)
            except Exception:
                pass
        if os.path.exists(DB_PATH):
            try:
                conn = sqlite3.connect(DB_PATH)
                cur = conn.cursor()
                cur.execute("DELETE FROM configs WHERE key = ?", (CONFIG_KEY,))
                conn.commit()
                conn.close()
            except Exception:
                pass

    def get_authorization_url(self, redirect_uri: Optional[str] = None, client_id: Optional[str] = None) -> str:
        """Generate GitHub OAuth 2.0 Authorization URL."""
        cid = (client_id or os.environ.get("GITHUB_CLIENT_ID", "")).strip()
        if not cid:
            raise ValueError("GitHub Client ID is required. Please set GITHUB_CLIENT_ID in .env or pass client_id.")

        state = f"jarvis_gh_{int(time.time() * 1000)}"
        scopes = ["repo", "read:user", "user:email", "workflow", "gist"]
        params = {
            "client_id": cid,
            "state": state,
            "scope": " ".join(scopes),
            "allow_signup": "true",
        }
        if redirect_uri:
            params["redirect_uri"] = redirect_uri

        return f"https://github.com/login/oauth/authorize?{urlencode(params)}"

    async def exchange_auth_code(
        self,
        code: str,
        redirect_uri: str,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None
    ) -> Dict[str, Any]:
        """Exchange authorization code for GitHub access token."""
        cid = (client_id or os.environ.get("GITHUB_CLIENT_ID", "")).strip()
        sec = (client_secret or os.environ.get("GITHUB_CLIENT_SECRET", "")).strip()

        if not cid or not sec:
            raise ValueError("GitHub Client ID and Client Secret are required for code exchange.")

        payload = {
            "client_id": cid,
            "client_secret": sec,
            "code": code,
            "redirect_uri": redirect_uri,
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                "https://github.com/login/oauth/access_token",
                data=payload,
                headers={"Accept": "application/json", "User-Agent": "JARVIS-Python-Core/1.0"}
            )
            if res.status_code != 200:
                raise RuntimeError(f"GitHub token exchange failed (HTTP {res.status_code}): {res.text}")

            data = res.json()
            if data.get("error"):
                raise RuntimeError(f"GitHub token error: {data.get('error_description') or data.get('error')}")

            access_token = data.get("access_token", "")
            if not access_token:
                raise RuntimeError("Invalid response from GitHub: missing access_token")

            saved = await self.save_auth({
                "accessToken": access_token,
                "tokenType": data.get("token_type", "bearer"),
                "scope": data.get("scope", ""),
            })
            return saved

    async def list_my_repos(self, limit: int = 10, sort: str = "updated") -> List[Dict[str, Any]]:
        """List authenticated user's repositories."""
        token = self.get_access_token()
        if not token:
            raise ValueError("GitHub not connected. Please authenticate first.")

        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "JARVIS-Python-Core/1.0",
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                f"https://api.github.com/user/repos?per_page={limit}&sort={sort}",
                headers=headers
            )
            if res.status_code == 200:
                raw = res.json()
                return [
                    {
                        "id": r.get("id"),
                        "name": r.get("name"),
                        "fullName": r.get("full_name"),
                        "description": r.get("description"),
                        "htmlUrl": r.get("html_url"),
                        "isPrivate": r.get("private", False),
                        "stargazersCount": r.get("stargazers_count", 0),
                        "forksCount": r.get("forks_count", 0),
                        "language": r.get("language"),
                        "updatedAt": r.get("updated_at"),
                    }
                    for r in raw
                ]
            raise RuntimeError(f"Failed to fetch repositories (HTTP {res.status_code}): {res.text}")

    async def create_issue(self, owner: str, repo: str, title: str, body: str = "", labels: Optional[List[str]] = None) -> Dict[str, Any]:
        """Create an issue in a GitHub repository."""
        token = self.get_access_token()
        if not token:
            raise ValueError("GitHub not connected. Please authenticate first.")

        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "JARVIS-Python-Core/1.0",
        }
        payload: Dict[str, Any] = {"title": title, "body": body}
        if labels:
            payload["labels"] = labels

        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(f"https://api.github.com/repos/{owner}/{repo}/issues", json=payload, headers=headers)
            if res.status_code == 201:
                data = res.json()
                return {
                    "id": data.get("id"),
                    "number": data.get("number"),
                    "title": data.get("title"),
                    "htmlUrl": data.get("html_url"),
                    "state": data.get("state"),
                    "createdAt": data.get("created_at"),
                }
            raise RuntimeError(f"Failed to create issue (HTTP {res.status_code}): {res.text}")

    async def create_gist(self, description: str, files: Dict[str, Dict[str, str]], is_public: bool = False) -> Dict[str, Any]:
        """Create a GitHub Gist."""
        token = self.get_access_token()
        if not token:
            raise ValueError("GitHub not connected. Please authenticate first.")

        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "JARVIS-Python-Core/1.0",
        }
        payload = {
            "description": description,
            "public": is_public,
            "files": files,
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post("https://api.github.com/gists", json=payload, headers=headers)
            if res.status_code == 201:
                data = res.json()
                return {
                    "id": data.get("id"),
                    "htmlUrl": data.get("html_url"),
                    "description": data.get("description"),
                    "createdAt": data.get("created_at"),
                }
            raise RuntimeError(f"Failed to create Gist (HTTP {res.status_code}): {res.text}")


github_service = GitHubService.get_instance()
