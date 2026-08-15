import { useJarvis } from "../JarvisProvider";
import { ThemeToggle } from "../ThemeToggle";
import { Toggle } from "../Toggle";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function Row({
  title,
  desc,
  on,
  onToggle,
}: {
  title: string;
  desc: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="neu flex items-center justify-between gap-4 rounded-2xl p-4">
      <div className="min-w-0">
        <p className="text-[13.5px] font-bold">{title}</p>
        <p className="mt-0.5 text-[11.5px] text-muted-foreground">{desc}</p>
      </div>
      <Toggle on={on} onToggle={onToggle} label={title} />
    </div>
  );
}

function Dial({
  title,
  desc,
  value,
  onChange,
  min = 0,
  max = 100,
  suffix = "%",
  minLabel,
  maxLabel,
}: {
  title: string;
  desc: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
  minLabel: string;
  maxLabel: string;
}) {
  return (
    <div className="neu rounded-2xl p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-[13.5px] font-bold">{title}</p>
        <span className="neu-inset rounded-lg px-2.5 py-1 font-mono text-sm font-bold text-cyan-hud">
          {value}
          {suffix}
        </span>
      </div>
      <p className="mt-0.5 text-[11.5px] text-muted-foreground">{desc}</p>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-4 w-full"
      />
      <div className="mt-1 flex justify-between text-[10.5px] text-muted-foreground">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

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
    cpu,
    ram,
    net,
    pushLog,
  } = useJarvis();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="mb-4">
        <h1 className="font-display etched text-2xl font-bold tracking-wide">System Preferences</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Tune how independently the console operates and how much it shows you.
        </p>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-4 pr-1">
        <div className="neu flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4">
          <div className="min-w-0">
            <p className="text-[13.5px] font-bold">Chassis mode</p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">
              Switch between graphite dark, bright aluminium, or follow the system.
            </p>
          </div>
          <ThemeToggle className="rounded-xl p-1" />
        </div>

        <Row
          title="Live telemetry"
          desc="Stream CPU, memory and network readings into the gauges."
          on={telemetryOn}
          onToggle={() => setTelemetryOn(!telemetryOn)}
        />
        <Row
          title="Auto-dispatch"
          desc="Let running missions advance on their own without supervision."
          on={autoDispatch}
          onToggle={() => setAutoDispatch(!autoDispatch)}
        />
        <Row
          title="Confirm destructive actions"
          desc="Ask before aborting or removing an operation."
          on={confirmDestructive}
          onToggle={() => setConfirmDestructive(!confirmDestructive)}
        />

        <Dial
          title="Autonomy level"
          desc="Higher levels let agents act without asking first."
          value={autonomy}
          onChange={setAutonomy}
          minLabel="Ask first"
          maxLabel="Fully autonomous"
        />
        <Dial
          title="Readout density"
          desc="How much detail each panel packs into the same space."
          value={density}
          onChange={setDensity}
          minLabel="Calm"
          maxLabel="Dense"
        />

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { l: "CPU LOAD", v: `${cpu}%`, c: "text-cyan-hud" },
            { l: "MEMORY", v: `${ram}%`, c: "text-violet-hud" },
            { l: "NETWORK", v: `${net} KB/s`, c: "text-emerald-hud" },
          ].map((s) => (
            <div key={s.l} className="neu-inset rounded-2xl p-4">
              <p className={cn("font-mono text-lg font-extrabold", s.c)}>{s.v}</p>
              <p className="mt-0.5 text-[10px] tracking-[0.16em] text-muted-foreground">{s.l}</p>
            </div>
          ))}
        </div>

        <div className="neu flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
          <div className="min-w-0">
            <p className="text-[13.5px] font-bold">Diagnostics</p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">
              Run a full self-check across every subsystem.
            </p>
          </div>
          <button
            onClick={() => {
              pushLog("Full diagnostic sweep completed — no faults detected.");
              toast.success("Diagnostics clean — all subsystems nominal");
            }}
            className="key rounded-xl px-4 py-2.5 text-[12.5px] font-bold text-cyan-hud glow-ring"
          >
            Run diagnostics
          </button>
        </div>
      </div>
    </div>
  );
}
