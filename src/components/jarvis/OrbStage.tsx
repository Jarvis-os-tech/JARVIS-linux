import { useJarvis, useStats } from "./JarvisProvider";
import { cn } from "@/lib/utils";

const TICKS = Array.from({ length: 60 }, (_, i) => {
  const a = (i / 60) * Math.PI * 2;
  const r1 = 172;
  const r2 = i % 5 === 0 ? 158 : 165;
  return {
    x1: +(Math.cos(a) * r1).toFixed(2),
    y1: +(Math.sin(a) * r1).toFixed(2),
    x2: +(Math.cos(a) * r2).toFixed(2),
    y2: +(Math.sin(a) * r2).toFixed(2),
    w: i % 5 === 0 ? 2 : 1,
  };
});

function loadHue(load: number) {
  if (load < 40) return "var(--cyan-hud)";
  if (load < 65) return "var(--violet-hud)";
  if (load < 85) return "var(--amber-hud)";
  return "var(--rose-hud)";
}

export function OrbStage() {
  const { thinking, cpu, ram, net, connectionState, inputVolume, outputVolume, selectedPersona } = useJarvis();
  const stats = useStats();

  const isSpeaking = connectionState === "speaking";
  const isListening = connectionState === "listening";
  const isConnecting = connectionState === "connecting";
  const isConnected = connectionState !== "disconnected" && connectionState !== "error";
  const active = thinking || isSpeaking || isListening || isConnecting || stats.active > 0;
  const personaAccent = selectedPersona?.accentColor || "var(--cyan-hud)";
  const loadColor = isConnecting
    ? "var(--amber-hud)"
    : isSpeaking
    ? personaAccent
    : isListening
    ? "var(--emerald-hud)"
    : personaAccent;

  // Dynamic pulse scale based on audio volume
  const voiceScale = isConnecting ? 1.08 : isSpeaking ? 1 + outputVolume * 0.4 : isListening ? 1 + inputVolume * 0.4 : 1;

  return (
    <div className="bezel relative grid min-h-0 flex-1 place-items-center overflow-hidden rounded-2xl p-3">
      <div className="brushed pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -left-1/4 top-0 h-full w-1/3 -skew-x-12 animate-sweep bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--cyan-hud)_12%,transparent),transparent)]" />

      <svg viewBox="0 0 760 520" className="relative h-full max-h-[24rem] w-full">
        <defs>
          <radialGradient id="domeGrad" cx="50%" cy="34%">
            <stop offset="0%" stopColor="oklch(1 0 0)" stopOpacity="0.16" />
            <stop offset="55%" stopColor={isConnecting ? "var(--amber-hud)" : "var(--cyan-hud)"} stopOpacity="0.08" />
            <stop offset="100%" stopColor="oklch(0.1 0 0)" stopOpacity="0.35" />
          </radialGradient>
          <radialGradient id="coreGrad" cx="50%" cy="50%">
            <stop offset="0%" stopColor={loadColor} stopOpacity={isConnecting ? 0.65 : 0.5} />
            <stop offset="62%" stopColor={isConnecting ? "var(--amber-hud)" : "var(--blue-hud)"} stopOpacity="0.15" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="ringMetal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.72 0.01 250)" stopOpacity="0.75" />
            <stop offset="48%" stopColor="oklch(0.35 0.01 250)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="oklch(0.85 0.01 250)" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id="rainbow" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--cyan-hud)" />
            <stop offset="33%" stopColor="var(--violet-hud)" />
            <stop offset="66%" stopColor="var(--pink-hud)" />
            <stop offset="100%" stopColor="var(--amber-hud)" />
          </linearGradient>
          <filter id="soft">
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>

        {/* machined outer ring */}
        <circle cx="380" cy="256" r="196" fill="none" stroke="url(#ringMetal)" strokeWidth="12" />
        <circle cx="380" cy="256" r="204" fill="none" stroke="oklch(0 0 0 / 45%)" strokeWidth="2" />
        <circle cx="380" cy="256" r="187" fill="none" stroke="oklch(1 0 0 / 10%)" strokeWidth="1" />

        {/* tick marks */}
        <g stroke={isConnecting ? "var(--amber-hud)" : "var(--cyan-hud)"} strokeOpacity={isConnecting ? 0.7 : 0.45}>
          {TICKS.map((t, i) => (
            <line
              key={i}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              strokeWidth={t.w}
            />
          ))}
        </g>

        {/* Rotating connecting radar ring */}
        <g style={{ transformOrigin: "380px 256px" }} className={isConnecting ? "animate-spin" : "animate-spin-slow"}>
          <circle
            cx="380"
            cy="256"
            r="148"
            fill="none"
            stroke={isConnecting ? "var(--amber-hud)" : "var(--cyan-hud)"}
            strokeOpacity={isConnecting ? "0.75" : "0.3"}
            strokeWidth={isConnecting ? "2.5" : "1.5"}
            strokeDasharray={isConnecting ? "18 18" : "3 12"}
          />
        </g>
        <g style={{ transformOrigin: "380px 256px" }} className="animate-spin-slower">
          <circle
            cx="380"
            cy="256"
            r="132"
            fill="none"
            stroke={isConnecting ? "var(--amber-hud)" : "var(--violet-hud)"}
            strokeOpacity="0.28"
            strokeWidth="1.2"
            strokeDasharray="46 220"
          />
        </g>

        {/* rainbow orbit */}
        <g style={{ transformOrigin: "380px 256px" }} className="animate-spin-slower">
          <circle
            cx="380"
            cy="256"
            r="176"
            fill="none"
            stroke="url(#rainbow)"
            strokeOpacity="0.4"
            strokeWidth="1.4"
            strokeDasharray="2 26"
          />
        </g>

        {/* glass dome + core */}
        <circle
          cx="380"
          cy="256"
          r={150 * voiceScale}
          fill="url(#coreGrad)"
          filter="url(#soft)"
          className={cn("transition-all duration-150", isConnecting ? "animate-pulse" : "animate-core-pulse")}
        />
        <circle cx="380" cy="256" r="120" fill="url(#domeGrad)" stroke="oklch(1 0 0 / 14%)" strokeWidth="1.5" />
        <ellipse cx="345" cy="196" rx="52" ry="26" fill="oklch(1 0 0 / 9%)" transform="rotate(-24 345 196)" />

        {/* Ambient Holographic Ring */}
        <circle
          cx="380"
          cy="256"
          r="120"
          fill="none"
          stroke={loadColor}
          strokeWidth="2.5"
          strokeDasharray={isConnecting ? "60 120" : "120 40 40 40"}
          transform="rotate(-90 380 256)"
          className={isConnecting ? "animate-spin" : "animate-spin-slow"}
          style={{
            transformOrigin: "380px 256px",
            filter: `drop-shadow(0 0 10px ${loadColor})`,
            transition: "stroke 0.6s ease",
          }}
        />

        {/* Inner Subtle Ring */}
        <circle
          cx="380"
          cy="256"
          r="104"
          fill="none"
          stroke={isConnecting ? "var(--amber-hud)" : "var(--violet-hud)"}
          strokeWidth="1.5"
          strokeDasharray={isConnecting ? "180 180" : "40 160"}
          transform="rotate(45 380 256)"
          className="animate-spin-slower"
          style={{ transformOrigin: "380px 256px" }}
          strokeOpacity="0.6"
        />

        {/* Central Display: Connecting vs Core Identity */}
        {isConnecting ? (
          <g>
            <text
              x="380"
              y="238"
              textAnchor="middle"
              fill="var(--amber-hud)"
              fontSize="22"
              fontWeight="800"
              letterSpacing="4"
              fontFamily="var(--font-display)"
              className="animate-pulse"
            >
              CONNECTING
            </text>
            <text
              x="380"
              y="266"
              textAnchor="middle"
              fill="var(--foreground)"
              fontSize="12"
              letterSpacing="4"
              fontFamily="var(--font-mono)"
            >
              {selectedPersona?.name ? `INITIALIZING ${selectedPersona.name}` : "INITIALIZING STREAM"}
            </text>
            <text
              x="380"
              y="312"
              textAnchor="middle"
              fill="var(--amber-hud)"
              fontSize="10"
              letterSpacing="3"
              fontFamily="var(--font-mono)"
            >
              16KHZ WEBSOCKET · LIVE API LINK
            </text>
          </g>
        ) : (
          <g>
            <text
              x="380"
              y="244"
              textAnchor="middle"
              fill="var(--foreground)"
              fontSize="34"
              fontWeight="800"
              letterSpacing="6"
              fontFamily="var(--font-display)"
              style={{
                filter: `drop-shadow(0 0 12px ${loadColor})`,
              }}
            >
              {selectedPersona?.name ? selectedPersona.name.toUpperCase() : "JARVIS"}
            </text>
            <text
              x="380"
              y="272"
              textAnchor="middle"
              fill="var(--muted-foreground)"
              fontSize="11"
              letterSpacing="4"
              fontFamily="var(--font-mono)"
            >
              {connectionState === "speaking"
                ? "SPEAKING"
                : connectionState === "listening"
                ? "LISTENING"
                : "VOICE READY"}
            </text>
            <text
              x="380"
              y="312"
              textAnchor="middle"
              fill={loadColor}
              fontSize="10"
              letterSpacing="3"
              fontFamily="var(--font-mono)"
            >
              {selectedPersona?.voiceName ? `VOICE: ${selectedPersona.voiceName.toUpperCase()}` : "NEURAL DUPLEX"}
            </text>
          </g>
        )}
      </svg>

      <div
        className={cn(
          "neu-inset absolute bottom-3 flex items-center gap-3 rounded-full px-4 py-2 transition-all duration-300",
          isConnecting && "border border-amber-500/50 shadow-[0_0_14px_var(--amber-hud)] bg-amber-500/10"
        )}
      >
        {isConnecting && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
          </span>
        )}
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
                  animation: isConnecting ? `core-pulse 0.7s ease-in-out ${i * 0.08}s infinite alternate` : undefined,
                }}
              />
            );
          })}
        </span>
        <span
          className={cn(
            "text-[11px] font-bold uppercase tracking-[0.22em]",
            isConnecting ? "text-amber-hud animate-pulse" : "text-muted-foreground"
          )}
        >
          {isConnecting
            ? `Connecting to ${selectedPersona.name}…`
            : thinking
            ? "Processing Directive…"
            : isSpeaking
            ? `${selectedPersona.name} Speaking`
            : isListening
            ? "Listening…"
            : isConnected
            ? "Voice Online"
            : "Standing By"}
        </span>
      </div>
    </div>
  );
}

