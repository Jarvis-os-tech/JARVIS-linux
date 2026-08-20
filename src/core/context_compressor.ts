// Hermes-Grade Context Compressor & Trajectory Compactor for J.A.R.V.I.S.
// Protects token budget, prevents amnesia, and ensures prompt cache stability.

import { AgentMessage } from './hermes_agent_runtime';
import { logOrchestrator } from './logger';

export interface CompressionStats {
  originalTokens: number;
  compressedTokens: number;
  reclaimedTokens: number;
  messagesPruned: number;
}

const MAX_TOOL_OUTPUT_CHARS = 8000;
const PROTECT_FIRST_N = 3;
const PROTECT_LAST_N = 15;

export class ContextCompressor {
  private static instance: ContextCompressor;

  public static getInstance(): ContextCompressor {
    if (!ContextCompressor.instance) {
      ContextCompressor.instance = new ContextCompressor();
    }
    return ContextCompressor.instance;
  }

  /**
   * Estimate token count of a string (rough heuristic ~4 chars per token).
   */
  public estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  /**
   * Estimate token count of message history.
   */
  public estimateHistoryTokens(messages: AgentMessage[]): number {
    let total = 0;
    for (const m of messages) {
      total += this.estimateTokens(m.content);
      if (m.tool_calls) {
        total += this.estimateTokens(JSON.stringify(m.tool_calls));
      }
    }
    return total;
  }

  /**
   * Proactively trim oversized individual tool outputs before adding to history.
   */
  public pruneToolOutput(output: string): string {
    if (!output || output.length <= MAX_TOOL_OUTPUT_CHARS) {
      return output;
    }

    const head = output.slice(0, 3000);
    const tail = output.slice(-2000);
    const omitted = output.length - 5000;

    logOrchestrator.debug(`Pruned large tool output (${output.length} chars -> 5000 chars, reclaimed ~${Math.round(omitted / 4)} tokens)`);
    return `${head}\n\n... [PRUNED ${omitted} CHARACTERS FOR CONTEXT BUDGET EFFICIENCY] ...\n\n${tail}`;
  }

  /**
   * Compress conversation history if token count exceeds threshold.
   */
  public compressHistory(messages: AgentMessage[], maxTokens = 64000): { messages: AgentMessage[]; stats: CompressionStats } {
    const originalTokens = this.estimateHistoryTokens(messages);

    if (originalTokens < maxTokens || messages.length <= PROTECT_FIRST_N + PROTECT_LAST_N) {
      return {
        messages,
        stats: {
          originalTokens,
          compressedTokens: originalTokens,
          reclaimedTokens: 0,
          messagesPruned: 0,
        },
      };
    }

    logOrchestrator.info(`Context compression triggered: ${originalTokens} tokens in ${messages.length} messages.`);

    const protectedHead = messages.slice(0, PROTECT_FIRST_N);
    const protectedTail = messages.slice(-PROTECT_LAST_N);
    const middle = messages.slice(PROTECT_FIRST_N, -PROTECT_LAST_N);

    // Summarize the middle portion
    const summaryLines: string[] = [];
    for (const m of middle) {
      if (m.role === 'user') {
        summaryLines.push(`- User asked: ${m.content.slice(0, 150)}`);
      } else if (m.role === 'tool') {
        summaryLines.push(`- Tool (${m.name || 'exec'}) executed.`);
      } else if (m.role === 'assistant' && m.content) {
        summaryLines.push(`- Assistant: ${m.content.slice(0, 150)}`);
      }
    }

    const summaryMessage: AgentMessage = {
      role: 'system',
      content: `[COMPACTED CONVERSATION TRAJECTORY - ${middle.length} PRIOR TURNS SUMMARIZED]\n${summaryLines.join('\n')}`,
    };

    const compressed = [...protectedHead, summaryMessage, ...protectedTail];
    const compressedTokens = this.estimateHistoryTokens(compressed);
    const reclaimedTokens = Math.max(0, originalTokens - compressedTokens);

    logOrchestrator.info(`Context compression complete: reclaimed ~${reclaimedTokens} tokens (now ${compressedTokens} tokens).`);

    return {
      messages: compressed,
      stats: {
        originalTokens,
        compressedTokens,
        reclaimedTokens,
        messagesPruned: middle.length,
      },
    };
  }
}

export const contextCompressor = ContextCompressor.getInstance();
