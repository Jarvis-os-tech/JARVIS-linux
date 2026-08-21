// Heredoc Terminal & Process Execution Tool for J.A.R.V.I.S.
// Supports multi-line shell scripts, background processes, Tirith AST scanning, and operator approval.
// Ported and enhanced from Hermes (tools/terminal_tool.py, tools/process_registry.py)

import { exec } from 'child_process';
import { toolRegistry, ToolDefinition } from './tool_registry';
import { securityGuard } from '../core/security_guard';
import { toolApproval } from '../core/tool_approval';
import { verificationEvidenceLedger } from '../core/verification_evidence';
import { logTool } from '../core/logger';

export interface TerminalExecutionArgs {
  command: string;
  cwd?: string;
  timeoutMs?: number;
  background?: boolean;
}

export class TerminalToolManager {
  private static instance: TerminalToolManager;

  public static getInstance(): TerminalToolManager {
    if (!TerminalToolManager.instance) {
      TerminalToolManager.instance = new TerminalToolManager();
    }
    return TerminalToolManager.instance;
  }

  constructor() {
    // Explicit registration via registerTerminalTools()
  }

  public registerTool(): void {
    const terminalToolDef: ToolDefinition = {
      name: 'terminal_exec',
      description: 'Execute shell commands or multi-line heredoc scripts on the Linux host with Tirith security scanning and evidence logging.',
      tier: 'tier2_system_shell',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command or bash script to execute.' },
          cwd: { type: 'string', description: 'Working directory path (defaults to current project root).' },
          timeoutMs: { type: 'number', description: 'Execution timeout in ms (default: 30000).' },
          background: { type: 'boolean', description: 'Whether to run in background without waiting.' }
        },
        required: ['command']
      },
      handler: async (args: TerminalExecutionArgs) => this.handleExec(args)
    };

    toolRegistry.register(terminalToolDef);
    toolRegistry.register({
      ...terminalToolDef,
      name: 'bash',
      description: 'Alias for terminal_exec'
    });
  }

  public async handleExec(args: TerminalExecutionArgs): Promise<any> {
    const command = args.command?.trim();
    if (!command) {
      return { success: false, error: 'Command cannot be empty' };
    }

    const cwd = args.cwd || process.cwd();
    const timeoutMs = args.timeoutMs || 30000;

    // 1. Deep Tirith Security Scan
    const verdict = await securityGuard.validateCommandDeep(command);
    if (!verdict.allowed) {
      return {
        success: false,
        error: `Security Policy Violation: ${verdict.reason}`
      };
    }

    // 2. Interactive Operator Approval Gate for dangerous commands
    const approval = await toolApproval.requestApproval('terminal_exec', { command, cwd }, 'system', timeoutMs);
    if (!approval.approved) {
      return {
        success: false,
        error: `Operation Not Approved: ${approval.reason}`
      };
    }

    // 3. Execution
    return new Promise((resolve) => {
      const startTime = Date.now();
      exec(command, { cwd, timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
        const durationMs = Date.now() - startTime;
        const exitCode = err ? (err.code ?? 1) : 0;
        const outputSummary = stdout || stderr || '';

        // Record verification evidence
        verificationEvidenceLedger.recordEvidence({
          sessionId: 'terminal_session',
          agentRole: 'terminal',
          command,
          status: exitCode === 0 ? 'passed' : 'failed',
          exitCode,
          outputSummary,
          cwd
        });

        if (err) {
          resolve({
            success: false,
            exitCode,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            error: err.message,
            durationMs
          });
        } else {
          resolve({
            success: true,
            exitCode: 0,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            durationMs
          });
        }
      });
    });
  }
}

export const terminalToolManager = TerminalToolManager.getInstance();

export function registerTerminalTools(): void {
  terminalToolManager.registerTool();
}
