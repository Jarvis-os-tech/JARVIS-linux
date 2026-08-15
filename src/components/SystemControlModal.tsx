import React, { useState, useEffect } from 'react';
import {
  Cpu, HardDrive, Battery, BatteryCharging, Volume2, VolumeX, Sun,
  Activity, Play, Pause, SkipForward, SkipBack, Square, Lock, Moon,
  Bell, Terminal, Search, Trash2, Power, RefreshCw, X, ShieldAlert,
  Flame, Wifi, Monitor, CheckCircle2, AlertCircle, Sparkles, AppWindow,
  FileText, Shield, Clipboard, Server, Network
} from 'lucide-react';
import { HardwareControlState } from '../types';

interface SystemControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

export const SystemControlModal: React.FC<SystemControlModalProps> = ({
  isOpen,
  onClose,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'hardware' | 'specs' | 'apps' | 'processes' | 'diagnostics' | 'terminal'>('hardware');
  const [telemetry, setTelemetry] = useState<any>(null);
  const [hardwareState, setHardwareState] = useState<HardwareControlState | null>(null);
  const [installedApps, setInstalledApps] = useState<any[]>([]);
  const [appSearch, setAppSearch] = useState('');
  const [processes, setProcesses] = useState<any[]>([]);
  const [processSort, setProcessSort] = useState<'cpu' | 'memory'>('cpu');
  const [loading, setLoading] = useState(false);
  const [commandInput, setCommandInput] = useState('uname -a');
  const [commandOutput, setCommandOutput] = useState<any>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [pcSpec, setPcSpec] = useState<any>(null);
  const [systemLogs, setSystemLogs] = useState<string[]>([]);
  const [logSource, setLogSource] = useState<'journalctl' | 'dmesg' | 'syslog' | 'auth'>('journalctl');
  const [networkConnections, setNetworkConnections] = useState<any[]>([]);
  const [clipboardContent, setClipboardContent] = useState<string>('');

  // Auto clear feedback after 4s
  useEffect(() => {
    if (actionFeedback) {
      const timer = setTimeout(() => setActionFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [actionFeedback]);

  // Fetch telemetry & hardware status
  const fetchTelemetry = async () => {
    setLoading(true);
    try {
      const [telemRes, hwRes] = await Promise.all([
        fetch('/api/system/telemetry').then(r => r.json()),
        fetch('/api/system/hardware').then(r => r.json())
      ]);
      setTelemetry(telemRes);
      setHardwareState(hwRes);
    } catch (e: any) {
      console.error('Failed to load system telemetry:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchApps = async () => {
    try {
      const res = await fetch('/api/system/apps').then(r => r.json());
      setInstalledApps(res.applications || []);
    } catch (e) {}
  };

  const fetchProcesses = async () => {
    try {
      const res = await fetch(`/api/system/processes?sortBy=${processSort}&limit=25`).then(r => r.json());
      setProcesses(res.processes || []);
    } catch (e) {}
  };

  const fetchPcSpec = async () => {
    try {
      const res = await fetch('/api/system/spec').then(r => r.json());
      setPcSpec(res);
    } catch (e) {}
  };

  const fetchLogs = async (source = logSource) => {
    try {
      const res = await fetch(`/api/system/logs?source=${source}&lines=60`).then(r => r.json());
      setSystemLogs(res.logs || []);
    } catch (e) {}
  };

  const fetchNetworkConnections = async () => {
    try {
      const res = await fetch('/api/system/connections?filter=listening&limit=40').then(r => r.json());
      setNetworkConnections(res.listeningPorts || res.connections || []);
    } catch (e) {}
  };

  const fetchClipboard = async () => {
    try {
      const res = await fetch('/api/system/clipboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'read' })
      }).then(r => r.json());
      if (res.success && typeof res.text === 'string') {
        setClipboardContent(res.text);
      }
    } catch (e) {}
  };

  const handleWriteClipboard = async (text: string) => {
    try {
      const res = await fetch('/api/system/clipboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'write', text })
      }).then(r => r.json());
      if (res.success) {
        setActionFeedback('Copied to system clipboard');
        setClipboardContent(text);
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (isOpen) {
      fetchTelemetry();
      fetchApps();
      fetchProcesses();
      fetchPcSpec();
      fetchLogs();
      fetchNetworkConnections();
      fetchClipboard();
    }

    const handleHardwareUpdate = (e: any) => {
      const detail = e?.detail;
      if (detail) {
        if (detail.brightness) {
          setHardwareState(prev => prev ? { ...prev, brightness: detail.brightness } : null);
        }
        if (detail.volume) {
          setHardwareState(prev => prev ? { ...prev, volume: detail.volume } : null);
        } else if (detail.volumePercent !== undefined) {
          setHardwareState(prev => prev ? { ...prev, volume: { volumePercent: detail.volumePercent, muted: detail.muted ?? false } } : null);
        }
        if (detail.battery) {
          setHardwareState(prev => prev ? { ...prev, battery: detail.battery } : null);
        }
        if (detail.powerProfile) {
          setHardwareState(prev => prev ? { ...prev, powerProfile: detail.powerProfile } : null);
        }
      }
    };

    window.addEventListener('jarvis-hardware-updated', handleHardwareUpdate);
    return () => window.removeEventListener('jarvis-hardware-updated', handleHardwareUpdate);
  }, [isOpen, processSort, logSource]);

  if (!isOpen) return null;

  // System Control Actions
  const handleVolumeChange = async (newVol: number) => {
    try {
      const res = await fetch('/api/system/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_volume', percent: newVol })
      }).then(r => r.json());

      if (res.success) {
        setHardwareState(prev => prev ? { ...prev, volume: res.volume } : null);
        setActionFeedback(`Volume adjusted to ${res.volume.volumePercent}%`);
      }
    } catch (e) {}
  };

  const handleToggleMute = async () => {
    try {
      const res = await fetch('/api/system/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_volume', toggleMute: true })
      }).then(r => r.json());

      if (res.success) {
        setHardwareState(prev => prev ? { ...prev, volume: res.volume } : null);
        setActionFeedback(res.volume.muted ? 'Speakers muted' : 'Speakers unmuted');
      }
    } catch (e) {}
  };

  const handleBrightnessChange = async (newVal: number) => {
    try {
      const res = await fetch('/api/system/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_brightness', percent: newVal })
      }).then(r => r.json());

      if (res.success) {
        setHardwareState(prev => prev ? { ...prev, brightness: res.brightness } : null);
        setActionFeedback(`Screen brightness adjusted to ${res.brightness.brightnessPercent}%`);
      }
    } catch (e) {}
  };

  const handlePowerProfile = async (profile: string) => {
    try {
      const res = await fetch('/api/system/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_power_profile', profile })
      }).then(r => r.json());

      if (res.success) {
        setHardwareState(prev => prev ? { ...prev, powerProfile: res.profile } : null);
        setActionFeedback(`Power profile switched to ${profile}`);
      }
    } catch (e) {}
  };

  const handleMediaControl = async (mediaAction: string) => {
    try {
      const res = await fetch('/api/system/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'control_media', mediaAction })
      }).then(r => r.json());
      setActionFeedback(res.message);
    } catch (e) {}
  };

  const handlePowerAction = async (powerAction: string) => {
    try {
      const res = await fetch('/api/system/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'power_action', powerAction })
      }).then(r => r.json());
      setActionFeedback(res.message);
    } catch (e) {}
  };

  const handleSendNotification = async () => {
    try {
      const res = await fetch('/api/system/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_notification',
          title: 'J.A.R.V.I.S. Tactical Status',
          message: 'All autonomous OS control subroutines and real-time telemetry sensors are active.',
          urgency: 'normal'
        })
      }).then(r => r.json());
      setActionFeedback(res.message);
    } catch (e) {}
  };

  const handleLaunchApp = async (cmd: string) => {
    try {
      const res = await fetch('/api/system/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'launch_app', appNameOrCommand: cmd })
      }).then(r => r.json());
      setActionFeedback(res.message);
    } catch (e) {}
  };

  const handleKillProcess = async (pid: number) => {
    try {
      const res = await fetch('/api/system/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'manage_process', pid, signal: 'SIGTERM' })
      }).then(r => r.json());
      setActionFeedback(res.message);
      fetchProcesses();
    } catch (e) {}
  };

  const handleRunCommand = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commandInput.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/system/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: commandInput })
      }).then(r => r.json());
      setCommandOutput(res);
    } catch (err: any) {
      setCommandOutput({ success: false, stderr: err.message });
    } finally {
      setLoading(false);
    }
  };

  const filteredApps = installedApps.filter(app =>
    app.name.toLowerCase().includes(appSearch.toLowerCase()) ||
    app.exec.toLowerCase().includes(appSearch.toLowerCase()) ||
    (app.comment && app.comment.toLowerCase().includes(appSearch.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-5xl h-[85vh] bg-zinc-950/95 border border-cyan-500/30 rounded-3xl shadow-2xl shadow-cyan-500/10 flex flex-col overflow-hidden text-zinc-100">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Activity className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                J.A.R.V.I.S. Tactical OS & Computer Control Hub
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded-md border border-cyan-500/30">
                  Zero Hallucination
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Ground-truth host telemetry, hardware controls, app launcher, and autonomous system execution.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { fetchTelemetry(); fetchProcesses(); }}
              disabled={loading}
              className="p-2 rounded-xl text-zinc-400 hover:text-white glass-pill hover:bg-white/10 transition-all border border-white/10"
              title="Refresh Telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-white glass-pill hover:bg-white/10 transition-all border border-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Toast Feedback */}
        {actionFeedback && (
          <div className="bg-cyan-500/10 border-b border-cyan-500/30 px-6 py-2 flex items-center justify-between text-xs text-cyan-300 animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              <span>{actionFeedback}</span>
            </div>
            <button onClick={() => setActionFeedback(null)} className="text-cyan-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 py-2.5 border-b border-white/10 bg-zinc-900/30 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('hardware')}
            className={`px-4 py-1.5 rounded-xl font-medium transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'hardware'
                ? 'bg-cyan-500 text-zinc-950 font-bold shadow-lg shadow-cyan-500/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
            }`}
          >
            <Monitor className="w-4 h-4" />
            Hardware & Telemetry
          </button>
          <button
            onClick={() => { setActiveTab('specs'); fetchPcSpec(); }}
            className={`px-4 py-1.5 rounded-xl font-medium transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'specs'
                ? 'bg-cyan-500 text-zinc-950 font-bold shadow-lg shadow-cyan-500/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
            }`}
          >
            <Cpu className="w-4 h-4" />
            PC Hardware Specs
          </button>
          <button
            onClick={() => setActiveTab('apps')}
            className={`px-4 py-1.5 rounded-xl font-medium transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'apps'
                ? 'bg-cyan-500 text-zinc-950 font-bold shadow-lg shadow-cyan-500/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
            }`}
          >
            <AppWindow className="w-4 h-4" />
            App Launcher ({installedApps.length})
          </button>
          <button
            onClick={() => setActiveTab('processes')}
            className={`px-4 py-1.5 rounded-xl font-medium transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'processes'
                ? 'bg-cyan-500 text-zinc-950 font-bold shadow-lg shadow-cyan-500/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
            }`}
          >
            <Activity className="w-4 h-4" />
            Processes & Task Manager
          </button>
          <button
            onClick={() => { setActiveTab('diagnostics'); fetchLogs(); fetchNetworkConnections(); fetchClipboard(); }}
            className={`px-4 py-1.5 rounded-xl font-medium transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'diagnostics'
                ? 'bg-cyan-500 text-zinc-950 font-bold shadow-lg shadow-cyan-500/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
            }`}
          >
            <Shield className="w-4 h-4" />
            Logs, Ports & Clipboard
          </button>
          <button
            onClick={() => setActiveTab('terminal')}
            className={`px-4 py-1.5 rounded-xl font-medium transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'terminal'
                ? 'bg-cyan-500 text-zinc-950 font-bold shadow-lg shadow-cyan-500/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
            }`}
          >
            <Terminal className="w-4 h-4" />
            Shell & Execution
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* TAB 1: HARDWARE & TELEMETRY */}
          {activeTab === 'hardware' && (
            <div className="space-y-6 animate-fade-in">
              {/* Quick Controls Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Volume Card */}
                <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                      <Volume2 className="w-4 h-4 text-cyan-400" />
                      Audio Volume Output
                    </div>
                    <button
                      onClick={handleToggleMute}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                        hardwareState?.volume?.muted
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {hardwareState?.volume?.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      {hardwareState?.volume?.muted ? 'Muted' : 'Active'}
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={hardwareState?.volume?.volumePercent ?? telemetry?.volume?.volumePercent ?? 50}
                      onChange={(e) => handleVolumeChange(parseInt(e.target.value, 10))}
                      className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                    <span className="text-xs font-mono font-bold text-cyan-300 w-10 text-right">
                      {hardwareState?.volume?.volumePercent ?? telemetry?.volume?.volumePercent ?? 50}%
                    </span>
                  </div>
                </div>

                {/* Brightness Card */}
                <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                      <Sun className="w-4 h-4 text-amber-400" />
                      Screen Brightness ({hardwareState?.brightness?.connector || 'Display'})
                    </div>
                    <span className="text-xs font-mono font-bold text-amber-300">
                      {hardwareState?.brightness?.brightnessPercent ?? telemetry?.brightness?.brightnessPercent ?? 50}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="5"
                      max="100"
                      value={hardwareState?.brightness?.brightnessPercent ?? telemetry?.brightness?.brightnessPercent ?? 50}
                      onChange={(e) => handleBrightnessChange(parseInt(e.target.value, 10))}
                      className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                    />
                    <span className="text-xs font-mono font-bold text-amber-300 w-10 text-right">
                      {hardwareState?.brightness?.brightnessPercent ?? telemetry?.brightness?.brightnessPercent ?? 50}%
                    </span>
                  </div>
                </div>

              </div>

              {/* Real-time Telemetry Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                
                {/* CPU Metric */}
                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span className="flex items-center gap-1.5"><Cpu className="w-4 h-4 text-cyan-400" /> CPU Core</span>
                    <span className="font-mono text-cyan-300">{telemetry?.cpu?.cores || 8} Cores</span>
                  </div>
                  <div className="text-xl font-bold text-zinc-100 font-mono">
                    {telemetry?.cpu?.usagePercent || 0}%
                  </div>
                  <p className="text-[11px] text-zinc-400 truncate">
                    {telemetry?.cpu?.model || 'Intel / AMD Processor'}
                  </p>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    Load: {telemetry?.cpu?.load1m || 0.5} (1m), {telemetry?.cpu?.load5m || 0.4} (5m)
                  </p>
                </div>

                {/* RAM Metric */}
                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span className="flex items-center gap-1.5"><Activity className="w-4 h-4 text-indigo-400" /> Memory</span>
                    <span className="font-mono text-indigo-300">{telemetry?.memory?.usagePercent || 0}%</span>
                  </div>
                  <div className="text-xl font-bold text-zinc-100 font-mono">
                    {Math.round((telemetry?.memory?.usedMb || 0) / 1024 * 10) / 10} / {Math.round((telemetry?.memory?.totalMb || 0) / 1024 * 10) / 10} GB
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${telemetry?.memory?.usagePercent || 0}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    Free: {telemetry?.memory?.freeMb || 0} MB
                  </p>
                </div>

                {/* Battery Metric */}
                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      {telemetry?.battery?.plugged ? <BatteryCharging className="w-4 h-4 text-emerald-400" /> : <Battery className="w-4 h-4 text-emerald-400" />}
                      Battery
                    </span>
                    <span className="font-mono text-emerald-300 capitalize">{telemetry?.battery?.state || 'AC Power'}</span>
                  </div>
                  <div className="text-xl font-bold text-zinc-100 font-mono">
                    {telemetry?.battery?.percent !== null && telemetry?.battery?.percent !== undefined ? `${telemetry.battery.percent}%` : 'AC Line'}
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    {telemetry?.battery?.plugged ? 'AC Adapter Connected' : 'Running on Battery Power'}
                  </p>
                  {telemetry?.battery?.timeToEmpty && (
                    <p className="text-[10px] text-zinc-500 font-mono">Time Left: {telemetry.battery.timeToEmpty}</p>
                  )}
                </div>

                {/* Thermals Metric */}
                <div className="p-4 rounded-2xl bg-zinc-900/40 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span className="flex items-center gap-1.5"><Flame className="w-4 h-4 text-rose-400" /> Thermals</span>
                    <span className="font-mono text-rose-300">{telemetry?.thermals?.status || 'Normal'}</span>
                  </div>
                  <div className="text-xl font-bold text-zinc-100 font-mono">
                    {telemetry?.thermals?.maxTempCelsius || 48}°C
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Peak Zone Temperature
                  </p>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    Sensors: {telemetry?.thermals?.sensors?.length || 1} zones active
                  </p>
                </div>

              </div>

              {/* Power Profile & System Quick Actions */}
              <div className="p-4 rounded-2xl bg-zinc-900/40 border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Power Profile Strategy
                  </div>
                  <div className="flex items-center gap-2">
                    {(['power-saver', 'balanced', 'performance'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => handlePowerProfile(p)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium capitalize border transition-all cursor-pointer ${
                          hardwareState?.powerProfile === p
                            ? 'bg-cyan-500 text-zinc-950 font-bold border-cyan-400'
                            : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 border-white/10'
                        }`}
                      >
                        {p.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-white/5 pt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-zinc-400">
                    Host: <span className="text-zinc-200 font-mono">{telemetry?.os?.hostname}</span> | OS: <span className="text-zinc-200">{telemetry?.os?.platform} ({telemetry?.os?.release})</span> | Uptime: <span className="text-cyan-300 font-mono">{telemetry?.uptimeHuman}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleMediaControl('toggle')}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 flex items-center gap-1.5 border border-white/10"
                      title="Play / Pause Media"
                    >
                      <Play className="w-3.5 h-3.5 text-cyan-400" /> Play/Pause
                    </button>
                    <button
                      onClick={handleSendNotification}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 flex items-center gap-1.5 border border-white/10"
                    >
                      <Bell className="w-3.5 h-3.5 text-amber-400" /> Test Notification
                    </button>
                    <button
                      onClick={() => handlePowerAction('lock')}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 flex items-center gap-1.5 border border-white/10"
                    >
                      <Lock className="w-3.5 h-3.5 text-indigo-400" /> Lock Screen
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: APPLICATION LAUNCHER */}
          {activeTab === 'apps' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search installed applications or commands (e.g. Chrome, Code, Terminal)..."
                    value={appSearch}
                    onChange={(e) => setAppSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-zinc-900 border border-white/10 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
              </div>

              {/* Quick Launch Favorites */}
              <div className="p-4 rounded-2xl bg-zinc-900/40 border border-white/10">
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                  Tactical Quick Launcher
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {[
                    { name: 'Google Chrome', cmd: 'google-chrome' },
                    { name: 'VS Code', cmd: 'code' },
                    { name: 'Terminal', cmd: 'gnome-terminal' },
                    { name: 'File Manager', cmd: 'nautilus' },
                    { name: 'Settings', cmd: 'gnome-control-center' },
                    { name: 'Spotify', cmd: 'spotify' }
                  ].map(fav => (
                    <button
                      key={fav.cmd}
                      onClick={() => handleLaunchApp(fav.cmd)}
                      className="p-3 rounded-xl bg-zinc-800/60 hover:bg-cyan-500/20 hover:border-cyan-500/40 border border-white/10 text-center transition-all group cursor-pointer"
                    >
                      <AppWindow className="w-5 h-5 text-cyan-400 mx-auto mb-1 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-medium text-zinc-200 block truncate">{fav.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Filtered Apps List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
                {filteredApps.map(app => (
                  <div
                    key={app.desktopFile}
                    className="p-3 rounded-xl bg-zinc-900/60 border border-white/10 hover:border-cyan-500/30 flex items-center justify-between gap-3 group transition-all"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-zinc-100 truncate">{app.name}</div>
                      <div className="text-[10px] text-zinc-500 font-mono truncate">{app.exec}</div>
                    </div>
                    <button
                      onClick={() => handleLaunchApp(app.exec)}
                      className="px-3 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500 text-cyan-400 hover:text-zinc-950 text-xs font-bold transition-all border border-cyan-500/20 shrink-0 cursor-pointer"
                    >
                      Launch
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: PROCESS MANAGER */}
          {activeTab === 'processes' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">Sort By:</span>
                  <button
                    onClick={() => setProcessSort('cpu')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      processSort === 'cpu' ? 'bg-cyan-500 text-zinc-950 font-bold' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    CPU %
                  </button>
                  <button
                    onClick={() => setProcessSort('memory')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      processSort === 'memory' ? 'bg-cyan-500 text-zinc-950 font-bold' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    Memory %
                  </button>
                </div>

                <button
                  onClick={fetchProcesses}
                  className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 flex items-center gap-1.5 border border-white/10"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh List
                </button>
              </div>

              <div className="rounded-2xl border border-white/10 overflow-hidden bg-zinc-900/40">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-zinc-900 border-b border-white/10 text-zinc-400 font-mono text-[11px]">
                    <tr>
                      <th className="p-3">PID</th>
                      <th className="p-3">User</th>
                      <th className="p-3">CPU %</th>
                      <th className="p-3">Mem %</th>
                      <th className="p-3">Command</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {processes.map(p => (
                      <tr key={p.pid} className="hover:bg-white/5 transition-colors">
                        <td className="p-3 text-cyan-300">{p.pid}</td>
                        <td className="p-3 text-zinc-400">{p.user}</td>
                        <td className="p-3 text-zinc-100 font-bold">{p.cpuPercent}%</td>
                        <td className="p-3 text-indigo-300">{p.memPercent}%</td>
                        <td className="p-3 text-zinc-300 truncate max-w-xs" title={p.command}>
                          {p.command}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleKillProcess(p.pid)}
                            className="px-2.5 py-1 rounded-md bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white text-[10px] font-bold transition-all border border-rose-500/20 cursor-pointer"
                          >
                            Terminate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: PC SPECS & ZERO HALLUCINATION HARDWARE */}
          {activeTab === 'specs' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    Host Hardware Ground Truth
                  </h3>
                  <p className="text-xs text-zinc-400">Zero-hallucination PC hardware specifications read directly from kernel and DMI sysfs.</p>
                </div>
                <button
                  onClick={fetchPcSpec}
                  className="px-3 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all border border-cyan-500/30"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh Spec
                </button>
              </div>

              {pcSpec ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Host Machine & OS */}
                  <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-2">
                    <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider">System & Operating System</div>
                    <div className="text-sm font-semibold text-zinc-100">{pcSpec.motherboard?.product_name || pcSpec.os?.hostname || 'Host PC'}</div>
                    <div className="text-xs text-zinc-400 space-y-1 font-mono">
                      <div>OS: <span className="text-zinc-200">{pcSpec.os?.distro} {pcSpec.os?.version}</span></div>
                      <div>Kernel: <span className="text-zinc-200">{pcSpec.os?.kernel_release} ({pcSpec.os?.architecture})</span></div>
                      <div>Uptime: <span className="text-zinc-200">{pcSpec.os?.uptime_human}</span></div>
                      <div>Host: <span className="text-zinc-200">{pcSpec.os?.hostname}</span></div>
                    </div>
                  </div>

                  {/* CPU Details */}
                  <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-2">
                    <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Processor (CPU)</div>
                    <div className="text-sm font-semibold text-zinc-100">{pcSpec.cpu?.model || 'CPU'}</div>
                    <div className="text-xs text-zinc-400 space-y-1 font-mono">
                      <div>Topology: <span className="text-zinc-200">{pcSpec.cpu?.physical_cores} Cores / {pcSpec.cpu?.logical_threads} Threads</span></div>
                      <div>Frequency: <span className="text-zinc-200">{pcSpec.cpu?.current_frequency_mhz} MHz (Max: {pcSpec.cpu?.max_frequency_mhz} MHz)</span></div>
                      <div>Virtualization: <span className="text-zinc-200">{pcSpec.cpu?.virtualization ? 'Enabled' : 'Disabled'}</span></div>
                    </div>
                  </div>

                  {/* GPU & Display */}
                  <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-2">
                    <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Graphics & Display</div>
                    <div className="text-sm font-semibold text-zinc-100">{pcSpec.gpu?.[0]?.device || 'Integrated Graphics'}</div>
                    <div className="text-xs text-zinc-400 space-y-1 font-mono">
                      <div>Vendor: <span className="text-zinc-200">{pcSpec.gpu?.[0]?.vendor || 'Standard VGA'}</span></div>
                      <div>Driver: <span className="text-zinc-200">{pcSpec.gpu?.[0]?.driver || 'Kernel DRM'}</span></div>
                      <div>Display: <span className="text-zinc-200">{pcSpec.gpu?.[0]?.display_resolution || '1920x1080'} ({pcSpec.gpu?.[0]?.connector || 'Default'})</span></div>
                    </div>
                  </div>

                  {/* Memory & Swap */}
                  <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-2">
                    <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider">RAM & Memory</div>
                    <div className="text-sm font-semibold text-zinc-100">{pcSpec.memory?.total_mb} MB Total</div>
                    <div className="text-xs text-zinc-400 space-y-1 font-mono">
                      <div>Used: <span className="text-indigo-300">{pcSpec.memory?.used_mb} MB ({pcSpec.memory?.usage_percent}%)</span></div>
                      <div>Available: <span className="text-emerald-400">{pcSpec.memory?.available_mb} MB</span></div>
                      <div>Swap Used: <span className="text-zinc-300">{pcSpec.memory?.swap?.used_mb || 0} MB / {pcSpec.memory?.swap?.total_mb || 0} MB</span></div>
                    </div>
                  </div>

                  {/* Storage Mounts */}
                  <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-2 col-span-1 md:col-span-2">
                    <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Storage Filesystems & Partitions</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 font-mono text-xs">
                      {(pcSpec.storage?.mounts || []).map((m: any, idx: number) => (
                        <div key={idx} className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
                          <div className="font-bold text-zinc-200 truncate">{m.mounted_on} ({m.filesystem})</div>
                          <div className="text-zinc-400 text-[11px]">{m.used_gb}G / {m.total_gb}G ({m.usage_percent}%)</div>
                          <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${Math.min(100, m.usage_percent)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-zinc-500 text-xs">Loading hardware specifications...</div>
              )}
            </div>
          )}

          {/* TAB: LOGS, PORTS & CLIPBOARD DIAGNOSTICS */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-6 animate-fade-in">
              {/* Log Viewer Section */}
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-zinc-100">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    System Logs Stream ({logSource})
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(['journalctl', 'dmesg', 'syslog', 'auth'] as const).map(src => (
                      <button
                        key={src}
                        onClick={() => { setLogSource(src); fetchLogs(src); }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono capitalize transition-all border ${
                          logSource === src
                            ? 'bg-cyan-500 text-zinc-950 font-bold border-cyan-500'
                            : 'bg-zinc-800 text-zinc-400 border-white/10 hover:text-white'
                        }`}
                      >
                        {src}
                      </button>
                    ))}
                    <button
                      onClick={() => fetchLogs(logSource)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white"
                      title="Refresh logs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-black border border-white/10 rounded-xl font-mono text-xs text-zinc-300 max-h-56 overflow-y-auto space-y-1">
                  {systemLogs.length > 0 ? (
                    systemLogs.map((line, idx) => (
                      <div key={idx} className="whitespace-pre-wrap leading-relaxed hover:bg-white/5 px-1 rounded text-[11px]">
                        <span className="text-zinc-600 mr-2 select-none">{idx + 1}</span>
                        <span className={line.toLowerCase().includes('err') || line.toLowerCase().includes('fail') ? 'text-rose-400 font-semibold' : (line.toLowerCase().includes('warn') ? 'text-amber-300' : 'text-zinc-300')}>
                          {line}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-zinc-600 italic">No log entries found for {logSource}.</div>
                  )}
                </div>
              </div>

              {/* Listening Ports & Sockets */}
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-zinc-100">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    Active Listening Ports & Sockets
                  </div>
                  <button
                    onClick={fetchNetworkConnections}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white"
                    title="Refresh ports"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="overflow-x-auto max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-zinc-800/80 text-zinc-400 sticky top-0">
                      <tr>
                        <th className="p-2">Proto</th>
                        <th className="p-2">Local Port / Address</th>
                        <th className="p-2">State</th>
                        <th className="p-2">Process</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-[11px]">
                      {networkConnections.map((c, idx) => (
                        <tr key={idx} className="hover:bg-white/5">
                          <td className="p-2 text-cyan-400 font-bold">{c.proto}</td>
                          <td className="p-2 text-zinc-200">{c.localAddr}</td>
                          <td className="p-2 text-emerald-400">{c.state}</td>
                          <td className="p-2 text-zinc-400 truncate max-w-xs">{c.process || 'system'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Clipboard Control */}
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-zinc-100">
                    <Clipboard className="w-4 h-4 text-indigo-400" />
                    System Clipboard Bridge
                  </div>
                  <button
                    onClick={fetchClipboard}
                    className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 text-xs font-semibold flex items-center gap-1 border border-indigo-500/30"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Read Clipboard
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter text to write directly to system clipboard..."
                    value={clipboardContent}
                    onChange={(e) => setClipboardContent(e.target.value)}
                    className="flex-1 px-3 py-2 bg-zinc-900 border border-white/10 rounded-xl text-xs font-mono text-zinc-200 focus:outline-none focus:border-cyan-500/50"
                  />
                  <button
                    onClick={() => handleWriteClipboard(clipboardContent)}
                    className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
                  >
                    Write
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TERMINAL & SHELL EXECUTION */}
          {activeTab === 'terminal' && (
            <div className="space-y-4 animate-fade-in">
              <form onSubmit={handleRunCommand} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Terminal className="w-4 h-4 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Enter bash shell command (e.g. free -h, df -h, ip addr, uptime)..."
                    value={commandInput}
                    onChange={(e) => setCommandInput(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-zinc-900 border border-white/10 rounded-xl text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
                >
                  Execute
                </button>
              </form>

              {/* Output Display */}
              <div className="p-4 rounded-2xl bg-black border border-white/15 font-mono text-xs text-zinc-200 min-h-[300px] overflow-auto">
                <div className="text-zinc-500 text-[11px] mb-2 border-b border-white/10 pb-1 flex items-center justify-between">
                  <span>Terminal Execution Console</span>
                  {commandOutput && (
                    <span className={`text-[10px] ${commandOutput.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                      Exit Code: {commandOutput.exitCode ?? (commandOutput.success ? 0 : 1)} ({commandOutput.durationMs || 10}ms)
                    </span>
                  )}
                </div>
                {commandOutput ? (
                  <div>
                    {commandOutput.stdout && (
                      <pre className="text-emerald-300 whitespace-pre-wrap font-mono">{commandOutput.stdout}</pre>
                    )}
                    {commandOutput.stderr && (
                      <pre className="text-rose-400 whitespace-pre-wrap font-mono mt-2">{commandOutput.stderr}</pre>
                    )}
                  </div>
                ) : (
                  <div className="text-zinc-600 italic">
                    Type any system shell command above to execute with full output capture.
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
