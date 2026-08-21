import { useJarvis } from "./JarvisProvider";
import { cn } from "@/lib/utils";

export function OrbStage() {
  const { thinking, connectionState, inputVolume, outputVolume, liveSubtitle } = useJarvis();

  const isSpeaking = connectionState === "speaking";
  const isListening = connectionState === "listening";
  const isConnecting = connectionState === "connecting";
  const isConnected = connectionState !== "disconnected" && connectionState !== "error";
  const active = thinking || isSpeaking || isListening || isConnecting;

  return (
    <div className="bezel relative flex min-h-[380px] flex-1 items-center justify-center overflow-hidden rounded-2xl p-2 bg-[#02060d] border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.15)]">
      {/* Latency-Aware Instant Voice Subtitle Pill */}
      {liveSubtitle && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 max-w-[90%] rounded-full border border-cyan-500/40 bg-black/80 px-4 py-1.5 backdrop-blur-md text-xs text-cyan-300 font-medium tracking-wide shadow-[0_0_20px_rgba(6,182,212,0.35)] animate-fade-in flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="truncate">{liveSubtitle}</span>
        </div>
      )}

      {/* Sovereign Electric Blue Radial Orbit Canvas */}
      <div className="relative h-full min-h-[340px] w-full flex items-center justify-center overflow-hidden rounded-xl">
        <iframe
          src="/visualizer/faces/radial/index.html"
          title="JARVIS Radial Orbit Visualizer"
          className="h-full w-full border-0 pointer-events-auto"
        />
      </div>

      {/* System Status Banner */}
      <div
        className={cn(
          "neu absolute bottom-4 flex items-center gap-2.5 rounded-full px-4 py-1.5 transition-all duration-300 z-20",
          isConnecting
            ? "border border-amber-500/40 bg-amber-950/40 shadow-[0_0_16px_var(--amber-hud)]"
            : isConnected
            ? "border border-cyan-500/40 bg-black/75 shadow-[0_0_12px_rgba(6,182,212,0.25)]"
            : "border border-white/10 bg-black/50"
        )}
      >
        <span className="flex h-4 items-end gap-[3px]">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => {
            const hScale = isSpeaking
              ? Math.min(1, 0.3 + outputVolume * (1 + (i % 3) * 0.3))
              : isListening
              ? Math.min(1, 0.3 + inputVolume * (1 + (i % 3) * 0.3))
              : active
              ? 0.7
              : 0.22;
            return (
              <i
                key={i}
                className={cn(
                  "w-[3px] rounded-full transition-all duration-75",
                  isConnecting
                    ? "bg-amber-hud shadow-[0_0_6px_var(--amber-hud)]"
                    : "bg-cyan-hud shadow-[0_0_6px_var(--cyan-hud)]"
                )}
                style={{
                  height: "100%",
                  transform: `scaleY(${isConnecting ? 0.3 + ((i * 2) % 5) * 0.15 : hScale})`,
                  transformOrigin: "bottom",
                  opacity: active || isConnected || isConnecting ? 1 : 0.4,
                }}
              />
            );
          })}
        </span>
        <span
          className={cn(
            "text-[11px] font-bold uppercase tracking-[0.22em]",
            isConnecting ? "text-amber-hud animate-pulse" : "text-cyan-300"
          )}
        >
          {isConnecting
            ? "Connecting to JARVIS…"
            : thinking
            ? "Processing Directive…"
            : isSpeaking
            ? "JARVIS Speaking"
            : isListening
            ? "Listening…"
            : isConnected
            ? "Radial Core Online"
            : "Standing By"}
        </span>
      </div>
    </div>
  );
}
