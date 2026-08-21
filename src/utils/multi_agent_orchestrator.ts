// Sovereign JARVIS Orchestrator
import { executeSystemCommand } from './system_controller';
import { obsidianDailyLogger } from './obsidian_logger';
import { getPersonaAudioProfile, JARVIS_PERSONA } from '../data/personas';
import { PersonaAudioProfile } from '../types';

export interface PersonaMetadata {
  id: string;
  name: string;
  callsign: string;
  title: string;
  role: 'ceo' | 'manager' | 'specialist';
  voiceName: string;
  accentColor: string;
  domain: string;
  audioProfile?: PersonaAudioProfile;
  status: 'active_voice' | 'idle';
  lastActivityTime: string;
  activeTask?: string;
}

export interface MutedRelayEvent {
  id: string;
  timestamp: string;
  sourceManagerId: string;
  sourceManagerName: string;
  rawOutput: string;
  relayedSummary: string;
  severity: 'info' | 'warning' | 'critical';
}

class JarvisOrchestrator {
  private activePersonaId: string = 'jarvis';
  private jarvisMetadata: PersonaMetadata;
  private mutedRelayEvents: MutedRelayEvent[] = [];
  private eventListeners: Array<(event: { type: string; data: any }) => void> = [];

  constructor() {
    this.jarvisMetadata = {
      id: 'jarvis',
      name: 'JARVIS',
      callsign: 'The Elite Tactical Commander',
      title: 'Sovereign AI Chief of Staff & Tactical Operating Partner',
      role: 'ceo',
      voiceName: 'Puck',
      accentColor: '#06b6d4',
      domain: 'Supreme Tactical Authority, Autonomous Linux Control & Spatial Stage',
      status: 'active_voice',
      lastActivityTime: new Date().toISOString(),
      audioProfile: getPersonaAudioProfile('jarvis')
    };
  }

  public getActivePersona(): PersonaMetadata {
    return { ...this.jarvisMetadata };
  }

  public getAllPersonas(): PersonaMetadata[] {
    return [{ ...this.jarvisMetadata }];
  }

  public getMutedRelayEvents(): MutedRelayEvent[] {
    return [...this.mutedRelayEvents].slice(-20);
  }

  public addEventListener(listener: (event: { type: string; data: any }) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      this.eventListeners = this.eventListeners.filter((l) => l !== listener);
    };
  }

  private emitEvent(type: string, data: any): void {
    for (const listener of this.eventListeners) {
      try {
        listener({ type, data });
      } catch (err) {
        console.error('[Orchestrator] Error in listener:', err);
      }
    }
  }

  public swapActivePersona(_targetPersonaId: string) {
    // Single sovereign persona mode — JARVIS remains active
    return {
      success: true,
      previousPersona: this.jarvisMetadata,
      newPersona: this.jarvisMetadata,
      contextShiftDirective: '',
      systemInstruction: JARVIS_PERSONA.systemInstruction,
      audioProfile: getPersonaAudioProfile('jarvis')
    };
  }

  public async delegateTask(task: string, managerId: string, googleAccessToken?: string): Promise<{ success: boolean; result: any; summary: string }> {
    const start = Date.now();
    this.jarvisMetadata.activeTask = task;
    this.emitEvent('task_started', { task, managerId });

    try {
      const { executeUnifiedAiChat } = await import('./ai_engine');
      const chatRes = await executeUnifiedAiChat({
        message: task,
        googleAccessToken,
        systemInstruction: `Execute this subagent task with high agency and verify completion.`
      });

      const summary = chatRes.text;
      const durationMs = Date.now() - start;

      obsidianDailyLogger.logConversationTurn({
        speaker: 'JARVIS Subagent',
        role: 'assistant',
        text: `Subagent task completed (${durationMs}ms):\n${summary}`
      });

      return {
        success: true,
        result: chatRes,
        summary
      };
    } catch (err: any) {
      return {
        success: false,
        result: null,
        summary: `Subagent delegation failed: ${err.message}`
      };
    } finally {
      this.jarvisMetadata.activeTask = undefined;
    }
  }
}

export const masterOrchestratorInstance = new JarvisOrchestrator();
export const multiAgentOrchestrator = masterOrchestratorInstance;
export const jarvisOrchestrator = masterOrchestratorInstance;
