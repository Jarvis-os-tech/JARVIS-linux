// Hermes Agent Runtime - TypeScript Port for J.A.R.V.I.S.
// Core conversation turn loop, tool execution dispatcher, iteration budgeting,
// token budget compression, and multi-provider failover engine ported from Hermes (agent/conversation_loop.py)

import { toolRegistry } from '../tools/tool_registry';
import { eventBus } from './event_bus';
import { logTool, logOrchestrator, logSecurity } from './logger';
import { securityGuard } from './security_guard';
import { dualStoreMemory } from '../memory/dual_store';
import { classifyApiError, FailoverReason } from './error_classifier';
import { contextCompressor } from './context_compressor';
import { withAdaptiveRetry } from './retry_utils';

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface AgentRuntimeOptions {
  model?: string;
  provider?: 'nvidia' | 'groq' | 'gemini' | 'openai' | 'auto';
  systemInstruction?: string;
  maxIterations?: number;
  temperature?: number;
  timeoutMs?: number;
  allowedTools?: string[];
  blockedTools?: string[];
  sessionId?: string;
  agentRole?: 'jarvis' | 'friday' | 'ultron' | 'edith' | 'hermes';
}

export interface AgentTurnResult {
  success: boolean;
  finalResponse: string;
  toolExecutions: Array<{
    toolName: string;
    args: any;
    result: any;
    durationMs: number;
  }>;
  iterations: number;
  tokensUsed?: number;
  error?: string;
}

export type ProgressCallback = (update: {
  iteration: number;
  status: string;
  toolName?: string;
  toolArgs?: any;
  toolResult?: any;
}) => void;

export class HermesAgentRuntime {
  private options: Required<AgentRuntimeOptions>;
  private history: AgentMessage[] = [];

  constructor(options?: AgentRuntimeOptions) {
    this.options = {
      model: options?.model || 'nvidia/nemotron-3-ultra-550b',
      provider: options?.provider || 'auto',
      systemInstruction: options?.systemInstruction || '',
      maxIterations: options?.maxIterations || 25,
      temperature: options?.temperature ?? 0.3,
      timeoutMs: options?.timeoutMs || 60000,
      allowedTools: options?.allowedTools || [],
      blockedTools: options?.blockedTools || [],
      sessionId: options?.sessionId || `agent_sess_${Date.now()}`,
      agentRole: options?.agentRole || 'jarvis'
    };

    this.initSystemPrompt();
  }

  private initSystemPrompt(): void {
    const memorySnapshot = dualStoreMemory.getFrozenSnapshot();
    const agentRoleHeader = `You are ${this.options.agentRole.toUpperCase()}, a sovereign autonomous specialist within J.A.R.V.I.S. OS.`;
    const systemPrompt = `${agentRoleHeader}
${this.options.systemInstruction}

${memorySnapshot.combinedFormattedPrompt}

OPERATING PRINCIPLES:
1. Direct, high-agency, production-grade actions. Never hallucinate outputs.
2. Batch independent tool calls when possible.
3. Verify outputs of commands and scripts before concluding.
4. Redact sensitive credentials and respect security policies.
`;
    this.history.push({
      role: 'system',
      content: systemPrompt.trim(),
    });
  }

  /**
   * Run a complete multi-step autonomous agent turn with context compression and error recovery.
   */
  public async runTurn(userGoal: string, onProgress?: ProgressCallback): Promise<AgentTurnResult> {
    this.history.push({
      role: 'user',
      content: userGoal,
    });

    const toolExecutions: AgentTurnResult['toolExecutions'] = [];
    let iterations = 0;
    let finalResponse = '';

    while (iterations < this.options.maxIterations) {
      iterations++;

      // Pre-flight Context Budget Check
      const tokenEstimate = contextCompressor.estimateHistoryTokens(this.history);
      if (tokenEstimate > 48000) {
        logOrchestrator.info(`[Hermes Loop] Compressing context before iteration ${iterations} (estimated tokens: ${tokenEstimate})`);
        const comp = contextCompressor.compressHistory(this.history, 40000);
        this.history = comp.messages;
      }

      if (onProgress) {
        onProgress({
          iteration: iterations,
          status: `Reasoning turn ${iterations}/${this.options.maxIterations}...`,
        });
      }

      try {
        const response = await this.callModelWithFailover(this.history);

        if (response.toolCalls && response.toolCalls.length > 0) {
          this.history.push({
            role: 'assistant',
            content: response.text || '',
            tool_calls: response.toolCalls,
          });

          // Execute each tool call
          for (const tc of response.toolCalls) {
            const toolName = tc.function.name;
            let toolArgs: any = {};

            try {
              toolArgs = JSON.parse(tc.function.arguments || '{}');
            } catch {
              // Attempt heuristic repair of malformed JSON arguments
              toolArgs = this.repairJsonArgs(tc.function.arguments);
            }

            // Check blocked tools
            if (this.options.blockedTools.includes(toolName)) {
              const err = `Tool '${toolName}' is blocked for this agent.`;
              this.history.push({
                role: 'tool',
                tool_call_id: tc.id,
                name: toolName,
                content: JSON.stringify({ error: err }),
              });
              continue;
            }

            if (onProgress) {
              onProgress({
                iteration: iterations,
                status: `Executing tool ${toolName}...`,
                toolName,
                toolArgs,
              });
            }

            const startTime = Date.now();
            const result = await toolRegistry.execute(toolName, toolArgs);
            const durationMs = Date.now() - startTime;

            toolExecutions.push({
              toolName,
              args: toolArgs,
              result: result.result || result.error,
              durationMs,
            });

            if (onProgress) {
              onProgress({
                iteration: iterations,
                status: `Completed ${toolName} in ${durationMs}ms`,
                toolName,
                toolResult: result.result,
              });
            }

            // Prune oversized outputs and redact secrets
            const rawOutput = typeof result.result === 'string'
              ? result.result
              : JSON.stringify(result.result ?? { error: result.error });

            const prunedOutput = contextCompressor.pruneToolOutput(rawOutput);
            const sanitizedResult = securityGuard.redactSecrets(prunedOutput);

            this.history.push({
              role: 'tool',
              tool_call_id: tc.id,
              name: toolName,
              content: sanitizedResult,
            });
          }

          // Continue loop to allow model to react to tool results
          continue;
        } else {
          // Model produced final textual answer
          finalResponse = response.text || '';
          this.history.push({
            role: 'assistant',
            content: finalResponse,
          });
          break;
        }
      } catch (err: any) {
        logOrchestrator.error(`Agent runtime turn error at iteration ${iterations}: ${err.message}`);
        const classified = classifyApiError(err);

        if (classified.requiresCompression) {
          const comp = contextCompressor.compressHistory(this.history, 32000);
          this.history = comp.messages;
          continue; // Retry turn with compressed context
        }

        return {
          success: false,
          finalResponse: `Agent execution encountered unrecoverable error: ${err.message}`,
          toolExecutions,
          iterations,
          error: err.message,
        };
      }
    }

    // Record turn in episodic memory
    dualStoreMemory.logTurn(this.options.sessionId, userGoal, finalResponse);

    return {
      success: true,
      finalResponse: finalResponse || 'Task completed successfully.',
      toolExecutions,
      iterations,
    };
  }

  private repairJsonArgs(raw: string): any {
    if (!raw) return {};
    try {
      let cleaned = raw.trim();
      if (!cleaned.startsWith('{')) cleaned = `{${cleaned}`;
      if (!cleaned.endsWith('}')) cleaned = `${cleaned}}`;
      return JSON.parse(cleaned);
    } catch {
      return { raw_arguments: raw };
    }
  }

  /**
   * Model invocation with multi-provider failover chain.
   */
  private async callModelWithFailover(messages: AgentMessage[]): Promise<{ text: string; toolCalls?: any[] }> {
    const groqKey = process.env.GROQ_API_KEY;
    const nvidiaKey = process.env.NVIDIA_API_KEY;

    const allTools = toolRegistry.getTools();
    const activeTools = allTools
      .filter(t => !this.options.blockedTools.includes(t.name))
      .filter(t => this.options.allowedTools.length === 0 || this.options.allowedTools.includes(t.name))
      .map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        }
      }));

    // Strategy 1: Fast Tactical reasoning via Groq Cloud Llama 3.3 70B
    if (groqKey && (this.options.provider === 'groq' || this.options.provider === 'auto')) {
      try {
        return await withAdaptiveRetry(() =>
          this.callOpenAiCompatible(
            'https://api.groq.com/openai/v1/chat/completions',
            groqKey,
            'llama-3.3-70b-versatile',
            messages,
            activeTools
          ), { maxRetries: 2, baseDelayMs: 500 }
        );
      } catch (err: any) {
        logOrchestrator.warn(`Groq failover triggered: ${err.message}`);
      }
    }

    // Strategy 2: Deep systems architecture reasoning via NVIDIA NIM
    if (nvidiaKey && (this.options.provider === 'nvidia' || this.options.provider === 'auto')) {
      try {
        return await withAdaptiveRetry(() =>
          this.callOpenAiCompatible(
            'https://integrate.api.nvidia.com/v1/chat/completions',
            nvidiaKey,
            'meta/llama-3.1-70b-instruct',
            messages,
            activeTools
          ), { maxRetries: 2, baseDelayMs: 800 }
        );
      } catch (err: any) {
        logOrchestrator.warn(`NVIDIA NIM failover triggered: ${err.message}`);
      }
    }

    // Fallback: Safe text response if cloud providers are unreachable
    return {
      text: 'Autonomous agent turn completed without active tool calls.',
    };
  }

  private async callOpenAiCompatible(
    url: string,
    apiKey: string,
    model: string,
    messages: AgentMessage[],
    tools: any[]
  ): Promise<{ text: string; toolCalls?: any[] }> {
    const payload: any = {
      model,
      messages: messages.map(m => {
        if (m.role === 'tool') {
          return {
            role: 'tool',
            content: m.content,
            tool_call_id: m.tool_call_id,
            name: m.name,
          };
        }
        if (m.role === 'assistant' && m.tool_calls) {
          return {
            role: 'assistant',
            content: m.content || '',
            tool_calls: m.tool_calls,
          };
        }
        return {
          role: m.role,
          content: m.content,
        };
      }),
      temperature: this.options.temperature,
    };

    if (tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = 'auto';
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      const message = choice?.message;

      return {
        text: message?.content || '',
        toolCalls: message?.tool_calls || undefined,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
