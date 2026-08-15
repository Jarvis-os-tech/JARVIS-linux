import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  Radio,
  Cpu,
  Globe,
  Eye,
  Activity,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  X,
  Play,
  Volume2
} from 'lucide-react';
import { PersonaMetadata, MutedRelayEvent } from '../utils/multi_agent_orchestrator';

interface MultiAgentStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  personas: PersonaMetadata[];
  activePersonaId: string;
  onSwapPersona: (personaId: string) => void;
  onDelegateTask: (task: string, managerId: string) => void;
  mutedRelayEvents: MutedRelayEvent[];
}

export const MultiAgentStatusModal: React.FC<MultiAgentStatusModalProps> = ({
  isOpen,
  onClose,
  personas,
  activePersonaId,
  onSwapPersona,
  onDelegateTask,
  mutedRelayEvents
}) => {
  const [selectedManager, setSelectedManager] = useState<string>('ultron');
  const [taskInput, setTaskInput] = useState<string>('');
  const [isDelegating, setIsDelegating] = useState<boolean>(false);

  if (!isOpen) return null;

  const getPersonaIcon = (id: string) => {
    switch (id) {
      case 'jarvis':
        return <Cpu className="w-5 h-5 text-cyan-400" />;
      case 'friday':
        return <Activity className="w-5 h-5 text-emerald-400" />;
      case 'ultron':
        return <Shield className="w-5 h-5 text-red-400" />;
      case 'edith':
        return <Globe className="w-5 h-5 text-blue-400" />;
      case 'karen':
        return <Zap className="w-5 h-5 text-amber-400" />;
      case 'vision':
        return <Eye className="w-5 h-5 text-purple-400" />;
      default:
        return <Users className="w-5 h-5 text-zinc-400" />;
    }
  };

  const handleRunDelegatedTask = async () => {
    if (!taskInput.trim()) return;
    setIsDelegating(true);
    try {
      await onDelegateTask(taskInput.trim(), selectedManager);
      setTaskInput('');
    } finally {
      setIsDelegating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-zinc-950 border border-white/15 rounded-3xl p-6 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">Multi-Agent Command Deck</h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Phase 4 Orchestrator
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Single-Stream Persona Hot-Swapping & Muted Relay Audio Protocol
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Container */}
        <div className="flex-1 overflow-y-auto py-4 space-y-5 no-scrollbar">
          {/* Agent Hierarchy Grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Active Ecosystem Hierarchy</h3>
              <span className="text-[11px] text-zinc-500">Click &apos;Take Mic&apos; for Voice Patch-Through</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {personas.map((persona) => {
                const isActive = persona.id === activePersonaId;
                return (
                  <div
                    key={persona.id}
                    className={`p-3.5 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                      isActive
                        ? 'bg-zinc-900/90 border-cyan-500/50 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/30'
                        : 'bg-zinc-900/40 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-xl bg-zinc-800 border border-white/10">
                            {getPersonaIcon(persona.id)}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white flex items-center gap-1.5">
                              {persona.name}
                              {persona.role === 'ceo' && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
                                  CEO
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-400">{persona.title}</div>
                          </div>
                        </div>

                        {isActive ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse">
                            <Volume2 className="w-3 h-3" /> Voice
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-500 px-1.5 py-0.5 rounded bg-zinc-800/80 border border-white/5">
                            Muted
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-zinc-400 mt-2 line-clamp-2 leading-relaxed">
                        {persona.domain}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between">
                      <span className="text-[10px] text-zinc-500 font-mono">Voice: {persona.voiceName}</span>
                      {!isActive && (
                        <button
                          onClick={() => onSwapPersona(persona.id)}
                          className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-xl bg-white/10 hover:bg-cyan-500/20 hover:text-cyan-300 text-zinc-300 border border-white/10 hover:border-cyan-500/30 transition-all font-medium"
                        >
                          <ArrowRightLeft className="w-3 h-3" /> Take Mic
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Muted Relay Task Dispatcher */}
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Silent Background Delegation (Muted Relay)
                </h3>
              </div>
              <span className="text-[11px] text-zinc-400">
                Runs task in background ➔ Results reported via Prime J.A.R.V.I.S.
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={selectedManager}
                onChange={(e) => setSelectedManager(e.target.value)}
                className="bg-zinc-950 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="ultron">U.L.T.R.O.N. (Security & Firewall)</option>
                <option value="friday">F.R.I.D.A.Y. (Data & Intel)</option>
                <option value="edith">E.D.I.T.H. (Web & Network)</option>
                <option value="karen">K.A.R.E.N. (Hardware & OS)</option>
                <option value="vision">V.I.S.I.O.N. (Visual Sentinel)</option>
              </select>

              <input
                type="text"
                placeholder="Enter background directive (e.g. 'Audit open ports and firewall integrity')..."
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRunDelegatedTask()}
                className="flex-1 bg-zinc-950 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
              />

              <button
                onClick={handleRunDelegatedTask}
                disabled={isDelegating || !taskInput.trim()}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              >
                {isDelegating ? (
                  <Radio className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                Delegate
              </button>
            </div>
          </div>

          {/* Muted Relay Activity & Alert Feed */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
              Live Muted Relay Event Feed
            </h3>
            <div className="max-h-40 overflow-y-auto space-y-2 p-3 rounded-2xl bg-zinc-950/80 border border-white/10 no-scrollbar">
              {mutedRelayEvents.length === 0 ? (
                <div className="text-center py-4 text-xs text-zinc-500 flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  All background managers operating normally. 0 active alerts.
                </div>
              ) : (
                mutedRelayEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className={`p-2.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                      evt.severity === 'critical'
                        ? 'bg-red-950/40 border-red-500/40 text-red-200'
                        : evt.severity === 'warning'
                        ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                        : 'bg-zinc-900 border-white/10 text-zinc-300'
                    }`}
                  >
                    <div className="mt-0.5">
                      {evt.severity === 'critical' || evt.severity === 'warning' ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      ) : (
                        <Shield className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-bold text-white text-[11px]">
                          {evt.sourceManagerName}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">{evt.timestamp}</span>
                      </div>
                      <p className="text-[11px] leading-relaxed break-words">{evt.relayedSummary}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-zinc-500">
          <span>Stark Ecosystem Core v4.0</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
