import { memoryClient } from './client';
import { memoryContextBuilder } from './context_builder';
import { eventBus } from '../core/event_bus';
import { logOrchestrator } from '../core/logger';

export interface ConversationTurnCapture {
  userMessage: string;
  assistantResponse: string;
  personaId?: string;
  timestamp?: string;
}

export class AutoCaptureEngine {
  private static instance: AutoCaptureEngine;
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly AUTO_FLUSH_INTERVAL_MS = 15 * 60 * 1000; // Auto flush memory buffers every 15 minutes

  public static getInstance(): AutoCaptureEngine {
    if (!AutoCaptureEngine.instance) {
      AutoCaptureEngine.instance = new AutoCaptureEngine();
    }
    return AutoCaptureEngine.instance;
  }

  constructor() {}

  public start(): void {
    logOrchestrator.info('[AutoCapture] 🧠 Lifelong Learning & Auto-Capture Engine initialized.');

    // 1. Hook into EventBus for conversation turns
    eventBus.on('conversation:turn_completed', async (data: ConversationTurnCapture) => {
      await this.processConversationTurn(data);
    });

    // 2. Schedule periodic memory tree consolidation
    this.flushTimer = setInterval(async () => {
      try {
        logOrchestrator.debug('[AutoCapture] Running periodic memory tree consolidation...');
        const flushRes = await memoryClient.flush(300); // flush buffers idle for >5 mins
        if (flushRes.flushed_buffers > 0) {
          logOrchestrator.info(
            `[AutoCapture] Consolidated ${flushRes.flushed_buffers} idle buffer(s) into ${flushRes.sealed_summaries.length} summary notes.`
          );
          memoryContextBuilder.invalidateCache();
        }
      } catch (err: any) {
        logOrchestrator.debug(`[AutoCapture] Flush tick note: ${err.message}`);
      }
    }, this.AUTO_FLUSH_INTERVAL_MS);
  }

  /**
   * Evaluates if a conversation turn contains durable architectural facts, user preferences, or corrections
   */
  public async processConversationTurn(turn: ConversationTurnCapture): Promise<void> {
    const userText = turn.userMessage.trim();
    if (userText.length < 10) return;

    // Pattern matching for explicit or implicit user facts/preferences
    const isPreference =
      /i prefer|always use|never use|remember that|my preference|i like|i want to keep/i.test(userText);
    const isArchitecturalRule =
      /architecture rule|must be written in|we use|our pipeline uses|protocol:/i.test(userText);
    const isCorrection =
      /no, you should|that is wrong|correction:|actually, we use|change it to/i.test(userText);

    if (isPreference || isArchitecturalRule || isCorrection) {
      const title = this.generateFactTitle(userText);
      const kind = isPreference ? 'preference' : isArchitecturalRule ? 'pattern' : 'decision';

      logOrchestrator.info(`[AutoCapture] 🎯 Auto-detected durable fact: "${title}"`);

      await memoryClient.createNode({
        title,
        content: `User Statement: "${userText}"\nAssistant Acknowledgment: "${turn.assistantResponse.slice(0, 300)}"`,
        kind,
        tier: 'persistent',
        importance: isCorrection ? 0.95 : 0.85,
        scope: turn.personaId || 'global',
        tags: ['auto_capture', kind, turn.personaId || 'jarvis'],
      });

      memoryContextBuilder.invalidateCache();
    }
  }

  private generateFactTitle(text: string): string {
    const clean = text.replace(/^(remember that|please remember|note:|always remember)\s*/i, '');
    return clean.length > 50 ? `${clean.slice(0, 47)}...` : clean;
  }

  public stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

export const autoCaptureEngine = AutoCaptureEngine.getInstance();
