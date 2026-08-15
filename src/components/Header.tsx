import React from 'react';
import { ConnectionState } from '../types';
import { Mic, Volume2, VolumeX, Settings, Sparkles, Wifi, Folder, Globe, Brain, Activity, Terminal, Sun, Users, Radio } from 'lucide-react';

interface HeaderProps {
  connectionState: ConnectionState;
  latencyMs: number;
  selectedPersonaName: string;
  onOpenSettings: () => void;
  onOpenWorkspace: () => void;
  onOpenMemory: () => void;
  onOpenNlu?: () => void;
  onOpenSystemControl?: () => void;
  onOpenOrchestrator?: () => void;
  memoryCount: number;
  mutedRelayCount?: number;
  batteryPercent?: number | null;
  brightnessPercent?: number | null;
  volumePercent?: number | null;
  volumeMuted?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  connectionState,
  latencyMs,
  selectedPersonaName,
  onOpenSettings,
  onOpenWorkspace,
  onOpenMemory,
  onOpenNlu,
  onOpenSystemControl,
  onOpenOrchestrator,
  memoryCount,
  mutedRelayCount = 0,
  batteryPercent,
  brightnessPercent,
  volumePercent,
  volumeMuted
}) => {
  const getStatusBadge = () => {
    switch (connectionState) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Connected
          </span>
        );
      case 'speaking':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
            <Volume2 className="w-3.5 h-3.5 text-indigo-500 animate-bounce" />
            Speaking
          </span>
        );
      case 'listening':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-600 border border-rose-500/20">
            <Mic className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
            Listening
          </span>
        );
      case 'connecting':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            Connecting...
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-600 border border-red-500/20">
            Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-zinc-500/10 text-zinc-600 border border-zinc-500/20">
            Ready
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-white/10 bg-zinc-950/70 backdrop-blur-xl px-4 sm:px-6 py-3.5 flex items-center justify-between transition-all shadow-lg shadow-black/20">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-sky-500 to-indigo-600 p-0.5 shadow-lg shadow-cyan-500/20 flex items-center justify-center">
          <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-cyan-400" />
          </div>
        </div>
        <div>
          <h1 className="text-base font-semibold text-zinc-100 leading-none flex items-center gap-2">
            J.A.R.V.I.S. MCU AI Hub
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 rounded-md border border-cyan-500/30">
              Live Voice AI
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-md border border-emerald-500/30 flex items-center gap-1" title="Auto-detects spoken & typed language in real-time">
              <Globe className="w-3 h-3 text-emerald-400" /> Auto-Lang
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Active Co-Pilot: <span className="font-semibold text-cyan-300">{selectedPersonaName}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {getStatusBadge()}

        {connectionState !== 'disconnected' && (
          <div className="hidden sm:flex items-center gap-1 text-xs text-zinc-300 glass-pill px-2.5 py-1 rounded-lg">
            <Wifi className="w-3.5 h-3.5 text-zinc-400" />
            <span>{latencyMs > 0 ? `${latencyMs}ms` : 'Realtime'}</span>
          </div>
        )}

        {/* System & Computer Control Hub Button with Live Hardware Badges */}
        <button
          onClick={onOpenSystemControl}
          className="p-2 rounded-xl text-cyan-300 hover:text-white glass-pill hover:bg-cyan-500/20 transition-all flex items-center gap-2 text-xs font-medium border border-cyan-500/30 shadow-sm"
          title="OS & Computer Control Hub (Volume, Brightness, Apps, Telemetry)"
        >
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="hidden md:inline">System OS</span>
          <div className="flex items-center gap-1.5">
            {brightnessPercent !== null && brightnessPercent !== undefined && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30" title={`Display Brightness: ${brightnessPercent}%`}>
                <Sun className="w-2.5 h-2.5 text-amber-400" />
                {brightnessPercent}%
              </span>
            )}
            {volumePercent !== null && volumePercent !== undefined && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30" title={`Speaker Volume: ${volumePercent}%`}>
                {volumeMuted ? <VolumeX className="w-2.5 h-2.5 text-rose-400" /> : <Volume2 className="w-2.5 h-2.5 text-blue-400" />}
                {volumePercent}%
              </span>
            )}
            {batteryPercent !== null && batteryPercent !== undefined && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-cyan-500 text-zinc-950" title={`Battery: ${batteryPercent}%`}>
                {batteryPercent}%
              </span>
            )}
          </div>
        </button>

        <button
          onClick={onOpenNlu}
          className="p-2 rounded-xl text-cyan-300 hover:text-white glass-pill hover:bg-cyan-500/20 transition-all flex items-center gap-1.5 text-xs font-medium border border-cyan-500/30"
          title="Natural Language Understanding (NLU) & Intent Engine"
        >
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span className="hidden md:inline">NLU</span>
        </button>

        <button
          onClick={onOpenOrchestrator}
          className="p-2 rounded-xl text-indigo-300 hover:text-white glass-pill hover:bg-indigo-500/20 transition-all flex items-center gap-1.5 text-xs font-medium border border-indigo-500/30 relative"
          title="Phase 4: Multi-Agent Orchestrator (Hot-Swapping & Muted Relay)"
        >
          <Radio className="w-4 h-4 text-indigo-400 animate-pulse" />
          <span className="hidden md:inline">Agents</span>
          {mutedRelayCount > 0 && (
            <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-indigo-500 text-white shadow-sm">
              {mutedRelayCount}
            </span>
          )}
        </button>

        <button
          onClick={onOpenMemory}
          className="p-2 rounded-xl text-purple-300 hover:text-white glass-pill hover:bg-purple-500/20 transition-all flex items-center gap-1.5 text-xs font-medium border border-purple-500/30 relative"
          title="Agent Memory & Context Awareness"
        >
          <Brain className="w-4 h-4 text-purple-400 animate-pulse" />
          <span className="hidden md:inline">Memory</span>
          {memoryCount > 0 && (
            <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-purple-500 text-white shadow-sm">
              {memoryCount}
            </span>
          )}
        </button>

        <button
          onClick={onOpenWorkspace}
          className="p-2 rounded-xl text-blue-300 hover:text-white glass-pill hover:bg-blue-500/20 transition-all flex items-center gap-1.5 text-xs font-medium border border-blue-500/30"
          title="Google Workspace Hub"
        >
          <Folder className="w-4 h-4 text-blue-400" />
          <span className="hidden md:inline">Workspace</span>
        </button>

        <button
          onClick={onOpenSettings}
          className="p-2 rounded-xl text-zinc-300 hover:text-white glass-pill hover:bg-white/10 transition-colors"
          title="Voice & Agent Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
