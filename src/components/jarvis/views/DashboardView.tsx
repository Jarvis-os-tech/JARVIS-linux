import { Mic, MicOff, Camera, Monitor, Square, Play, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { Conversation } from "../Conversation";
import { OrbStage } from "../OrbStage";
import { SwarmTelemetryBar } from "../SwarmTelemetryBar";
import { useJarvis } from "../JarvisProvider";
import { cn } from "@/lib/utils";

export function DashboardView() {
  const {
    connectionState,
    isMuted,
    setIsMuted,
    errorMsg,
    micPermissionState,
    requestMicPermission,
    handleStartSession,
    handleStopSession,
    handleInterrupt,
    isVisionActive,
    visionMode,
    toggleVision,
  } = useJarvis();

  const isConnecting = connectionState === "connecting";
  const isConnected = connectionState !== "disconnected" && connectionState !== "error";

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
      {/* Top Tactical Command Bar */}
      <div className="bezel flex flex-wrap items-center justify-between gap-2.5 rounded-2xl px-4 py-2.5 bg-black/40 border border-cyan-500/20 backdrop-blur-md">
        {/* Left: Sovereign Status Badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 neu-inset rounded-xl border border-cyan-500/40 text-xs shadow-[0_0_12px_rgba(6,182,212,0.2)] bg-cyan-950/20">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-cyan-hud font-bold tracking-wider">J.A.R.V.I.S. MK-VII</span>
            <span className="text-cyan-300/70 text-[11px]">· Sovereign Operating Partner</span>
          </div>

          {isConnecting && (
            <span className="neu-inset px-2.5 py-1 rounded-xl text-[11px] font-bold text-amber-hud border border-amber-500/40 bg-amber-500/10 flex items-center gap-1.5 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" /> Calibrating DSP…
            </span>
          )}
          {isConnected && !isConnecting && (
            <span className="neu-inset px-2.5 py-1 rounded-xl text-[11px] font-bold text-emerald-hud border border-emerald-500/40 bg-emerald-500/10 flex items-center gap-1.5 shadow-[0_0_10px_var(--emerald-hud)]">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" /> Live Core Online
            </span>
          )}
        </div>

        {/* Right: Live Interactive Actuation Controls */}
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

          {/* Interrupt Button */}
          {connectionState === "speaking" && (
            <button
              onClick={handleInterrupt}
              title="Interrupt speech"
              className="key flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-hud border border-amber-500/40 cursor-pointer animate-pulse"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Interrupt</span>
            </button>
          )}

          {/* Camera Vision */}
          <button
            onClick={() => toggleVision("camera")}
            title="Toggle Camera Vision Feed"
            className={cn(
              "key flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
              isVisionActive && visionMode === "camera"
                ? "neu-inset text-cyan-hud border border-cyan-400/40 bg-cyan-950/30 shadow-[0_0_10px_rgba(6,182,212,0.25)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Camera className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Camera</span>
          </button>

          {/* Screen Share */}
          <button
            onClick={() => toggleVision("screen")}
            title="Toggle Screen Share Stream"
            className={cn(
              "key flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
              isVisionActive && visionMode === "screen"
                ? "neu-inset text-cyan-hud border border-cyan-400/40 bg-cyan-950/30 shadow-[0_0_10px_rgba(6,182,212,0.25)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Monitor className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Screen</span>
          </button>

          {/* Main Voice Activation Toggle */}
          <button
            onClick={isConnected ? handleStopSession : handleStartSession}
            disabled={isConnecting}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
              isConnecting
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg shadow-amber-500/20 animate-pulse cursor-wait"
                : isConnected
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30"
                : "bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600 text-white shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:brightness-110",
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
                : "Activate JARVIS"}
            </span>
          </button>
        </div>
      </div>

      {/* Microphone Permission Warning */}
      {(micPermissionState === "denied" || (errorMsg && errorMsg.toLowerCase().includes("micro"))) && (
        <div className="neu-inset p-3.5 rounded-2xl border border-rose-500/40 bg-rose-950/20 text-rose-200 flex items-center justify-between gap-3 text-xs shadow-lg shadow-rose-950/40">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <span className="font-bold text-rose-300 block">Microphone Access Needed</span>
              <span className="text-[11px] text-rose-200/80">
                Click allow in your browser address bar to enable voice interaction.
              </span>
            </div>
          </div>
          <button
            onClick={requestMicPermission}
            className="neu flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-all shrink-0 cursor-pointer shadow-md"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Enable Mic</span>
          </button>
        </div>
      )}

      {/* Multi-Agent Swarm Telemetry Bar */}
      <SwarmTelemetryBar />

      {/* Main Electric Blue Radial Orbit Visualizer Frame */}
      <OrbStage />

      {/* Real-time Conversational Feed */}
      <div className="max-h-[220px] min-h-[140px] flex flex-col">
        <Conversation />
      </div>
    </div>
  );
}
