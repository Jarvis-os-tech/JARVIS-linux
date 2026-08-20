// Python Interop Bridge for J.A.R.V.I.S.
// Executes Python plugins (e.g. agency-agents-router with 270 specialists),
// standalone scripts, and data engineering routines with native stdio IPC.

import { execFile, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { logTool, logOrchestrator } from './logger';
import { securityGuard } from './security_guard';

const HERMES_PYTHON_VENV = '/home/gopi/.hermes/hermes-agent/.venv/bin/python3';
const SYSTEM_PYTHON = '/usr/bin/python3';

export class PythonBridge {
  private static instance: PythonBridge;
  private pythonPath: string = SYSTEM_PYTHON;

  public static getInstance(): PythonBridge {
    if (!PythonBridge.instance) {
      PythonBridge.instance = new PythonBridge();
    }
    return PythonBridge.instance;
  }

  constructor() {
    this.detectPython();
  }

  private detectPython(): void {
    if (fs.existsSync(HERMES_PYTHON_VENV)) {
      this.pythonPath = HERMES_PYTHON_VENV;
      logOrchestrator.info(`Python Bridge initialized using Hermes virtual environment: ${HERMES_PYTHON_VENV}`);
    } else {
      this.pythonPath = SYSTEM_PYTHON;
      logOrchestrator.info(`Python Bridge initialized using system Python: ${SYSTEM_PYTHON}`);
    }
  }

  /**
   * Execute Python code string directly and return output.
   */
  public async executeCode(code: string, timeoutMs = 15000): Promise<{ stdout: string; stderr: string; success: boolean }> {
    const verdict = securityGuard.validateCommand(code);
    if (!verdict.allowed) {
      return { stdout: '', stderr: `Security validation rejected Python code: ${verdict.reason}`, success: false };
    }

    return new Promise((resolve) => {
      const child = execFile(this.pythonPath, ['-c', code], { timeout: timeoutMs }, (error, stdout, stderr) => {
        if (error) {
          resolve({
            stdout: stdout ? stdout.trim() : '',
            stderr: stderr ? stderr.trim() : error.message,
            success: false,
          });
        } else {
          resolve({
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            success: true,
          });
        }
      });
    });
  }

  /**
   * Query the 270 Agency Agents roster from Hermes plugin.
   */
  public async queryAgencyAgents(action: 'search' | 'inspect' | 'list', query = '', limit = 8): Promise<any> {
    const encodedQuery = Buffer.from(query).toString('base64');
    const script = `
import json, sys, os, base64
plugin_path = "/home/gopi/.hermes/plugins/agency-agents-router"
if os.path.exists(plugin_path):
    sys.path.insert(0, plugin_path)
    from __init__ import _load_agents, _score, _tokens, _summary
    agents = _load_agents()
    action = "${action}"
    q = base64.b64decode("${encodedQuery}").decode('utf-8')
    if action == "list":
        print(json.dumps([{"slug": a["slug"], "name": a["name"], "division": a.get("division", "")} for a in agents[:${limit}]]))
    elif action == "inspect":
        target = next((a for a in agents if a["slug"] == q or a["name"].lower() == q.lower()), None)
        print(json.dumps(target if target else {"error": "Agent not found"}))
    elif action == "search":
        q_toks = _tokens(q)
        matches = []
        for a in agents:
            s = _score(a, q_toks, q.lower())
            if s > 0:
                matches.append((s, a))
        matches.sort(key=lambda x: -x[0])
        print(json.dumps([_summary(a, score=s) for s, a in matches[:${limit}]]))
else:
    print(json.dumps({"error": "Agency agents plugin not found at " + plugin_path}))
`;
    const res = await this.executeCode(script);
    if (!res.success) {
      return { error: res.stderr || 'Agency agents query failed' };
    }
    try {
      return JSON.parse(res.stdout);
    } catch {
      return { raw: res.stdout };
    }
  }
}

export const pythonBridge = PythonBridge.getInstance();
