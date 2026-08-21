// Tirith Pre-Execution Security Scanner for J.A.R.V.I.S.
// Runs the Tirith security binary or performs robust local AST/heuristic scanning to detect
// command injection, homograph URLs, dangerous pipe-to-interpreters, and privilege escalations.
// Ported and enhanced from Hermes (tools/tirith_security.py)

import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logSecurity } from './logger';
import { scanForThreats } from './threat_patterns';

const execFileAsync = promisify(execFile);

export interface TirithFinding {
  rule_id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  line?: number;
  snippet?: string;
}

export interface TirithVerdict {
  allowed: boolean;
  verdict: 'allow' | 'block' | 'warn';
  exitCode: number;
  findings: TirithFinding[];
  summary: string;
  engine: 'tirith_binary' | 'builtin_ast';
}

export class TirithSecurityEngine {
  private static instance: TirithSecurityEngine;
  private tirithBinaryPath: string | null = null;
  private binaryChecked = false;

  public static getInstance(): TirithSecurityEngine {
    if (!TirithSecurityEngine.instance) {
      TirithSecurityEngine.instance = new TirithSecurityEngine();
    }
    return TirithSecurityEngine.instance;
  }

  constructor() {
    this.locateBinary();
  }

  private locateBinary(): void {
    const candidatePaths = [
      path.join(os.homedir(), '.hermes', 'bin', 'tirith'),
      path.join(os.homedir(), '.local', 'bin', 'tirith'),
      '/usr/local/bin/tirith',
      '/usr/bin/tirith'
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          fs.accessSync(p, fs.constants.X_OK);
          this.tirithBinaryPath = p;
          logSecurity.info(`Tirith binary discovered at: ${p}`);
          break;
        } catch {
          // not executable
        }
      }
    }
    this.binaryChecked = true;
  }

  /**
   * Scan shell command string before execution.
   */
  public async scanCommand(command: string): Promise<TirithVerdict> {
    if (!command || !command.trim()) {
      return {
        allowed: true,
        verdict: 'allow',
        exitCode: 0,
        findings: [],
        summary: 'Empty command',
        engine: 'builtin_ast'
      };
    }

    // 1. Run native Tirith binary if present
    if (this.tirithBinaryPath) {
      try {
        const { stdout, stderr } = await execFileAsync(
          this.tirithBinaryPath,
          ['scan', '--json', '--command', command],
          { timeout: 3000 }
        );
        const parsed = JSON.parse(stdout || '{}');
        const allowed = parsed.verdict !== 'block';
        return {
          allowed,
          verdict: parsed.verdict || (allowed ? 'allow' : 'block'),
          exitCode: allowed ? 0 : 1,
          findings: parsed.findings || [],
          summary: parsed.summary || (allowed ? 'Tirith binary scan passed' : 'Tirith binary blocked command'),
          engine: 'tirith_binary'
        };
      } catch (err: any) {
        if (err.code === 1) {
          // Block verdict from binary
          return {
            allowed: false,
            verdict: 'block',
            exitCode: 1,
            findings: [{ rule_id: 'tirith_blocked', severity: 'high', message: err.stdout || err.message }],
            summary: 'Tirith binary detected security violation',
            engine: 'tirith_binary'
          };
        }
        logSecurity.warn(`Tirith binary scan error (${err.message}). Falling back to builtin AST engine.`);
      }
    }

    // 2. Fallback to builtin AST / heuristic scanner
    return this.builtinScan(command);
  }

  /**
   * Built-in AST & heuristic analysis when binary is not active
   */
  private builtinScan(command: string): TirithVerdict {
    const findings: TirithFinding[] = [];

    // Check shared threat patterns
    const threat = scanForThreats(command, 'strict');
    if (threat.isThreat) {
      findings.push({
        rule_id: threat.matchedPatternId || 'threat_pattern',
        severity: threat.severity,
        message: threat.matchedDescription || 'Malicious pattern detected'
      });
    }

    // Check dangerous pipe to shell
    if (/\|\s*(?:sudo\s+)?(?:bash|sh|zsh|python|perl|ruby)/i.test(command)) {
      findings.push({
        rule_id: 'pipe_to_interpreter',
        severity: 'high',
        message: 'Direct piping of unverified payload to shell interpreter'
      });
    }

    // Check privilege escalation attempts
    if (/(?:chmod\s+[0-7]*777|chown\s+root|sudo\s+su|sudo\s+-i)/i.test(command)) {
      findings.push({
        rule_id: 'privilege_escalation',
        severity: 'high',
        message: 'Uncontrolled privilege modification or root escalation'
      });
    }

    // Check suspicious base64 decode execution
    if (/(?:base64\s+-d|openssl\s+enc\s+-d).*\s*\|\s*(?:bash|sh)/i.test(command)) {
      findings.push({
        rule_id: 'obfuscated_execution',
        severity: 'critical',
        message: 'Execution of obfuscated base64 payload'
      });
    }

    const hasCriticalOrHigh = findings.some(f => f.severity === 'critical' || f.severity === 'high');
    const allowed = !hasCriticalOrHigh;

    return {
      allowed,
      verdict: allowed ? (findings.length > 0 ? 'warn' : 'allow') : 'block',
      exitCode: allowed ? 0 : 1,
      findings,
      summary: allowed ? (findings.length > 0 ? 'Allowed with warnings' : 'Passed security AST checks') : 'Blocked by security AST rule',
      engine: 'builtin_ast'
    };
  }
}

export const tirithSecurity = TirithSecurityEngine.getInstance();
