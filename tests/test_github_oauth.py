#!/usr/bin/env python3
"""
Unit and Integration Tests for J.A.R.V.I.S. GitHub OAuth 2.0 Local Engine
"""

import json
import os
import sqlite3
import sys
import unittest
from pathlib import Path
from urllib.parse import parse_qs, urlparse

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.github_oauth_flow import (
    DEFAULT_SCOPES,
    generate_authorization_url,
    save_to_jarvis_sqlite,
    save_to_json_file,
    load_env_file,
)


class TestGitHubOAuthEngine(unittest.TestCase):

    def setUp(self):
        self.client_id = "test_github_client_id_123"
        self.client_secret = "test_github_client_secret_xyz"
        self.redirect_uri = "http://localhost:8080/callback"
        self.state = "test_secure_state_token_abc"
        self.scopes = ["repo", "read:user", "user:email", "workflow", "gist"]

    def test_generate_authorization_url(self):
        """Verify GitHub authorization URL structure, parameters, and scopes."""
        url = generate_authorization_url(self.client_id, self.redirect_uri, self.state, self.scopes)

        parsed = urlparse(url)
        self.assertEqual(parsed.scheme, "https")
        self.assertEqual(parsed.netloc, "github.com")
        self.assertEqual(parsed.path, "/login/oauth/authorize")

        params = parse_qs(parsed.query)
        self.assertEqual(params.get("client_id"), [self.client_id])
        self.assertEqual(params.get("redirect_uri"), [self.redirect_uri])
        self.assertEqual(params.get("state"), [self.state])
        self.assertEqual(params.get("allow_signup"), ["true"])

        # Validate scope formatting
        scope_str = params.get("scope", [""])[0]
        for s in self.scopes:
            self.assertIn(s, scope_str)

    def test_sqlite_and_json_persistence(self):
        """Verify local-first SQLite persistence and JSON file backup in isolated sandbox."""
        import tempfile
        with tempfile.TemporaryDirectory() as tmp_dir:
            test_db_path = Path(tmp_dir) / "test_jarvis.db"
            test_json_path = Path(tmp_dir) / "test_github_auth.json"

            payload = {
                "accessToken": "gho_mock_test_token_9999",
                "tokenType": "bearer",
                "scope": "repo read:user user:email",
                "login": "octocat",
                "name": "The Octocat",
                "email": "octocat@github.com",
                "avatarUrl": "https://avatars.githubusercontent.com/u/583231",
                "htmlUrl": "https://github.com/octocat",
                "publicRepos": 8,
                "updatedAt": 1700000000000,
            }

            # 1. Test SQLite persistence in isolated temp DB
            db_saved = save_to_jarvis_sqlite(payload, target_db_path=test_db_path)
            self.assertTrue(db_saved, "Should successfully write to isolated SQLite database")

            # Verify record in SQLite database
            conn = sqlite3.connect(str(test_db_path))
            cursor = conn.cursor()
            cursor.execute("SELECT value_json FROM configs WHERE key = 'github_auth'")
            row = cursor.fetchone()
            conn.close()

            self.assertIsNotNone(row, "Record for github_auth must exist in configs table")
            saved_data = json.loads(row[0])
            self.assertEqual(saved_data.get("accessToken"), "gho_mock_test_token_9999")
            self.assertEqual(saved_data.get("login"), "octocat")
            self.assertEqual(saved_data.get("name"), "The Octocat")
            self.assertEqual(saved_data.get("email"), "octocat@github.com")

            # 2. Test JSON backup persistence in isolated temp file
            json_path = save_to_json_file(payload, target_json_path=test_json_path)
            self.assertTrue(Path(json_path).exists(), "JSON backup file must exist")

            with open(json_path, "r", encoding="utf-8") as f:
                file_data = json.load(f)

            self.assertEqual(file_data.get("accessToken"), "gho_mock_test_token_9999")
            self.assertEqual(file_data.get("login"), "octocat")

    def test_load_env_file(self):
        """Verify automatic loading of GitHub credentials from .env."""
        env_dict = load_env_file()
        self.assertIn("GITHUB_CLIENT_ID", env_dict)
        self.assertIn("GITHUB_CLIENT_SECRET", env_dict)
        self.assertEqual(env_dict["GITHUB_CLIENT_ID"], "Ov23liEyk0j57E8F7Fe7")


if __name__ == "__main__":
    unittest.main()
