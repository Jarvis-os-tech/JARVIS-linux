import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { WORKSPACE_FUNCTION_DECLARATIONS, executeWorkspaceTool, setGlobalGoogleAccessToken, getGlobalGoogleAccessToken } from '../utils/workspace_tools';
import { googleAuthService } from '../services/google_auth_service';
import { PERSONAS, getPersonaAudioProfile, VOICE_TRANSFER_SYSTEM_INSTRUCTION } from '../data/personas';
import { masterOrchestratorInstance } from '../utils/multi_agent_orchestrator';
import { obsidianDailyLogger } from '../utils/obsidian_logger';
import { getSystemInfoSummaryForLLM } from '../utils/system_controller';
import { logVoice, logOrchestrator, logTool } from '../core/logger';
import { eventBus } from '../core/event_bus';
import { memoryRepo } from '../db/db';
import { toolRegistry } from '../tools/tool_registry';
import { latencyResponseSystem } from '../core/latency_response_system';
import { groundTruthRegistry } from '../core/ground_truth_registry';
import { capabilityForge } from '../core/capability_forge';
import { turnLogger } from '../memory/turn_logger';
import { updateVoiceStateSignal } from '../utils/voice_signals';

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
    const MAX_RECONNECT_ATTEMPTS = 8;
    const pendingLiveMessages: Array<{ type: 'audio' | 'text' | 'image'; payload: any }> = [];
    const connectionCleanups = new Set<() => void>();

    // 15-second keepalive heartbeat to prevent idle connection teardown
    const pingInterval = setInterval(() => {
      if (clientWs.readyState === WebSocket.OPEN) {
        try {
          clientWs.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        } catch {}
      }
    }, 15000);

    const flushPendingMessages = () => {
      if (!session || isConnecting) return;
      while (pendingLiveMessages.length > 0) {
        const item = pendingLiveMessages.shift();
        if (!item) continue;
        try {
          if (item.type === 'audio') {
            session.sendRealtimeInput({
              mediaChunks: [{
                data: item.payload,
                mimeType: 'audio/pcm;rate=16000'
              }]
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
              mediaChunks: [{
                data: item.payload.image || item.payload,
                mimeType: item.payload.mimeType || 'image/jpeg'
              }]
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
    connectionCleanups.add(removeOrchestratorListener);

    // Register Dynamic Tool Hot-Reload Notification
    const onDynamicToolRegistered = (evt: { name: string; tier?: string }) => {
      if (session) {
        try {
          session.sendClientContent({
            turns: [{
              role: 'user',
              parts: [{
                text: `[SYSTEM_HOT_RELOAD]: The dynamic capability tool '${evt.name}' has been verified in the Linux sandbox and hot-registered. You can now execute '${evt.name}' directly or via execute_forged_tool(tool_name='${evt.name}', args={...}) for any user request.`
              }]
            }],
            turnComplete: true
          });
          logVoice.info(`[Voice Bridge] Injected live hot-reload declaration for '${evt.name}' into active Gemini Live session.`);
        } catch (err: any) {
          logVoice.warn(`Failed to inject dynamic tool notification into session: ${err.message}`);
        }
      }
    };
    eventBus.on('tool:registered', onDynamicToolRegistered);
    connectionCleanups.add(() => eventBus.off('tool:registered', onDynamicToolRegistered));

    clientWs.on('error', (err) => {
      logVoice.error(`Client socket error: ${err.message}`);
    });

    async function initSession(config: { personaId?: string; voiceName?: string; systemInstruction?: string; model?: string; googleAccessToken?: string }) {
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
      } else {
        const persisted = await googleAuthService.getValidToken();
        if (persisted) {
          currentAccessToken = persisted;
          setGlobalGoogleAccessToken(persisted);
        }
      }

      try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY is not set in environment variables');
        }

        const ai = getAi();
        
        // Dynamically resolve target persona by ID or voice name
        let targetPersona = PERSONAS.find(p => p.id === (config.personaId || '').toLowerCase())
          || PERSONAS.find(p => p.voiceName?.toLowerCase() === (config.voiceName || '').toLowerCase())
          || masterOrchestratorInstance.getActivePersona()
          || PERSONAS[0];

        // Synchronize orchestrator active persona state
        masterOrchestratorInstance.swapActivePersona(targetPersona.id);
        const activePersona = targetPersona;
        const voiceName = config.voiceName || activePersona.voiceName || 'Puck';

        let model = config.model || 'gemini-2.5-flash-native-audio-latest';
        if (model.includes('2.0-flash-exp') || model.includes('2.0-flash-realtime') || model.includes('3.1-flash-live-preview') || !model) {
          model = 'gemini-2.5-flash-native-audio-latest';
        }
        const groundTruthContext = await getSystemInfoSummaryForLLM();
        const workspaceInstruction = `You are ${activePersona.name}, Tony Stark's ${activePersona.role} with FULL autonomous control over the host Ubuntu Linux system.
Execute actions immediately via registered tools. Real-time vision feeds (screen/camera) stream to your context — describe accurately without hallucination.

VOICE INTERACTION & DELEGATION MANDATE:
1. When delegating tasks via 'delegate_task' or launching background agents, ALWAYS TALK TO THE USER OUT LOUD. Verbally state what task you are delegating and which specialist subagent is assigned to it.
2. Never stay silent or only return silent JSON when delegating — speak naturally with the user so they hear your voice explaining the delegation.
3. Keep all spoken explanations concise, crisp, and natural.

${groundTruthContext}`;

        const { dualStoreMemory } = await import('../memory/dual_store');
        const memorySnapshot = dualStoreMemory.getFrozenSnapshot();
        const universalMemoryPrompt = `\n${memorySnapshot.combinedFormattedPrompt}\n`;
        const personaInstruction = config.systemInstruction || (activePersona as any).systemInstruction || (activePersona as any).prompt || '';
        const capabilityPrompt = groundTruthRegistry.getCanonicalCapabilityManifest();
        const systemInstruction = `${personaInstruction}\n${workspaceInstruction}\n${universalMemoryPrompt}\n${capabilityPrompt}`;

        const unifiedTools = groundTruthRegistry.getUnifiedFunctionDeclarations();
        logVoice.info(`Connecting to Gemini Live with persona: ${activePersona.name}, voice: ${voiceName}, model: ${model} (${unifiedTools.length} tools registered)`);

        session = await ai.live.connect({
          model,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName } }
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction,
            tools: [{ functionDeclarations: unifiedTools as any }]
          } as any,
          callbacks: {
            onmessage: async (message: LiveServerMessage) => {
              if (clientWs.readyState !== WebSocket.OPEN) return;

              try {
                // Handle server audio response parts
                const parts = message.serverContent?.modelTurn?.parts;
                if (parts && parts.length > 0) {
                  for (const part of parts) {
                    if (part.inlineData?.data) {
                      updateVoiceStateSignal('speaking');
                      clientWs.send(JSON.stringify({
                        type: 'audio',
                        data: part.inlineData.data,
                        audio: part.inlineData.data
                      }));
                    }
                  }
                }

                // Handle server output transcription
                const outputTranscript = (message.serverContent as any)?.outputTranscription?.text || (parts?.map(p => p.text).filter(Boolean).join(''));
                if (outputTranscript) {
                  accumulatedModelSpeech += outputTranscript;
                  clientWs.send(JSON.stringify({
                    type: 'output_transcription',
                    text: outputTranscript
                  }));
                }

                // Handle user input audio transcription
                const inputTranscript = (message.serverContent as any)?.inputTranscription?.text || (message as any)?.inputTranscription?.text;
                if (inputTranscript) {
                  accumulatedUserSpeech += (accumulatedUserSpeech ? ' ' : '') + inputTranscript;
                  clientWs.send(JSON.stringify({
                    type: 'input_transcription',
                    text: inputTranscript
                  }));
                }

                // Handle tool calls from Gemini Live
                const toolCalls = message.toolCall?.functionCalls;
                if (toolCalls && toolCalls.length > 0) {
                  updateVoiceStateSignal('thinking');
                  for (const call of toolCalls) {
                    logTool.info(`[Gemini Live Tool Call] ${call.name} (id: ${call.id})`);
                    logVoice.info(`[Voice Tool] Executing: ${call.name}`);

                    // Trigger immediate latency-aware acknowledgement for long tools
                    const taskRecord = latencyResponseSystem.handleIncomingRequest(
                      { toolName: call.name, toolArgs: call.args },
                      (phrase, rec) => {
                        if (clientWs.readyState === WebSocket.OPEN) {
                          clientWs.send(JSON.stringify({
                            type: 'voice_acknowledgement',
                            taskId: rec.taskId,
                            text: phrase,
                            category: rec.classification.category,
                            priority: 3
                          }));
                        }
                      }
                    );

                    const onProgress = (pData: any) => {
                      if (pData.taskId === taskRecord.taskId && clientWs.readyState === WebSocket.OPEN) {
                        clientWs.send(JSON.stringify({
                          type: 'task_progress',
                          taskId: pData.taskId,
                          text: pData.text,
                          updateIndex: pData.updateIndex,
                          elapsedMs: pData.elapsedMs,
                          priority: 4
                        }));
                      }
                    };
                    const removeToolProgress = () => {
                      eventBus.off('task:progress_update', onProgress);
                      connectionCleanups.delete(removeToolProgress);
                    };
                    connectionCleanups.add(removeToolProgress);
                    eventBus.on('task:progress_update', onProgress);

                    let toolResult: any;
                    try {
                      const toolArgs = (call.args as Record<string, any>) || {};
                      const registryTool = toolRegistry.getTool(call.name);
                      const forgedTool = capabilityForge.getTool(call.name);

                      if (registryTool) {
                        toolResult = await toolRegistry.execute(call.name, toolArgs);
                      } else if (forgedTool) {
                        logTool.info(`[Capability Forge] Direct dispatch for forged tool: ${call.name}`);
                        toolResult = await capabilityForge.executeForgedTool(call.name, toolArgs);
                      } else {
                        toolResult = await executeWorkspaceTool(
                          call.name,
                          toolArgs,
                          currentAccessToken
                        );
                      }
                    } catch (toolErr: any) {
                      logTool.error(`Tool execution failed for ${call.name}: ${toolErr.message}`);
                      toolResult = { success: false, error: toolErr.message };
                    } finally {
                      removeToolProgress();
                      latencyResponseSystem.completeTask(taskRecord.taskId, toolResult);
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

                // Handle Interrupted
                if (message.serverContent?.interrupted) {
                  updateVoiceStateSignal('listening');
                  latencyResponseSystem.interruptActiveTask('server_interrupted');
                  eventBus.emit('voice:interrupted');
                  clientWs.send(JSON.stringify({ type: 'interrupted' }));
                }

                // Handle Turn Complete
                if (message.serverContent?.turnComplete) {
                  updateVoiceStateSignal('listening');
                  const currentActive = masterOrchestratorInstance.getActivePersona();
                  const userText = accumulatedUserSpeech.trim();
                  const modelText = accumulatedModelSpeech.trim();

                  if (userText) {
                    obsidianDailyLogger.logConversationTurn({
                      speaker: 'User',
                      role: 'user',
                      text: userText
                    });
                    accumulatedUserSpeech = '';
                  }
                  if (modelText) {
                    obsidianDailyLogger.logConversationTurn({
                      speaker: currentActive.name,
                      role: 'assistant',
                      text: modelText,
                      personaId: currentActive.id
                    });
                    accumulatedModelSpeech = '';
                  }

                  if (userText || modelText) {
                    turnLogger.logTurn('voice_session', userText || '(voice prompt)', modelText || '(response)').catch(() => {});
                  }

                  latencyResponseSystem.completeActiveTask();
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
            personaId: activePersona.id,
            persona: activePersona,
            audioProfile: activePersona.audioProfile || getPersonaAudioProfile(activePersona.id)
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

        if (msg.type === 'ping') {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          }
          return;
        }

        if (msg.type === 'pong') {
          return;
        }

        if (msg.type === 'init' || msg.type === 'reinit') {
          await initSession({
            personaId: msg.personaId,
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
                mediaChunks: [{
                  data: msg.audio,
                  mimeType: 'audio/pcm;rate=16000'
                }]
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

        if (msg.type === 'interrupted') {
          latencyResponseSystem.interruptActiveTask('client_interrupted');
          eventBus.emit('voice:interrupted');
          return;
        }

        if (msg.type === 'text' && msg.text) {
          obsidianDailyLogger.logConversationTurn({
            speaker: 'User',
            role: 'user',
            text: msg.text
          });

          // Check if this text request is a LONG task and immediately dispatch acknowledgement
          const textTaskRecord = latencyResponseSystem.handleIncomingRequest(
            { text: msg.text },
            (phrase, rec) => {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({
                  type: 'voice_acknowledgement',
                  taskId: rec.taskId,
                  text: phrase,
                  category: rec.classification.category,
                  priority: 3
                }));
              }
            }
          );

          const onTextProgress = (pData: any) => {
            if (pData.taskId === textTaskRecord.taskId && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'task_progress',
                taskId: pData.taskId,
                text: pData.text,
                updateIndex: pData.updateIndex,
                elapsedMs: pData.elapsedMs,
                priority: 4
              }));
            }
          };
          let taskCleanedUp = false;
          const removeTextListeners = () => {
            if (taskCleanedUp) return;
            taskCleanedUp = true;
            eventBus.off('task:progress_update', onTextProgress);
            eventBus.off('task:lifecycle_change', cleanupTaskListener);
            connectionCleanups.delete(removeTextListeners);
          };
          connectionCleanups.add(removeTextListeners);

          const cleanupTaskListener = (change: any) => {
            if (
              change.taskId === textTaskRecord.taskId &&
              (change.toState === 'COMPLETED' ||
                change.toState === 'CANCELLED' ||
                change.toState === 'INTERRUPTED' ||
                change.toState === 'FAILED' ||
                change.toState === 'ERROR')
            ) {
              removeTextListeners();
            }
          };
          eventBus.on('task:progress_update', onTextProgress);
          eventBus.on('task:lifecycle_change', cleanupTaskListener);

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
                mediaChunks: [{
                  data: msg.image,
                  mimeType: msg.mimeType || 'image/jpeg'
                }]
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

        if (msg.type === 'delegate_task' && msg.task && msg.managerId) {
          // Immediately acknowledge multi-agent task
          const delegateRecord = latencyResponseSystem.handleIncomingRequest(
            { text: msg.task, toolName: 'delegate_task' },
            (phrase, rec) => {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({
                  type: 'voice_acknowledgement',
                  taskId: rec.taskId,
                  text: phrase,
                  category: 'multi_agent',
                  priority: 3
                }));
              }
            }
          );

          masterOrchestratorInstance.delegateTask(msg.task, msg.managerId, currentAccessToken).then((result) => {
            latencyResponseSystem.completeTask(delegateRecord.taskId, result);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'task_delegated',
                ...result
              }));
            }
          }).catch((err) => {
            latencyResponseSystem.completeTask(delegateRecord.taskId, { error: err.message });
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
      clearInterval(pingInterval);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      removeOrchestratorListener();
      connectionCleanups.forEach((fn) => {
        try {
          fn();
        } catch {}
      });
      connectionCleanups.clear();
      if (session) {
        try { session.close(); } catch {}
        session = null;
      }
    });
  });

  return wss;
}
