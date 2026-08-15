import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { WORKSPACE_FUNCTION_DECLARATIONS, executeWorkspaceTool, setGlobalGoogleAccessToken, getGlobalGoogleAccessToken } from '../utils/workspace_tools';
import { TELGISH_LANGUAGE_SYSTEM_INSTRUCTION } from '../data/personas';
import { masterOrchestratorInstance } from '../utils/multi_agent_orchestrator';
import { obsidianDailyLogger } from '../utils/obsidian_logger';
import { getSystemInfoSummaryForLLM } from '../utils/system_controller';
import { logVoice, logOrchestrator, logTool } from '../core/logger';
import { eventBus } from '../core/event_bus';

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
        const voiceName = config.voiceName || 'Puck';
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
        const systemInstruction = `${config.systemInstruction || ''}\n${workspaceInstruction}`;

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
                const functionCalls: any[] = [];
                if (message.toolCall?.functionCalls) {
                  functionCalls.push(...message.toolCall.functionCalls);
                }
                if (parts) {
                  for (const part of parts) {
                    if ((part as any).functionCall) {
                      functionCalls.push((part as any).functionCall);
                    }
                  }
                }

                if (functionCalls.length > 0) {
                  // 1. Notify client immediately for started actions
                  if (clientWs.readyState === WebSocket.OPEN) {
                    for (const call of functionCalls) {
                      clientWs.send(JSON.stringify({
                        type: 'workspace_action',
                        status: 'started',
                        toolName: call.name,
                        args: call.args,
                        id: call.id
                      }));
                    }
                  }

                  // 2. Execute tool calls in parallel
                  const functionResponses = await Promise.all(
                    functionCalls.map(async (call) => {
                      logTool.info(`Executing tool: ${call.name}`, call.args);
                      try {
                        const tokenToUse = currentAccessToken || getGlobalGoogleAccessToken() || process.env.GOOGLE_ACCESS_TOKEN || '';
                        const toolResult = await executeWorkspaceTool(
                          call.name,
                          (call.args as Record<string, any>) || {},
                          tokenToUse
                        );

                        // Record tool execution in Obsidian Daily Log
                        obsidianDailyLogger.logToolExecution({
                          toolName: call.name,
                          args: (call.args as Record<string, any>) || {},
                          success: !!toolResult.success,
                          resultSummary: typeof toolResult.result === 'string' ? toolResult.result : JSON.stringify(toolResult.result || toolResult),
                          id: call.id
                        });

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

                          if (call.name === 'switch_persona' && call.args?.targetPersonaId) {
                            const targetPersonaId = call.args.targetPersonaId;
                            const swapResult = masterOrchestratorInstance.swapActivePersona(targetPersonaId);
                            clientWs.send(JSON.stringify({
                              type: 'switch_persona_tool_call',
                              targetPersonaId,
                              ...swapResult
                            }));
                          }
                        }

                        if (!toolResult.success) {
                          logTool.error(`Tool '${call.name}' failed`, { args: call.args, error: toolResult.error || 'Execution returned false' });
                        } else {
                          logTool.info(`Tool '${call.name}' completed successfully`);
                        }

                        return {
                          id: call.id,
                          name: call.name,
                          response: { output: toolResult }
                        };
                      } catch (execErr: any) {
                        logTool.error(`Tool '${call.name}' threw error: ${execErr.message}`, { args: call.args, stack: execErr.stack });
                        return {
                          id: call.id,
                          name: call.name,
                          response: { output: { success: false, error: execErr.message || 'Execution error' } }
                        };
                      }
                    })
                  );

                  // 3. Send response back to Gemini Live
                  if (session) {
                    try {
                      session.sendToolResponse({ functionResponses });
                    } catch (sendErr) {
                      logVoice.error('Error sending tool response to Gemini Live:', sendErr);
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
                  const activePersona = masterOrchestratorInstance.getActivePersona();
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
                      speaker: activePersona.name,
                      role: 'assistant',
                      text: accumulatedModelSpeech.trim(),
                      personaId: activePersona.id
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
              logVoice.error(`Live session error: ${err?.message || err}`);
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ type: 'error', message: err?.message || 'Live session error' }));
              }
            },
            onclose: (e: any) => {
              logVoice.info(`Gemini Live session closed: ${e?.reason || ''}`);
            }
          }
        });

        logVoice.info('Connected successfully to Gemini Live API.');
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ type: 'connected' }));
        }
      } catch (err: any) {
        logVoice.error(`Gemini Live connection failed: ${err?.message || err}`);
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ type: 'error', message: err?.message || 'Failed to connect to Live API' }));
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
          if (session) {
            try {
              session.sendRealtimeInput({
                audio: {
                  data: msg.audio,
                  mimeType: 'audio/pcm;rate=16000'
                }
              });
            } catch (err) {
              logVoice.error('Error sending audio input:', err);
            }
          }
        }

        if (msg.type === 'text' && msg.text) {
          obsidianDailyLogger.logConversationTurn({
            speaker: 'User',
            role: 'user',
            text: msg.text
          });
          if (session) {
            try {
              session.sendClientContent({
                turns: [{
                  role: 'user',
                  parts: [{ text: msg.text }]
                }],
                turnComplete: true
              });
            } catch (err) {
              logVoice.error('Error sending text input:', err);
            }
          }
        }

        if (msg.type === 'image' && msg.image) {
          if (session) {
            try {
              session.sendRealtimeInput({
                video: {
                  data: msg.image,
                  mimeType: msg.mimeType || 'image/jpeg'
                }
              });
            } catch (err) {
              logVoice.error('Error sending image input:', err);
            }
          }
        }

        if (msg.type === 'swap_persona' && msg.personaId) {
          const swapResult = masterOrchestratorInstance.swapActivePersona(msg.personaId);
          if (session && swapResult.contextShiftDirective) {
            try {
              session.sendClientContent({
                turns: [{
                  role: 'user',
                  parts: [{ text: swapResult.contextShiftDirective }]
                }],
                turnComplete: true
              });
            } catch (e) {
              logVoice.warn('Failed to send context shift to Gemini Live session:', e);
            }
          }
          clientWs.send(JSON.stringify({
            type: 'persona_swapped',
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
