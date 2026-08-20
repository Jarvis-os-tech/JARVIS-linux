"""
LinkedIn Integration & OAuth 2.0 Service for J.A.R.V.I.S. Python Core Engine.
Provides autonomous career intelligence, profile analysis, post creation,
and OAuth 2.0 token handling.
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
TOKEN_FILE_PATH = os.path.join(DATA_DIR, "linkedin_auth.json")
DB_PATH = os.path.join(DATA_DIR, "jarvis.db")
CONFIG_KEY = "linkedin_auth"


class LinkedInService:
    _instance = None

    @classmethod
    def get_instance(cls) -> "LinkedInService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        self.auth_data: Optional[Dict[str, Any]] = None
        self.load_persisted_auth()

    def load_persisted_auth(self) -> Optional[Dict[str, Any]]:
        """Load LinkedIn credentials from JSON file, SQLite database, or environment."""
        # 1. JSON file
        try:
            if os.path.exists(TOKEN_FILE_PATH):
                with open(TOKEN_FILE_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                token = (data.get("accessToken") or data.get("access_token", "")).strip()
                if token or data.get("linkedApiToken"):
                    self.auth_data = {
                        "accessToken": token,
                        "refreshToken": data.get("refreshToken") or data.get("refresh_token"),
                        "expiresAt": data.get("expiresAt") or data.get("expires_at"),
                        "name": data.get("name", ""),
                        "email": data.get("email", ""),
                        "picture": data.get("picture", ""),
                        "userUrn": data.get("userUrn") or data.get("user_urn", ""),
                        "scope": data.get("scope", "openid profile email w_member_social"),
                        "linkedApiToken": data.get("linkedApiToken", ""),
                        "identificationToken": data.get("identificationToken", ""),
                        "updatedAt": data.get("updatedAt", int(time.time() * 1000)),
                    }
                    if token:
                        os.environ["LINKEDIN_ACCESS_TOKEN"] = token
                    return self.auth_data
        except Exception:
            pass

        # 2. SQLite jarvis.db configs table
        if os.path.exists(DB_PATH):
            try:
                conn = sqlite3.connect(DB_PATH)
                cur = conn.cursor()
                cur.execute("SELECT value_json FROM configs WHERE key = ?", (CONFIG_KEY,))
                row = cur.fetchone()
                conn.close()
                if row and row[0]:
                    db_data = json.loads(row[0])
                    token = (db_data.get("accessToken") or db_data.get("access_token", "")).strip()
                    if token or db_data.get("linkedApiToken"):
                        self.auth_data = db_data
                        if token:
                            os.environ["LINKEDIN_ACCESS_TOKEN"] = token
                        return self.auth_data
            except Exception:
                pass

        # 3. Environment variable fallback
        env_token = os.environ.get("LINKEDIN_ACCESS_TOKEN", "").strip()
        if env_token:
            self.auth_data = {
                "accessToken": env_token,
                "scope": "openid profile email w_member_social",
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
        has_token = bool(auth and auth.get("accessToken"))
        has_api_token = bool(auth and auth.get("linkedApiToken"))
        return {
            "connected": has_token or has_api_token,
            "hasAccessToken": has_token,
            "hasLinkedApiToken": has_api_token,
            "name": auth.get("name", "") if auth else "",
            "email": auth.get("email", "") if auth else "",
            "picture": auth.get("picture", "") if auth else "",
            "userUrn": auth.get("userUrn", "") if auth else "",
            "updatedAt": auth.get("updatedAt") if auth else None,
        }

    async def fetch_user_profile(self, token: str) -> Optional[Dict[str, Any]]:
        """Fetch user profile from LinkedIn OpenID UserInfo API."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                headers = {"Authorization": f"Bearer {token}"}
                res = await client.get("https://api.linkedin.com/v2/userinfo", headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    name = data.get("name") or f"{data.get('given_name', '')} {data.get('family_name', '')}".strip()
                    return {
                        "name": name,
                        "email": data.get("email", ""),
                        "picture": data.get("picture", ""),
                        "userUrn": f"urn:li:person:{data.get('sub')}" if data.get("sub") else "",
                    }
        except Exception as e:
            print(f"[LinkedInService] User profile fetch notice: {e}")
        return None

    async def save_auth(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Save LinkedIn credentials to JSON file, SQLite, and environment."""
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
            os.environ["LINKEDIN_ACCESS_TOKEN"] = token
            profile = await self.fetch_user_profile(token)
            if profile:
                merged["name"] = profile.get("name") or merged.get("name", "")
                merged["email"] = profile.get("email") or merged.get("email", "")
                merged["picture"] = profile.get("picture") or merged.get("picture", "")
                if profile.get("userUrn"):
                    merged["userUrn"] = profile["userUrn"]

        self.auth_data = merged

        # 1. Save JSON backup
        try:
            with open(TOKEN_FILE_PATH, "w", encoding="utf-8") as f:
                json.dump(merged, f, indent=2)
        except Exception as e:
            print(f"[LinkedInService] Error saving JSON: {e}")

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
            print(f"[LinkedInService] SQLite save warning: {e}")

        return merged

    def disconnect(self) -> None:
        """Disconnect LinkedIn credentials."""
        self.auth_data = None
        os.environ.pop("LINKEDIN_ACCESS_TOKEN", None)
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

    def get_authorization_url(self, redirect_uri: str, client_id: Optional[str] = None) -> str:
        """Generate LinkedIn OAuth 2.0 Authorization URL."""
        cid = (client_id or os.environ.get("LINKEDIN_CLIENT_ID", "")).strip()
        if not cid or cid in ["your_client_id", "your_linkedin_client_id", "YOUR_CLIENT_ID"]:
            raise ValueError("LinkedIn OAuth App Client ID is not configured. Please paste your direct LinkedIn Access Token in the token box, or set LINKEDIN_CLIENT_ID in .env.")

        state = f"jarvis_li_{int(time.time() * 1000)}"
        scopes = ["openid", "profile", "email", "w_member_social"]
        params = {
            "response_type": "code",
            "client_id": cid,
            "redirect_uri": redirect_uri,
            "state": state,
            "scope": " ".join(scopes),
        }
        return f"https://www.linkedin.com/oauth/v2/authorization?{urlencode(params)}"

    async def exchange_auth_code(
        self,
        code: str,
        redirect_uri: str,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None
    ) -> Dict[str, Any]:
        """Exchange authorization code for LinkedIn access token."""
        cid = (client_id or os.environ.get("LINKEDIN_CLIENT_ID", "")).strip()
        sec = (client_secret or os.environ.get("LINKEDIN_CLIENT_SECRET", "")).strip()

        if not cid or not sec:
            raise ValueError("LinkedIn Client ID and Client Secret are required for code exchange.")

        payload = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": cid,
            "client_secret": sec,
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                "https://www.linkedin.com/oauth/v2/accessToken",
                data=payload,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            if res.status_code != 200:
                raise RuntimeError(f"LinkedIn token exchange failed (HTTP {res.status_code}): {res.text}")

            data = res.json()
            access_token = data.get("access_token", "")
            if not access_token:
                raise RuntimeError("Invalid response from LinkedIn: missing access_token")

            expires_in = data.get("expires_in", 5184000)
            expires_at = int(time.time() * 1000) + (expires_in * 1000)

            saved = await self.save_auth({
                "accessToken": access_token,
                "refreshToken": data.get("refresh_token"),
                "expiresAt": expires_at,
                "scope": data.get("scope", ""),
            })
            return saved

    async def create_post(self, text: str, visibility: str = "PUBLIC") -> Dict[str, Any]:
        """Create a post on LinkedIn."""
        token = self.get_access_token()
        if not token:
            raise ValueError("LinkedIn not connected. Please authenticate first.")

        user_urn = self.auth_data.get("userUrn") if self.auth_data else ""
        if not user_urn:
            profile = await self.fetch_user_profile(token)
            if profile and profile.get("userUrn"):
                user_urn = profile["userUrn"]

        if not user_urn:
            raise ValueError("Could not determine user URN for LinkedIn post. Please re-authenticate.")

        payload = {
            "author": user_urn,
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {"text": text},
                    "shareMediaCategory": "NONE",
                }
            },
            "visibility": {
                "com.linkedin.ugc.MemberNetworkVisibility": visibility
            },
        }

        headers = {
            "Authorization": f"Bearer {token}",
            "X-Restli-Protocol-Version": "2.0.0",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post("https://api.linkedin.com/v2/ugcPosts", json=payload, headers=headers)
            if res.status_code in (200, 201):
                data = res.json()
                return {"success": True, "id": data.get("id"), "message": "Post published to LinkedIn"}
            raise RuntimeError(f"LinkedIn post creation failed (HTTP {res.status_code}): {res.text}")


linkedin_service = LinkedInService.get_instance()
