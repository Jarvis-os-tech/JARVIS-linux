import { logVoice, logTool } from '../core/logger';
import { memoryClient } from './client';
import { sessionRepo } from '../db/db';

export class TurnLogger {
  private static instance: TurnLogger;

  public static getInstance(): TurnLogger {
    if (!TurnLogger.instance) {
      TurnLogger.instance = new TurnLogger();
    }
    return TurnLogger.instance;
  }

  constructor() {}

  public async logTurn(sessionId: string, userMsg: string, assistantMsg: string, metadata?: any): Promise<void> {
    try {
      const content = `User: ${userMsg}\nAssistant: ${assistantMsg}`;
      const title = `Q&A: ${userMsg.substring(0, 30)}...`;

      const result = await memoryClient.createNode({
        kind: 'conversation',
        tier: 'session',
        title,
        content,
        tags: ['conversation', sessionId],
      });

      if (!result.success) {
        logVoice.warn(`[TurnLogger] Failed to log turn to memory engine: ${result.message}`);
        this.fallbackLog(sessionId, userMsg, assistantMsg, metadata);
      }
    } catch (err: any) {
      logVoice.warn(`[TurnLogger] Error logging turn: ${err.message}. Falling back to SQLite.`);
      this.fallbackLog(sessionId, userMsg, assistantMsg, metadata);
    }
  }

  public async logToolExecution(toolName: string, args: any, result: any): Promise<void> {
    try {
      const content = `Tool: ${toolName}\nArgs: ${JSON.stringify(args)}\nResult: ${JSON.stringify(result)}`;
      const title = `Tool Execution: ${toolName}`;

      await memoryClient.createNode({
        kind: 'pattern',
        tier: 'working',
        title,
        content,
        tags: ['tool_execution', toolName]
      });
    } catch (err: any) {
      logTool.warn(`[TurnLogger] Error logging tool execution: ${err.message}`);
    }
  }

  private fallbackLog(sessionId: string, userMsg: string, assistantMsg: string, metadata?: any): void {
    try {
      if (sessionRepo) {
        sessionRepo.getOrCreate(sessionId);
        
        sessionRepo.addMessage({
          id: `msg-${Date.now()}-user`,
          session_id: sessionId,
          role: 'user',
          content: userMsg,
          created_at: Date.now()
        });

        sessionRepo.addMessage({
          id: `msg-${Date.now()}-assistant`,
          session_id: sessionId,
          role: 'assistant',
          content: assistantMsg,
          created_at: Date.now()
        });
      }
    } catch (err: any) {
      logVoice.error(`[TurnLogger] Fallback log failed: ${err.message}`);
    }
  }
}

export const turnLogger = TurnLogger.getInstance();
