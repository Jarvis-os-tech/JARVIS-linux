/**
 * AssistantGreeter / JarvisGreeter Module
 * Manages time-of-day detection, daily greeting frequency via localStorage,
 * and session duration tracking for long-usage awareness upon activation.
 */

export class AssistantGreeter {
  private sessionStartTime: number = Date.now();

  /** Determines current time of day */
  public getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }

  /** Retrieves daily greeting count from localStorage, resetting if date changes */
  public getDailyGreetingCount(): { count: number; date: string } {
    try {
      const today = new Date().toISOString().split('T')[0];
      const stored = localStorage.getItem('jarvis_daily_greetings');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.date === today) {
          return parsed;
        }
      }
      return { count: 0, date: today };
    } catch {
      return { count: 0, date: new Date().toISOString().split('T')[0] };
    }
  }

  /** Increments and persists daily greeting count */
  public incrementDailyGreetingCount(): number {
    try {
      const current = this.getDailyGreetingCount();
      const newCount = current.count + 1;
      localStorage.setItem(
        'jarvis_daily_greetings',
        JSON.stringify({ count: newCount, date: current.date })
      );
      return newCount;
    } catch {
      return 1;
    }
  }

  /** Calculates session duration in minutes */
  public getSessionDurationMinutes(): number {
    return Math.floor((Date.now() - this.sessionStartTime) / 60000);
  }

  /** Gathers full context for the greeting prompt */
  public getGreetingContext(agentName: string = 'Jarvis') {
    const dailyCount = this.incrementDailyGreetingCount();
    const sessionDurationMins = this.getSessionDurationMinutes();
    const isLongSession = sessionDurationMins >= 25; // 25+ minutes flagged as prolonged activity
    return {
      dailyCount,
      sessionDurationMins,
      isLongSession,
      timeOfDay: this.getTimeOfDay(),
      generateDynamicPrompt: () => {
        const timeOfDay = this.getTimeOfDay();
        const longSessionNote = isLongSession
          ? ` Note: We have been continuously active for over ${sessionDurationMins} minutes today across ${dailyCount} activations. Politely remark on our sustained productivity or suggest a brief break.`
          : ` This is greeting number ${dailyCount} today.`;

        const variations = [
          `Say a unique, natural 1-sentence ${timeOfDay} greeting as ${agentName}.${longSessionNote} Be spontaneous, direct, and ready.`,
          `Acknowledge activation in 1 brief, energetic sentence as ${agentName}.${longSessionNote} Refer to the ${timeOfDay} context and confirm you are on standby.`,
          `Greet me with fresh, creative phrasing in 1 short spoken sentence as ${agentName}.${longSessionNote} Sound sharp and attentive.`,
          `Give a quick, conversational, 1-sentence opening as ${agentName}.${longSessionNote} Signal immediate readiness.`,
          `Welcome me back in 1 distinct spoken line as ${agentName}.${longSessionNote} Use warm, natural language tailored to this ${timeOfDay}.`
        ];

        const pick = variations[Math.floor(Math.random() * variations.length)];
        return `${pick} [Random seed: ${Math.floor(Math.random() * 100000)}]`;
      }
    };
  }
}

export const assistantGreeterInstance = new AssistantGreeter();
