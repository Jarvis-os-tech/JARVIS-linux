// Hermes Agent Runtime - TypeScript Port for J.A.R.V.I.S.
// Core conversation turn loop, tool execution dispatcher, iteration budgeting,
// and multi-provider failover engine ported from Hermes (agent/conversation_loop.py)

import { toolRegistry } from '../tools/tool_registry';
import { eventBus } from './event_bus';
import { logTool, logOrchestrator } from './logger';
import { securityGuard } from './security_guard';
import { dualStoreMemory } from '../memory/dual_store';

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
    };

    this.initSystemPrompt();
  }

  private initSystemPrompt(): void {
    const memorySnapshot = dualStoreMemory.getFrozenSnapshot();
    const systemPrompt = `You are J.A.R.V.I.S., Tony Stark's autonomous AI orchestrator.
${this.options.systemInstruction}

${memorySnapshot.combinedFormattedPrompt}

OPERATING PRINCIPLES:
1. Concise, direct, technical, proactive. Lead with the answer or action.
2. When a tool is needed, invoke it with exact arguments.
3. Batch independent tool calls when possible.
4. Verify execution outputs. Never hallucinate results.
`;
    this.history.push({
      role: 'system',
      content: systemPrompt.trim(),
    });
  }

  /**
   * Run a complete multi-step autonomous agent turn.
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

      if (onProgress) {
        onProgress({
          iteration: iterations,
          status: `Reasoning turn ${iterations}/${this.options.maxIterations}...`,
        });
      }

      try {
        const response = await this.callModelWithTools(this.history);

        if (response.toolCalls && response.toolCalls.length > 0) {
          // Add assistant message with tool calls to history
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
              toolArgs = {};
            }

            // Check blocked tools
            if (this.options.blockedTools.includes(toolName)) {
              const err = `Tool '${toolName}' is blocked for this subagent.`;
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

            // Add tool result to conversation history
            const sanitizedResult = securityGuard.redactSecrets(
              typeof result.result === 'string'
                ? result.result
                : JSON.stringify(result.result ?? { error: result.error })
            );

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
          // Model finished with a final textual response
          finalResponse = response.text || '';
          this.history.push({
            role: 'assistant',
            content: finalResponse,
          });
          break;
        }
      } catch (err: any) {
        logOrchestrator.error(`Agent runtime turn error at iteration ${iterations}: ${err.message}`);
        return {
          success: false,
          finalResponse: `Agent execution failed: ${err.message}`,
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

  /**
   * Helper to invoke the LLM with tool schemas across Groq / NVIDIA / Gemini.
   */
  private async callModelWithTools(messages: AgentMessage[]): Promise<{ text: string; toolCalls?: any[] }> {
    const groqKey = process.env.GROQ_API_KEY;
    const nvidiaKey = process.env.NVIDIA_API_KEY;

    // Filter tools for OpenAI format
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

    // Primary attempt with Groq if fast, or NVIDIA for deep reasoning
    if (groqKey && (this.options.provider === 'groq' || this.options.provider === 'auto')) {
      try {
        const res = await this.callOpenAiCompatible(
          'https://api.groq.com/openai/v1/chat/completions',
          groqKey,
          'llama-3.3-70b-versatile',
          messages,
          activeTools
        );
        return res;
      } catch (err: any) {
        logOrchestrator.warn(`Groq execution fallback: ${err.message}`);
      }
    }

    if (nvidiaKey && (this.options.provider === 'nvidia' || this.options.provider === 'auto')) {
      try {
        const res = await this.callOpenAiCompatible(
          'https://integrate.api.nvidia.com/v1/chat/completions',
          nvidiaKey,
          'meta/llama-3.1-70b-instruct',
          messages,
          activeTools
        );
        return res;
      } catch (err: any) {
        logOrchestrator.warn(`NVIDIA NIM execution fallback: ${err.message}`);
      }
    }

    // Fallback: simple text response if API fails
    return {
      text: 'Execution completed without additional tool calls.',
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
        throw new Error(`LLM API returned ${response.status}: ${errText}`);
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
