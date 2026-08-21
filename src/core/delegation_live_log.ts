// Delegation Live Streaming Log Buffer for J.A.R.V.I.S.
// Captures and broadcasts live progress, tool dispatches, and output streams from delegated subagents.
// Ported and enhanced from Hermes (tools/delegation_live_log.py)

import { eventBus } from './event_bus';

export interface SubagentLogEntry {
  subagentId: string;
  agentRole: string;
  timestamp: number;
  type: 'log' | 'tool_call' | 'tool_result' | 'status' | 'error';
  message: string;
  metadata?: any;
}

export class DelegationLiveLog {
  private static instance: DelegationLiveLog;
  private logs: SubagentLogEntry[] = [];
  private maxLogs: number = 500;

  public static getInstance(): DelegationLiveLog {
    if (!DelegationLiveLog.instance) {
      DelegationLiveLog.instance = new DelegationLiveLog();
    }
    return DelegationLiveLog.instance;
  }

  public record(subagentId: string, agentRole: string, type: SubagentLogEntry['type'], message: string, metadata?: any): void {
    const entry: SubagentLogEntry = {
      subagentId,
      agentRole,
      timestamp: Date.now(),
      type,
      message,
      metadata
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    eventBus.emit('subagent:stream_log', entry);
  }

  public getLogsForSubagent(subagentId: string): SubagentLogEntry[] {
    return this.logs.filter(l => l.subagentId === subagentId);
  }

  public getRecentLogs(count: number = 50): SubagentLogEntry[] {
    return this.logs.slice(-count);
  }
}

export const delegationLiveLog = DelegationLiveLog.getInstance();
