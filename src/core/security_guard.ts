// Security Guard & Secret Redactor for J.A.R.V.I.S.
// Integrates Tirith AST Binary Scanner, Threat Pattern Registry, and Interactive Tool Approval Gates.
// Ported & Enhanced from Hermes Security Architecture (tirith_security, threat_patterns, redact.py, approval.py)

import fs from 'fs';
import path from 'path';
import os from 'os';
import { eventBus } from './event_bus';
import { logSecurity } from './logger';
import { tirithSecurity } from './tirith_security';
import { scanForThreats } from './threat_patterns';
import { toolApproval } from './tool_approval';

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

export class SecurityGuard {
  private static instance: SecurityGuard;

  public static getInstance(): SecurityGuard {
    if (!SecurityGuard.instance) {
      SecurityGuard.instance = new SecurityGuard();
    }
    return SecurityGuard.instance;
  }

  /**
   * Validate a shell command synchronously using threat patterns and heuristics.
   */
  public validateCommand(command: string): CommandSecurityVerdict {
    if (!command || typeof command !== 'string') {
      return { allowed: false, reason: 'Empty command.', riskLevel: 'high' };
    }

    const trimmed = command.trim();

    // Check shared threat patterns
    const threat = scanForThreats(trimmed, 'strict');
    if (threat.isThreat) {
      logSecurity.error(`Security Alert: Blocked dangerous command execution -> ${threat.matchedDescription}`);
      eventBus.emit('security:blocked', { toolName: 'execute_linux_command', reason: threat.matchedDescription, risk: threat.severity });
      return { allowed: false, reason: threat.matchedDescription, riskLevel: threat.severity };
    }

    return { allowed: true, riskLevel: 'safe' };
  }

  /**
   * Deep async validation using Tirith binary scanner + threat pattern engine.
   */
  public async validateCommandDeep(command: string): Promise<CommandSecurityVerdict> {
    const syncVerdict = this.validateCommand(command);
    if (!syncVerdict.allowed) {
      return syncVerdict;
    }

    const tirithVerdict = await tirithSecurity.scanCommand(command);
    if (!tirithVerdict.allowed) {
      logSecurity.warn(`Tirith blocked command: ${tirithVerdict.summary}`);
      eventBus.emit('security:blocked', { toolName: 'execute_linux_command', reason: tirithVerdict.summary, risk: 'high' });
      return {
        allowed: false,
        reason: tirithVerdict.summary,
        riskLevel: 'high'
      };
    }

    return {
      allowed: true,
      riskLevel: tirithVerdict.verdict === 'warn' ? 'low' : 'safe'
    };
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

    const threat = scanForThreats(content, 'context');
    if (threat.isThreat) {
      logSecurity.warn(`Prompt injection pattern flagged: ${threat.matchedDescription}`);
      return { safe: false, reason: threat.matchedDescription };
    }

    return { safe: true };
  }
}

export const securityGuard = SecurityGuard.getInstance();
