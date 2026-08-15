import React, { useState } from "react";
import { Check, Pause, Play, Plus, Trash2, X, ExternalLink, Sparkles, AlertCircle } from "lucide-react";
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
  const { missions, createMission, setMissionStatus, removeMission, clearAllMissions, log, workspaceActions } = useJarvis();
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
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-wide">Mission Control</h1>
            <span className="neu-inset px-2.5 py-0.5 rounded-full text-[10.5px] font-bold text-cyan-hud border border-cyan-500/20">
              Operations Deck
            </span>
          </div>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            Direct oversight of every autonomous operation, background routine, and Google Workspace action.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {missions.length > 0 && (
            <button
              onClick={clearAllMissions}
              className="key flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-bold text-rose-400 border border-rose-500/30 hover:bg-rose-500/10 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear All
            </button>
          )}
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-cyan-hud/40 bg-[linear-gradient(90deg,color-mix(in_oklab,var(--cyan-hud)_20%,transparent),color-mix(in_oklab,var(--blue-hud)_20%,transparent))] px-4 py-2.5 text-[13px] font-bold text-cyan-hud transition-transform hover:-translate-y-0.5 cursor-pointer shadow-lg shadow-cyan-600/20"
          >
            <Plus className="h-4 w-4" /> New Mission
          </button>
        </div>
      </header>

      {/* Top metric tiles */}
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

      {/* Inline dispatch form */}
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
          className="animate-rise-in mb-4 flex flex-col gap-2 rounded-2xl border border-cyan-hud/25 bg-foreground/[0.04] p-3.5 sm:flex-row backdrop-blur-xl"
        >
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Mission title (e.g. Daily Briefing, Triage Inbox)…"
            className="min-w-0 flex-1 rounded-xl border border-border bg-foreground/5 px-3.5 py-2.5 text-[13px] outline-none focus:border-cyan-hud/60"
          />
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Directives or parameters…"
            className="min-w-0 flex-1 rounded-xl border border-border bg-foreground/5 px-3.5 py-2.5 text-[13px] outline-none focus:border-cyan-hud/60"
          />
          <button
            type="submit"
            className="shrink-0 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-cyan-600/25 cursor-pointer"
          >
            Dispatch
          </button>
        </form>
      )}

      {/* Filter Tabs */}
      <div className="mb-3 flex flex-wrap gap-2">
        {(["all", "progress", "paused", "pending", "done", "cancelled"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full px-3 py-1 text-[11px] font-bold capitalize transition-all cursor-pointer",
              filter === f
                ? "neu-inset text-cyan-hud border border-cyan-500/40"
                : "key text-muted-foreground hover:text-foreground",
            )}
          >
            {f === "progress" ? "Active" : f}
          </button>
        ))}
      </div>

      {/* Missions list + activity side panel */}
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pb-4 pr-1">
          {list.length === 0 && (
            <div className="flex flex-col items-center justify-center my-auto py-16 text-center neu-inset rounded-2xl p-6">
              <span className="text-3xl mb-2">🎯</span>
              <h3 className="text-sm font-bold text-foreground">No operations in flight</h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                Directives dispatched via voice, chat, or the Workflow Forge will appear and track here in real-time.
              </p>
              <button
                onClick={() => setOpen(true)}
                className="mt-4 key px-4 py-2 rounded-xl text-xs font-bold text-cyan-hud cursor-pointer"
              >
                + Dispatch Directive
              </button>
            </div>
          )}
          {list.map((m) => {
            const s = label[m.status] || label.progress;
            return (
              <article
                key={m.id}
                className="neu gloss animate-rise-in flex shrink-0 gap-3.5 rounded-2xl p-4 border border-white/5 shadow-md"
              >
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg"
                  style={{
                    background: `color-mix(in oklab, ${m.accent} 15%, transparent)`,
                    color: m.accent,
                    border: `1px solid color-mix(in oklab, ${m.accent} 30%, transparent)`,
                  }}
                >
                  {m.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-[13.5px] font-bold text-foreground truncate">{m.title}</h3>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[11px] font-semibold", s.cls)}>{s.text}</span>
                      <span className="font-mono text-[10.5px] text-muted-foreground">
                        {timeAgo(m.createdAt)}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground break-words line-clamp-2">
                    {m.desc}
                  </p>

                  {m.linkUrl && (
                    <a
                      href={m.linkUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
                    >
                      <span>Open Workspace Link</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}

                  <div className="mt-3 flex items-center gap-3">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/10">
                      <i
                        className="block h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${m.progress}%`,
                          background: `linear-gradient(90deg, ${m.accent}, var(--blue-hud))`,
                          boxShadow: `0 0 6px ${m.accent}`,
                        }}
                      />
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground font-bold">
                      {Math.round(m.progress)}%
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5 pt-2 border-t border-white/5">
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
            SYSTEM TELEMETRY LOG
          </p>
          <div className="neu-inset min-h-0 flex-1 space-y-3 overflow-y-auto rounded-2xl p-4">
            {log.map((l) => (
              <div key={l.id} className="border-l-2 border-cyan-hud/40 pl-3 py-0.5">
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
        "key flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer",
        tone === "cyan" && "text-muted-foreground hover:text-cyan-hud",
        tone === "emerald" && "text-muted-foreground hover:text-emerald-hud",
        tone === "destructive" && "text-muted-foreground hover:text-destructive",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
