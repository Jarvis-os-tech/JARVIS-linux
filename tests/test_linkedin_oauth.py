#!/usr/bin/env python3
"""
Unit tests for J.A.R.V.I.S. LinkedIn OAuth Flow script
"""

import json
import os
import sqlite3
import sys
import unittest
import urllib.parse
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from linkedin_oauth_flow import (
    generate_authorization_url,
    save_to_jarvis_sqlite,
    save_to_json_file,
    DEFAULT_SCOPES
)


class TestLinkedInOAuthFlow(unittest.TestCase):

    def test_authorization_url_generation(self):
        client_id = "test_client_id_123"
        redirect_uri = "http://localhost:8080/callback"
        state = "secure_csrf_state_abc"
        scopes = ["openid", "profile", "email", "w_member_social"]

        url = generate_authorization_url(client_id, redirect_uri, state, scopes)
        parsed = urllib.parse.urlparse(url)
        params = urllib.parse.parse_qs(parsed.query)

        self.assertEqual(parsed.scheme, "https")
        self.assertEqual(parsed.netloc, "www.linkedin.com")
        self.assertEqual(parsed.path, "/oauth/v2/authorization")
        self.assertEqual(params.get("response_type"), ["code"])
        self.assertEqual(params.get("client_id"), [client_id])
        self.assertEqual(params.get("redirect_uri"), [redirect_uri])
        self.assertEqual(params.get("state"), [state])
        self.assertEqual(params.get("scope"), ["openid profile email w_member_social"])

    def test_sqlite_and_json_persistence(self):
        test_payload = {
            "accessToken": "AQV_mock_python_test_token",
            "name": "Bruce Wayne",
            "email": "bruce@wayneenterprises.com",
            "userUrn": "urn:li:person:wayne777",
            "scope": "openid profile email w_member_social",
            "updatedAt": 1723812345000
        }

        # Test SQLite saving
        saved_db = save_to_jarvis_sqlite(test_payload)
        self.assertTrue(saved_db, "Should save payload to data/jarvis.db SQLite database")

        # Verify record in SQLite database
        db_path = Path.cwd() / "data" / "jarvis.db"
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        cursor.execute("SELECT value_json FROM configs WHERE key = 'linkedin_auth'")
        row = cursor.fetchone()
        conn.close()

        self.assertIsNotNone(row, "Should find linkedin_auth key in configs table")
        parsed_db_value = json.loads(row[0])
        self.assertEqual(parsed_db_value["accessToken"], "AQV_mock_python_test_token")
        self.assertEqual(parsed_db_value["name"], "Bruce Wayne")

        # Test JSON file saving
        json_file = save_to_json_file(test_payload)
        self.assertTrue(os.path.exists(json_file), "Should create JSON file")
        with open(json_file, "r") as f:
            data = json.load(f)
        self.assertEqual(data["email"], "bruce@wayneenterprises.com")


if __name__ == "__main__":
    unittest.main()
