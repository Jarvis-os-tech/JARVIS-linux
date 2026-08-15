import { useJarvis, useStats } from "./JarvisProvider";

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
  const isConnected = connectionState !== "disconnected" && connectionState !== "error";
  const active = thinking || isSpeaking || isListening || stats.active > 0;
  const loadColor = isSpeaking ? "var(--violet-hud)" : isListening ? "var(--rose-hud)" : loadHue(cpu);

  // Dynamic pulse scale based on audio volume
  const voiceScale = isSpeaking ? 1 + outputVolume * 0.4 : isListening ? 1 + inputVolume * 0.4 : 1;

  return (
    <div className="bezel relative grid min-h-0 flex-1 place-items-center overflow-hidden rounded-2xl p-3">
      <div className="brushed pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -left-1/4 top-0 h-full w-1/3 -skew-x-12 animate-sweep bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--cyan-hud)_12%,transparent),transparent)]" />

      <svg viewBox="0 0 760 520" className="relative h-full max-h-[24rem] w-full">
        <defs>
          <radialGradient id="domeGrad" cx="50%" cy="34%">
            <stop offset="0%" stopColor="oklch(1 0 0)" stopOpacity="0.16" />
            <stop offset="55%" stopColor="var(--cyan-hud)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="oklch(0.1 0 0)" stopOpacity="0.35" />
          </radialGradient>
          <radialGradient id="coreGrad" cx="50%" cy="50%">
            <stop offset="0%" stopColor={loadColor} stopOpacity="0.5" />
            <stop offset="62%" stopColor="var(--blue-hud)" stopOpacity="0.12" />
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
        <g stroke="var(--cyan-hud)" strokeOpacity="0.45">
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

        <g style={{ transformOrigin: "380px 256px" }} className="animate-spin-slow">
          <circle
            cx="380"
            cy="256"
            r="148"
            fill="none"
            stroke="var(--cyan-hud)"
            strokeOpacity="0.3"
            strokeWidth="1.5"
            strokeDasharray="3 12"
          />
        </g>
        <g style={{ transformOrigin: "380px 256px" }} className="animate-spin-slower">
          <circle
            cx="380"
            cy="256"
            r="132"
            fill="none"
            stroke="var(--violet-hud)"
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
          className="animate-core-pulse transition-all duration-150"
        />
        <circle cx="380" cy="256" r="120" fill="url(#domeGrad)" stroke="oklch(1 0 0 / 14%)" strokeWidth="1.5" />
        <ellipse cx="345" cy="196" rx="52" ry="26" fill="oklch(1 0 0 / 9%)" transform="rotate(-24 345 196)" />

        {/* CPU load arc */}
        <circle
          cx="380"
          cy="256"
          r="120"
          fill="none"
          stroke={loadColor}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${(cpu / 100) * 754} 900`}
          transform="rotate(-90 380 256)"
          style={{ filter: `drop-shadow(0 0 8px ${loadColor})`, transition: "stroke 0.6s ease" }}
        />

        {/* RAM load arc */}
        <circle
          cx="380"
          cy="256"
          r="104"
          fill="none"
          stroke="var(--violet-hud)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${(ram / 100) * 653} 900`}
          transform="rotate(-90 380 256)"
          strokeOpacity="0.75"
        />

        <text
          x="380"
          y="240"
          textAnchor="middle"
          fill="var(--foreground)"
          fontSize="44"
          fontWeight="700"
          fontFamily="var(--font-mono)"
        >
          {cpu}%
        </text>
        <text
          x="380"
          y="266"
          textAnchor="middle"
          fill="var(--muted-foreground)"
          fontSize="12"
          letterSpacing="5"
          fontFamily="var(--font-display)"
        >
          {selectedPersona?.name ? selectedPersona.name.toUpperCase() : "JARVIS CORE"}
        </text>
        <text
          x="380"
          y="312"
          textAnchor="middle"
          fill={loadColor}
          fontSize="11"
          letterSpacing="3"
          fontFamily="var(--font-mono)"
        >
          {Math.round(net)} KB/S · {stats.running} AGENTS
        </text>
      </svg>

      <div className="neu-inset absolute bottom-3 flex items-center gap-3 rounded-full px-4 py-2">
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
                className="w-[3px] rounded-full bg-cyan-hud shadow-[0_0_6px_var(--cyan-hud)] transition-all duration-75"
                style={{
                  height: "100%",
                  transform: `scaleY(${hScale})`,
                  transformOrigin: "bottom",
                  opacity: active || isConnected ? 1 : 0.4,
                }}
              />
            );
          })}
        </span>
        <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
          {thinking
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
