import React, { useState, useEffect } from "react";
import { Play, Plus, Workflow, Sparkles, CheckCircle2 } from "lucide-react";
import { useJarvis } from "../JarvisProvider";
import { toast } from "sonner";

const defaultRoutines = [
  {
    id: "w1",
    name: "System Hardware & Thermals Sweep",
    steps: ["Probe CPU & RAM loads", "Inspect thermal sensors & fan states", "Check NVMe storage mounts", "Publish diagnostic report"],
    runs: 0,
    color: "var(--cyan-hud)",
  },
  {
    id: "w2",
    name: "Morning Executive Briefing",
    steps: ["Aggregate overnight telemetry", "Check pending Google Calendar events", "Triage high-priority emails", "Speak spoken digest"],
    runs: 0,
    color: "var(--amber-hud)",
  },
  {
    id: "w3",
    name: "Long-Term Memory Consolidation",
    steps: ["Harvest active conversational facts", "Deduplicate entity graph nodes", "Update vector recall weights", "Sync with Gemini Live"],
    runs: 0,
    color: "var(--violet-hud)",
  },
  {
    id: "w4",
    name: "Security Sentinel Night Watch",
    steps: ["Verify UFW firewall & network sockets", "Audit background process spikes", "Rotate stale OAuth tokens", "Alert on anomalous events"],
    runs: 0,
    color: "var(--emerald-hud)",
  },
];

export function WorkflowsView() {
  const { createMission, pushLog } = useJarvis();
  const [routines, setRoutines] = useState(() => {
    try {
      const saved = localStorage.getItem("jarvis_workflows_v1");
      return saved ? JSON.parse(saved) : defaultRoutines;
    } catch {
      return defaultRoutines;
    }
  });
  const [name, setName] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem("jarvis_workflows_v1", JSON.stringify(routines));
    } catch {}
  }, [routines]);

  const handleForgeWorkflow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const newRoutine = {
      id: Math.random().toString(36).slice(2, 9),
      name: name.trim(),
      steps: ["Initialize parameters", "Execute toolchain actions", "Verify results & log"],
      runs: 0,
      color: "var(--cyan-hud)",
    };
    setRoutines([newRoutine, ...routines]);
    pushLog(`Custom workflow forged: ${name.trim()}`);
    toast.success(`Workflow created: ${name.trim()}`);
    setName("");
  };

  const handleRunWorkflow = (routine: typeof defaultRoutines[0]) => {
    createMission(routine.name, `Executing automated workflow steps: ${routine.steps.join(" → ")}`);
    setRoutines((prev: typeof defaultRoutines) =>
      prev.map((r) => (r.id === routine.id ? { ...r, runs: r.runs + 1 } : r))
    );
    toast.success(`Workflow dispatched: ${routine.name}`);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <h1 className="font-display etched text-2xl font-bold tracking-wide">Workflow Forge</h1>
          <span className="neu-inset px-2.5 py-0.5 rounded-full text-[10.5px] font-bold text-violet-hud border border-violet-500/20">
            Automated Routines
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Autonomous multi-step routines executable by the JARVIS co-pilot across local Linux and connected services.
        </p>
      </header>

      {/* Forge new routine form */}
      <form onSubmit={handleForgeWorkflow} className="mb-4 flex gap-2">
        <div className="neu-inset flex min-w-0 flex-1 items-center rounded-xl px-3.5 py-2.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Forge a new routine (e.g. Daily Standup Prep, Battery Saver Mode)…"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
          />
        </div>
        <button
          type="submit"
          className="key flex items-center gap-2 rounded-xl px-4 text-[12.5px] font-bold text-cyan-hud glow-ring cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Forge
        </button>
      </form>

      {/* Routines Grid */}
      <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-3.5 overflow-y-auto pb-4 pr-1">
        {routines.map((w) => (
          <article key={w.id} className="neu gloss animate-rise-in flex flex-col justify-between rounded-2xl p-4">
            <div>
              <div className="flex items-center gap-3">
                <span
                  className="neu-inset grid h-11 w-11 place-items-center rounded-xl shrink-0"
                  style={{ color: w.color }}
                >
                  <Workflow className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-[13.5px] font-bold">{w.name}</h3>
                  <p className="font-mono text-[10.5px] text-muted-foreground">{w.runs} executions</p>
                </div>
              </div>

              <ol className="mt-3.5 space-y-1.5">
                {w.steps.map((s, i) => (
                  <li key={s} className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
                    <span className="neu-inset grid h-5 w-5 shrink-0 place-items-center rounded-md font-mono text-[10px] text-cyan-hud font-bold">
                      {i + 1}
                    </span>
                    <span className="truncate">{s}</span>
                  </li>
                ))}
              </ol>
            </div>

            <button
              onClick={() => handleRunWorkflow(w)}
              className="key mt-4 flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold text-cyan-hud cursor-pointer"
            >
              <Play className="h-3.5 w-3.5" /> Run Workflow
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
