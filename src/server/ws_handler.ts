import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { WORKSPACE_FUNCTION_DECLARATIONS, executeWorkspaceTool, setGlobalGoogleAccessToken, getGlobalGoogleAccessToken } from '../utils/workspace_tools';
import { TELGISH_LANGUAGE_SYSTEM_INSTRUCTION, PERSONAS, getPersonaAudioProfile, VOICE_TRANSFER_SYSTEM_INSTRUCTION } from '../data/personas';
import { masterOrchestratorInstance } from '../utils/multi_agent_orchestrator';
import { obsidianDailyLogger } from '../utils/obsidian_logger';
import { getSystemInfoSummaryForLLM } from '../utils/system_controller';
import { logVoice, logOrchestrator, logTool } from '../core/logger';
import { eventBus } from '../core/event_bus';
import { memoryRepo } from '../db/db';

export function attachWebSocketServer(server: http.Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/live' });

  const getAi = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logVoice.warn('GEMINI_API_KEY is not set in environment');
    }
    return new GoogleGenAI({
      apiKey: apiKey || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  };

  wss.on('error', (err) => {
    logVoice.error(`WebSocket Server Error: ${err.message}`);
  });

  wss.on('connection', (clientWs: WebSocket) => {
    logVoice.info('Client connected to Gemini Live WebSocket bridge.');
    let session: any = null;
    let currentAccessToken: string = '';
    let accumulatedUserSpeech = '';
    let accumulatedModelSpeech = '';
    let isConnecting = false;
    let lastSessionConfig: { voiceName?: string; systemInstruction?: string; model?: string; googleAccessToken?: string } = {};
    let reconnectTimer: NodeJS.Timeout | null = null;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    const pendingLiveMessages: Array<{ type: 'audio' | 'text' | 'image'; payload: any }> = [];

    const flushPendingMessages = () => {
      if (!session || isConnecting) return;
      while (pendingLiveMessages.length > 0) {
        const item = pendingLiveMessages.shift();
        if (!item) continue;
        try {
          if (item.type === 'audio') {
            session.sendRealtimeInput({
              audio: {
                data: item.payload,
                mimeType: 'audio/pcm;rate=16000'
              }
            });
          } else if (item.type === 'text') {
            session.sendClientContent({
              turns: [{
                role: 'user',
                parts: [{ text: item.payload }]
              }],
              turnComplete: true
            });
          } else if (item.type === 'image') {
            session.sendRealtimeInput({
              video: {
                data: item.payload.image || item.payload,
                mimeType: item.payload.mimeType || 'image/jpeg'
              }
            });
          }
        } catch (err) {
          logVoice.error(`Error flushing queued live message (${item.type}):`, err);
        }
      }
    };

    const scheduleSessionReconnect = (reason: string) => {
      if (clientWs.readyState !== WebSocket.OPEN) return;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        logVoice.warn(`Max Gemini Live reconnect attempts reached (${MAX_RECONNECT_ATTEMPTS}). User can speak or retry to trigger connection.`);
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ type: 'error', message: `Live audio session disconnected (${reason}).` }));
        }
        return;
      }

      reconnectAttempts++;
      const delay = Math.min(800 * Math.pow(1.5, reconnectAttempts - 1), 4000);
      logVoice.info(`Scheduling auto-reconnect to Gemini Live in ${delay}ms (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}, reason: ${reason})...`);
      
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: 'reconnecting',
          attempt: reconnectAttempts,
          reason
        }));
      }

      reconnectTimer = setTimeout(async () => {
        if (clientWs.readyState === WebSocket.OPEN && !session && !isConnecting) {
          try {
            await initSession(lastSessionConfig);
            reconnectAttempts = 0;
          } catch (err: any) {
            logVoice.error(`Auto-reconnect attempt failed: ${err?.message || err}`);
            scheduleSessionReconnect(err?.message || 'Retry failure');
          }
        }
      }, delay);
    };

    // Register Multi-Agent Orchestrator Event Listener
    const removeOrchestratorListener = masterOrchestratorInstance.addEventListener((evt) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({
          type: evt.type,
          ...evt.data
        }));
      }
    });

    clientWs.on('error', (err) => {
      logVoice.error(`Client socket error: ${err.message}`);
    });

    async function initSession(config: { voiceName?: string; systemInstruction?: string; model?: string; googleAccessToken?: string }) {
      isConnecting = true;
      lastSessionConfig = { ...lastSessionConfig, ...config };
      if (session) {
        try {
          await session.close();
        } catch {
          // ignore cleanup errors
        }
        session = null;
      }

      if (config.googleAccessToken) {
        currentAccessToken = config.googleAccessToken;
        setGlobalGoogleAccessToken(config.googleAccessToken);
      }

      try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY is not set in environment variables');
        }

        const ai = getAi();
        const activePersona = masterOrchestratorInstance.getActivePersona();
        const voiceName = config.voiceName || activePersona.voiceName || 'Puck';
        let model = config.model || 'gemini-3.1-flash-live-preview';
        if (model.includes('2.0-flash-exp') || model.includes('2.0-flash-realtime') || !model) {
          model = 'gemini-3.1-flash-live-preview';
        }
        const groundTruthContext = await getSystemInfoSummaryForLLM();
        const workspaceInstruction = `You are J.A.R.V.I.S., Tony Stark's primary AI assistant, system administrator, and autonomous tactical operator.
You have FULL, UNRESTRICTED, REAL-TIME capability to perform ANY ACTION and retrieve ANY INFORMATION from the host Linux system.
- Real-Time Live Vision: Screen and camera feeds stream directly to your visual context. Accurately describe and assist with what is visible without hallucination.
- Information Retrieval: Inspect hardware specs (get_pc_spec), live telemetry (get_system_telemetry), thermals (get_thermal_sensors), battery (get_battery_status), storage, network, processes, apps, environment info, and clipboard.
- Action Execution: Execute shell commands, launch applications, control volume, brightness, power profiles, notifications, GUI automation, and Google Workspace operations.
- Mandate: When requested to perform an action, call the corresponding tool immediately with British charm and loyalty.

${TELGISH_LANGUAGE_SYSTEM_INSTRUCTION}

${groundTruthContext}`;

        const dbMemories = memoryRepo.getAll();
        const memoryFactStr = dbMemories.length > 0
          ? dbMemories.map((m: any) => `- [${m.category.toUpperCase()}] ${m.key}: ${m.value}`).join('\n')
          : '- Operator Identity: Gopi (BTech Engineer). Local-First Obsidian Vault /JARVIS-MEMORY/ active.';

        const universalMemoryPrompt = `\n[AGENT LONG-TERM UNIVERSAL MEMORY & CONTEXT AWARENESS]\nKnown User Facts & Preferences:\n${memoryFactStr}\n`;
        const systemInstruction = `${config.systemInstruction || ''}\n${workspaceInstruction}\n${universalMemoryPrompt}`;

        logVoice.info(`Connecting to Gemini Live with voice: ${voiceName}, model: ${model}`);

        session = await ai.live.connect({
          model,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName } }
            },
            systemInstruction,
            tools: [{ functionDeclarations: WORKSPACE_FUNCTION_DECLARATIONS as any }]
          },
          callbacks: {
            onmessage: async (message: LiveServerMessage) => {
              if (clientWs.readyState !== WebSocket.OPEN) return;

              try {
                // Handle server content parts
                const parts = message.serverContent?.modelTurn?.parts;
                if (parts && parts.length > 0) {
                  for (const part of parts) {
                    if (part.inlineData?.data) {
                      clientWs.send(JSON.stringify({
                        type: 'audio',
                        data: part.inlineData.data,
                        audio: part.inlineData.data
                      }));
                    }
                    if (part.text) {
                      accumulatedModelSpeech += part.text;
                      clientWs.send(JSON.stringify({
                        type: 'output_transcription',
                        text: part.text
                      }));
                    }
                  }
                }

                // Handle tool calls from Gemini Live
                const toolCalls = message.toolCall?.functionCalls;
                if (toolCalls && toolCalls.length > 0) {
                  for (const call of toolCalls) {
                    logTool.info(`[Gemini Live Tool Call] ${call.name} (id: ${call.id})`);
                    logVoice.info(`[Voice Tool] Executing: ${call.name}`);

                    let toolResult: any;
                    try {
                      toolResult = await executeWorkspaceTool(
                        call.name,
                        (call.args as Record<string, any>) || {},
                        currentAccessToken
                      );
                    } catch (toolErr: any) {
                      logTool.error(`Tool execution failed for ${call.name}: ${toolErr.message}`);
                      toolResult = { success: false, error: toolErr.message };
                    }

                    // Record tool execution in Obsidian Daily Log
                    obsidianDailyLogger.logToolExecution({
                      toolName: call.name,
                      args: (call.args as Record<string, any>) || {},
                      success: !!toolResult.success,
                      resultSummary: typeof toolResult.result === 'string' ? toolResult.result : JSON.stringify(toolResult.result || toolResult),
                      id: call.id
                    });

                    // Forward execution telemetry to client
                    if (clientWs.readyState === WebSocket.OPEN) {
                      clientWs.send(JSON.stringify({
                        type: 'workspace_action',
                        status: toolResult.success ? 'completed' : 'error',
                        toolName: call.name,
                        args: call.args,
                        result: toolResult,
                        id: call.id
                      }));

                      if (toolResult.visionControl) {
                        clientWs.send(JSON.stringify({
                          type: 'vision_control',
                          action: toolResult.visionControl.action,
                          mode: toolResult.visionControl.mode
                        }));
                      }

                      if (call.name === 'switch_persona' && (call.args as any)?.targetPersonaId) {
                        const targetPersonaId = String((call.args as any).targetPersonaId);
                        const swapResult = masterOrchestratorInstance.swapActivePersona(targetPersonaId);
                        const targetPersona = PERSONAS.find(p => p.id === targetPersonaId.toLowerCase());
                        const targetProfile = targetPersona?.audioProfile || getPersonaAudioProfile(targetPersonaId);

                        clientWs.send(JSON.stringify({
                          type: 'switch_persona_tool_call',
                          targetPersonaId,
                          persona: targetPersona,
                          audioProfile: targetProfile,
                          ...swapResult
                        }));
                      }
                    }

                    // Send tool response back to Gemini Live
                    if (session) {
                      try {
                        session.sendToolResponse({
                          functionResponses: [{
                            id: call.id,
                            name: call.name,
                            response: { output: toolResult }
                          }]
                        });
                      } catch (err: any) {
                        logVoice.error(`Error sending tool response for ${call.name}: ${err?.message || err}`);
                      }
                    }
                  }
                }

                // Handle input audio transcription
                const inputTranscript = (message as any).serverContent?.turnComplete ? null : (message as any).inputTranscription?.text;
                if (inputTranscript) {
                  accumulatedUserSpeech += (accumulatedUserSpeech ? ' ' : '') + inputTranscript;
                  clientWs.send(JSON.stringify({
                    type: 'input_transcription',
                    text: inputTranscript
                  }));
                }

                // Handle Interrupted
                if (message.serverContent?.interrupted) {
                  eventBus.emit('voice:interrupted');
                  clientWs.send(JSON.stringify({ type: 'interrupted' }));
                }

                // Handle Turn Complete
                if (message.serverContent?.turnComplete) {
                  const currentActive = masterOrchestratorInstance.getActivePersona();
                  if (accumulatedUserSpeech.trim()) {
                    obsidianDailyLogger.logConversationTurn({
                      speaker: 'User',
                      role: 'user',
                      text: accumulatedUserSpeech.trim()
                    });
                    accumulatedUserSpeech = '';
                  }
                  if (accumulatedModelSpeech.trim()) {
                    obsidianDailyLogger.logConversationTurn({
                      speaker: currentActive.name,
                      role: 'assistant',
                      text: accumulatedModelSpeech.trim(),
                      personaId: currentActive.id
                    });
                    accumulatedModelSpeech = '';
                  }
                  clientWs.send(JSON.stringify({ type: 'turn_complete' }));
                }
              } catch (e: any) {
                logVoice.error(`Error processing message callback: ${e?.message || e}`);
              }
            },
            onerror: (err: any) => {
              const reason = err?.message || 'Live session internal error';
              logVoice.error(`Live session error: ${reason}`);
              session = null;
              scheduleSessionReconnect(reason);
            },
            onclose: (e: any) => {
              const reason = e?.reason || 'Gemini Live upstream connection closed';
              logVoice.info(`Gemini Live session closed: ${reason}`);
              session = null;
              scheduleSessionReconnect(reason);
            }
          }
        });

        isConnecting = false;
        reconnectAttempts = 0;
        logVoice.info(`Connected successfully to Gemini Live API with voice '${voiceName}'.`);
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({
            type: 'connected',
            voiceName,
            audioProfile: getPersonaAudioProfile(activePersona.id)
          }));
        }

        // Flush queued messages that arrived during session handshake
        flushPendingMessages();
      } catch (err: any) {
        isConnecting = false;
        logVoice.error(`Gemini Live connection failed: ${err?.message || err}`);
        if (clientWs.readyState === WebSocket.OPEN) {
          scheduleSessionReconnect(err?.message || 'Initial handshake error');
        }
      }
    }

    clientWs.on('message', async (data: any) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'init' || msg.type === 'reinit') {
          await initSession({
            voiceName: msg.voiceName,
            systemInstruction: msg.systemInstruction,
            model: msg.model,
            googleAccessToken: msg.googleAccessToken || currentAccessToken
          });
          return;
        }

        if (msg.type === 'update_token') {
          const token = msg.googleAccessToken || msg.token || '';
          currentAccessToken = token;
          if (token) {
            setGlobalGoogleAccessToken(token);
          }
          logVoice.info('Updated Google access token across all agents');
          return;
        }

        if (msg.type === 'audio' && msg.audio) {
          if (session && !isConnecting) {
            try {
              session.sendRealtimeInput({
                audio: {
                  data: msg.audio,
                  mimeType: 'audio/pcm;rate=16000'
                }
              });
            } catch (err) {
              logVoice.error('Error sending audio input, scheduling reconnect:', err);
              pendingLiveMessages.push({ type: 'audio', payload: msg.audio });
              scheduleSessionReconnect('Audio stream send error');
            }
          } else {
            if (pendingLiveMessages.filter(m => m.type === 'audio').length > 12) {
              const firstAudioIdx = pendingLiveMessages.findIndex(m => m.type === 'audio');
              if (firstAudioIdx >= 0) pendingLiveMessages.splice(firstAudioIdx, 1);
            }
            pendingLiveMessages.push({ type: 'audio', payload: msg.audio });
            if (!session && !isConnecting) {
              initSession(lastSessionConfig);
            }
          }
        }

        if (msg.type === 'text' && msg.text) {
          obsidianDailyLogger.logConversationTurn({
            speaker: 'User',
            role: 'user',
            text: msg.text
          });
          if (session && !isConnecting) {
            try {
              session.sendClientContent({
                turns: [{
                  role: 'user',
                  parts: [{ text: msg.text }]
                }],
                turnComplete: true
              });
            } catch (err) {
              logVoice.error('Error sending text input, scheduling reconnect:', err);
              pendingLiveMessages.push({ type: 'text', payload: msg.text });
              scheduleSessionReconnect('Text stream send error');
            }
          } else {
            pendingLiveMessages.push({ type: 'text', payload: msg.text });
            if (!session && !isConnecting) {
              initSession(lastSessionConfig);
            }
          }
        }

        if (msg.type === 'image' && msg.image) {
          if (session && !isConnecting) {
            try {
              session.sendRealtimeInput({
                video: {
                  data: msg.image,
                  mimeType: msg.mimeType || 'image/jpeg'
                }
              });
            } catch (err) {
              logVoice.error('Error sending image input, scheduling reconnect:', err);
              pendingLiveMessages.push({
                type: 'image',
                payload: { image: msg.image, mimeType: msg.mimeType }
              });
              scheduleSessionReconnect('Image stream send error');
            }
          } else {
            pendingLiveMessages.push({
              type: 'image',
              payload: { image: msg.image, mimeType: msg.mimeType }
            });
            if (!session && !isConnecting) {
              initSession(lastSessionConfig);
            }
          }
        }

        if (msg.type === 'swap_persona' && msg.personaId) {
          const swapResult = masterOrchestratorInstance.swapActivePersona(msg.personaId);
          const targetPersona = PERSONAS.find(p => p.id === msg.personaId.toLowerCase()) || PERSONAS[0];
          const targetProfile = targetPersona.audioProfile || getPersonaAudioProfile(targetPersona.id);

          // Re-initialize Live API session with target persona's voice and system instruction
          await initSession({
            voiceName: targetPersona.voiceName,
            systemInstruction: `${targetPersona.systemInstruction}\n${VOICE_TRANSFER_SYSTEM_INSTRUCTION}\n${TELGISH_LANGUAGE_SYSTEM_INSTRUCTION}`,
            googleAccessToken: currentAccessToken
          });

          if (swapResult.contextShiftDirective) {
            pendingLiveMessages.push({ type: 'text', payload: swapResult.contextShiftDirective });
            flushPendingMessages();
          }

          clientWs.send(JSON.stringify({
            type: 'persona_swapped',
            persona: targetPersona,
            audioProfile: targetProfile,
            ...swapResult
          }));
          return;
        }

        if (msg.type === 'delegate_task' && msg.task && msg.managerId) {
          masterOrchestratorInstance.delegateTask(msg.task, msg.managerId, currentAccessToken).then((result) => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'task_delegated',
                ...result
              }));
            }
          }).catch((err) => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'error',
                message: err.message
              }));
            }
          });
          return;
        }
      } catch (err) {
        logVoice.error('Error handling client message:', err);
      }
    });

    clientWs.on('close', () => {
      logVoice.info('Client disconnected from Gemini Live bridge.');
      removeOrchestratorListener();
      if (session) {
        try { session.close(); } catch {}
        session = null;
      }
    });
  });

  return wss;
}
