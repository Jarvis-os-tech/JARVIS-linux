// Background Post-Turn Review & Dreaming Engine for J.A.R.V.I.S.
// Asynchronously reviews completed turns, extracts key lessons, updates memory, and synthesizes skills without blocking voice.
// Ported and enhanced from Hermes (agent/background_review.py) and OpenClaw Dreaming

import { eventBus } from './event_bus';
import { logOrchestrator } from './logger';
import { dualStoreMemory } from '../memory/dual_store';
import { learningGraph } from './learning_graph';
import { learningMutations } from './learning_mutations';

export class BackgroundReviewEngine {
  private static instance: BackgroundReviewEngine;
  private isReviewing = false;

  public static getInstance(): BackgroundReviewEngine {
    if (!BackgroundReviewEngine.instance) {
      BackgroundReviewEngine.instance = new BackgroundReviewEngine();
    }
    return BackgroundReviewEngine.instance;
  }

  constructor() {
    // Listen to turn completions on the event bus
    eventBus.on('subagent:completed', (data: any) => {
      this.scheduleReview(data);
    });
  }

  /**
   * Schedule an async review in background (never throws, never blocks caller).
   */
  public scheduleReview(turnData: { subagentId?: string; role?: string; goal?: string; result?: any }): void {
    setTimeout(() => {
      this.executeReview(turnData).catch(err => {
        logOrchestrator.warn(`Background review failed quietly: ${err.message}`);
      });
    }, 1000);
  }

  private async executeReview(turnData: any): Promise<void> {
    if (this.isReviewing) return;
    this.isReviewing = true;

    try {
      const role = turnData.role || 'jarvis';
      const goal = turnData.goal || 'General Task';
      const summary = typeof turnData.result === 'string' ? turnData.result : JSON.stringify(turnData.result);

      logOrchestrator.debug(`[Background Review] Conducting post-turn review for [${role}]: ${goal}`);

      // Record in learning graph
      learningGraph.addOrUpdateNode({
        id: `task:${turnData.subagentId || Date.now()}`,
        type: 'memory',
        label: goal.slice(0, 50),
        category: 'completed_task',
        useCount: 1,
        metadata: { role, completedAt: new Date().toISOString() }
      });

      // Update episodic knowledge
      dualStoreMemory.logFact(`[Learned Experience from ${role.toUpperCase()}] For task "${goal}": ${summary.slice(0, 300)}`);

      eventBus.emit('review:completed', { role, goal });
    } finally {
      this.isReviewing = false;
    }
  }
}

export const backgroundReview = BackgroundReviewEngine.getInstance();
