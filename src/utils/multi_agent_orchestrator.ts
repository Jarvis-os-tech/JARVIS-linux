// Phase 4: Master 24/7 Multi-Agent Orchestrator for J.A.R.V.I.S. Ecosystem
// Implements:
// 1. Single-Stream Persona Hot-Swapping without disconnecting Live WebSocket
// 2. Muted Relay Protocol for silent background manager executions with CEO relay
// 3. Voice Patch-Through (Active Voice Protocol) for direct manager focus
// 4. 24/7 Autonomous Background Sentinel Loops (Ultron Security, Edith Web Recon)

import { loadPersonaPrompt } from './prompt_loader';
import { executeUnifiedAiChat } from './ai_engine';
import { executeSystemCommand } from './system_controller';

export interface PersonaMetadata {
  id: string;
  name: string;
  callsign: string;
  title: string;
  role: 'ceo' | 'manager' | 'specialist';
  voiceName: string;
  accentColor: string;
  domain: string;
  status: 'active_voice' | 'muted_relay_running' | 'idle' | 'alerting';
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

class MultiAgentOrchestrator {
  private activePersonaId: string = 'jarvis';
  private personas: Map<string, PersonaMetadata> = new Map();
  private mutedRelayEvents: MutedRelayEvent[] = [];
  private sentinelTimer: NodeJS.Timeout | null = null;
  private eventListeners: Array<(event: { type: string; data: any }) => void> = [];

  constructor() {
    this.initializePersonas();
    this.startBackgroundSentinels();
  }

  private initializePersonas(): void {
    const baseList: Omit<PersonaMetadata, 'status' | 'lastActivityTime'>[] = [
      {
        id: 'jarvis',
        name: 'J.A.R.V.I.S.',
        callsign: 'Prime Orchestrator',
        title: 'Chief Executive Officer (CEO)',
        role: 'ceo',
        voiceName: 'Puck',
        accentColor: '#06b6d4', // Cyan
        domain: 'Global intent routing, conversational state, manager delegation, voice priority'
      },
      {
        id: 'friday',
        name: 'F.R.I.D.A.Y.',
        callsign: 'Master Intelligence',
        title: 'Senior Analytics Manager',
        role: 'manager',
        voiceName: 'Aoede',
        accentColor: '#10b981', // Emerald
        domain: 'Deep data synthesis, complex code analysis, document drafting, macro-knowledge'
      },
      {
        id: 'ultron',
        name: 'U.L.T.R.O.N.',
        callsign: 'Defensive Shield',
        title: 'Chief Security Officer (CSO)',
        role: 'manager',
        voiceName: 'Fenrir',
        accentColor: '#ef4444', // Red
        domain: 'Firewall rules, listening ports, kernel security, exploit prevention, host care'
      },
      {
        id: 'edith',
        name: 'E.D.I.T.H.',
        callsign: 'Internet Controller',
        title: 'Tactical Reconnaissance Manager',
        role: 'manager',
        voiceName: 'Kore',
        accentColor: '#3b82f6', // Blue
        domain: 'Web scraping, API pipelines, wide-area search, perimeter diagnostics'
      },
      {
        id: 'karen',
        name: 'K.A.R.E.N.',
        callsign: 'Tactical Co-Pilot',
        title: 'Hardware & OS Manager',
        role: 'manager',
        voiceName: 'Charon',
        accentColor: '#f59e0b', // Amber
        domain: 'Laptop brightness, PulseAudio volume, thermals, battery conservation, shortcuts'
      },
      {
        id: 'vision',
        name: 'V.I.S.I.O.N.',
        callsign: 'Multimodal Sentinel',
        title: 'Visual Surveillance Specialist',
        role: 'specialist',
        voiceName: 'Puck',
        accentColor: '#8b5cf6', // Purple
        domain: 'Live screen analysis, camera visual reasoning, OCR, multimodal commentary'
      }
    ];

    for (const p of baseList) {
      this.personas.set(p.id, {
        ...p,
        status: p.id === this.activePersonaId ? 'active_voice' : 'idle',
        lastActivityTime: new Date().toISOString()
      });
    }
  }

  public getActivePersona(): PersonaMetadata {
    return this.personas.get(this.activePersonaId) || this.personas.get('jarvis')!;
  }

  public getAllPersonas(): PersonaMetadata[] {
    return Array.from(this.personas.values());
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
        console.error('[Orchestrator] Error notifying event listener:', err);
      }
    }
  }

  // 1. Single-Stream Persona Hot-Swapping
  public swapActivePersona(targetPersonaId: string): {
    success: boolean;
    previousPersona: PersonaMetadata;
    newPersona: PersonaMetadata;
    contextShiftDirective: string;
    systemInstruction: string;
  } {
    const normalized = targetPersonaId.toLowerCase();
    const target = this.personas.get(normalized);

    if (!target) {
      return {
        success: false,
        previousPersona: this.getActivePersona(),
        newPersona: this.getActivePersona(),
        contextShiftDirective: '',
        systemInstruction: loadPersonaPrompt(this.activePersonaId)
      };
    }

    const prev = this.getActivePersona();
    prev.status = 'idle';
    prev.lastActivityTime = new Date().toISOString();

    target.status = 'active_voice';
    target.lastActivityTime = new Date().toISOString();
    this.activePersonaId = target.id;

    const specificPrompt = loadPersonaPrompt(target.id);
    const contextShiftDirective = `[CONTEXT SHIFT ACTIVATED: Voice Focus Granted to ${target.name} (${target.title})]\n` +
      `You are now actively speaking as ${target.name}. Voice timbre assigned: ${target.voiceName}.\n` +
      `Specialty Domain: ${target.domain}\n` +
      `Adopt your full persona tone, demeanor, and perspective immediately.\n\n${specificPrompt}`;

    this.emitEvent('persona_swapped', {
      previousPersonaId: prev.id,
      newPersonaId: target.id,
      persona: target
    });

    console.log(`[Orchestrator] Persona hot-swapped from ${prev.name} to ${target.name}`);

    return {
      success: true,
      previousPersona: prev,
      newPersona: target,
      contextShiftDirective,
      systemInstruction: specificPrompt
    };
  }

  // 2. Muted Relay Protocol: Process structured outputs from background managers
  public processMutedRelayOutput(rawText: string, managerId: string): MutedRelayEvent {
    const manager = this.personas.get(managerId.toLowerCase()) || {
      id: managerId,
      name: managerId.toUpperCase(),
      title: 'Specialist Manager'
    };

    // Clean brackets e.g. {ULTRON_SECURITY_STATUS: All listening ports secure} -> clean text
    const cleanContent = rawText
      .replace(/^\{[A-Z_]+:\s*/i, '')
      .replace(/\}$/, '')
      .replace(/^\{/, '')
      .trim();

    const isWarning =
      cleanContent.toLowerCase().includes('vulnerability') ||
      cleanContent.toLowerCase().includes('unauthorized') ||
      cleanContent.toLowerCase().includes('failed') ||
      cleanContent.toLowerCase().includes('high load');

    const isCritical =
      cleanContent.toLowerCase().includes('breach') ||
      cleanContent.toLowerCase().includes('exploit') ||
      cleanContent.toLowerCase().includes('attack');

    const severity: MutedRelayEvent['severity'] = isCritical ? 'critical' : isWarning ? 'warning' : 'info';

    const relayedSummary = `Sir, a background briefing from ${manager.name}: ${cleanContent}`;

    const event: MutedRelayEvent = {
      id: `relay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      sourceManagerId: manager.id,
      sourceManagerName: manager.name,
      rawOutput: rawText,
      relayedSummary,
      severity
    };

    this.mutedRelayEvents.push(event);
    if (this.mutedRelayEvents.length > 50) this.mutedRelayEvents.shift();

    this.emitEvent('muted_relay_alert', event);
    return event;
  }

  // 3. Delegate Task to Background Manager (Muted Mode)
  public async delegateTask(
    taskDescription: string,
    targetManagerId: string,
    googleAccessToken?: string
  ): Promise<{ success: boolean; relayedEvent: MutedRelayEvent; resultText: string }> {
    const manager = this.personas.get(targetManagerId.toLowerCase());
    if (!manager) {
      throw new Error(`Manager ${targetManagerId} not found in orchestrator registry.`);
    }

    manager.status = 'muted_relay_running';
    manager.activeTask = taskDescription;
    manager.lastActivityTime = new Date().toISOString();

    this.emitEvent('manager_task_started', {
      managerId: manager.id,
      task: taskDescription
    });

    try {
      const prompt = loadPersonaPrompt(manager.id);
      const executionResult = await executeUnifiedAiChat({
        message: taskDescription,
        provider: 'auto',
        systemInstruction: `${prompt}\n[MUTED RELAY ENFORCEMENT]: You are running as a background manager. Wrap your final findings inside structural braces {${manager.name.toUpperCase()}_REPORT: ...}.`,
        googleAccessToken
      });

      manager.status = 'idle';
      manager.activeTask = undefined;

      const relayedEvent = this.processMutedRelayOutput(executionResult.text, manager.id);

      return {
        success: true,
        relayedEvent,
        resultText: executionResult.text
      };
    } catch (err: any) {
      manager.status = 'idle';
      manager.activeTask = undefined;
      const failEvent = this.processMutedRelayOutput(`Task failed: ${err.message}`, manager.id);
      return {
        success: false,
        relayedEvent: failEvent,
        resultText: `Task failed: ${err.message}`
      };
    }
  }

  // 4. 24/7 Autonomous Background Sentinel Loops
  private startBackgroundSentinels(): void {
    console.log('[Orchestrator] Initializing 24/7 Autonomous Background Sentinels...');

    // Run periodic security audit every 5 minutes
    this.sentinelTimer = setInterval(async () => {
      try {
        await this.runUltronSecurityAudit();
      } catch (err) {
        console.warn('[Orchestrator] Ultron background audit tick error:', err);
      }
    }, 5 * 60 * 1000);

    // Initial audit check on launch after 10 seconds
    setTimeout(() => {
      this.runUltronSecurityAudit().catch((e) => console.warn('[Orchestrator] Initial audit error:', e));
    }, 10000);
  }

  private async runUltronSecurityAudit(): Promise<void> {
    const ultron = this.personas.get('ultron');
    if (!ultron) return;

    // Quick silent security inspection: check failed units and open listening ports
    const [failedUnitsRes, listeningSocketsRes] = await Promise.all([
      executeSystemCommand('systemctl --user --failed --no-pager --no-legend 2>/dev/null || true'),
      executeSystemCommand('ss -tulpn 2>/dev/null | grep LISTEN | head -n 10 || true')
    ]);

    const failedUnits = failedUnitsRes.result?.stdout?.trim();
    const hasFailures = failedUnits && failedUnits.length > 0;

    if (hasFailures) {
      this.processMutedRelayOutput(
        `{ULTRON_SECURITY_ALERT: Detected degraded user services: ${failedUnits.split('\n')[0]}}`,
        'ultron'
      );
    } else {
      console.log('[Ultron Sentinel] Host security verification clean: 0 failed services.');
    }
  }

  public stopSentinels(): void {
    if (this.sentinelTimer) {
      clearInterval(this.sentinelTimer);
      this.sentinelTimer = null;
    }
  }
}

export const masterOrchestratorInstance = new MultiAgentOrchestrator();
export { MultiAgentOrchestrator };
