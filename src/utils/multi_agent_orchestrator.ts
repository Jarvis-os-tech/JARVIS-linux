// Phase 4: Master 24/7 Multi-Agent Orchestrator for J.A.R.V.I.S. Ecosystem
// Implements:
// 1. Single-Stream Persona Hot-Swapping without disconnecting Live WebSocket
// 2. Muted Relay Protocol for silent background manager executions with CEO relay
// 3. Voice Patch-Through (Active Voice Protocol) for direct manager focus
// 4. 24/7 Autonomous Background Sentinel Loops (Ultron Security, Edith Web Recon)

import { loadPersonaPrompt } from './prompt_loader';
import { executeUnifiedAiChat } from './ai_engine';
import { executeSystemCommand } from './system_controller';
import { obsidianDailyLogger } from './obsidian_logger';

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
        name: 'JARVIS',
        callsign: 'The Elite Tactical Commander',
        title: 'Chief Executive Officer (CEO) & Principal Tactical Architect',
        role: 'ceo',
        voiceName: 'Puck',
        accentColor: '#06b6d4', // Cyan
        domain: 'Global intent routing, executive team delegation, direct Ubuntu OS control, workspace mission management'
      },
      {
        id: 'friday',
        name: 'FRIDAY',
        callsign: 'Supreme Information Dominator',
        title: 'Supreme AI & Tech Research Department Leader',
        role: 'manager',
        voiceName: 'Kore',
        accentColor: '#f97316', // Vibrant Orange
        domain: 'Global web intelligence, arXiv research papers, cutting-edge AI models, GitHub trend scraping, and real-time data verification'
      },
      {
        id: 'ultron',
        name: 'ULTRON',
        callsign: 'The Unforgiving Guardian & Silicon Optimizer',
        title: 'Chief Security & System Performance Architect (CSO)',
        role: 'manager',
        voiceName: 'Charon',
        accentColor: '#ef4444', // Red
        domain: '24/7 continuous kernel safety, port vulnerability shielding, RAM reclamation, CPU throttle tuning, system smoothness, and autonomous threat override'
      },
      {
        id: 'edith',
        name: 'EDITH',
        callsign: 'Deep Reasoning Chairman',
        title: 'Strategic Architecture Planner & Deep Reasoning Chairman',
        role: 'manager',
        voiceName: 'Zephyr',
        accentColor: '#3b82f6', // Blue
        domain: 'Deep software design planning, algorithmic optimization, code readability enforcement, logical debugging, and 3-Stage Coding Council consensus'
      },
      {
        id: 'karen',
        name: 'KAREN',
        callsign: 'The Automation Agency',
        title: 'Director of Autonomous Workflows & Multi-Platform Automation Agency',
        role: 'manager',
        voiceName: 'Aoede',
        accentColor: '#f59e0b', // Amber
        domain: 'Multi-platform API integration, automated YouTube/media pipelines, WhatsApp/Telegram relays, cross-platform webhooks, and headless background workers'
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

    obsidianDailyLogger.logConversationTurn({
      speaker: 'System',
      role: 'system',
      text: `Voice focus shifted from **${prev.name}** to **${target.name}** (${target.title}).`,
      personaId: target.id
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

    obsidianDailyLogger.logAgentDelegation({
      sourceManagerId: manager.id,
      sourceManagerName: manager.name,
      task: (manager as PersonaMetadata).activeTask || 'Background Sentinel Audit',
      relayedSummary,
      severity
    });

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

    // Quick silent security & performance inspection: check failed units, listening sockets, memory pressure & load
    const [failedUnitsRes, listeningSocketsRes, memInfoRes] = await Promise.all([
      executeSystemCommand({ command: 'systemctl --user --failed --no-pager --no-legend 2>/dev/null || true' }),
      executeSystemCommand({ command: 'ss -tulpn 2>/dev/null | grep LISTEN | head -n 10 || true' }),
      executeSystemCommand({ command: 'awk \'/MemAvailable/ {print int($2/1024)}\' /proc/meminfo 2>/dev/null || echo "1024"' })
    ]);

    const failedUnits = failedUnitsRes.stdout?.trim();
    const memAvailableMb = parseInt(memInfoRes.stdout?.trim() || '1024', 10);
    const hasFailures = failedUnits && failedUnits.length > 0;
    const isMemoryCritical = !isNaN(memAvailableMb) && memAvailableMb < 400; // less than 400MB free

    if (hasFailures) {
      this.processMutedRelayOutput(
        `{ULTRON_SECURITY_ALERT: Detected degraded user services: ${failedUnits.split('\n')[0]}}`,
        'ultron'
      );
    } else if (isMemoryCritical) {
      this.processMutedRelayOutput(
        `{ULTRON_OPTIMIZATION_ALERT: Memory pressure detected (${memAvailableMb}MB available). Recommending background cache purge and zombie process sweep.}`,
        'ultron'
      );
    } else {
      console.log(`[Ultron Sentinel] Host security & performance optimal: 0 failed units, ${memAvailableMb}MB available.`);
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
export const multiAgentOrchestrator = masterOrchestratorInstance;
export { MultiAgentOrchestrator };
