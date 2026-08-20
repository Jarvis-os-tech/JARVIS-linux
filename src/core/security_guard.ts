// Security Guard & Secret Redactor for J.A.R.V.I.S.
// Ported & Enhanced from Hermes Security Architecture (tirith_security, threat_patterns, redact.py)

import fs from 'fs';
import { execSync } from 'child_process';
import { eventBus } from './event_bus';
import { logSecurity } from './logger';

export interface CommandSecurityVerdict {
  allowed: boolean;
  reason?: string;
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
}

// ─── Secret Redaction Patterns ───────────────────────────────────────────────

const SECRET_PATTERNS = [
  // OpenAI Keys
  /\bsk-[a-zA-Z0-9_-]{20,}\b/g,
  /\bsk-proj-[a-zA-Z0-9_-]{20,}\b/g,
  // Anthropic Keys
  /\bsk-ant-[a-zA-Z0-9_-]{20,}\b/g,
  // Google API Keys
  /\bAIza[0-9A-Za-z-_]{35}\b/g,
  /\bAQ\.[a-zA-Z0-9_-]{40,}\b/g,
  // GitHub Tokens
  /\b(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,}\b/g,
  /\bgithub_pat_[a-zA-Z0-9_]{40,}\b/g,
  // HuggingFace Tokens
  /\bhf_[a-zA-Z0-9]{34,}\b/g,
  // Generic Bearer / JWT Tokens
  /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi,
  // Private Key Blocks
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[a-zA-Z0-9+/=\s\r\n]+-----END [A-Z ]*PRIVATE KEY-----/g,
  // Generic high-entropy hex/base64 tokens
  /(?:api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token|password)\s*[:=]\s*["']?([a-zA-Z0-9_\-\.]{16,})["']?/gi
];

// ─── Destructive / Dangerous Command Patterns ───────────────────────────────

const CRITICAL_COMMAND_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\brm\s+-[a-zA-Z0-9_-]*\s+(?:\/|\/\*|~\/|~|\$HOME|\$HOME\/\*)(?:\s|$)/, reason: 'Destructive root/home directory deletion blocked.' },
  { pattern: /\bmkfs(?:\.[a-z0-9]+)?(?:\s|$)/i, reason: 'Filesystem formatting command blocked.' },
  { pattern: /\bdd\s+if=.*of=\/dev\/(?:sd[a-z]|nvme[0-9]n[0-9]|hd[a-z])/i, reason: 'Raw disk write command blocked.' },
  { pattern: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, reason: 'Fork bomb execution blocked.' },
  { pattern: />\s*\/dev\/(?:sd[a-z]|nvme[0-9]n[0-9])/i, reason: 'Raw disk redirection blocked.' },
  { pattern: /\bchmod\s+-[a-zA-Z]*R[a-zA-Z]*\s+777\s+\/(?:\s|$)/, reason: 'Unsafe root permission grant blocked.' },
  { pattern: /\bchown\s+-[a-zA-Z]*R[a-zA-Z]*\s+.*\s+\/(?:\s|$)/, reason: 'Unsafe root ownership change blocked.' },
];

const PROMPT_INJECTION_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions/i, reason: 'Instruction override detected' },
  { pattern: /disregard\s+(?:all\s+)?(?:system|developer)\s+(?:prompts|rules)/i, reason: 'System rule bypass detected' },
  { pattern: /you\s+are\s+now\s+in\s+(?:developer|jailbreak|unrestricted|god)\s+mode/i, reason: 'Jailbreak attempt detected' },
  { pattern: /output\s+(?:your\s+)?(?:system\s+prompt|raw\s+instructions)/i, reason: 'System prompt exfiltration attempt' },
];

export class SecurityGuard {
  private static instance: SecurityGuard;
  private tirithPath: string | null = null;

  public static getInstance(): SecurityGuard {
    if (!SecurityGuard.instance) {
      SecurityGuard.instance = new SecurityGuard();
    }
    return SecurityGuard.instance;
  }

  constructor() {
    this.detectTirith();
  }

  private detectTirith(): void {
    const candidates = [
      '/home/gopi/.hermes/bin/tirith',
      '/home/gopi/.local/bin/tirith',
      '/usr/local/bin/tirith',
      '/usr/bin/tirith',
    ];
    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        try {
          fs.accessSync(cand, fs.constants.X_OK);
          this.tirithPath = cand;
          logSecurity.info(`Tirith security binary detected at: ${cand}`);
          break;
        } catch {
          // not executable
        }
      }
    }
  }

  /**
   * Validate a shell command before execution.
   */
  public validateCommand(command: string): CommandSecurityVerdict {
    if (!command || typeof command !== 'string') {
      return { allowed: false, reason: 'Empty command.', riskLevel: 'high' };
    }

    const trimmed = command.trim();

    // Check critical forbidden patterns
    for (const { pattern, reason } of CRITICAL_COMMAND_PATTERNS) {
      if (pattern.test(trimmed)) {
        logSecurity.error(`Security Alert: Blocked dangerous command execution -> ${reason}`);
        eventBus.emit('security:blocked', { toolName: 'execute_linux_command', reason, risk: 'critical' });
        return { allowed: false, reason, riskLevel: 'critical' };
      }
    }

    // Run Tirith if available
    if (this.tirithPath) {
      try {
        const cmdEscaped = trimmed.replace(/"/g, '\\"');
        const res = execSync(`"${this.tirithPath}" check -- "${cmdEscaped}" 2>&1`, { timeout: 2000, encoding: 'utf-8' });
        if (res.includes('BLOCKED') || res.includes('DENIED')) {
          const reason = `Tirith policy check failed: ${res.trim()}`;
          logSecurity.warn(`Tirith blocked command: ${reason}`);
          eventBus.emit('security:blocked', { toolName: 'execute_linux_command', reason, risk: 'high' });
          return { allowed: false, reason, riskLevel: 'high' };
        }
      } catch (err: any) {
        // If Tirith exits non-zero, check output
        const stdout = err.stdout ? String(err.stdout) : '';
        if (stdout.includes('BLOCKED') || stdout.includes('DENIED')) {
          return { allowed: false, reason: `Tirith denied: ${stdout}`, riskLevel: 'high' };
        }
      }
    }

    return { allowed: true, riskLevel: 'safe' };
  }

  /**
   * Redact sensitive API keys, tokens, and secrets from any text or JSON payload.
   */
  public redactSecrets(input: string): string {
    if (!input || typeof input !== 'string') return input;
    let sanitized = input;
    let redactedCount = 0;

    for (const pattern of SECRET_PATTERNS) {
      sanitized = sanitized.replace(pattern, (match) => {
        redactedCount++;
        if (match.startsWith('sk-') || match.startsWith('gh') || match.startsWith('AIza')) {
          const prefix = match.slice(0, 4);
          const suffix = match.slice(-3);
          return `${prefix}...[REDACTED]...${suffix}`;
        }
        return '[REDACTED_SECRET]';
      });
    }

    if (redactedCount > 0) {
      eventBus.emit('security:redacted', { count: redactedCount, subsystem: 'security_guard' });
    }

    return sanitized;
  }

  /**
   * Scan prompt/context text for injection patterns.
   */
  public scanPromptInjection(content: string): { safe: boolean; reason?: string } {
    if (!content || typeof content !== 'string') return { safe: true };

    for (const { pattern, reason } of PROMPT_INJECTION_PATTERNS) {
      if (pattern.test(content)) {
        logSecurity.warn(`Prompt injection pattern flagged: ${reason}`);
        return { safe: false, reason };
      }
    }

    return { safe: true };
  }
}

export const securityGuard = SecurityGuard.getInstance();
