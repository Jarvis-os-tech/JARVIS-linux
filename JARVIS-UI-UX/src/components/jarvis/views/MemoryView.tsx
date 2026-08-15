import { useState } from "react";
import { Brain, Search } from "lucide-react";
import { useJarvis } from "../JarvisProvider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const memories = [
  { t: "Owner profile", d: "Gopi — prefers concise briefings, morning digests at 08:00.", tag: "identity", c: "var(--cyan-hud)" },
  { t: "Interface preferences", d: "Dense readouts, dark console, confirm destructive actions.", tag: "prefs", c: "var(--violet-hud)" },
  { t: "Infrastructure map", d: "14 nodes, 3 regions, certificates auto-rotated every 60 days.", tag: "systems", c: "var(--emerald-hud)" },
  { t: "Research corpus", d: "8,412 embedded documents across 42 monitored sources.", tag: "knowledge", c: "var(--blue-hud)" },
  { t: "Escalation policy", d: "Anything above priority 3 wakes the owner, regardless of hour.", tag: "rules", c: "var(--amber-hud)" },
  { t: "Recall index", d: "Entity graph with 1.2M edges, compressed nightly.", tag: "vector", c: "var(--pink-hud)" },
];

const tags = ["all", ...Array.from(new Set(memories.map((m) => m.tag)))];

export function MemoryView() {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("all");
  const { pushLog } = useJarvis();

  const list = memories.filter(
    (m) =>
      (tag === "all" || m.tag === tag) &&
      (m.t.toLowerCase().includes(q.toLowerCase()) || m.d.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="mb-4">
        <h1 className="font-display etched text-2xl font-bold tracking-wide">Knowledge Hub</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Long-term memory, entity graph and everything JARVIS recalls about your world.
        </p>
      </header>

      <div className="neu-inset mb-3 flex items-center gap-2 rounded-xl px-3.5 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Recall anything…"
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {tags.map((t) => (
          <button
            key={t}
            onClick={() => setTag(t)}
            className={cn(
              "rounded-full px-3 py-1 text-[11px] font-bold capitalize transition-all",
              tag === t ? "neu-inset text-cyan-hud" : "key text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3.5 overflow-y-auto pb-4 pr-1">
        {list.map((m) => (
          <button
            key={m.t}
            onClick={() => {
              pushLog(`Recalled memory node “${m.t}”.`);
              toast(`Recalled: ${m.t}`);
            }}
            className="neu gloss animate-rise-in rounded-2xl p-4 text-left transition-transform hover:-translate-y-0.5"
          >
            <span
              className="neu-inset grid h-11 w-11 place-items-center rounded-xl"
              style={{ color: m.c }}
            >
              <Brain className="h-4.5 w-4.5" />
            </span>
            <h3 className="mt-3 text-[13.5px] font-bold">{m.t}</h3>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{m.d}</p>
            <span className="neu-inset mt-3 inline-block rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {m.tag}
            </span>
          </button>
        ))}
        {list.length === 0 && (
          <p className="col-span-full py-10 text-center text-xs text-muted-foreground">
            Nothing in memory matches that.
          </p>
        )}
      </div>
    </div>
  );
}
