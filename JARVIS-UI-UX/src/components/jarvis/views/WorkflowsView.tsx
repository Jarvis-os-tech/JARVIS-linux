import { useState } from "react";
import { Play, Plus, Workflow } from "lucide-react";
import { useJarvis } from "../JarvisProvider";
import { toast } from "sonner";

const seed = [
  { id: "w1", n: "Morning Digest", steps: ["Collect telemetry", "Summarise overnight events", "Publish briefing"], runs: 128, c: "var(--amber-hud)" },
  { id: "w2", n: "Inbox Triage", steps: ["Classify mail", "Draft replies", "Escalate P1+"], runs: 942, c: "var(--violet-hud)" },
  { id: "w3", n: "Intel Sweep", steps: ["Crawl sources", "Deduplicate", "Rank by signal"], runs: 216, c: "var(--blue-hud)" },
  { id: "w4", n: "Night Watch", steps: ["Probe nodes", "Rotate keys", "Report anomalies"], runs: 74, c: "var(--emerald-hud)" },
];

export function WorkflowsView() {
  const { createMission, pushLog } = useJarvis();
  const [items, setItems] = useState(seed);
  const [name, setName] = useState("");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="mb-4">
        <h1 className="font-display etched text-2xl font-bold tracking-wide">Workflow Forge</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Reusable routines the swarm can execute end to end. Run one to dispatch it as a mission.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          setItems((prev) => [
            { id: Math.random().toString(36).slice(2), n: name.trim(), steps: ["Plan", "Execute", "Report"], runs: 0, c: "var(--cyan-hud)" },
            ...prev,
          ]);
          pushLog(`Workflow “${name.trim()}” forged.`);
          toast.success(`Workflow created: ${name.trim()}`);
          setName("");
        }}
        className="mb-4 flex gap-2"
      >
        <div className="neu-inset flex min-w-0 flex-1 items-center rounded-xl px-3.5 py-2.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name a new routine…"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
          />
        </div>
        <button type="submit" className="key flex items-center gap-2 rounded-xl px-4 text-[12.5px] font-bold text-cyan-hud glow-ring">
          <Plus className="h-4 w-4" /> Forge
        </button>
      </form>

      <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-3.5 overflow-y-auto pb-4 pr-1">
        {items.map((w) => (
          <article key={w.id} className="neu gloss animate-rise-in flex flex-col rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <span className="neu-inset grid h-11 w-11 place-items-center rounded-xl" style={{ color: w.c }}>
                <Workflow className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-[13.5px] font-bold">{w.n}</h3>
                <p className="font-mono text-[10.5px] text-muted-foreground">{w.runs} runs</p>
              </div>
            </div>

            <ol className="mt-3 space-y-1.5">
              {w.steps.map((s, i) => (
                <li key={s} className="flex items-center gap-2.5 text-[11.5px] text-muted-foreground">
                  <span className="neu-inset grid h-5 w-5 shrink-0 place-items-center rounded-md font-mono text-[10px] text-cyan-hud">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>

            <button
              onClick={() => {
                createMission(w.n, `Routine executing: ${w.steps.join(" → ")}.`);
                setItems((prev) => prev.map((x) => (x.id === w.id ? { ...x, runs: x.runs + 1 } : x)));
              }}
              className="key mt-4 flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold text-cyan-hud"
            >
              <Play className="h-3.5 w-3.5" /> Run workflow
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
