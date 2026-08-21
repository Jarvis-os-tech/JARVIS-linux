// Pluggable Context Engine Interface for J.A.R.V.I.S.
// Defines the abstraction for conversation compaction, token budgeting, and trajectory pruning.
// Ported and enhanced from Hermes (agent/context_engine.py)

import { AgentMessage } from './hermes_agent_runtime';

export interface ContextUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedPromptTokens?: number;
}

export interface CompactionResult {
  compacted: boolean;
  messages: AgentMessage[];
  tokensBefore: number;
  tokensAfter: number;
  reclaimedTokens: number;
  summary?: string;
}

export interface IContextEngine {
  engineName: string;
  onSessionStart(sessionId: string): void;
  updateUsage(usage: ContextUsage): void;
  shouldCompress(messages: AgentMessage[], maxTokens?: number): boolean;
  compress(messages: AgentMessage[], maxTokens?: number): Promise<CompactionResult>;
  onSessionEnd(sessionId: string): void;
}
