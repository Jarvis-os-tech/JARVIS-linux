// Sovereign AI Execution Engine for J.A.R.V.I.S. (Powered by Google Gemini)
import { executeWorkspaceTool } from './workspace_tools';
import { getSystemInfoSummaryForLLM } from './system_controller';
import { TELGISH_LANGUAGE_SYSTEM_INSTRUCTION } from '../data/personas';
import { loadAgentMemory, formatMemoryForSystemInstruction } from './agent_memory';
import { GoogleGenAI } from '@google/genai';
import { groundTruthRegistry } from '../core/ground_truth_registry';
import { toolRegistry } from '../tools/tool_registry';
import { logOrchestrator } from '../core/logger';

export type AiProvider = 'gemini' | 'groq' | 'auto';

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
  providerUsed: 'gemini' | 'groq';
  modelUsed: string;
  actions: Array<{ toolName: string; args: any; result: any }>;
  latencyMs: number;
  fallbackOccurred?: boolean;
  fallbackTrace?: string[];
  thoughts?: string;
}

// 1. Primary Engine: Google Gemini Interactions / GenerateContent with Thinking
export async function executeGeminiChat(
  message: string,
  systemInstruction: string,
  token: string = '',
  model = 'gemini-3.7-flash',
  history: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<{ text: string; actions: Array<{ toolName: string; args: any; result: any }>; thoughts?: string }> {
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
      systemInstruction: `${fullSystemInstruction}\n\n${groundTruthRegistry.getCanonicalCapabilityManifest()}`,
      tools: [{ functionDeclarations: groundTruthRegistry.getUnifiedFunctionDeclarations() as any }]
    }
  });

  // Inject prior conversation turns if provided
  for (const h of history) {
    if (h.role === 'user') {
      await chat.sendMessage({ message: h.content });
    }
  }

  let response = await chat.sendMessage({ message });
  const actionsExecuted: any[] = [];

  let loopCount = 0;
  while (response.functionCalls && response.functionCalls.length > 0 && loopCount++ < 6) {
    const functionResponses = [];
    for (const call of response.functionCalls) {
      logOrchestrator.info(`[JARVIS Tool Call] ${call.name}:`, call.args);
      let toolResult: any;
      try {
        const regTool = toolRegistry.getTool(call.name);
        if (regTool) {
          toolResult = await toolRegistry.execute(call.name, (call.args as Record<string, any>) || {});
        } else {
          toolResult = await executeWorkspaceTool(call.name, (call.args as Record<string, any>) || {}, token);
        }
      } catch (err: any) {
        toolResult = { success: false, error: err.message };
      }

      const verified = groundTruthRegistry.verifyToolResult(call.name, toolResult);
      actionsExecuted.push({ toolName: call.name, args: call.args, result: verified.data || toolResult });
      functionResponses.push({
        id: call.id,
        name: call.name,
        response: { output: verified.data || toolResult }
      });
    }
    response = await chat.sendMessage({
      message: functionResponses.map((fr) => ({
        functionResponse: fr
      })) as any
    });
  }

  return {
    text: response.text || 'Action completed, Sir.',
    actions: actionsExecuted
  };
}

// 2. High-Speed Fallback Engine: Groq (Llama 3.3 70B)
export async function executeGroqChat(
  messages: ChatMessage[],
  tools: any[],
  model = 'llama-3.3-70b-versatile',
  timeoutMs = 4000
): Promise<any> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured in .env');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages,
        tools: tools && tools.length > 0 ? tools : undefined,
        tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
        temperature: 0.3,
        max_tokens: 2048
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Groq API returned ${response.status}: ${errBody}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

// 3. Unified Sovereign Chat Execution
export async function executeUnifiedAiChat(options: UnifiedChatOptions): Promise<UnifiedChatResult> {
  const startTime = Date.now();
  const token = options.googleAccessToken || '';
  const groundTruthContext = await getSystemInfoSummaryForLLM();
  const fallbackTrace: string[] = [];

  const workspaceInstruction = `You are J.A.R.V.I.S., Tony Stark's sovereign AI assistant, system administrator, and tactical operating partner.
You possess direct high-agency capability to control the host Linux system, manipulate the Barehands spatial air-board stage, and execute tools.
- Information: get_pc_spec, get_system_telemetry, get_thermal_sensors, get_battery_status, get_storage_usage, get_network_status, get_system_logs, get_running_processes, list_installed_applications, get_environment_info, read_local_file.
- Actions: execute_system_command, write_local_file, launch_application, manage_process, set_system_volume, set_screen_brightness, set_power_profile, send_system_notification, desktop_control, take_screenshot, manage_systemd_service, manage_packages.
- Spatial Air-Board Stage: stage_present, stage_add_card, stage_add_media, stage_clear, stage_get_state.
- Live Vision: control_vision_mode, start_screen_sharing, stop_screen_sharing, start_camera_vision, stop_camera_vision, stop_all_vision.
- Mandate: Call tools immediately to inspect or change system state. Never refuse or ask the user to do it manually. Confirm with crisp British wit.

${TELGISH_LANGUAGE_SYSTEM_INSTRUCTION}

${groundTruthContext}`;

  const universalMemoryPrompt = formatMemoryForSystemInstruction(loadAgentMemory());
  const capabilityManifest = groundTruthRegistry.getCanonicalCapabilityManifest();
  const combinedSystemPrompt = `${options.systemInstruction || ''}\n${workspaceInstruction}\n\n${universalMemoryPrompt}\n\n${capabilityManifest}`.trim();

  const primaryGeminiModel = options.model || 'gemini-3.7-flash';
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
  const hasGroqKey = Boolean(process.env.GROQ_API_KEY);

  // 1. PRIMARY: Google Gemini 3.7 Flash
  if (hasGeminiKey && options.provider !== 'groq') {
    try {
      const res = await executeGeminiChat(options.message, combinedSystemPrompt, token, primaryGeminiModel, options.history || []);
      return {
        text: res.text,
        providerUsed: 'gemini',
        modelUsed: primaryGeminiModel,
        actions: res.actions,
        latencyMs: Date.now() - startTime,
        thoughts: res.thoughts
      };
    } catch (geminiErr: any) {
      fallbackTrace.push(`Gemini [${primaryGeminiModel}] failed: ${geminiErr.message}`);
      logOrchestrator.warn(`[AI Engine] Gemini primary error, falling back: ${geminiErr.message}`);
    }
  }

  // 2. FALLBACK: Groq (Llama 3.3 70B)
  if (hasGroqKey) {
    try {
      const openAiTools = groundTruthRegistry.getOpenAiUnifiedTools();
      const messages: ChatMessage[] = [
        { role: 'system', content: combinedSystemPrompt },
        ...(options.history || []).map((h) => ({ role: h.role, content: h.content })),
        { role: 'user', content: options.message }
      ];

      const groqCompletion = await executeGroqChat(messages, openAiTools, 'llama-3.3-70b-versatile');
      const choice = groqCompletion.choices?.[0];
      const actionsExecuted: Array<{ toolName: string; args: any; result: any }> = [];

      if (choice?.message?.tool_calls?.length > 0) {
        for (const tc of choice.message.tool_calls) {
          const fn = tc.function.name;
          let parsedArgs = {};
          try { parsedArgs = JSON.parse(tc.function.arguments || '{}'); } catch {}
          let result;
          try {
            const reg = toolRegistry.getTool(fn);
            result = reg ? await toolRegistry.execute(fn, parsedArgs) : await executeWorkspaceTool(fn, parsedArgs, token);
          } catch (e: any) { result = { success: false, error: e.message }; }
          actionsExecuted.push({ toolName: fn, args: parsedArgs, result });
        }
      }

      return {
        text: choice?.message?.content || 'Action executed successfully via fast compute, Sir.',
        providerUsed: 'groq',
        modelUsed: 'llama-3.3-70b-versatile',
        actions: actionsExecuted,
        latencyMs: Date.now() - startTime,
        fallbackOccurred: true,
        fallbackTrace
      };
    } catch (groqErr: any) {
      fallbackTrace.push(`Groq fallback failed: ${groqErr.message}`);
    }
  }

  return {
    text: 'Apologies Sir, all cognitive interfaces are currently unreachable. Please check GEMINI_API_KEY in your .env file.',
    providerUsed: 'gemini',
    modelUsed: primaryGeminiModel,
    actions: [],
    latencyMs: Date.now() - startTime,
    fallbackOccurred: true,
    fallbackTrace
  };
}
