import { useState } from "react";
import { CheckCircle2, ShieldCheck, Sparkles, RefreshCw, Cpu, Activity, Mic, Radio, Volume2 } from "lucide-react";
import { useJarvis } from "../JarvisProvider";
import { Toggle } from "../Toggle";
import { ThemeToggle } from "../ThemeToggle";
import { toast } from "sonner";

export function SettingsView() {
  const {
    autonomy,
    setAutonomy,
    density,
    setDensity,
    telemetryOn,
    setTelemetryOn,
    autoDispatch,
    setAutoDispatch,
    confirmDestructive,
    setConfirmDestructive,
    micSensitivity,
    setMicSensitivity,
    inputVolume,
    webrtcConnected,
    pushLog,
    pushNotification,
    latencyMs,
  } = useJarvis();

  const [diagnosticRunning, setDiagnosticRunning] = useState(false);
  const [diagResults, setDiagResults] = useState<{
    score: number;
    overallStatus: string;
    passedCount: number;
    totalChecks: number;
    durationMs: number;
    time: string;
    summary: string;
    items?: Array<{ id: string; name: string; status: string; details: string }>;
  } | null>(null);

  const runSweep = async () => {
    setDiagnosticRunning(true);
    pushLog("Initiating Iron Man Mark Suite full pre-flight diagnostic sweep…");

    try {
      const sweep = await fetch("/api/diagnostics/full-sweep").then((r) => r.json());

      setDiagResults({
        score: sweep.healthScorePercent ?? 100,
        overallStatus: sweep.overallStatus === "all_systems_nominal" ? "100% NOMINAL" : "DEGRADED",
        passedCount: sweep.passedCount ?? 0,
        totalChecks: sweep.totalChecks ?? 0,
        durationMs: sweep.durationMs ?? 0,
        time: new Date().toLocaleTimeString(),
        summary: sweep.verbalSummaryEn || "All subsystems verified operational.",
        items: sweep.items || []
      });

      pushLog(`Suit Diagnostic Sweep complete: ${sweep.passedCount}/${sweep.totalChecks} subsystems passed in ${sweep.durationMs}ms.`);
      pushNotification("✔", `Suit Diagnostic: ${sweep.healthScorePercent}% Nominal`);
      toast.success(`Pre-Flight Diagnostic: ${sweep.healthScorePercent}% Operational (${sweep.passedCount}/${sweep.totalChecks} Checks Passed)`);
    } catch {
      toast.error("Diagnostic sweep failed");
    } finally {
      setDiagnosticRunning(false);
    }
  };

  const getSensitivityLabel = (level: number) => {
    if (level <= 3) return "Low Sensitivity / High Noise Rejection";
    if (level <= 7) return "Balanced Studio Gain (Default)";
    return "High Sensitivity / Whisper Mode";
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <h1 className="font-display etched text-2xl font-bold tracking-wide">System Preferences</h1>
          <span className="neu-inset px-2.5 py-0.5 rounded-full text-[10.5px] font-bold text-cyan-hud border border-cyan-500/20">
            MK-VII Core Config
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Audio DSP calibration, WebRTC/WebSocket dual transport, autonomy thresholds, and hardware security gates.
        </p>
      </header>

      <div className="grid min-h-0 flex-1 auto-rows-min gap-4 overflow-y-auto pb-4 pr-1 md:grid-cols-2">
        {/* Audio DSP & Mic Sensitivity Calibration */}
        <section className="neu gloss rounded-2xl p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-[13.5px] font-bold flex items-center gap-2">
              <Mic className="w-4 h-4 text-cyan-hud" />
              Microphone &amp; Audio DSP Calibration
            </h3>
            <span className="neu-inset px-2 py-0.5 rounded-md font-mono text-[11px] font-bold text-cyan-hud border border-cyan-500/20">
              Level {micSensitivity} / 10
            </span>
          </div>
          <p className="text-[11.5px] text-muted-foreground">
            Calibrate hardware gain and voice activation threshold. Higher values capture softer whispers; lower values reject background noise.
          </p>

          <div>
            <div className="flex items-center justify-between text-[11px] font-bold mb-1">
              <span className="text-muted-foreground">{getSensitivityLabel(micSensitivity)}</span>
              <span className="font-mono text-cyan-hud">{(micSensitivity * 10)}% Gain</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={micSensitivity}
              onChange={(e) => setMicSensitivity(+e.target.value)}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Live Mic Level Bar Indicator */}
          <div className="p-2.5 neu-inset rounded-xl space-y-1.5">
            <div className="flex items-center justify-between text-[10.5px] font-mono text-muted-foreground">
              <span>Live Mic Signal</span>
              <span className={inputVolume > 15 ? "text-emerald-hud font-bold" : "text-muted-foreground"}>
                {Math.round(inputVolume)}%
              </span>
            </div>
            <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden p-0.5">
              <div
                className="h-full rounded-full transition-all duration-75 bg-gradient-to-r from-cyan-500 via-emerald-400 to-violet-500"
                style={{ width: `${Math.min(100, inputVolume * 1.4)}%` }}
              />
            </div>
          </div>
        </section>

        {/* Dual-Transport Realtime Protocol */}
        <section className="neu gloss rounded-2xl p-4 space-y-3">
          <h3 className="text-[13.5px] font-bold flex items-center gap-2">
            <Radio className="w-4 h-4 text-violet-hud" />
            Dual-Transport Pipeline
          </h3>
          <p className="text-[11.5px] text-muted-foreground">
            Hybrid WebSocket control plane paired with ultra-low latency WebRTC UDP DataChannel for sub-10ms voice response.
          </p>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 neu-inset rounded-xl">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold">WebSocket (/live)</span>
              </div>
              <span className="font-mono text-[11px] text-emerald-hud font-bold">Active &amp; Linked</span>
            </div>

            <div className="flex items-center justify-between p-2 neu-inset rounded-xl">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${webrtcConnected ? "bg-emerald-400" : "bg-cyan-400"}`} />
                <span className="font-bold">WebRTC UDP DataChannel</span>
              </div>
              <span className="font-mono text-[11px] text-cyan-hud font-bold">
                {webrtcConnected ? "UDP Sub-10ms Linked" : "Standby / Ready"}
              </span>
            </div>
          </div>
        </section>

        {/* Chassis finish */}
        <section className="neu gloss rounded-2xl p-4">
          <h3 className="text-[13.5px] font-bold">Chassis Finish &amp; Lighting</h3>
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            Switch between Graphite dark anodized aluminium and Bright aluminium HUD themes.
          </p>
          <div className="mt-3.5">
            <ThemeToggle />
          </div>
        </section>

        {/* Suit Pre-Flight Diagnostic Sweep */}
        <section className="neu gloss rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-[13.5px] font-bold flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Suit Pre-Flight Diagnostic Sweep
              </h3>
              {diagResults && (
                <span className="neu-inset px-2 py-0.5 rounded-md font-mono text-[10.5px] font-bold text-emerald-400 border border-emerald-500/20">
                  {diagResults.score}% HEALTH
                </span>
              )}
            </div>
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              Deep Iron Man-grade verification of C++ actuators, SQLite memory, 5-agent persona mesh, and 1,500+ skills.
            </p>
          </div>

          {diagResults && (
            <div className="my-2.5 p-3 neu-inset rounded-xl font-mono text-[11px] space-y-1.5 text-muted-foreground border border-white/5 max-h-48 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-white/10 pb-1">
                <span className="text-cyan-hud font-bold">PRE-FLIGHT REPORT ({diagResults.time}):</span>
                <span className="text-emerald-hud font-bold">{diagResults.overallStatus} ({diagResults.durationMs}ms)</span>
              </div>
              <p className="text-[10.5px] text-zinc-300 italic pt-0.5">"{diagResults.summary}"</p>
              <div className="pt-1.5 space-y-1">
                {diagResults.items?.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-[10px]">
                    <span className="truncate pr-2">• {item.name}:</span>
                    <span className={item.status === 'passed' ? 'text-emerald-400 font-bold shrink-0' : 'text-amber-400 font-bold shrink-0'}>
                      {item.status === 'passed' ? 'PASS' : 'WARN'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={runSweep}
            disabled={diagnosticRunning}
            className="key mt-3 flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold text-cyan-hud glow-ring cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${diagnosticRunning ? "animate-spin" : ""}`} />
            <span>{diagnosticRunning ? "Running Pre-Flight Sweep…" : "Run Full Suit Diagnostics"}</span>
          </button>
        </section>

        {/* Telemetry and Automation Toggles */}
        <section className="neu gloss rounded-2xl p-4">
          <h3 className="text-[13.5px] font-bold">Autonomous Execution Gates</h3>
          <div className="mt-3.5 space-y-3">
            {[
              {
                l: "Live Hardware Telemetry",
                d: "Poll CPU, RAM, thermals, and battery in real-time.",
                v: telemetryOn,
                set: setTelemetryOn,
              },
              {
                l: "Auto-Dispatch Recommendations",
                d: "Allow JARVIS to suggest and dispatch proactive missions.",
                v: autoDispatch,
                set: setAutoDispatch,
              },
              {
                l: "Confirm Destructive Actuations",
                d: "Prompt for verbal or click approval before rm/kill/shutdown commands.",
                v: confirmDestructive,
                set: setConfirmDestructive,
              },
            ].map((t) => (
              <div key={t.l} className="flex items-center justify-between gap-3 border-b border-white/5 pb-2 last:border-b-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-bold text-foreground">{t.l}</span>
                  <span className="block text-[10.5px] text-muted-foreground">{t.d}</span>
                </div>
                <Toggle on={t.v} onToggle={() => t.set(!t.v)} />
              </div>
            ))}
          </div>
        </section>

        {/* System Calibration Sliders */}
        <section className="neu gloss rounded-2xl p-4 space-y-4">
          <h3 className="text-[13.5px] font-bold">System Calibration</h3>
          <div>
            <div className="flex items-center justify-between text-[11.5px] font-bold">
              <span>Autonomy Threshold</span>
              <span className="font-mono text-cyan-hud">{autonomy}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              value={autonomy}
              onChange={(e) => setAutonomy(+e.target.value)}
              className="mt-2 w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-[11.5px] font-bold">
              <span>Readout Density</span>
              <span className="font-mono text-violet-hud">{density}%</span>
            </div>
            <input
              type="range"
              min={20}
              max={100}
              value={density}
              onChange={(e) => setDensity(+e.target.value)}
              className="mt-2 w-full accent-violet-400 cursor-pointer"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
