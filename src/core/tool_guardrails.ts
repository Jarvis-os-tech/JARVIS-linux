// Hermes-Grade Tool Loop Guardrails & Circuit Breakers for J.A.R.V.I.S.
// Protects against infinite loops, repeated tool failures, and idempotent no-progress deadlocks.

import { logTool } from './logger';
import { eventBus } from './event_bus';

export interface GuardrailVerdict {
  allowed: boolean;
  warning?: string;
  hardStop?: boolean;
}

export class ToolLoopGuardrails {
  private static instance: ToolLoopGuardrails;

  private exactFailureCounts = new Map<string, number>();
  private toolFailureCounts = new Map<string, number>();
  private lastToolCallFingerprint = '';
  private identicalCallCount = 0;

  public static getInstance(): ToolLoopGuardrails {
    if (!ToolLoopGuardrails.instance) {
      ToolLoopGuardrails.instance = new ToolLoopGuardrails();
    }
    return ToolLoopGuardrails.instance;
  }

  public reset(): void {
    this.exactFailureCounts.clear();
    this.toolFailureCounts.clear();
    this.lastToolCallFingerprint = '';
    this.identicalCallCount = 0;
  }

  /**
   * Check before a tool call is executed.
   */
  public checkPreExecute(toolName: string, args: any): GuardrailVerdict {
    const fingerprint = `${toolName}:${JSON.stringify(args || {})}`;

    if (fingerprint === this.lastToolCallFingerprint) {
      this.identicalCallCount++;
      if (this.identicalCallCount >= 5) {
        const warning = `Circuit Breaker: Tool '${toolName}' called 5 consecutive times with identical arguments without progress. Hard stop triggered.`;
        logTool.error(warning);
        return { allowed: false, warning, hardStop: true };
      }
      if (this.identicalCallCount >= 3) {
        const warning = `Warning: Tool '${toolName}' called 3 times with identical arguments. Re-evaluating strategy.`;
        logTool.warn(warning);
        return { allowed: true, warning };
      }
    } else {
      this.lastToolCallFingerprint = fingerprint;
      this.identicalCallCount = 1;
    }

    const toolFails = this.toolFailureCounts.get(toolName) || 0;
    if (toolFails >= 8) {
      const warning = `Circuit Breaker: Tool '${toolName}' has failed 8 times in this session. Tool temporarily disabled.`;
      logTool.error(warning);
      return { allowed: false, warning, hardStop: true };
    }

    return { allowed: true };
  }

  /**
   * Record outcome after tool execution.
   */
  public recordResult(toolName: string, args: any, success: boolean, error?: string): void {
    if (success) {
      // Clear failure counter for this tool on success
      this.toolFailureCounts.delete(toolName);
      return;
    }

    const currentFails = (this.toolFailureCounts.get(toolName) || 0) + 1;
    this.toolFailureCounts.set(toolName, currentFails);

    if (error) {
      const exactKey = `${toolName}:${error.slice(0, 100)}`;
      const exactFails = (this.exactFailureCounts.get(exactKey) || 0) + 1;
      this.exactFailureCounts.set(exactKey, exactFails);

      if (exactFails >= 2) {
        logTool.warn(`Guardrail Warning: Exact failure repeated ${exactFails}x for '${toolName}': "${error.slice(0, 80)}"`);
      }
    }
  }

  public getMetrics(): { totalExecutions: number; circuitBreakersTripped: number } {
    let tripped = 0;
    for (const count of this.toolFailureCounts.values()) {
      if (count >= 8) tripped++;
    }
    return {
      totalExecutions: Array.from(this.toolFailureCounts.values()).reduce((a, b) => a + b, 0),
      circuitBreakersTripped: tripped,
    };
  }
}

export const toolGuardrails = ToolLoopGuardrails.getInstance();
