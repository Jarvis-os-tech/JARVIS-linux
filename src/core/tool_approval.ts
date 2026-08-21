// Dangerous Command Approval Engine for J.A.R.V.I.S.
// Intercepts destructive actions, manages interactive approval states, and supports allowlisting.
// Ported and enhanced from Hermes (tools/approval.py) and OpenClaw (exec-approvals.json)

import { logSecurity } from './logger';
import { eventBus } from './event_bus';
import { scanForThreats } from './threat_patterns';

export interface PendingApproval {
  id: string;
  command: string;
  toolName: string;
  reason: string;
  requestedBy: string; // 'jarvis' | 'friday' | 'ultron' | 'edith' | 'hermes' | 'voice'
  createdAt: number;
  status: 'pending' | 'approved' | 'rejected' | 'timeout';
  resolve?: (approved: boolean) => void;
}

export class ToolApprovalEngine {
  private static instance: ToolApprovalEngine;
  private pendingApprovals: Map<string, PendingApproval> = new Map();
  private allowlistedCommands: Set<string> = new Set();
  private yoloMode: boolean = false;

  public static getInstance(): ToolApprovalEngine {
    if (!ToolApprovalEngine.instance) {
      ToolApprovalEngine.instance = new ToolApprovalEngine();
    }
    return ToolApprovalEngine.instance;
  }

  constructor() {
    this.yoloMode = process.env.JARVIS_YOLO_MODE === '1' || process.env.JARVIS_YOLO_MODE === 'true';
    if (this.yoloMode) {
      logSecurity.warn('⚠️ YOLO MODE IS ACTIVE: Automatic approval of all dangerous commands.');
    }
  }

  /**
   * Determine if a command or tool execution requires explicit operator approval.
   */
  public isDangerous(toolName: string, args: any): { dangerous: boolean; reason?: string } {
    if (this.yoloMode) {
      return { dangerous: false };
    }

    const commandStr = typeof args === 'string' ? args : args?.command || args?.cmd || '';

    // Check allowlist
    if (commandStr && this.allowlistedCommands.has(commandStr.trim())) {
      return { dangerous: false };
    }

    // 1. Destructive shell commands
    if (toolName === 'execute_system_command' || toolName === 'terminal_exec' || toolName === 'bash') {
      const threat = scanForThreats(commandStr, 'strict');
      if (threat.isThreat) {
        return { dangerous: true, reason: threat.matchedDescription || 'Threat pattern detected' };
      }

      if (/\b(?:rm\s+-[a-zA-Z]*r|rmdir|mkfs|fdisk|dd\s+if=|killall|reboot|shutdown|systemctl\s+(?:stop|restart|disable))\b/i.test(commandStr)) {
        return { dangerous: true, reason: 'Command can cause system disruption or data loss' };
      }
    }

    // 2. Destructive file operations
    if (toolName === 'delete_file' || toolName === 'overwrite_system_file') {
      return { dangerous: true, reason: `Destructive file operation on ${args?.path || 'target'}` };
    }

    return { dangerous: false };
  }

  /**
   * Request approval for a dangerous operation. Returns a Promise that resolves when approved or rejected.
   */
  public async requestApproval(
    toolName: string,
    args: any,
    requestedBy: string = 'system',
    timeoutMs: number = 30000
  ): Promise<{ approved: boolean; reason?: string }> {
    const danger = this.isDangerous(toolName, args);
    if (!danger.dangerous) {
      return { approved: true };
    }

    const command = typeof args === 'string' ? args : args?.command || args?.cmd || JSON.stringify(args);
    const id = `appr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    logSecurity.warn(`[Approval Gate] Requesting operator approval for [${toolName}] requested by [${requestedBy}]: ${command}`);

    return new Promise((resolve) => {
      const pending: PendingApproval = {
        id,
        command,
        toolName,
        reason: danger.reason || 'High risk operation',
        requestedBy,
        createdAt: Date.now(),
        status: 'pending',
        resolve: (approved: boolean) => {
          clearTimeout(timer);
          this.pendingApprovals.delete(id);
          resolve({
            approved,
            reason: approved ? 'Approved by operator' : 'Rejected by operator or security policy'
          });
        }
      };

      this.pendingApprovals.set(id, pending);

      // Emit event across event bus (WebSocket, UI HUD, CLI)
      eventBus.emit('security:approval_required', {
        id,
        toolName,
        command,
        reason: pending.reason,
        requestedBy,
        timeoutMs
      });

      const timer = setTimeout(() => {
        if (this.pendingApprovals.has(id)) {
          this.pendingApprovals.delete(id);
          logSecurity.warn(`[Approval Gate] Approval timed out for [${id}]`);
          eventBus.emit('security:approval_timeout', { id });
          resolve({ approved: false, reason: 'Approval request timed out after 30 seconds' });
        }
      }, timeoutMs);
    });
  }

  /**
   * Submit an operator decision on a pending approval
   */
  public resolveApproval(id: string, approved: boolean, remember: boolean = false): boolean {
    const pending = this.pendingApprovals.get(id);
    if (!pending) return false;

    if (approved && remember && pending.command) {
      this.allowlistedCommands.add(pending.command.trim());
      logSecurity.info(`[Approval Gate] Allowlisted command: ${pending.command}`);
    }

    pending.status = approved ? 'approved' : 'rejected';
    if (pending.resolve) {
      pending.resolve(approved);
    }
    return true;
  }

  public getPendingApprovals(): PendingApproval[] {
    return Array.from(this.pendingApprovals.values());
  }
}

export const toolApproval = ToolApprovalEngine.getInstance();
