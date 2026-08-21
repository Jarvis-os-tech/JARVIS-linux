import React, { useEffect, useState } from 'react';
import { PersonaMetadata } from '@/types';

const INITIAL_SWARM: PersonaMetadata[] = [
  {
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
  {
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
  {
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
  {
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
];

export const SwarmTelemetryBar: React.FC = () => {
  const [personas, setPersonas] = useState<PersonaMetadata[]>(INITIAL_SWARM);

  const fetchSwarmState = async () => {
    try {
      const res = await fetch('/api/swarm');
      if (res.ok) {
        const data = await res.json();
        if (data.personas && Array.isArray(data.personas)) {
          setPersonas(data.personas.filter((p: PersonaMetadata) => p.id !== 'jarvis'));
        }
      }
    } catch {
      // polling fallback
    }
  };

  useEffect(() => {
    fetchSwarmState();
    const interval = setInterval(fetchSwarmState, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 px-4 py-2 bg-black/40 backdrop-blur-md border border-cyan-500/20 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.15)] transition-all duration-300">
      <div className="flex items-center gap-2 pr-3 border-r border-cyan-500/30">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
        </span>
        <span className="text-[11px] font-mono font-bold tracking-widest text-cyan-300 uppercase">
          Swarm Mesh
        </span>
      </div>

      <div className="flex items-center gap-2">
        {personas.map((agent) => {
          const isBusy = agent.status === 'running_task';
          return (
            <div
              key={agent.id}
              className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-all duration-300 text-xs font-mono ${
                isBusy
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.4)] animate-pulse'
                  : 'bg-white/5 border-white/10 text-zinc-400 hover:border-white/20'
              }`}
              title={`${agent.title}: ${agent.domain}`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: isBusy ? agent.accentColor : '#71717a' }}
              />
              <span className="font-semibold text-[11px] uppercase tracking-wider">
                {agent.name}
              </span>
              {isBusy && agent.activeTask && (
                <span className="text-[10px] text-cyan-300/80 truncate max-w-[120px]">
                  ({agent.activeTask})
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
