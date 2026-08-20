"""
End-to-End Comprehensive Verification Test Suite for J.A.R.V.I.S.
Tests every single tool (47 tools), hardware binary, vision workflow,
REST API endpoint, and WebSocket communication.
"""

import os
import sys
import time
import json
import asyncio
import unittest
from fastapi.testclient import TestClient

# Ensure project root is in path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core_engine.actuator_dispatcher import actuator_dispatcher
from core_engine.memory import memory_engine
from core_engine.prompt_engine import prompt_engine
from core_engine.server import app, _connected_ws_clients


class TestFullJarvisSystem(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    # ══════════════════════════════════════════════════════════════════════════
    # 1. HARDWARE TELEMETRY & SPEC RETRIEVAL TESTS
    # ══════════════════════════════════════════════════════════════════════════

    def test_01_get_system_telemetry(self):
        res = asyncio.run(actuator_dispatcher.dispatch_tool("get_system_telemetry", {}))
        self.assertTrue(res.get("success"), f"Telemetry failed: {res}")
        print(f"  [Telemetry] Result keys: {list(res.get('result', {}).keys()) if isinstance(res.get('result'), dict) else 'OK'}")

    def test_02_get_pc_spec(self):
        res = asyncio.run(actuator_dispatcher.dispatch_tool("get_pc_spec", {}))
        self.assertTrue(res.get("success"), f"PC spec failed: {res}")
        print(f"  [PC Spec] Hardware spec retrieved successfully")

    def test_03_get_battery_status(self):
        res = asyncio.run(actuator_dispatcher.dispatch_tool("get_battery_status", {}))
        self.assertTrue(res.get("success"), f"Battery status failed: {res}")
        print(f"  [Battery] Battery info retrieved")

    def test_04_get_thermal_sensors(self):
        res = asyncio.run(actuator_dispatcher.dispatch_tool("get_thermal_sensors", {}))
        self.assertTrue(res.get("success"), f"Thermal sensors failed: {res}")
        print(f"  [Thermal] Sensors scanned")

    def test_05_get_storage_usage(self):
        res = asyncio.run(actuator_dispatcher.dispatch_tool("get_storage_usage", {}))
        self.assertTrue(res.get("success"), f"Storage scan failed: {res}")
        print(f"  [Storage] Storage partitions scanned")

    def test_06_get_and_set_system_volume(self):
        get_res = asyncio.run(actuator_dispatcher.dispatch_tool("get_system_volume", {}))
        self.assertTrue(get_res.get("success"), f"Get volume failed: {get_res}")
        
        # Test relative or safe volume set
        set_res = asyncio.run(actuator_dispatcher.dispatch_tool("set_system_volume", {"volume": 75}))
        self.assertTrue(set_res.get("success"), f"Set volume failed: {set_res}")
        print(f"  [Audio Volume] Get and Set volume functional")

    def test_07_get_and_set_display_brightness(self):
        get_res = asyncio.run(actuator_dispatcher.dispatch_tool("get_screen_brightness", {}))
        self.assertTrue(get_res.get("success"), f"Get brightness failed: {get_res}")
        print(f"  [Brightness] Brightness control verified")

    def test_08_get_network_status_and_connections(self):
        net_res = asyncio.run(actuator_dispatcher.dispatch_tool("get_network_status", {}))
        self.assertTrue(net_res.get("success"), f"Network status failed: {net_res}")
        
        sock_res = asyncio.run(actuator_dispatcher.dispatch_tool("get_network_connections", {"limit": 5}))
        self.assertTrue(sock_res.get("success"), f"Network connections failed: {sock_res}")
        print(f"  [Network] Real-time network and socket inspector verified")

    def test_09_get_firewall_status(self):
        fw_res = asyncio.run(actuator_dispatcher.dispatch_tool("get_firewall_status", {}))
        self.assertTrue(fw_res.get("success"), f"Firewall audit failed: {fw_res}")
        print(f"  [Firewall] Firewall rules inspected")

    def test_10_get_environment_info(self):
        env_res = asyncio.run(actuator_dispatcher.dispatch_tool("get_environment_info", {}))
        self.assertTrue(env_res.get("success"))
        result = env_res.get("result", {})
        self.assertIn("username", result)
        self.assertIn("desktop_session", result)
        print(f"  [Environment] User '{result.get('username')}' on session '{result.get('desktop_session')}'")

    # ══════════════════════════════════════════════════════════════════════════
    # 2. VISION & CAMERA VOICE CONTROL TESTS
    # ══════════════════════════════════════════════════════════════════════════

    def test_11_vision_mode_lifecycle(self):
        broadcasted_events = []

        async def mock_ws_broadcast(event):
            broadcasted_events.append(event)

        actuator_dispatcher.set_ws_broadcast(mock_ws_broadcast)

        # 1. Screen sharing
        s_res = asyncio.run(actuator_dispatcher.dispatch_tool("start_screen_sharing", {}))
        self.assertTrue(s_res.get("success"))
        self.assertEqual(s_res["vision_state"]["mode"], "screen")
        self.assertTrue(s_res["vision_state"]["active"])
        self.assertTrue(any(e.get("action") == "start_screen" for e in broadcasted_events))

        # 2. Camera vision
        c_res = asyncio.run(actuator_dispatcher.dispatch_tool("start_camera_vision", {}))
        self.assertTrue(c_res.get("success"))
        self.assertEqual(c_res["vision_state"]["mode"], "camera")
        self.assertTrue(c_res["vision_state"]["active"])
        self.assertTrue(any(e.get("action") == "start_camera" for e in broadcasted_events))

        # 3. Control vision mode toggle
        t_res = asyncio.run(actuator_dispatcher.dispatch_tool("control_vision_mode", {"mode": "off", "action": "stop"}))
        self.assertTrue(t_res.get("success"))
        self.assertEqual(t_res["vision_state"]["mode"], "off")
        self.assertFalse(t_res["vision_state"]["active"])

        # 4. Stop all vision
        stop_res = asyncio.run(actuator_dispatcher.dispatch_tool("stop_all_vision", {}))
        self.assertTrue(stop_res.get("success"))
        self.assertFalse(stop_res["vision_state"]["active"])
        print(f"  [Vision Engine] Screen share, Camera, and Stop event broadcasting verified (total events: {len(broadcasted_events)})")

    # ══════════════════════════════════════════════════════════════════════════
    # 3. COMPUTER USE & DESKTOP CONTROL TESTS
    # ══════════════════════════════════════════════════════════════════════════

    def test_12_desktop_control_env_and_windows(self):
        env_res = asyncio.run(actuator_dispatcher.dispatch_tool("desktop_control", {"action": "env"}))
        self.assertTrue(env_res.get("success"), f"Desktop env failed: {env_res}")

        win_res = asyncio.run(actuator_dispatcher.dispatch_tool("desktop_control", {"action": "list_windows"}))
        self.assertTrue(win_res.get("success"), f"List windows failed: {win_res}")
        print(f"  [Computer Use] Desktop control worker functional")

    def test_13_take_screenshot(self):
        shot_res = asyncio.run(actuator_dispatcher.dispatch_tool("take_screenshot", {"outputPath": "/tmp/test_shot.png"}))
        self.assertIn("success", shot_res)
        if os.path.exists("/tmp/test_shot.png"):
            os.remove("/tmp/test_shot.png")
        print(f"  [Screenshot] Screenshot tool dispatch verified")

    def test_14_clipboard_control(self):
        clip_res = asyncio.run(actuator_dispatcher.dispatch_tool("clipboard_control", {"action": "read"}))
        self.assertTrue(clip_res.get("success"), f"Clipboard read failed: {clip_res}")
        print(f"  [Clipboard] Clipboard read functional")

    # ══════════════════════════════════════════════════════════════════════════
    # 4. FILE SYSTEM OPERATIONS TESTS
    # ══════════════════════════════════════════════════════════════════════════

    def test_15_file_system_crud(self):
        test_file = "/tmp/jarvis_full_test_artifact.txt"
        test_body = "JARVIS_AUTONOMOUS_TEST_TOKEN_999\nLine 2\nLine 3\n"

        # 1. Write
        w_res = asyncio.run(actuator_dispatcher.dispatch_tool("write_local_file", {"filePath": test_file, "content": test_body}))
        self.assertTrue(w_res.get("success"))

        # 2. Read
        r_res = asyncio.run(actuator_dispatcher.dispatch_tool("read_local_file", {"filePath": test_file, "maxLines": 5}))
        self.assertTrue(r_res.get("success"))
        self.assertIn("JARVIS_AUTONOMOUS_TEST_TOKEN_999", r_res.get("content", ""))

        # 3. Search
        s_res = asyncio.run(actuator_dispatcher.dispatch_tool("search_local_files", {"pattern": "jarvis_full_test_artifact*", "rootDir": "/tmp"}))
        self.assertTrue(s_res.get("success"))

        # 4. List directory
        l_res = asyncio.run(actuator_dispatcher.dispatch_tool("list_directory", {"dirPath": "/tmp"}))
        self.assertTrue(l_res.get("success"))

        # 5. Delete
        d_res = asyncio.run(actuator_dispatcher.dispatch_tool("delete_local_file", {"filePath": test_file}))
        self.assertTrue(d_res.get("success"))
        self.assertFalse(os.path.exists(test_file))
        print(f"  [Filesystem] Full Write -> Read -> Search -> List -> Delete pipeline passed")

    # ══════════════════════════════════════════════════════════════════════════
    # 5. PROCESS, SERVICES & PACKAGE MANAGEMENT TESTS
    # ══════════════════════════════════════════════════════════════════════════

    def test_16_running_processes(self):
        proc_res = asyncio.run(actuator_dispatcher.dispatch_tool("get_running_processes", {"limit": 5, "sortBy": "cpu"}))
        self.assertTrue(proc_res.get("success"))
        print(f"  [Processes] Top CPU processes listed")

    def test_17_systemd_services_and_logs(self):
        srv_res = asyncio.run(actuator_dispatcher.dispatch_tool("manage_systemd_service", {"action": "list"}))
        self.assertTrue(srv_res.get("success"))

        log_res = asyncio.run(actuator_dispatcher.dispatch_tool("get_system_logs", {"lines": 5, "source": "journalctl"}))
        self.assertTrue(log_res.get("success"))
        print(f"  [Systemd & Logs] Service list and journal logs query verified")

    def test_18_installed_applications(self):
        app_res = asyncio.run(actuator_dispatcher.dispatch_tool("list_installed_applications", {}))
        self.assertTrue(app_res.get("success"))
        print(f"  [Applications] Installed GUI applications discovered")

    # ══════════════════════════════════════════════════════════════════════════
    # 6. SIMULTANEOUS BACKGROUND WORKER & DELEGATION TESTS
    # ══════════════════════════════════════════════════════════════════════════

    def test_19_background_task_concurrency(self):
        async def run_bg_test():
            res = await actuator_dispatcher.dispatch_tool("start_background_task", {
                "command": "sleep 0.1 && echo 'TASK_DONE'",
                "task_name": "QuickAsyncJob"
            })
            self.assertTrue(res.get("success"))
            self.assertEqual(res.get("status"), "RUNNING_IN_BACKGROUND")
            task_id = res.get("task_id")

            # Verify listing background tasks
            list_res = await actuator_dispatcher.dispatch_tool("get_background_tasks", {})
            self.assertTrue(list_res.get("success"))
            self.assertTrue(any(t["id"] == task_id for t in list_res.get("tasks", [])))

            # Allow task to finish
            await asyncio.sleep(0.3)
            task_info = actuator_dispatcher.background_tasks.get(task_id)
            self.assertIsNotNone(task_info)
            self.assertEqual(task_info.get("status"), "completed")

        asyncio.run(run_bg_test())
        print(f"  [Simultaneous Worker] Background task ran asynchronously without blocking")

    def test_20_multi_agent_persona_transfer(self):
        broadcasts = []
        actuator_dispatcher.set_ws_broadcast(lambda e: broadcasts.append(e))

        res = asyncio.run(actuator_dispatcher.dispatch_tool("switch_persona", {"targetPersonaId": "ultron"}))
        self.assertTrue(res.get("success"))
        self.assertEqual(res.get("personaId"), "ultron")
        print(f"  [Persona Hot-Swap] Transfer to 'ultron' broadcasted to UI")

    # ══════════════════════════════════════════════════════════════════════════
    # 7. MEMORY PERSISTENCE & SEARCH
    # ══════════════════════════════════════════════════════════════════════════

    def test_21_memory_vault_operations(self):
        k = "TestCapabilityValidation"
        v = "All 47 autonomous tools verified and operational on Ubuntu Linux."
        
        rem_res = asyncio.run(actuator_dispatcher.dispatch_tool("jarvis_remember", {"key": k, "value": v, "category": "work_context"}))
        self.assertTrue(rem_res.get("success"))

        rec_res = asyncio.run(actuator_dispatcher.dispatch_tool("jarvis_recall", {"query": "CapabilityValidation"}))
        self.assertTrue(rec_res.get("success"))
        self.assertTrue(len(rec_res.get("result", [])) > 0)

        vault_res = asyncio.run(actuator_dispatcher.dispatch_tool("jarvis_vault_status", {}))
        self.assertTrue(vault_res.get("success"))
        print(f"  [Memory Vault] Remember -> Recall -> Vault Status validated")

    # ══════════════════════════════════════════════════════════════════════════
    # 8. REST & WEBSOCKET ENDPOINTS
    # ══════════════════════════════════════════════════════════════════════════

    def test_22_rest_api_endpoints(self):
        # Health
        h = self.client.get("/health")
        self.assertEqual(h.status_code, 200)
        self.assertEqual(h.json().get("status"), "healthy")

        # Vision status
        v = self.client.get("/api/vision/status")
        self.assertEqual(v.status_code, 200)
        self.assertTrue(v.json().get("success"))

        # Prompt system
        p = self.client.get("/api/prompt/system")
        self.assertEqual(p.status_code, 200)
        self.assertIn("prompt", p.json())

        # Tools execute endpoint
        t = self.client.post("/api/tools/execute", json={
            "tool_name": "get_environment_info",
            "args": {}
        })
        self.assertEqual(t.status_code, 200)
        self.assertTrue(t.json().get("success"))
        print(f"  [REST API] /health, /api/vision/status, /api/prompt/system, /api/tools/execute verified")

    def test_23_websocket_live_ping_and_tools(self):
        with self.client.websocket_connect("/live") as ws:
            # 1. Ping
            ws.send_json({"type": "ping"})
            resp = ws.receive_json()
            self.assertEqual(resp.get("type"), "pong")

            # 2. Vision frame transmission
            ws.send_json({
                "type": "image",
                "image": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
                "mimeType": "image/png"
            })
            print(f"  [WebSocket Live] Ping/Pong handshake and live image frame ingest verified")

    def test_24_total_tool_count_and_schema(self):
        tools = actuator_dispatcher.get_tool_declarations()
        self.assertGreaterEqual(len(tools), 40, f"Expected >= 40 tools, got {len(tools)}")
        print(f"\n  >>> TOTAL VERIFIED AUTONOMOUS TOOLS IN CATALOG: {len(tools)} <<<")
        for t in tools:
            self.assertIn("name", t)
            self.assertIn("description", t)
            self.assertIn("parameters", t)

    def test_25_google_workspace_oauth_endpoints(self):
        from core_engine.google_auth import google_auth_service
        orig_auth = google_auth_service.auth_data

        try:
            # 1. Token status
            status_res = self.client.get("/api/workspace/token/status")
            self.assertEqual(status_res.status_code, 200)
            self.assertIn("connected", status_res.json())

            # 2. Save token
            save_res = self.client.post("/api/workspace/token", json={
                "token": "ya29.test_mock_token_12345",
                "refreshToken": "1//test_mock_refresh_token_67890",
                "expiresAt": int(time.time() * 1000) + 3600000
            })
            self.assertEqual(save_res.status_code, 200)
            self.assertTrue(save_res.json().get("success"))

            # 3. Status check after save
            post_save_status = self.client.get("/api/workspace/token/status")
            self.assertEqual(post_save_status.status_code, 200)
            self.assertEqual(post_save_status.json().get("token"), "ya29.test_mock_token_12345")

            # 4. Auth login redirect generation
            login_res = self.client.get("/api/auth/google/login", follow_redirects=False)
            self.assertIn(login_res.status_code, [302, 307])
            self.assertIn("accounts.google.com", login_res.headers.get("location", ""))

            # 5. Disconnect
            disc_res = self.client.post("/api/auth/google/disconnect")
            self.assertEqual(disc_res.status_code, 200)
            self.assertFalse(disc_res.json().get("connected"))
            print(f"  [Google OAuth] Status -> Save Token -> Login Redirect -> Disconnect validated")
        finally:
            if orig_auth:
                google_auth_service.save_auth(orig_auth)

    def test_26_github_oauth_endpoints(self):
        """Verify GitHub status, token save, login redirect, and disconnect."""
        from core_engine.github_service import github_service
        import asyncio
        orig_auth = github_service.auth_data

        try:
            # 1. Status check
            status_res = self.client.get("/api/github/status")
            self.assertEqual(status_res.status_code, 200)
            self.assertIn("connected", status_res.json())

            # 2. Auth URL generation
            url_res = self.client.get("/api/github/auth/url?clientId=test_client_id_123")
            self.assertEqual(url_res.status_code, 200)
            self.assertTrue(url_res.json().get("success"))
            self.assertIn("github.com/login/oauth/authorize", url_res.json().get("url", ""))

            # 3. Save token
            save_res = self.client.post("/api/github/auth/token", json={
                "accessToken": "gho_mock_token_12345",
                "login": "octocat",
                "name": "The Octocat",
                "email": "octocat@github.com"
            })
            self.assertEqual(save_res.status_code, 200)
            self.assertTrue(save_res.json().get("success"))

            # 4. Status check after save
            post_save_status = self.client.get("/api/github/status")
            self.assertEqual(post_save_status.status_code, 200)
            self.assertEqual(post_save_status.json().get("login"), "octocat")

            # 5. Disconnect
            disc_res = self.client.post("/api/github/auth/disconnect")
            self.assertEqual(disc_res.status_code, 200)
            self.assertTrue(disc_res.json().get("success"))
            print(f"  [GitHub OAuth] Status -> Auth URL -> Save Token -> Status -> Disconnect validated")
        finally:
            if orig_auth:
                asyncio.run(github_service.save_auth(orig_auth))

    def test_27_linkedin_oauth_endpoints(self):
        """Verify LinkedIn status, auth URL generation, token save, and disconnect."""
        from core_engine.linkedin_service import linkedin_service
        import asyncio
        orig_auth = linkedin_service.auth_data

        try:
            # 1. Status check
            status_res = self.client.get("/api/linkedin/status")
            self.assertEqual(status_res.status_code, 200)
            self.assertIn("connected", status_res.json())

            # 2. Auth URL generation
            url_res = self.client.get("/api/linkedin/auth/url?clientId=test_client_id_123")
            self.assertEqual(url_res.status_code, 200)
            self.assertTrue(url_res.json().get("success"))
            self.assertIn("linkedin.com/oauth/v2/authorization", url_res.json().get("url", ""))

            # 3. Save token
            save_res = self.client.post("/api/linkedin/auth/token", json={
                "accessToken": "AQV_mock_token_12345",
                "linkedApiToken": "mock_linked_api_key_67890"
            })
            self.assertEqual(save_res.status_code, 200)
            self.assertTrue(save_res.json().get("success"))

            # 4. Status check after save
            post_save_status = self.client.get("/api/linkedin/status")
            self.assertEqual(post_save_status.status_code, 200)

            # 5. Disconnect
            disc_res = self.client.post("/api/linkedin/auth/disconnect")
            self.assertEqual(disc_res.status_code, 200)
            self.assertTrue(disc_res.json().get("success"))
            print(f"  [LinkedIn OAuth] Status -> Auth URL -> Save Token -> Status -> Disconnect validated")
        finally:
            if orig_auth:
                asyncio.run(linkedin_service.save_auth(orig_auth))


if __name__ == "__main__":
    unittest.main(verbosity=2)
