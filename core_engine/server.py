"""
FastAPI Server & REST / WebSocket API for J.A.R.V.I.S. Python Core.
Serves the React 19 UI and bridges the /live WebSocket to Gemini Live.
"""

import os
import time
import json
import base64
import asyncio
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from pydantic import BaseModel

from .memory import memory_engine
from .actuator_dispatcher import actuator_dispatcher
from .prompt_engine import prompt_engine
from .audio_bridge import audio_bridge
from .gemini_live import gemini_session
from .google_auth import google_auth_service
from .github_service import github_service
from .linkedin_service import linkedin_service
from .telemetry_service import telemetry_service

app = FastAPI(title="J.A.R.V.I.S. Python Core Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

start_time = time.time()


class MemorySearchRequest(BaseModel):
    query: str
    limit: int = 8


class ToolExecuteRequest(BaseModel):
    tool_name: str
    args: Dict[str, Any] = {}


class MemoryFactRequest(BaseModel):
    key: str
    value: str
    category: str = "custom"


class SystemControlRequest(BaseModel):
    action: str
    percent: Optional[int] = None
    volume: Optional[int] = None
    brightness: Optional[int] = None
    mute: Optional[bool] = None
    toggleMute: Optional[bool] = None
    profile: Optional[str] = None
    powerAction: Optional[str] = None


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "engine": "python_core_v1",
        "audio_bridge_running": audio_bridge.is_running,
        "gemini_live_connected": gemini_session.is_connected,
        "uptime_seconds": round(time.time() - start_time, 2)
    }


@app.get("/api/vision/status")
async def vision_status():
    return {"success": True, "vision_state": actuator_dispatcher.vision_state}


# ─── System Telemetry & Hardware Endpoints ────────────────────────────────────

@app.get("/api/system/telemetry")
@app.get("/api/telemetry")
async def get_system_telemetry():
    return await telemetry_service.get_full_telemetry()


@app.get("/api/system/hardware")
async def get_system_hardware():
    return await telemetry_service.get_hardware_state()


@app.post("/api/system/control")
async def system_control(req: SystemControlRequest):
    action = req.action
    if action in ["set_volume", "volume"]:
        if req.toggleMute:
            await actuator_dispatcher.execute_cpp_worker("hardware_ctrl", ["toggle_mute"])
        elif req.mute is not None:
            await actuator_dispatcher.execute_cpp_worker("hardware_ctrl", ["mute_volume", "1" if req.mute else "0"])
        else:
            vol = req.percent if req.percent is not None else req.volume if req.volume is not None else 50
            await actuator_dispatcher.execute_cpp_worker("hardware_ctrl", ["set_volume", str(vol)])
        hw = await telemetry_service.get_hardware_state()
        return {"success": True, "volume": hw.get("volume", {})}

    elif action in ["set_brightness", "brightness"]:
        bri = req.percent if req.percent is not None else req.brightness if req.brightness is not None else 50
        await actuator_dispatcher.execute_cpp_worker("hardware_ctrl", ["set_brightness", str(bri)])
        hw = await telemetry_service.get_hardware_state()
        return {"success": True, "brightness": hw.get("brightness", {})}

    elif action in ["power_profile", "set_power_profile"]:
        prof = req.profile or "balanced"
        await actuator_dispatcher.execute_cpp_worker("hardware_ctrl", ["set_power_profile", prof])
        return {"success": True, "powerProfile": prof}

    elif action in ["sound_heal", "heal_sound_server"]:
        await actuator_dispatcher.execute_cpp_worker("hardware_ctrl", ["heal_sound_server"])
        hw = await telemetry_service.get_hardware_state()
        return {"success": True, "soundServer": hw.get("soundServer", {})}

    elif action in ["power_action", "system_power"]:
        res = await actuator_dispatcher.dispatch_tool("system_power_action", {"action": req.powerAction or "lock"})
        return res

    return {"success": False, "error": f"Unknown action: {action}"}


@app.post("/api/system/brightness")
async def set_brightness_endpoint(req: Dict[str, Any]):
    val = req.get("percent", req.get("brightness", 50))
    await actuator_dispatcher.execute_cpp_worker("hardware_ctrl", ["set_brightness", str(val)])
    hw = await telemetry_service.get_hardware_state()
    return {"success": True, "brightness": hw.get("brightness", {})}


@app.post("/api/system/volume")
async def set_volume_endpoint(req: Dict[str, Any]):
    if req.get("toggleMute"):
        await actuator_dispatcher.execute_cpp_worker("hardware_ctrl", ["toggle_mute"])
    elif "mute" in req:
        await actuator_dispatcher.execute_cpp_worker("hardware_ctrl", ["mute_volume", "1" if req["mute"] else "0"])
    else:
        val = req.get("percent", req.get("volume", 50))
        await actuator_dispatcher.execute_cpp_worker("hardware_ctrl", ["set_volume", str(val)])
    hw = await telemetry_service.get_hardware_state()
    return {"success": True, "volume": hw.get("volume", {})}


@app.post("/api/system/power-profile")
async def set_power_profile_endpoint(req: Dict[str, Any]):
    prof = req.get("profile", "balanced")
    await actuator_dispatcher.execute_cpp_worker("hardware_ctrl", ["set_power_profile", prof])
    return {"success": True, "powerProfile": prof}


@app.post("/api/system/power-action")
async def set_power_action_endpoint(req: Dict[str, Any]):
    act = req.get("action", "lock")
    return await actuator_dispatcher.dispatch_tool("system_power_action", {"action": act})


@app.get("/api/system/apps")
async def get_system_apps():
    apps = []
    seen = set()
    search_dirs = ["/usr/share/applications", os.path.expanduser("~/.local/share/applications")]
    for d in search_dirs:
        if not os.path.exists(d):
            continue
        try:
            for entry in os.listdir(d):
                if not entry.endswith(".desktop"):
                    continue
                file_path = os.path.join(d, entry)
                try:
                    name, exec_cmd, icon, comment, cats = "", "", "", "", []
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        in_desktop_entry = False
                        for line in f:
                            line = line.strip()
                            if line == "[Desktop Entry]":
                                in_desktop_entry = True
                            elif line.startswith("[") and line != "[Desktop Entry]":
                                in_desktop_entry = False
                            elif in_desktop_entry and "=" in line:
                                k, v = line.split("=", 1)
                                k = k.strip()
                                v = v.strip()
                                if k == "Name" and not name:
                                    name = v
                                elif k == "Exec" and not exec_cmd:
                                    exec_cmd = v.split("%")[0].strip()
                                elif k == "Icon" and not icon:
                                    icon = v
                                elif k == "Comment" and not comment:
                                    comment = v
                                elif k == "Categories" and not cats:
                                    cats = [c.strip() for c in v.split(";") if c.strip()]
                                elif k == "NoDisplay" and v.lower() == "true":
                                    name = ""
                                    break
                    if name and name not in seen:
                        seen.add(name)
                        apps.append({
                            "name": name,
                            "exec": exec_cmd or name.lower(),
                            "icon": icon or "application-x-executable",
                            "comment": comment,
                            "desktopFile": entry,
                            "categories": cats,
                        })
                except Exception:
                    continue
        except Exception:
            continue
    apps.sort(key=lambda x: x["name"].lower())
    return {"success": True, "applications": apps}


@app.get("/api/system/processes")
async def get_system_processes(sortBy: str = "cpu", limit: int = 25):
    sort_flag = "-%cpu" if sortBy == "cpu" else "-%mem" if sortBy == "memory" else "-pid"
    cmd_res = await actuator_dispatcher.execute_linux_command(
        f"ps -eo pid,user,%cpu,%mem,vsz,rss,comm --sort={sort_flag} | head -n {limit + 1}"
    )
    procs = []
    if cmd_res.get("success") and cmd_res.get("stdout"):
        lines = cmd_res["stdout"].strip().split("\n")
        for line in lines[1:]:
            parts = line.split(None, 6)
            if len(parts) >= 7:
                try:
                    procs.append({
                        "pid": int(parts[0]),
                        "user": parts[1],
                        "cpuPercent": float(parts[2]),
                        "memPercent": float(parts[3]),
                        "vszMb": round(int(parts[4]) / 1024, 1),
                        "rssMb": round(int(parts[5]) / 1024, 1),
                        "command": parts[6],
                    })
                except Exception:
                    continue
    return {"success": True, "processes": procs}


@app.post("/api/system/processes/kill")
async def kill_system_process(req: Dict[str, Any]):
    pid = req.get("pid")
    signal = req.get("signal", "SIGTERM")
    return await actuator_dispatcher.dispatch_tool("manage_process", {"pid": pid, "signal": signal})


@app.get("/api/system/spec")
async def get_system_spec():
    res = await actuator_dispatcher.execute_cpp_worker("pc_spec", timeout=8.0)
    if res.get("success"):
        return res.get("result", {})
    return {"success": False, "error": "Spec worker unavailable"}


@app.get("/api/system/logs")
async def get_system_logs(source: str = "journalctl", lines: int = 60):
    lines_val = min(lines, 200)
    if source == "dmesg":
        cmd_res = await actuator_dispatcher.execute_linux_command(f"dmesg -T 2>/dev/null | tail -n {lines_val}")
    else:
        cmd_res = await actuator_dispatcher.execute_linux_command(f"journalctl -n {lines_val} --no-pager 2>/dev/null")
    logs = cmd_res.get("stdout", "").strip().split("\n") if cmd_res.get("success") else []
    return {"success": True, "logs": [l for l in logs if l]}


@app.get("/api/system/connections")
async def get_system_connections(filter: str = "listening", limit: int = 40):
    flag = "-l" if filter == "listening" else "-t" if filter == "tcp" else "-u" if filter == "udp" else ""
    cmd_res = await actuator_dispatcher.execute_linux_command(f"ss -tunap {flag} 2>/dev/null | head -n {limit + 1}")
    conns = []
    ports = []
    if cmd_res.get("success") and cmd_res.get("stdout"):
        lines = cmd_res["stdout"].strip().split("\n")
        for line in lines[1:]:
            parts = line.split(None, 6)
            if len(parts) >= 5:
                conns.append({
                    "proto": parts[0],
                    "state": parts[1] if len(parts) > 1 else "",
                    "local": parts[4] if len(parts) > 4 else parts[3],
                    "peer": parts[5] if len(parts) > 5 else "*:*",
                    "process": parts[6] if len(parts) > 6 else "",
                })
                ports.append(parts[4] if len(parts) > 4 else parts[3])
    return {"success": True, "connections": conns, "listeningPorts": ports}


@app.post("/api/system/clipboard")
async def system_clipboard(req: Dict[str, Any]):
    act = req.get("action", "read")
    text = req.get("text", "")
    return await actuator_dispatcher.dispatch_tool("clipboard_control", {"action": act, "text": text})


@app.post("/api/system/exec")
async def system_exec(req: Dict[str, Any]):
    cmd = req.get("command", "")
    cwd = req.get("cwd")
    return await actuator_dispatcher.execute_linux_command(cmd, cwd=cwd)


@app.get("/api/system/thermals")
async def get_system_thermals():
    return await actuator_dispatcher.execute_cpp_worker("thermal_scan")


@app.get("/api/system/storage")
async def get_system_storage():
    return await actuator_dispatcher.execute_cpp_worker("storage_scan")


@app.get("/api/system/services")
async def get_system_services():
    cmd_res = await actuator_dispatcher.execute_linux_command("systemctl list-units --type=service --state=running --no-pager --no-legend 2>/dev/null | head -40")
    svcs = []
    if cmd_res.get("success") and cmd_res.get("stdout"):
        for line in cmd_res["stdout"].strip().split("\n"):
            parts = line.split(None, 4)
            if parts:
                svcs.append({"unit": parts[0], "load": parts[1] if len(parts) > 1 else "", "active": parts[2] if len(parts) > 2 else "", "sub": parts[3] if len(parts) > 3 else "", "description": parts[4] if len(parts) > 4 else ""})
    return {"success": True, "services": svcs}


@app.post("/api/system/services/action")
async def service_action(req: Dict[str, Any]):
    unit = req.get("unit", "")
    act = req.get("action", "status")
    return await actuator_dispatcher.dispatch_tool("manage_systemd_service", {"unit": unit, "action": act})


@app.get("/api/system/network")
async def get_system_network():
    return await actuator_dispatcher.dispatch_tool("get_network_status", {})


@app.post("/api/system/list-dir")
async def list_directory_endpoint(req: Dict[str, Any]):
    dir_path = req.get("dirPath", os.path.expanduser("~"))
    return await actuator_dispatcher.dispatch_tool("list_directory", {"dirPath": dir_path, "showHidden": req.get("showHidden", False), "limit": req.get("limit", 50)})


@app.post("/api/system/delete-file")
async def delete_file_endpoint(req: Dict[str, Any]):
    return await actuator_dispatcher.dispatch_tool("delete_local_file", {"filePath": req.get("filePath", ""), "recursive": req.get("recursive", False)})


@app.post("/api/system/desktop")
async def desktop_endpoint(req: Dict[str, Any]):
    return await actuator_dispatcher.dispatch_tool("desktop_control", req)


# ─── Sovereign Orchestrator & Knowledge Spheres Endpoints ─────────────────────

@app.get("/api/orchestrator/status")
async def orchestrator_status():
    return {
        "status": "online",
        "active_persona": "jarvis",
        "total_agents": 1,
        "persona": {
            "id": "jarvis",
            "name": "JARVIS",
            "role": "Sovereign AI Chief of Staff & Tactical Operating Partner",
            "status": "active"
        },
        "knowledge_spheres": [
            {"id": "system_os", "name": "System & OS Core", "status": "active", "color": "#06b6d4"},
            {"id": "operator_profile", "name": "Operator Directives", "status": "active", "color": "#38bdf8"},
            {"id": "knowledge_intel", "name": "Intelligence & Research", "status": "active", "color": "#f59e0b"},
            {"id": "codebase_dev", "name": "Codebase Architecture", "status": "active", "color": "#8b5cf6"},
            {"id": "workspace_ops", "name": "Workspace & Cloud Ops", "status": "active", "color": "#10b981"},
            {"id": "security_groundtruth", "name": "Security & Ground Truth", "status": "active", "color": "#f43f5e"},
        ]
    }


@app.post("/api/orchestrator/swap-persona")
async def orchestrator_swap_persona(req: Dict[str, Any]):
    pid = req.get("personaId", req.get("targetPersonaId", "jarvis"))
    return await actuator_dispatcher.dispatch_tool("switch_persona", {"targetPersonaId": pid})


@app.post("/api/orchestrator/delegate")
async def orchestrator_delegate(req: Dict[str, Any]):
    agent = req.get("agent", "Specialist")
    task = req.get("task", "")
    return await actuator_dispatcher.dispatch_tool("delegate_task", {"agent_name": agent, "task": task})


@app.post("/api/chat")
async def chat_endpoint(req: Dict[str, Any]):
    msg = req.get("message", req.get("text", ""))
    return {"success": True, "reply": f"Acknowledged, Gopi: '{msg}'. All subsystems standing by."}


@app.post("/api/workspace/execute")
async def workspace_execute(req: Dict[str, Any]):
    action = req.get("action", "")
    return {"success": True, "action": action, "result": f"Workspace action '{action}' executed."}


@app.get("/api/memory/status")
async def memory_status():
    snapshot = memory_engine.get_frozen_snapshot()
    return {
        "success": True,
        "memory_chars": len(snapshot["memory_content"]),
        "user_chars": len(snapshot["user_content"]),
        "timestamp": snapshot["timestamp"]
    }


@app.post("/api/memory/flush")
async def flush_memory():
    return {
        "success": True,
        "flushed_buffers": 0,
        "sealed_summaries": [],
        "message": "Memory buffers synchronized."
    }


@app.post("/api/memory/search")
async def search_memory(req: MemorySearchRequest):
    results = memory_engine.search(req.query, req.limit)
    return {"success": True, "results": results}


@app.post("/api/memory/save")
async def save_memory(req: MemoryFactRequest):
    memory_engine.save_memory_fact(req.key, req.value, req.category)
    return {"success": True, "message": f"Memory '{req.key}' saved successfully."}


@app.post("/api/tools/execute")
async def execute_tool(req: ToolExecuteRequest):
    result = await actuator_dispatcher.dispatch_tool(req.tool_name, req.args)
    return result


# ─── Google Workspace OAuth & Token Management Endpoints ──────────────────────

class WorkspaceTokenRequest(BaseModel):
    token: Optional[str] = None
    refreshToken: Optional[str] = None
    expiresAt: Optional[int] = None
    clientId: Optional[str] = None
    clientSecret: Optional[str] = None


class GoogleCodeRequest(BaseModel):
    code: str
    redirectUri: Optional[str] = "postmessage"
    clientId: Optional[str] = None
    clientSecret: Optional[str] = None


@app.get("/api/workspace/token/status")
async def workspace_token_status():
    status = google_auth_service.get_status()
    return status


@app.post("/api/workspace/token")
async def workspace_save_token(req: WorkspaceTokenRequest):
    if req.token:
        auth_data = google_auth_service.save_auth({
            "accessToken": req.token,
            "refreshToken": req.refreshToken,
            "expiresAt": req.expiresAt,
        })
        try:
            await google_auth_service.fetch_and_cache_profile(req.token)
        except Exception:
            pass
        return {
            "success": True,
            "connected": True,
            "status": google_auth_service.get_status(),
            "message": "Google access token persisted globally."
        }
    else:
        google_auth_service.disconnect()
        return {
            "success": True,
            "connected": False,
            "status": google_auth_service.get_status(),
            "message": "Google access token cleared."
        }


@app.post("/api/auth/google/code")
async def google_code_exchange(req: GoogleCodeRequest):
    try:
        auth_data = await google_auth_service.exchange_auth_code(
            code=req.code,
            redirect_uri=req.redirectUri or "postmessage",
            client_id=req.clientId,
            client_secret=req.clientSecret
        )
        return {
            "success": True,
            "connected": True,
            "email": auth_data.get("email", ""),
            "name": auth_data.get("name", ""),
            "picture": auth_data.get("picture", ""),
            "hasRefreshToken": bool(auth_data.get("refreshToken")),
            "status": google_auth_service.get_status()
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/auth/google/refresh")
async def google_token_refresh(req: Optional[WorkspaceTokenRequest] = None):
    cid = req.clientId if req else None
    sec = req.clientSecret if req else None
    new_token = await google_auth_service.refresh_access_token(client_id=cid, client_secret=sec)
    if new_token:
        return {"success": True, "token": new_token, "status": google_auth_service.get_status()}
    return {"success": False, "error": "Token refresh failed. Re-authorization required."}


@app.post("/api/auth/google/disconnect")
async def google_disconnect():
    google_auth_service.disconnect()
    return {"success": True, "connected": False, "status": google_auth_service.get_status()}


@app.get("/api/auth/google/login")
async def google_auth_login(request: Request, client_id: Optional[str] = None):
    """Server-side standard OAuth 2.0 redirect flow (bypasses GIS JavaScript origin checks)."""
    base_url = str(request.base_url).rstrip("/")
    redirect_uri = f"{base_url}/api/auth/google/callback"
    auth_url = google_auth_service.get_auth_url(redirect_uri=redirect_uri, client_id=client_id)
    return RedirectResponse(url=auth_url)


@app.get("/api/auth/google/callback")
@app.get("/api/connectors/callback")
async def google_auth_callback(request: Request, code: Optional[str] = None, error: Optional[str] = None):
    """Receives standard Google OAuth redirect and posts message to frontend."""
    if error:
        return HTMLResponse(content=f"""<!DOCTYPE html><html><body style="background:#090a0f;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:32px;background:rgba(255,255,255,0.05);border-radius:16px;"><h2 style="color:#f87171;">Google Auth Error</h2><p style="color:#9ca3af;font-size:13px;">{error}</p></div><script>if(window.opener){{window.opener.postMessage({{type:'GOOGLE_AUTH_FAILED',error:'{error}'}},'*');setTimeout(()=>window.close(),2500);}}</script></body></html>""")

    if not code:
        return HTMLResponse(content="""<!DOCTYPE html><html><body style="background:#090a0f;color:#fff;font-family:sans-serif;padding:40px;"><h2>Missing authorization code</h2></body></html>""")

    try:
        base_url = str(request.base_url).rstrip("/")
        # Try current URL path as redirect_uri
        redirect_uri = f"{base_url}{request.url.path}"
        auth_data = await google_auth_service.exchange_auth_code(code=code, redirect_uri=redirect_uri)
        status_json = json.dumps(google_auth_service.get_status())

        html = f"""<!DOCTYPE html><html><head><title>Google Connected | J.A.R.V.I.S.</title></head><body style="background:#090a0f;color:#fff;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:32px;background:rgba(18,20,29,0.9);border:1px solid rgba(0,240,255,0.3);border-radius:16px;max-width:380px;"><div style="font-size:36px;margin-bottom:12px;">🌐</div><h2 style="color:#00f0ff;margin:0 0 8px 0;">Google Connected</h2><p style="font-size:13px;color:#9ca3af;margin:0 0 16px 0;">Authenticated as <b>{auth_data.get('email') or 'User'}</b>. Closing window...</p></div><script>if(window.opener){{window.opener.postMessage({{type:'GOOGLE_AUTH_SUCCESS',status:{status_json}}},'*');window.opener.postMessage({{type:'CONNECTORS_AUTH_SUCCESS',provider:'google',status:{status_json}}},'*');setTimeout(()=>window.close(),1000);}}else{{setTimeout(()=>{{window.location.href='/';}},1500);}}</script></body></html>"""
        return HTMLResponse(content=html)
    except Exception as e:
        err_msg = str(e)
        return HTMLResponse(content=f"""<!DOCTYPE html><html><body style="background:#090a0f;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:32px;background:rgba(255,255,255,0.05);border-radius:16px;"><h2 style="color:#f87171;">Google Auth Code Exchange Error</h2><p style="color:#9ca3af;font-size:13px;">{err_msg}</p><p style="color:#6b7280;font-size:11px;">You can also copy the access token directly from Google OAuth Playground.</p></div><script>if(window.opener){{window.opener.postMessage({{type:'GOOGLE_AUTH_FAILED',error:'{err_msg}'}},'*');setTimeout(()=>window.close(),3000);}}</script></body></html>""")


# ─── GitHub Integration Endpoints ───────────────────────────────────────────

class GitHubTokenRequest(BaseModel):
    accessToken: Optional[str] = None
    login: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    avatarUrl: Optional[str] = None


class GitHubCodeRequest(BaseModel):
    code: str
    redirectUri: Optional[str] = None
    clientId: Optional[str] = None
    clientSecret: Optional[str] = None


class GitHubIssueRequest(BaseModel):
    owner: str
    repo: str
    title: str
    body: Optional[str] = ""
    labels: Optional[List[str]] = None


class GitHubGistRequest(BaseModel):
    description: str
    files: Dict[str, Dict[str, str]]
    public: Optional[bool] = False


@app.get("/api/github/status")
async def github_status():
    return {"success": True, **github_service.get_status()}


@app.get("/api/github/auth/url")
async def github_auth_url(request: Request, redirectUri: Optional[str] = None, clientId: Optional[str] = None):
    try:
        base_url = str(request.base_url).rstrip("/")
        uri = redirectUri or f"{base_url}/api/github/callback"
        url = github_service.get_authorization_url(redirect_uri=uri, client_id=clientId)
        return {"success": True, "url": url, "redirectUri": uri}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/github/auth/code")
async def github_auth_code(req: GitHubCodeRequest, request: Request):
    try:
        base_url = str(request.base_url).rstrip("/")
        uri = req.redirectUri or f"{base_url}/api/github/callback"
        saved = await github_service.exchange_auth_code(
            code=req.code,
            redirect_uri=uri,
            client_id=req.clientId,
            client_secret=req.clientSecret
        )
        return {
            "success": True,
            "message": "GitHub authenticated successfully",
            "status": github_service.get_status(),
            "auth": saved
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/github/callback")
async def github_auth_callback(request: Request, code: Optional[str] = None, error: Optional[str] = None, error_description: Optional[str] = None):
    err = error_description or error
    if err or not code:
        return HTMLResponse(content=f"""<!DOCTYPE html><html><body style="background:#090a0f;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:32px;background:rgba(255,255,255,0.05);border-radius:16px;"><h2 style="color:#f87171;">GitHub Auth Error</h2><p style="color:#9ca3af;font-size:13px;">{err or 'Missing authorization code'}</p></div><script>if(window.opener){{window.opener.postMessage({{type:'GITHUB_AUTH_FAILED',error:'{err or 'Failed'}'}},'*');setTimeout(()=>window.close(),2000);}}</script></body></html>""")

    try:
        base_url = str(request.base_url).rstrip("/")
        redirect_uri = f"{base_url}{request.url.path}"
        saved = await github_service.exchange_auth_code(code=code, redirect_uri=redirect_uri)
        status_json = json.dumps(github_service.get_status())
        html = f"""<!DOCTYPE html><html><head><title>GitHub Connected | J.A.R.V.I.S.</title></head><body style="background:#090a0f;color:#fff;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:32px;background:rgba(18,20,29,0.9);border:1px solid rgba(240,80,50,0.3);border-radius:16px;max-width:380px;"><div style="font-size:36px;margin-bottom:12px;">🐙</div><h2 style="color:#ff7a64;margin:0 0 8px 0;">GitHub Connected</h2><p style="font-size:13px;color:#9ca3af;margin:0 0 16px 0;">Authenticated as <b>@{saved.get('login') or 'User'}</b>. Closing popup...</p></div><script>if(window.opener){{window.opener.postMessage({{type:'GITHUB_AUTH_SUCCESS',status:{status_json}}},'*');setTimeout(()=>window.close(),1000);}}else{{setTimeout(()=>{{window.location.href='/';}},1500);}}</script></body></html>"""
        return HTMLResponse(content=html)
    except Exception as e:
        err_msg = str(e)
        return HTMLResponse(content=f"""<!DOCTYPE html><html><body style="background:#090a0f;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:32px;background:rgba(255,255,255,0.05);border-radius:16px;"><h2 style="color:#f87171;">GitHub Auth Code Exchange Error</h2><p style="color:#9ca3af;font-size:13px;">{err_msg}</p></div><script>if(window.opener){{window.opener.postMessage({{type:'GITHUB_AUTH_FAILED',error:'{err_msg}'}},'*');setTimeout(()=>window.close(),2500);}}</script></body></html>""")


@app.post("/api/github/auth/token")
async def github_save_token(req: GitHubTokenRequest):
    try:
        if not req.accessToken:
            return {"success": False, "error": "accessToken is required"}
        saved = await github_service.save_auth({
            "accessToken": req.accessToken,
            "login": req.login,
            "name": req.name,
            "email": req.email,
            "avatarUrl": req.avatarUrl
        })
        return {
            "success": True,
            "message": "GitHub credentials saved successfully",
            "status": github_service.get_status(),
            "auth": saved
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/github/auth/disconnect")
async def github_disconnect():
    github_service.disconnect()
    return {"success": True, "message": "GitHub credentials disconnected"}


@app.get("/api/github/profile")
async def github_get_profile():
    try:
        token = github_service.get_access_token()
        if not token:
            return {"success": False, "error": "GitHub not connected"}
        profile = await github_service.fetch_user_profile(token)
        return {"success": True, "profile": profile}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/github/repos")
async def github_get_repos(limit: int = 10, sort: str = "updated"):
    try:
        repos = await github_service.list_my_repos(limit=limit, sort=sort)
        return {"success": True, "count": len(repos), "repos": repos}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/github/issue")
async def github_create_issue(req: GitHubIssueRequest):
    try:
        issue = await github_service.create_issue(
            owner=req.owner,
            repo=req.repo,
            title=req.title,
            body=req.body or "",
            labels=req.labels
        )
        return {"success": True, "issue": issue}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/github/gist")
async def github_create_gist(req: GitHubGistRequest):
    try:
        gist = await github_service.create_gist(
            description=req.description,
            files=req.files,
            is_public=req.public or False
        )
        return {"success": True, "gist": gist}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ─── LinkedIn Integration Endpoints ──────────────────────────────────────────

class LinkedInTokenRequest(BaseModel):
    accessToken: Optional[str] = None
    linkedApiToken: Optional[str] = None
    identificationToken: Optional[str] = None


class LinkedInCodeRequest(BaseModel):
    code: str
    redirectUri: Optional[str] = None
    clientId: Optional[str] = None
    clientSecret: Optional[str] = None


class LinkedInPostRequest(BaseModel):
    text: str
    visibility: Optional[str] = "PUBLIC"


@app.get("/api/linkedin/status")
async def linkedin_status():
    return {"success": True, **linkedin_service.get_status()}


@app.get("/api/linkedin/auth/url")
async def linkedin_auth_url(request: Request, redirectUri: Optional[str] = None, clientId: Optional[str] = None):
    try:
        base_url = str(request.base_url).rstrip("/")
        uri = redirectUri or f"{base_url}/api/linkedin/callback"
        url = linkedin_service.get_authorization_url(redirect_uri=uri, client_id=clientId)
        return {"success": True, "url": url, "redirectUri": uri}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/linkedin/auth/code")
async def linkedin_auth_code(req: LinkedInCodeRequest, request: Request):
    try:
        base_url = str(request.base_url).rstrip("/")
        uri = req.redirectUri or f"{base_url}/api/linkedin/callback"
        saved = await linkedin_service.exchange_auth_code(
            code=req.code,
            redirect_uri=uri,
            client_id=req.clientId,
            client_secret=req.clientSecret
        )
        return {
            "success": True,
            "message": "LinkedIn authenticated successfully",
            "status": linkedin_service.get_status(),
            "auth": saved
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/linkedin/callback")
async def linkedin_auth_callback(request: Request, code: Optional[str] = None, error: Optional[str] = None, error_description: Optional[str] = None):
    err = error_description or error
    if err or not code:
        return HTMLResponse(content=f"""<!DOCTYPE html><html><body style="background:#090a0f;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:32px;background:rgba(255,255,255,0.05);border-radius:16px;"><h2 style="color:#f87171;">LinkedIn Auth Error</h2><p style="color:#9ca3af;font-size:13px;">{err or 'Missing authorization code'}</p></div><script>if(window.opener){{window.opener.postMessage({{type:'LINKEDIN_AUTH_FAILED',error:'{err or 'Failed'}'}},'*');setTimeout(()=>window.close(),2000);}}</script></body></html>""")

    try:
        base_url = str(request.base_url).rstrip("/")
        redirect_uri = f"{base_url}{request.url.path}"
        saved = await linkedin_service.exchange_auth_code(code=code, redirect_uri=redirect_uri)
        status_json = json.dumps(linkedin_service.get_status())
        html = f"""<!DOCTYPE html><html><head><title>LinkedIn Connected | J.A.R.V.I.S.</title></head><body style="background:#090a0f;color:#fff;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:32px;background:rgba(18,20,29,0.9);border:1px solid rgba(10,102,194,0.3);border-radius:16px;max-width:380px;"><div style="font-size:36px;margin-bottom:12px;">💼</div><h2 style="color:#38bdf8;margin:0 0 8px 0;">LinkedIn Connected</h2><p style="font-size:13px;color:#9ca3af;margin:0 0 16px 0;">Authenticated as <b>{saved.get('name') or 'User'}</b>. Closing popup...</p></div><script>if(window.opener){{window.opener.postMessage({{type:'LINKEDIN_AUTH_SUCCESS',status:{status_json}}},'*');setTimeout(()=>window.close(),1000);}}else{{setTimeout(()=>{{window.location.href='/';}},1500);}}</script></body></html>"""
        return HTMLResponse(content=html)
    except Exception as e:
        err_msg = str(e)
        return HTMLResponse(content=f"""<!DOCTYPE html><html><body style="background:#090a0f;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;padding:32px;background:rgba(255,255,255,0.05);border-radius:16px;"><h2 style="color:#f87171;">LinkedIn Auth Code Exchange Error</h2><p style="color:#9ca3af;font-size:13px;">{err_msg}</p></div><script>if(window.opener){{window.opener.postMessage({{type:'LINKEDIN_AUTH_FAILED',error:'{err_msg}'}},'*');setTimeout(()=>window.close(),2500);}}</script></body></html>""")


@app.post("/api/linkedin/auth/token")
async def linkedin_save_token(req: LinkedInTokenRequest):
    try:
        if not req.accessToken and not req.linkedApiToken:
            return {"success": False, "error": "accessToken or linkedApiToken is required"}
        saved = await linkedin_service.save_auth({
            "accessToken": req.accessToken,
            "linkedApiToken": req.linkedApiToken,
            "identificationToken": req.identificationToken,
        })
        return {
            "success": True,
            "message": "LinkedIn credentials saved successfully",
            "status": linkedin_service.get_status(),
            "auth": saved
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/linkedin/auth/disconnect")
async def linkedin_disconnect():
    linkedin_service.disconnect()
    return {"success": True, "message": "LinkedIn credentials disconnected"}


@app.post("/api/linkedin/post")
async def linkedin_create_post(req: LinkedInPostRequest):
    try:
        res = await linkedin_service.create_post(text=req.text, visibility=req.visibility or "PUBLIC")
        return res
    except Exception as e:
        return {"success": False, "error": str(e)}


# ─── WebRTC Signaling & DataChannel Bridge ───────────────────────────────────

class WebRTCOfferRequest(BaseModel):
    clientId: Optional[str] = None
    sdp: Optional[str] = None
    type: Optional[str] = "offer"


class WebRTCCommandRequest(BaseModel):
    type: str
    personaId: Optional[str] = "jarvis"
    toolName: Optional[str] = None
    args: Dict[str, Any] = {}
    googleAccessToken: Optional[str] = None


@app.post("/api/webrtc/offer")
async def webrtc_offer(req: WebRTCOfferRequest):
    effective_client_id = req.clientId or f"client_{int(time.time() * 1000)}"
    session_id = f"session_{int(time.time() * 1000)}"
    return {
        "type": "answer",
        "sdp": f"v=0\r\no=- {int(time.time())} 2 IN IP4 127.0.0.1\r\ns=Jarvis-WebRTC-Hub\r\nt=0 0\r\n",
        "sessionId": session_id,
        "clientId": effective_client_id
    }


@app.post("/api/webrtc/ice")
async def webrtc_ice(req: Dict[str, Any]):
    return {"ok": True, "received": True}


@app.post("/api/webrtc/command")
async def webrtc_command(req: WebRTCCommandRequest):
    if req.type == "persona_switch":
        return {"type": "persona_active", "personaId": req.personaId or "jarvis", "voiceToken": True}
    if req.type == "tool_trigger" and req.toolName:
        result = await actuator_dispatcher.dispatch_tool(req.toolName, req.args)
        return {"type": "tool_result", "toolName": req.toolName, "result": result}
    return {"type": "command_ack", "received": req.dict()}


@app.get("/api/webrtc/status")
async def webrtc_status():
    return {
        "status": "online",
        "mode": "webrtc-signaling-hub",
        "dual_transport": True,
        "timestamp": time.time()
    }


@app.get("/api/prompt/system")
async def get_system_prompt():
    prompt = prompt_engine.render_system_prompt()
    return {"prompt": prompt}




# ─── Dual WebSocket Endpoints: /live (React UI) and /ws/live ────────────────

_connected_ws_clients: List[WebSocket] = []


async def _broadcast_to_all_ws(event: Dict[str, Any]):
    """Broadcast a control event to all connected UI WebSocket clients."""
    for ws_client in list(_connected_ws_clients):
        try:
            await ws_client.send_json(event)
        except Exception:
            pass

# Wire the broadcast callback so actuator_dispatcher vision/persona tools
# can push events directly to the UI
actuator_dispatcher.set_ws_broadcast(_broadcast_to_all_ws)


@app.websocket("/live")
@app.websocket("/ws/live")
async def websocket_live_bridge(ws: WebSocket):
    await ws.accept()
    _connected_ws_clients.append(ws)

    # Event listener that forwards Gemini Live events to this React client
    def on_gemini_event(event: Dict[str, Any]):
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.run_coroutine_threadsafe(ws.send_json(event), loop)
        except Exception:
            pass

    gemini_session.add_listener(on_gemini_event)

    try:
        while True:
            data = await ws.receive_json()
            msg_type = data.get("type")

            # 1. Keepalive ping/pong
            if msg_type == "ping":
                await ws.send_json({"type": "pong", "timestamp": int(time.time() * 1000)})
                continue

            if msg_type == "pong":
                continue

            # 2. Client Init Handshake
            if msg_type == "init":
                voice_name = data.get("voiceName", "Puck")
                sys_instruction = data.get("systemInstruction")

                if not gemini_session.is_connected:
                    await gemini_session.connect(voice_name=voice_name, custom_system_instruction=sys_instruction)

                await ws.send_json({
                    "type": "connected",
                    "voiceName": voice_name,
                    "audioProfile": {
                        "bass": 1.2,
                        "mid": 1.0,
                        "treble": 1.1,
                        "compressorThreshold": -24,
                        "compressorRatio": 4
                    }
                })

            # 3. Client Audio Chunk (16kHz PCM Base64)
            elif msg_type == "audio":
                audio_b64 = data.get("audio")
                if audio_b64:
                    await gemini_session.send_realtime_audio(audio_b64)

            # 4. User Text Message
            elif msg_type == "text":
                text = data.get("text")
                if text:
                    await gemini_session.send_text_message(text)

            # 5. Client Vision Image (Camera / Screen Share)
            elif msg_type == "image":
                img = data.get("image")
                mime = data.get("mimeType", "image/jpeg")
                if img:
                    await gemini_session.send_realtime_image(img, mime)

            # 6. Interruption (Voice Barge-in)
            elif msg_type == "interrupted":
                # Interrupted
                pass

            # 7. Persona Hot-swap
            elif msg_type == "swap_persona":
                persona_id = data.get("personaId", "jarvis")
                await ws.send_json({
                    "type": "persona_swapped",
                    "personaId": persona_id
                })

    except WebSocketDisconnect:
        print("[WebSocket] 🔌 UI disconnected.")
    except Exception as e:
        print(f"[WebSocket] Error: {e}")
    finally:
        if ws in _connected_ws_clients:
            _connected_ws_clients.remove(ws)
        gemini_session.remove_listener(on_gemini_event)
        await gemini_session.close()


# ─── Serve Spatial Stage & AI-Visualizer Suite ───────────────────────────────

root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
visualizer_dir = os.path.join(root_dir, "ai-visualizer")
barehands_dir = os.path.join(root_dir, "barehands")
dist_dir = os.path.join(root_dir, "dist")

if os.path.exists(visualizer_dir):
    app.mount("/visualizer", StaticFiles(directory=visualizer_dir), name="visualizer")

if os.path.exists(barehands_dir):
    app.mount("/barehands", StaticFiles(directory=barehands_dir), name="barehands")


@app.get("/state")
async def get_visualizer_state():
    voice_state = "speaking" if gemini_session.is_connected and getattr(gemini_session, "is_speaking", False) else "listening" if gemini_session.is_connected else "idle"
    voice_state_file = os.path.join(root_dir, ".voice_state")
    if os.path.exists(voice_state_file):
        try:
            with open(voice_state_file, "r") as f:
                content = f.read().strip()
                if content:
                    voice_state = content
        except Exception:
            pass
    return {
        "state": voice_state,
        "sample_rate": 24000,
        "rms": 0.0,
        "volume": 0.0,
        "samples": [0.0] * 64,
        "timestamp": int(time.time() * 1000)
    }


@app.get("/config")
async def get_visualizer_config():
    return {
        "name": "JARVIS",
        "badge": "MK-VII",
        "default_face": "radial",
        "thinking_sound": False,
        "faces": [{"id": "radial", "name": "Radial", "file": "faces/radial/index.html"}]
    }


# ─── Serve React UI Static Build ─────────────────────────────────────────────

if os.path.exists(dist_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_dir, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        file_path = os.path.join(dist_dir, full_path)
        if os.path.exists(file_path) and not os.path.isdir(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(dist_dir, "index.html"))

