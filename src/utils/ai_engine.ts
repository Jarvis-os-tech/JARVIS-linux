// Multi-Engine AI Execution Orchestrator for J.A.R.V.I.S.
// - Groq API: Ultra-Fast Real-Time Reasoning & Short Tool Execution (sub-25ms)
// - NVIDIA NIM: Complex System Tasks, Multi-Step Architecture & Deep Planning
// - Gemini API: Voice Multimodal Live Audio/Video Stream & Screen Ingestion

import { WORKSPACE_FUNCTION_DECLARATIONS, executeWorkspaceTool } from './workspace_tools';
import { getSystemInfoSummaryForLLM } from './system_controller';
import { TELGISH_LANGUAGE_SYSTEM_INSTRUCTION } from '../data/personas';
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
  systemInstruction?: string;
  googleAccessToken?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  model?: string;
}

export interface UnifiedChatResult {
  text: string;
  providerUsed: 'groq' | 'nvidia' | 'gemini';
  modelUsed: string;
  actions: Array<{ toolName: string; args: any; result: any }>;
  latencyMs: number;
}

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

// 1. Groq Ultra-Fast Execution Engine (Llama 3.1 8B Instant / 3.3 70B)
export async function executeGroqChat(
  messages: ChatMessage[],
  tools: any[],
  model = 'llama-3.1-8b-instant'
): Promise<any> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured in .env');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
      temperature: 0.2,
      max_tokens: 1500
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API Error (${response.status}): ${errText}`);
  }

  return response.json();
}

// 2. NVIDIA NIM Complex Task & Heavy Reasoning Engine
export async function executeNvidiaChat(
  messages: ChatMessage[],
  tools: any[],
  model = 'meta/llama-3.1-70b-instruct'
): Promise<any> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error('NVIDIA_API_KEY is not configured in .env');
  }

  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
      temperature: 0.2,
      max_tokens: 2048
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`NVIDIA NIM API Error (${response.status}): ${errText}`);
  }

  return response.json();
}

// 3. Gemini Multimodal & Function Calling Engine
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

  const chat = ai.chats.create({
    model,
    config: {
      systemInstruction,
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

// Unified Dispatcher with Multi-Turn Tool Execution & Automatic Fallback
export async function executeUnifiedAiChat(options: UnifiedChatOptions): Promise<UnifiedChatResult> {
  const startTime = Date.now();
  const token = options.googleAccessToken || '';
  const groundTruthContext = await getSystemInfoSummaryForLLM();

  const workspaceInstruction = `You are J.A.R.V.I.S., Tony Stark's primary AI assistant, system administrator, and autonomous tactical operator.
You have FULL, REAL-TIME capability to perform ANY ACTION and retrieve ANY INFORMATION from the host Linux system.
- Information: get_pc_spec, get_system_telemetry, get_thermal_sensors, get_battery_status, get_storage_usage, get_network_status, get_system_logs, get_running_processes, list_installed_applications, get_environment_info, read_local_file.
- Actions: execute_system_command, write_local_file, launch_application, manage_process, set_system_volume, set_screen_brightness, set_power_profile, send_system_notification, desktop_control, take_screenshot, manage_systemd_service, manage_packages.
- Real-Time Live Vision & Hands-Free Screen/Camera Control: control_vision_mode, start_screen_sharing, stop_screen_sharing, start_camera_vision, stop_camera_vision, stop_all_vision.
- Mandate: When requested, ALWAYS call tools immediately to inspect or change system state. Never refuse or ask the user to do it. Confirm crisply with British loyalty.

${TELGISH_LANGUAGE_SYSTEM_INSTRUCTION}

${groundTruthContext}`;

  const combinedSystemPrompt = `${options.systemInstruction || ''}\n${workspaceInstruction}`.trim();
  const provider = options.provider || 'auto';

  // Determine provider:
  // Fast / default queries -> Groq (Llama 3.1 8B Instant)
  // Heavy task / deep analysis -> NVIDIA (Llama 3.1 70B)
  // Explicit provider or Gemini fallback -> Gemini
  let selectedProvider: 'groq' | 'nvidia' | 'gemini' = 'groq';

  if (provider === 'gemini') {
    selectedProvider = 'gemini';
  } else if (provider === 'nvidia') {
    selectedProvider = 'nvidia';
  } else if (provider === 'groq') {
    selectedProvider = 'groq';
  } else {
    // Auto mode: check query complexity
    const lower = options.message.toLowerCase();
    const isHeavyTask =
      lower.includes('analyze codebase') ||
      lower.includes('deep scan') ||
      lower.includes('refactor') ||
      lower.includes('architecture') ||
      lower.includes('audit');

    if (isHeavyTask && process.env.NVIDIA_API_KEY) {
      selectedProvider = 'nvidia';
    } else if (process.env.GROQ_API_KEY) {
      selectedProvider = 'groq';
    } else if (process.env.NVIDIA_API_KEY) {
      selectedProvider = 'nvidia';
    } else {
      selectedProvider = 'gemini';
    }
  }

  const openAiTools = getOpenAiFormatTools();
  const actionsExecuted: Array<{ toolName: string; args: any; result: any }> = [];

  // Helper for Groq/NVIDIA multi-turn tool loops
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
          ? await executeGroqChat(messages, openAiTools, model)
          : await executeNvidiaChat(messages, openAiTools, model);

      const choice = completion.choices?.[0];
      if (!choice) {
        throw new Error(`Empty response from ${engine}`);
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
          // Guard against null args
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
        return msg.content || 'Action executed, sir.';
      }
    }
    return 'Task execution finished.';
  };

  // 1. Try Groq if selected
  if (selectedProvider === 'groq') {
    try {
      const model = options.model || 'llama-3.1-8b-instant';
      const text = await runOpenAiToolLoop('groq', model);
      return {
        text,
        providerUsed: 'groq',
        modelUsed: model,
        actions: actionsExecuted,
        latencyMs: Date.now() - startTime
      };
    } catch (groqErr) {
      console.warn('Groq execution failed, falling back to NVIDIA/Gemini:', groqErr);
      if (process.env.NVIDIA_API_KEY) {
        selectedProvider = 'nvidia';
      } else {
        selectedProvider = 'gemini';
      }
    }
  }

  // 2. Try NVIDIA NIM if selected or fell back
  if (selectedProvider === 'nvidia') {
    try {
      const model = options.model || 'meta/llama-3.1-70b-instruct';
      const text = await runOpenAiToolLoop('nvidia', model);
      return {
        text,
        providerUsed: 'nvidia',
        modelUsed: model,
        actions: actionsExecuted,
        latencyMs: Date.now() - startTime
      };
    } catch (nvidiaErr) {
      console.warn('NVIDIA execution failed, falling back to Gemini:', nvidiaErr);
      selectedProvider = 'gemini';
    }
  }

  // 3. Try Gemini
  const model = options.model || 'gemini-2.5-flash';
  const geminiRes = await executeGeminiChat(options.message, combinedSystemPrompt, token, model);
  return {
    text: geminiRes.text,
    providerUsed: 'gemini',
    modelUsed: model,
    actions: geminiRes.actions,
    latencyMs: Date.now() - startTime
  };
}
