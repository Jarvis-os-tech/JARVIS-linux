import { Mic, MicOff, Camera, Monitor, Square, Play, Sparkles, Volume2, Shield, Loader2 } from "lucide-react";
import { Conversation } from "../Conversation";
import { OrbStage } from "../OrbStage";
import { useJarvis, useStats } from "../JarvisProvider";
import { PERSONAS } from "@/data/personas";
import { cn } from "@/lib/utils";

export function DashboardView() {
  const {
    cpu,
    ram,
    net,
    selectedPersona,
    handleSwapPersona,
    connectionState,
    isMuted,
    setIsMuted,
    handleStartSession,
    handleStopSession,
    handleInterrupt,
    isVisionActive,
    visionMode,
    visionStream,
    isLiveStreaming,
    setIsLiveStreaming,
    startVision,
    stopVision,
    toggleVision,
    handleCaptureAndSend,
    handleLiveStreamFrame,
  } = useJarvis();
  const stats = useStats();

  const isConnecting = connectionState === "connecting";
  const isConnected = connectionState !== "disconnected" && connectionState !== "error";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Header & Metric summary */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display etched text-2xl font-bold tracking-wide">
              Good to see you, <span className="text-aurora">Gopi</span>
            </h1>
            <span
              className="neu-inset px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border transition-all duration-300"
              style={{
                color: selectedPersona.accentColor,
                borderColor: `color-mix(in oklab, ${selectedPersona.accentColor} 35%, transparent)`,
                boxShadow: `0 0 10px color-mix(in oklab, ${selectedPersona.accentColor} 15%, transparent)`,
              }}
            >
              {selectedPersona.name} Active
            </span>
            {isConnecting && (
              <span className="neu-inset px-2.5 py-0.5 rounded-full text-[10.5px] font-bold text-amber-hud border border-amber-500/40 bg-amber-500/10 flex items-center gap-1.5 animate-pulse shadow-[0_0_8px_var(--amber-hud)]">
                <Loader2 className="w-3 h-3 animate-spin" /> Connecting Live Voice…
              </span>
            )}
            {isConnected && !isConnecting && (
              <span className="neu-inset px-2.5 py-0.5 rounded-full text-[10.5px] font-bold text-emerald-hud border border-emerald-500/40 bg-emerald-500/10 flex items-center gap-1.5 shadow-[0_0_8px_var(--emerald-hud)]">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" /> Live Connected
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Swarm active — {stats.running} agents online · {stats.active} missions in flight.
          </p>
        </div>

        <div className="hidden gap-2 sm:flex">
          {[
            { l: "AGENTS", v: stats.running, c: "text-emerald-hud" },
            { l: "MISSIONS", v: stats.active, c: "text-cyan-hud" },
            { l: "CPU", v: `${cpu}%`, c: "text-violet-hud" },
            { l: "RAM", v: `${ram}%`, c: "text-amber-hud" },
            { l: "NET", v: `${Math.round(net)} KB/s`, c: "text-cyan-hud" },
          ].map((s) => (
            <div key={s.l} className="neu-inset rounded-xl px-3.5 py-2 text-center">
              <p className={`font-mono text-sm font-extrabold ${s.c}`}>{s.v}</p>
              <p className="text-[9px] tracking-[0.16em] text-muted-foreground">{s.l}</p>
            </div>
          ))}
        </div>
      </header>

      {/* Voice & Vision Command Bar */}
      <div className="bezel flex flex-wrap items-center justify-between gap-2.5 rounded-2xl px-4 py-2.5">
        {/* Persona quick switch chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {PERSONAS.map((p) => {
            const active = selectedPersona.id === p.id;
            const icon =
              p.id === "jarvis" ? "◎" :
              p.id === "friday" ? "🌐" :
              p.id === "ultron" ? "💀" :
              p.id === "edith" ? "🕶" :
              p.id === "karen" ? "⚡" : "🧠";
            return (
              <button
                key={p.id}
                onClick={() => handleSwapPersona(p.id)}
                style={
                  active
                    ? {
                        color: p.accentColor,
                        borderColor: `color-mix(in oklab, ${p.accentColor} 45%, transparent)`,
                        boxShadow: `0 0 12px color-mix(in oklab, ${p.accentColor} 20%, transparent)`,
                      }
                    : undefined
                }
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  active
                    ? "neu-inset border"
                    : "key text-muted-foreground hover:text-foreground",
                )}
              >
                <span>{icon}</span>
                <span>{p.name}</span>
              </button>
            );
          })}
        </div>

        {/* Live Controls */}
        <div className="flex items-center gap-2">
          {/* Mute button */}
          {isConnected && (
            <button
              onClick={() => setIsMuted(!isMuted)}
              title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
              className={cn(
                "key flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                isMuted ? "text-rose-400 border border-rose-500/40" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5 text-rose-400" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{isMuted ? "Muted" : "Mute"}</span>
            </button>
          )}

          {/* Interrupt */}
          {connectionState === "speaking" && (
            <button
              onClick={handleInterrupt}
              title="Interrupt AI speech"
              className="key flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-hud border border-amber-500/40 cursor-pointer animate-pulse"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Interrupt</span>
            </button>
          )}

          {/* Camera Vision */}
          <button
            onClick={() => toggleVision("camera")}
            title="Toggle Camera Vision"
            className={cn(
              "key flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
              isVisionActive && visionMode === "camera"
                ? "neu-inset text-cyan-hud border border-cyan-400/40"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Camera className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Camera</span>
          </button>

          {/* Screen Share */}
          <button
            onClick={() => toggleVision("screen")}
            title="Toggle Screen Share Vision"
            className={cn(
              "key flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
              isVisionActive && visionMode === "screen"
                ? "neu-inset text-cyan-hud border border-cyan-400/40"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Monitor className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Screen</span>
          </button>

          {/* Main Connect / Disconnect */}
          <button
            onClick={isConnected ? handleStopSession : handleStartSession}
            disabled={isConnecting}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
              isConnecting
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg shadow-amber-500/20 animate-pulse cursor-wait"
                : isConnected
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30"
                : "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-600/25 hover:from-cyan-500 hover:to-blue-500",
            )}
          >
            {isConnecting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
            ) : isConnected ? (
              <Square className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            <span>
              {isConnecting
                ? "Connecting…"
                : isConnected
                ? "Disconnect"
                : "Connect Voice"}
            </span>
          </button>
        </div>
      </div>

      {/* Main holographic orb & command console */}
      <OrbStage />
      <Conversation />
    </div>
  );
}
