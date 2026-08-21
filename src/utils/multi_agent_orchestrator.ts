// Sovereign J.A.R.V.I.S. Multi-Agent Swarm Orchestrator
// Coordinates the executive commander (JARVIS) with autonomous specialists (FRIDAY, ULTRON, EDITH, HERMES).

import { obsidianDailyLogger } from './obsidian_logger';
import { getPersonaAudioProfile, JARVIS_PERSONA } from '../data/personas';
import { PersonaAudioProfile } from '../types';
import { delegationDispatcher } from '../tools/delegation_tool';
import { eventBus } from '../core/event_bus';

export interface PersonaMetadata {
  id: 'jarvis' | 'friday' | 'ultron' | 'edith' | 'hermes';
  name: string;
  callsign: string;
  title: string;
  role: 'commander' | 'engineer' | 'cso' | 'researcher' | 'operations';
  voiceName: string;
  accentColor: string;
  domain: string;
  audioProfile?: PersonaAudioProfile;
  status: 'active_voice' | 'running_task' | 'idle';
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

const SWARM_PERSONAS: Record<string, PersonaMetadata> = {
  jarvis: {
    id: 'jarvis',
    name: 'JARVIS',
    callsign: 'The Sovereign Commander',
    title: 'Chief of Staff & Voice Commander',
    role: 'commander',
    voiceName: 'Puck',
    accentColor: '#06b6d4',
    domain: 'Real-Time Voice, Executive Delegation & Instant System Control',
    status: 'active_voice',
    lastActivityTime: new Date().toISOString(),
    audioProfile: getPersonaAudioProfile('jarvis')
  },
  friday: {
    id: 'friday',
    name: 'FRIDAY',
    callsign: 'Tactical Engineer',
    title: 'Lead Systems Architect & Code Engineer',
    role: 'engineer',
    voiceName: 'Aoede',
    accentColor: '#3b82f6',
    domain: 'Software Architecture, Git Worktrees, Testing & Refactoring',
    status: 'idle',
    lastActivityTime: new Date().toISOString()
  },
  ultron: {
    id: 'ultron',
    name: 'ULTRON',
    callsign: 'Autonomous CSO',
    title: 'Chief Security Officer & Threat Auditor',
    role: 'cso',
    voiceName: 'Fenrir',
    accentColor: '#ef4444',
    domain: 'Tirith AST Scanning, Command Injection Defense & Approval Gating',
    status: 'idle',
    lastActivityTime: new Date().toISOString()
  },
  edith: {
    id: 'edith',
    name: 'EDITH',
    callsign: 'Deep Intelligence',
    title: 'Global Research & Data Extraction Lead',
    role: 'researcher',
    voiceName: 'Kore',
    accentColor: '#8b5cf6',
    domain: 'Chrome CDP Browser Automation, Agent Reach & Document Forensics',
    status: 'idle',
    lastActivityTime: new Date().toISOString()
  },
  hermes: {
    id: 'hermes',
    name: 'HERMES',
    callsign: 'Background Operations',
    title: '24/7 Ops & Continuous Scheduler',
    role: 'operations',
    voiceName: 'Charon',
    accentColor: '#10b981',
    domain: 'Persistent Cron, SQLite Kanban, Dreaming & Learning Graph Mutations',
    status: 'idle',
    lastActivityTime: new Date().toISOString()
  }
};

class JarvisSwarmOrchestrator {
  private activePersonaId: string = 'jarvis';
  private personas: Map<string, PersonaMetadata> = new Map();
  private mutedRelayEvents: MutedRelayEvent[] = [];
  private eventListeners: Array<(event: { type: string; data: any }) => void> = [];

  constructor() {
    Object.values(SWARM_PERSONAS).forEach(p => this.personas.set(p.id, { ...p }));

    // Listen to subagent events to update swarm state dynamically
    eventBus.on('subagent:started', (data: any) => {
      const p = this.personas.get(data.role);
      if (p) {
        p.status = 'running_task';
        p.activeTask = data.goal;
        p.lastActivityTime = new Date().toISOString();
        this.emitEvent('swarm_updated', { personas: this.getAllPersonas() });
      }
    });

    eventBus.on('subagent:completed', (data: any) => {
      const p = this.personas.get(data.role);
      if (p) {
        p.status = 'idle';
        p.activeTask = undefined;
        p.lastActivityTime = new Date().toISOString();
        this.emitEvent('swarm_updated', { personas: this.getAllPersonas() });
      }
    });

    eventBus.on('subagent:failed', (data: any) => {
      const p = this.personas.get(data.role);
      if (p) {
        p.status = 'idle';
        p.activeTask = undefined;
        this.emitEvent('swarm_updated', { personas: this.getAllPersonas() });
      }
    });
  }

  public getActivePersona(): PersonaMetadata {
    return this.personas.get(this.activePersonaId) || SWARM_PERSONAS.jarvis;
  }

  public getAllPersonas(): PersonaMetadata[] {
    return Array.from(this.personas.values());
  }

  public getPersona(id: string): PersonaMetadata | undefined {
    return this.personas.get(id);
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
        console.error('[Swarm Orchestrator] Error in listener:', err);
      }
    }
  }

  /**
   * Delegate an autonomous task to a specialist subagent.
   */
  public async delegateTask(
    task: string,
    role: 'friday' | 'ultron' | 'edith' | 'hermes' = 'friday',
    context?: string,
    isolatedWorktree: boolean = true
  ): Promise<{ success: boolean; result: any; summary: string }> {
    const res = await delegationDispatcher.handleDelegation({
      goal: task,
      role,
      context,
      isolated_worktree: isolatedWorktree,
      background: false
    });

    const summary = res.results?.[0]?.result || res.error || 'Delegation complete';
    obsidianDailyLogger.logConversationTurn({
      speaker: `${role.toUpperCase()} Subagent`,
      role: 'assistant',
      text: `Specialist task completed:\n${summary}`
    });

    return {
      success: res.success,
      result: res.results?.[0],
      summary
    };
  }
}

export const masterOrchestratorInstance = new JarvisSwarmOrchestrator();
export const multiAgentOrchestrator = masterOrchestratorInstance;
export const jarvisOrchestrator = masterOrchestratorInstance;
export const jarvisSwarmOrchestrator = masterOrchestratorInstance;
