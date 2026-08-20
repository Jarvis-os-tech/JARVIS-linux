#!/usr/bin/env python3
"""
Unit and Integration Tests for J.A.R.V.I.S. Google Workspace OAuth 2.0 Local Engine
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

from scripts.google_oauth_flow import (
    DEFAULT_SCOPES,
    generate_authorization_url,
    save_to_jarvis_sqlite,
    save_to_json_file,
    load_env_file,
)


class TestGoogleOAuthEngine(unittest.TestCase):

    def setUp(self):
        self.client_id = "test_google_client_id_123.apps.googleusercontent.com"
        self.client_secret = "test_google_client_secret_xyz"
        self.redirect_uri = "http://localhost:8080/callback"
        self.state = "test_secure_state_token_abc"
        self.scopes = DEFAULT_SCOPES

    def test_generate_authorization_url(self):
        """Verify Google authorization URL structure, parameters, and scopes."""
        url = generate_authorization_url(self.client_id, self.redirect_uri, self.state, self.scopes)

        parsed = urlparse(url)
        self.assertEqual(parsed.scheme, "https")
        self.assertEqual(parsed.netloc, "accounts.google.com")
        self.assertEqual(parsed.path, "/o/oauth2/v2/auth")

        params = parse_qs(parsed.query)
        self.assertEqual(params.get("client_id"), [self.client_id])
        self.assertEqual(params.get("redirect_uri"), [self.redirect_uri])
        self.assertEqual(params.get("state"), [self.state])
        self.assertEqual(params.get("response_type"), ["code"])
        self.assertEqual(params.get("access_type"), ["offline"])
        self.assertEqual(params.get("prompt"), ["consent"])

        # Validate scope formatting
        scope_str = params.get("scope", [""])[0]
        self.assertIn("drive", scope_str)
        self.assertIn("calendar", scope_str)
        self.assertIn("gmail", scope_str)

    def test_sqlite_and_json_persistence(self):
        """Verify local-first SQLite persistence and JSON file backup for Google auth in isolated sandbox."""
        import tempfile
        with tempfile.TemporaryDirectory() as tmp_dir:
            test_db_path = Path(tmp_dir) / "test_jarvis.db"
            test_json_path = Path(tmp_dir) / "test_google_auth.json"

            payload = {
                "accessToken": "ya29.mock_test_token_9999",
                "refreshToken": "1//mock_refresh_token_8888",
                "expiresAt": 1700003600000,
                "tokenType": "Bearer",
                "scope": "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/calendar",
                "name": "Bruce Wayne",
                "email": "bruce.wayne@gmail.com",
                "picture": "https://lh3.googleusercontent.com/a/mock_avatar",
                "updatedAt": 1700000000000,
            }

            # 1. Test SQLite persistence in isolated temp database
            db_saved = save_to_jarvis_sqlite(payload, target_db_path=test_db_path)
            self.assertTrue(db_saved, "Should successfully write to isolated SQLite database")

            # Verify record in SQLite database
            conn = sqlite3.connect(str(test_db_path))
            cursor = conn.cursor()
            cursor.execute("SELECT value_json FROM configs WHERE key = 'google_auth'")
            row = cursor.fetchone()
            conn.close()

            self.assertIsNotNone(row, "Record for google_auth must exist in configs table")
            saved_data = json.loads(row[0])
            self.assertEqual(saved_data.get("accessToken"), "ya29.mock_test_token_9999")
            self.assertEqual(saved_data.get("refreshToken"), "1//mock_refresh_token_8888")
            self.assertEqual(saved_data.get("email"), "bruce.wayne@gmail.com")
            self.assertEqual(saved_data.get("name"), "Bruce Wayne")

            # 2. Test JSON backup persistence in isolated temp file
            json_path = save_to_json_file(payload, target_json_path=test_json_path)
            self.assertTrue(Path(json_path).exists(), "JSON backup file must exist")

            with open(json_path, "r", encoding="utf-8") as f:
                file_data = json.load(f)

            self.assertEqual(file_data.get("accessToken"), "ya29.mock_test_token_9999")
            self.assertEqual(file_data.get("email"), "bruce.wayne@gmail.com")

    def test_load_env_file(self):
        """Verify automatic loading of Google credentials from .env."""
        env = load_env_file()
        self.assertIsInstance(env, dict)
        self.assertIn("VITE_GOOGLE_CLIENT_ID", env)
        self.assertTrue(env["VITE_GOOGLE_CLIENT_ID"].endswith(".apps.googleusercontent.com"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
