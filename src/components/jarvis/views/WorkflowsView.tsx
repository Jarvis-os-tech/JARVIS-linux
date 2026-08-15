import React, { useState, useEffect } from "react";
import { Play, Plus, Workflow, Trash2 } from "lucide-react";
import { useJarvis } from "../JarvisProvider";
import { toast } from "sonner";

interface RoutineItem {
  id: string;
  name: string;
  steps: string[];
  runs: number;
  color: string;
}

export function WorkflowsView() {
  const { createMission, pushLog } = useJarvis();
  const [routines, setRoutines] = useState<RoutineItem[]>(() => {
    try {
      const saved = localStorage.getItem("jarvis_workflows_v1");
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      // Filter out legacy dummy workflows
      return parsed.filter(
        (r: RoutineItem) => r && r.id && !["w1", "w2", "w3", "w4"].includes(r.id)
      );
    } catch {
      return [];
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
    const newRoutine: RoutineItem = {
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

  const handleRunWorkflow = (routine: RoutineItem) => {
    createMission(routine.name, `Executing automated workflow steps: ${routine.steps.join(" → ")}`);
    setRoutines((prev) =>
      prev.map((r) => (r.id === routine.id ? { ...r, runs: r.runs + 1 } : r))
    );
    toast.success(`Workflow dispatched: ${routine.name}`);
  };

  const handleDeleteWorkflow = (id: string) => {
    setRoutines((prev) => prev.filter((r) => r.id !== id));
    toast("Workflow removed");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <h1 className="font-display etched text-2xl font-bold tracking-wide">Workflow Forge</h1>
          <span className="neu-inset px-2.5 py-0.5 rounded-full text-[10.5px] font-bold text-violet-hud border border-violet-500/20">
            {routines.length} Automated Routines
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

      {/* Routines Grid or Clean Empty State */}
      {routines.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 my-auto py-16 text-center neu-inset rounded-2xl p-6">
          <span className="neu-inset grid h-14 w-14 place-items-center rounded-2xl text-violet-400 mb-3 border border-violet-500/20">
            <Workflow className="h-7 w-7" />
          </span>
          <h3 className="text-sm font-bold text-foreground">No Automated Workflows Created</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            You haven't forged any automated routines yet. Type a routine name above and click Forge to create your first multi-step workflow.
          </p>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-3.5 overflow-y-auto pb-4 pr-1">
          {routines.map((w) => (
            <article key={w.id} className="neu gloss animate-rise-in flex flex-col justify-between rounded-2xl p-4">
              <div>
                <div className="flex items-center justify-between gap-3">
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
                  <button
                    onClick={() => handleDeleteWorkflow(w.id)}
                    className="text-muted-foreground hover:text-rose-400 p-1.5 rounded-lg transition-colors cursor-pointer"
                    title="Delete workflow"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
      )}
    </div>
  );
}
