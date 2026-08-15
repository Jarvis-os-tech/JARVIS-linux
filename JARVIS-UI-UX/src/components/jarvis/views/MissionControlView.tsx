import { useState } from "react";
import { Check, Pause, Play, Plus, Trash2, X } from "lucide-react";
import { useJarvis, useStats } from "../JarvisProvider";
import { timeAgo } from "@/lib/jarvis-data";
import { cn } from "@/lib/utils";
import type { Mission } from "@/lib/jarvis-data";

const label: Record<Mission["status"], { text: string; cls: string }> = {
  progress: { text: "In Progress", cls: "text-cyan-hud" },
  paused: { text: "Paused", cls: "text-amber-hud" },
  done: { text: "Completed", cls: "text-emerald-hud" },
  pending: { text: "Queued", cls: "text-amber-hud" },
  cancelled: { text: "Cancelled", cls: "text-destructive" },
};

export function MissionControlView() {
  const { missions, createMission, setMissionStatus, removeMission, log } = useJarvis();
  const stats = useStats();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [filter, setFilter] = useState<"all" | Mission["status"]>("all");

  const list = missions.filter((m) => filter === "all" || m.status === filter);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-wide">Mission Control</h1>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            Direct oversight of every autonomous operation — dispatch, pause, resume, complete or abort.
          </p>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-cyan-hud/40 bg-[linear-gradient(90deg,color-mix(in_oklab,var(--cyan-hud)_20%,transparent),color-mix(in_oklab,var(--blue-hud)_20%,transparent))] px-4 py-2.5 text-[13px] font-bold text-cyan-hud transition-transform hover:-translate-y-0.5"
        >
          <Plus className="h-4 w-4" /> New Mission
        </button>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          { n: stats.active, l: "ACTIVE", c: "text-cyan-hud" },
          { n: stats.paused, l: "PAUSED", c: "text-amber-hud" },
          { n: stats.pending, l: "QUEUED", c: "text-violet-hud" },
          { n: stats.done, l: "COMPLETED", c: "text-emerald-hud" },
        ].map((s) => (
          <div key={s.l} className="neu-inset rounded-xl px-4 py-3">
            <p className={cn("font-mono text-xl font-extrabold", s.c)}>{s.n}</p>
            <p className="mt-0.5 text-[10px] tracking-[0.14em] text-muted-foreground">{s.l}</p>
          </div>
        ))}
      </div>

      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            createMission(title.trim(), desc.trim());
            setTitle("");
            setDesc("");
            setOpen(false);
          }}
          className="animate-rise-in mb-4 flex flex-col gap-2 rounded-xl border border-cyan-hud/25 bg-foreground/[0.04] p-3.5 sm:flex-row"
        >
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Mission title…"
            className="min-w-0 flex-1 rounded-lg border border-border bg-foreground/5 px-3 py-2.5 text-[13px] outline-none focus:border-cyan-hud/60"
          />
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Objective (optional)…"
            className="min-w-0 flex-1 rounded-lg border border-border bg-foreground/5 px-3 py-2.5 text-[13px] outline-none focus:border-cyan-hud/60"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-[linear-gradient(135deg,var(--cyan-hud),var(--blue-hud))] px-5 py-2.5 text-[13px] font-bold text-primary-foreground"
          >
            Dispatch
          </button>
        </form>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        {(["all", "progress", "paused", "pending", "done", "cancelled"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1 text-[11px] font-semibold capitalize transition-colors",
              filter === f
                ? "border-cyan-hud/50 bg-cyan-hud/12 text-cyan-hud"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {f === "progress" ? "active" : f}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto pb-4 pr-1">
          {list.length === 0 && (
            <p className="py-10 text-center text-xs text-muted-foreground">No missions in this state.</p>
          )}
          {list.map((m) => {
            const s = label[m.status];
            return (
              <article key={m.id} className="neu gloss animate-rise-in flex gap-3.5 rounded-2xl p-4">
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-base"
                  style={{
                    background: `color-mix(in oklab, ${m.accent} 15%, transparent)`,
                    color: m.accent,
                    border: `1px solid color-mix(in oklab, ${m.accent} 30%, transparent)`,
                  }}
                >
                  {m.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <h3 className="text-[13.5px] font-bold">{m.title}</h3>
                    <span className={cn("text-[11px] font-semibold", s.cls)}>{s.text}</span>
                    <span className="ml-auto font-mono text-[10.5px] text-muted-foreground">
                      {timeAgo(m.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{m.desc}</p>
                  <div className="mt-2.5 flex items-center gap-3">
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/8">
                      <i
                        className="block h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${m.progress}%`,
                          background: `linear-gradient(90deg, ${m.accent}, var(--blue-hud))`,
                        }}
                      />
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {Math.round(m.progress)}%
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {m.status !== "done" && m.status !== "cancelled" && (
                      <>
                        {m.status === "progress" ? (
                          <Act icon={<Pause className="h-3 w-3" />} label="Pause" onClick={() => setMissionStatus(m.id, "paused")} />
                        ) : (
                          <Act icon={<Play className="h-3 w-3" />} label="Resume" onClick={() => setMissionStatus(m.id, "progress")} />
                        )}
                        <Act icon={<Check className="h-3 w-3" />} label="Complete" tone="emerald" onClick={() => setMissionStatus(m.id, "done")} />
                        <Act icon={<X className="h-3 w-3" />} label="Abort" tone="destructive" onClick={() => setMissionStatus(m.id, "cancelled")} />
                      </>
                    )}
                    <Act icon={<Trash2 className="h-3 w-3" />} label="Remove" tone="destructive" onClick={() => removeMission(m.id)} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="hidden min-h-0 flex-col lg:flex">
          <p className="mb-2.5 text-[10.5px] font-bold tracking-[0.18em] text-muted-foreground">
            RECENT ACTIVITY
          </p>
          <div className="neu-inset min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl p-3.5">
            {log.map((l) => (
              <div key={l.id} className="border-l border-cyan-hud/30 pl-3">
                <p className="text-[11.5px] leading-snug text-foreground">{l.text}</p>
                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{timeAgo(l.at)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Act({
  icon,
  label,
  onClick,
  tone = "cyan",
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: "cyan" | "emerald" | "destructive";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors",
        tone === "cyan" && "border-border text-muted-foreground hover:border-cyan-hud/50 hover:text-cyan-hud",
        tone === "emerald" && "border-border text-muted-foreground hover:border-emerald-hud/50 hover:text-emerald-hud",
        tone === "destructive" && "border-border text-muted-foreground hover:border-destructive/50 hover:text-destructive",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
