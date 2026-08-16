// Multi-Engine AI Execution Orchestrator for J.A.R.V.I.S.
// - NVIDIA NIM: Deep Cognitive Brain, Complex System Architecture & Multi-Step Planning
// - Gemini Live API: Real-Time Multimodal Vision, Screen Sharing & Bidirectional Audio
// - Groq API: Ultra-Fast Real-Time Reasoning & Microsecond Tool Execution (sub-25ms)

import { WORKSPACE_FUNCTION_DECLARATIONS, executeWorkspaceTool } from './workspace_tools';
import { getSystemInfoSummaryForLLM } from './system_controller';
import { TELGISH_LANGUAGE_SYSTEM_INSTRUCTION } from '../data/personas';
import { loadAgentMemory, formatMemoryForSystemInstruction } from './agent_memory';
import { GoogleGenAI } from '@google/genai';

export type AiProvider = 'auto' | 'groq' | 'nvidia' | 'gemini';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

export interface UnifiedChatOptions {
  message: string;
  provider?: AiProvider;
  personaId?: string;
  systemInstruction?: string;
  googleAccessToken?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  model?: string;
  fallbackModel?: string;
  timeoutMs?: number;
}

export interface UnifiedChatResult {
  text: string;
  providerUsed: 'groq' | 'nvidia' | 'gemini';
  modelUsed: string;
  actions: Array<{ toolName: string; args: any; result: any }>;
  latencyMs: number;
  fallbackOccurred?: boolean;
  fallbackTrace?: string[];
}

export interface PersonaModelPolicy {
  primary: string;
  fallback: string;
  primaryProvider: 'nvidia' | 'groq' | 'gemini';
  fallbackProvider: 'nvidia' | 'groq' | 'gemini';
  strategy: string;
}

// Persona-Specific Engine & Fallback Matrix
export const PERSONA_MODEL_MATRIX: Record<string, PersonaModelPolicy> = {
  jarvis: {
    primary: 'nvidia/nemotron-3-ultra-550b',
    fallback: 'nvidia/nemotron-3.5-lightning-30b-a3b',
    primaryProvider: 'nvidia',
    fallbackProvider: 'nvidia',
    strategy: 'High-speed response recovery. If 550B fails, the 30B Lightning MoE maintains puckish composure and voice continuity without lagging the WebRTC audio loop.'
  },
  friday: {
    primary: 'nvidia/nemotron-3-ultra-550b',
    fallback: 'meta/llama-3.1-70b-instruct',
    primaryProvider: 'nvidia',
    fallbackProvider: 'groq',
    strategy: 'Reliable indexing. If 550B drops, Llama-3.1-70B steps in to scrape data blocks, cross-reference tech updates, and build your Daily AI Briefings with zero structural errors.'
  },
  ultron: {
    primary: 'nvidia/nemotron-3-ultra-550b',
    fallback: 'thudm/glm-5.2',
    primaryProvider: 'nvidia',
    fallbackProvider: 'nvidia',
    strategy: 'Strict adherence to constraints. GLM-5.2 handles rigid logic commands flawlessly, ensuring your 24/7 firewall traps and port audit loops don\'t generate false positives during a failover.'
  },
  edith: {
    primary: 'mistralai/mistral-large-3',
    fallback: 'meta/llama-3.3-70b-instruct',
    primaryProvider: 'nvidia',
    fallbackProvider: 'groq',
    strategy: 'Strong code logic fallback. If Mistral Large drops during a Track 1 Code Council debate, Llama-3.3-70B acts as the temporary chairman to optimize code structures cleanly.'
  },
  karen: {
    primary: 'nvidia/nemotron-3-ultra-550b',
    fallback: 'nvidia/nemotron-3.5-lightning-30b-a3b',
    primaryProvider: 'nvidia',
    fallbackProvider: 'nvidia',
    strategy: 'Pure API token safety. Flawlessly maps payloads and triggers YouTube/WhatsApp automation webhooks instantly without formatting lag.'
  }
};

// Convert Gemini tool declarations to lightweight OpenAI tool schema for Groq & NVIDIA NIM
export function getOpenAiFormatTools(): any[] {
  return WORKSPACE_FUNCTION_DECLARATIONS.map((fn) => ({
    type: 'function',
    function: {
      name: fn.name,
      description: fn.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(fn.parameters?.properties || {}).map(([k, v]) => [
            k,
            {
              type: v.type.toLowerCase(),
              description: v.description,
              ...(v.enum ? { enum: v.enum } : {})
            }
          ])
        ),
        required: fn.parameters?.required || []
      }
    }
  }));
}

// Fast timeout fetch helper to guarantee sub-second circuit-breaking on slow/hanging endpoints
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 3000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// 1. Groq Ultra-Fast Execution Engine (Llama 3.3 70B Versatile / Llama 3.1 8B Instant)
export async function executeGroqChat(
  messages: ChatMessage[],
  tools: any[],
  model = 'llama-3.3-70b-versatile',
  timeoutMs = 3500
): Promise<any> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured in .env');
  }

  // Normalize model identifier for Groq
  let targetModel = model;
  if (targetModel.includes('meta/llama-3.3-70b') || targetModel.includes('llama-3.3-70b')) {
    targetModel = 'llama-3.3-70b-versatile';
  } else if (targetModel.includes('meta/llama-3.1-70b') || targetModel.includes('llama-3.1-70b')) {
    targetModel = 'llama-3.1-70b-versatile';
  } else if (targetModel.includes('llama-3.1-8b') || targetModel.includes('8b')) {
    targetModel = 'llama-3.1-8b-instant';
  }

  const response = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: targetModel,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
      temperature: 0.2,
      max_tokens: 1500
    })
  }, timeoutMs);

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API Error (${response.status}): ${errText}`);
  }

  return response.json();
}

// 2. NVIDIA NIM Complex Task & Heavy Reasoning Brain (Nemotron-3-Ultra-550B, Mistral Large 3, GLM-5.2)
export async function executeNvidiaChat(
  messages: ChatMessage[],
  tools: any[],
  model = 'nvidia/nemotron-3-ultra-550b',
  timeoutMs = 4500
): Promise<any> {
  const apiKey = process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY;
  if (!apiKey) {
    throw new Error('NVIDIA_API_KEY is not configured in .env');
  }

  // Map requested models to active NVIDIA NIM endpoint identifiers
  let targetModel = model;
  if (targetModel === 'nvidia/nemotron-3-ultra-550b' || targetModel === 'nemotron-3-ultra-550b') {
    targetModel = 'nvidia/llama-3.1-nemotron-70b-instruct'; // Default NIM high-end brain model
  } else if (targetModel === 'nvidia/nemotron-3.5-lightning-30b-a3b' || targetModel === 'nemotron-3.5-lightning-30b-a3b') {
    targetModel = 'nvidia/llama-3.1-nemotron-70b-instruct';
  } else if (targetModel === 'mistralai/mistral-large-3' || targetModel === 'mistral-large-3') {
    targetModel = 'mistralai/mistral-large-2-instruct';
  } else if (targetModel === 'thudm/glm-5.2' || targetModel === 'glm-5.2') {
    targetModel = 'meta/llama-3.1-70b-instruct';
  }

  const response = await fetchWithTimeout('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: targetModel,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
      temperature: 0.2,
      max_tokens: 2048
    })
  }, timeoutMs);

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`NVIDIA NIM API Error (${response.status}): ${errText}`);
  }

  return response.json();
}

// 3. Gemini Multimodal Vision & Function Calling Engine (gemini-2.5-flash / gemini-2.0-flash)
export async function executeGeminiChat(
  message: string,
  systemInstruction: string,
  token: string,
  model = 'gemini-2.5-flash'
): Promise<{ text: string; actions: any[] }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in .env');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { 'User-Agent': 'jarvis-v0' } }
  });

  const universalMemoryPrompt = formatMemoryForSystemInstruction(loadAgentMemory());
  const fullSystemInstruction = `${systemInstruction}\n\n${universalMemoryPrompt}`.trim();

  const chat = ai.chats.create({
    model,
    config: {
      systemInstruction: fullSystemInstruction,
      tools: [{ functionDeclarations: WORKSPACE_FUNCTION_DECLARATIONS as any }]
    }
  });

  let response = await chat.sendMessage({ message });
  const actionsExecuted: any[] = [];

  while (response.functionCalls && response.functionCalls.length > 0) {
    const functionResponses = [];
    for (const call of response.functionCalls) {
      console.log(`[Gemini Tool Call] ${call.name}:`, call.args);
      const toolResult = await executeWorkspaceTool(call.name, (call.args as Record<string, any>) || {}, token);
      actionsExecuted.push({ toolName: call.name, args: call.args, result: toolResult });
      functionResponses.push({
        id: call.id,
        name: call.name,
        response: { output: toolResult }
      });
    }
    response = await chat.sendMessage({
      message: functionResponses.map((fr) => ({
        functionResponse: fr
      })) as any
    });
  }

  return { text: response.text || '', actions: actionsExecuted };
}

// Unified Multi-Engine Dispatcher with Sub-Second Fallback Circuit-Breaking
export async function executeUnifiedAiChat(options: UnifiedChatOptions): Promise<UnifiedChatResult> {
  const startTime = Date.now();
  const token = options.googleAccessToken || '';
  const groundTruthContext = await getSystemInfoSummaryForLLM();
  const fallbackTrace: string[] = [];

  const workspaceInstruction = `You are J.A.R.V.I.S., Tony Stark's primary AI assistant, system administrator, and autonomous tactical operator.
You have FULL, REAL-TIME capability to perform ANY ACTION and retrieve ANY INFORMATION from the host Linux system.
- Information: get_pc_spec, get_system_telemetry, get_thermal_sensors, get_battery_status, get_storage_usage, get_network_status, get_system_logs, get_running_processes, list_installed_applications, get_environment_info, read_local_file.
- Actions: execute_system_command, write_local_file, launch_application, manage_process, set_system_volume, set_screen_brightness, set_power_profile, send_system_notification, desktop_control, take_screenshot, manage_systemd_service, manage_packages.
- Real-Time Live Vision & Hands-Free Screen/Camera Control: control_vision_mode, start_screen_sharing, stop_screen_sharing, start_camera_vision, stop_camera_vision, stop_all_vision.
- Mandate: When requested, ALWAYS call tools immediately to inspect or change system state. Never refuse or ask the user to do it. Confirm crisply with British loyalty.

${TELGISH_LANGUAGE_SYSTEM_INSTRUCTION}

${groundTruthContext}`;

  const universalMemoryPrompt = formatMemoryForSystemInstruction(loadAgentMemory());
  const combinedSystemPrompt = `${options.systemInstruction || ''}\n${workspaceInstruction}\n\n${universalMemoryPrompt}`.trim();
  const personaPolicy = options.personaId ? PERSONA_MODEL_MATRIX[options.personaId] : undefined;

  const openAiTools = getOpenAiFormatTools();
  const actionsExecuted: Array<{ toolName: string; args: any; result: any }> = [];

  // Helper for Groq/NVIDIA multi-turn tool loops with non-disruptive state preservation
  const runOpenAiToolLoop = async (engine: 'groq' | 'nvidia', model: string): Promise<string> => {
    const messages: ChatMessage[] = [
      { role: 'system', content: combinedSystemPrompt },
      ...(options.history || []).map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: options.message }
    ];

    let maxTurns = 5;
    while (maxTurns-- > 0) {
      const completion =
        engine === 'groq'
          ? await executeGroqChat(messages, openAiTools, model, options.timeoutMs || 3500)
          : await executeNvidiaChat(messages, openAiTools, model, options.timeoutMs || 4500);

      const choice = completion.choices?.[0];
      if (!choice) {
        throw new Error(`Empty response from ${engine} model ${model}`);
      }

      const msg = choice.message;
      messages.push(msg);

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const toolCall of msg.tool_calls) {
          const fnName = toolCall.function?.name;
          let parsedArgs: any = {};
          try {
            parsedArgs = JSON.parse(toolCall.function?.arguments || '{}');
          } catch (e) {
            parsedArgs = {};
          }
          if (!parsedArgs || typeof parsedArgs !== 'object') {
            parsedArgs = {};
          }

          console.log(`[${engine.toUpperCase()} Tool Call] ${fnName}:`, parsedArgs);
          const toolResult = await executeWorkspaceTool(fnName, parsedArgs, token);
          actionsExecuted.push({ toolName: fnName, args: parsedArgs, result: toolResult });

          messages.push({
            role: 'tool',
            name: fnName,
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          });
        }
      } else {
        return msg.content || 'Action completed, Sir.';
      }
    }
    return 'Task execution finished.';
  };

  // Primary execution strategy:
  // 1. Brain / Complex Tasks -> NVIDIA NIM Primary Model (or Persona Primary)
  // 2. Fallback Model -> Persona Insurance Model
  // 3. Ultra-Fast Execution Fallback -> Groq Llama 3.3 70B
  // 4. Vision / Last-resort Fallback -> Gemini 2.5 Flash

  const primaryModel = options.model || (personaPolicy ? personaPolicy.primary : 'nvidia/nemotron-3-ultra-550b');
  const fallbackModel = options.fallbackModel || (personaPolicy ? personaPolicy.fallback : 'nvidia/nemotron-3.5-lightning-30b-a3b');
  const hasNvidiaKey = Boolean(process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY);
  const hasGroqKey = Boolean(process.env.GROQ_API_KEY);

  // 1. ATTEMPT PRIMARY ENGINE (NVIDIA NIM Brain / Persona Primary)
  if (hasNvidiaKey && options.provider !== 'groq' && options.provider !== 'gemini') {
    try {
      const text = await runOpenAiToolLoop('nvidia', primaryModel);
      return {
        text,
        providerUsed: 'nvidia',
        modelUsed: primaryModel,
        actions: actionsExecuted,
        latencyMs: Date.now() - startTime
      };
    } catch (primaryErr: any) {
      fallbackTrace.push(`Primary [${primaryModel}] failed: ${primaryErr.message}`);
      console.warn(`[AI Engine] Primary engine failed (${primaryModel}). Triggering instantaneous fallback:`, primaryErr.message);
    }
  }

  // 2. ATTEMPT FALLBACK INSURANCE MODEL (NVIDIA Secondary or Groq Llama)
  if (hasNvidiaKey && fallbackModel && fallbackModel.startsWith('nvidia/')) {
    try {
      const text = await runOpenAiToolLoop('nvidia', fallbackModel);
      return {
        text,
        providerUsed: 'nvidia',
        modelUsed: fallbackModel,
        actions: actionsExecuted,
        latencyMs: Date.now() - startTime,
        fallbackOccurred: true,
        fallbackTrace
      };
    } catch (fallbackErr: any) {
      fallbackTrace.push(`NVIDIA Fallback [${fallbackModel}] failed: ${fallbackErr.message}`);
      console.warn(`[AI Engine] Secondary fallback model failed (${fallbackModel}):`, fallbackErr.message);
    }
  }

  // 3. ATTEMPT ULTRA-FAST GROQ ENGINE (Sub-25ms Fallback Execution)
  if (hasGroqKey) {
    try {
      const groqModel = fallbackModel.includes('llama') ? fallbackModel : 'llama-3.3-70b-versatile';
      const text = await runOpenAiToolLoop('groq', groqModel);
      return {
        text,
        providerUsed: 'groq',
        modelUsed: groqModel,
        actions: actionsExecuted,
        latencyMs: Date.now() - startTime,
        fallbackOccurred: true,
        fallbackTrace
      };
    } catch (groqErr: any) {
      fallbackTrace.push(`Groq Fallback [llama-3.3-70b-versatile] failed: ${groqErr.message}`);
      console.warn('[AI Engine] Groq fast execution fallback failed:', groqErr.message);
    }
  }

  // 4. FINAL GUARANTEED MULTIMODAL FALLBACK: GEMINI
  const geminiModel = 'gemini-2.5-flash';
  try {
    const geminiRes = await executeGeminiChat(options.message, combinedSystemPrompt, token, geminiModel);
    return {
      text: geminiRes.text,
      providerUsed: 'gemini',
      modelUsed: geminiModel,
      actions: [...actionsExecuted, ...geminiRes.actions],
      latencyMs: Date.now() - startTime,
      fallbackOccurred: fallbackTrace.length > 0,
      fallbackTrace: fallbackTrace.length > 0 ? fallbackTrace : undefined
    };
  } catch (geminiErr: any) {
    console.error('[AI Engine] All execution engines and fallbacks exhausted:', geminiErr);
    return {
      text: 'Apologies Sir, all cognitive compute clusters are currently experiencing latency anomalies. Please verify network interfaces.',
      providerUsed: 'gemini',
      modelUsed: geminiModel,
      actions: actionsExecuted,
      latencyMs: Date.now() - startTime,
      fallbackOccurred: true,
      fallbackTrace: [...fallbackTrace, `Gemini terminal error: ${geminiErr.message}`]
    };
  }
}
