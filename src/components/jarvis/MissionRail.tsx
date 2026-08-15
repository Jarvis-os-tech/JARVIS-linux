import { Plus } from "lucide-react";
import { useJarvis } from "./JarvisProvider";
import { cn } from "@/lib/utils";
import type { Mission } from "@/lib/jarvis-data";

const statusLabel: Record<Mission["status"], { text: string; cls: string }> = {
  progress: { text: "In Progress", cls: "text-cyan-hud" },
  paused: { text: "Paused", cls: "text-amber-hud" },
  done: { text: "Completed", cls: "text-emerald-hud" },
  pending: { text: "Queued", cls: "text-amber-hud" },
  cancelled: { text: "Cancelled", cls: "text-destructive" },
};

export function MissionRail() {
  const { missions, setView, createMission } = useJarvis();
  const shown = missions.slice(0, 6);

  return (
    <aside className="bezel flex min-h-0 shrink-0 flex-col overflow-hidden rounded-2xl xl:w-[21rem]">
      <div className="flex items-center justify-between border-b border-[oklch(0_0_0/35%)] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="neu-sm grid h-9 w-9 place-items-center rounded-xl text-cyan-hud">🎯</span>
          <span className="etched text-[12px] font-bold tracking-[0.16em]">MISSION RAIL</span>
        </div>
        <button
          onClick={() => setView("mission")}
          className="key rounded-lg px-2.5 py-1 text-[11px] font-bold text-cyan-hud"
        >
          View All
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-3.5">
        <p className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground">ACTIVE MISSIONS</p>
        {shown.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center neu-inset rounded-xl p-4 my-auto">
            <p className="text-xs font-semibold text-muted-foreground">No operations in flight</p>
            <p className="text-[10px] text-muted-foreground/70 mt-1">Dispatched directives will track here</p>
          </div>
        ) : (
          shown.map((m) => {
            const s = statusLabel[m.status] || statusLabel.progress;
            return (
              <button
                key={m.id}
                onClick={() => setView("mission")}
                className="neu group flex gap-3 rounded-xl p-3 text-left transition-transform hover:-translate-y-0.5"
              >
                <span
                  className="neu-inset grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm"
                  style={{ color: m.accent }}
                >
                  {m.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold">{m.title}</span>
                  <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-muted-foreground">
                    {m.desc}
                  </span>
                  <span className="mt-2 flex items-center justify-between text-[11px]">
                    <span className={cn("font-bold", s.cls)}>{s.text}</span>
                    <span className="font-mono text-muted-foreground">{Math.round(m.progress)}%</span>
                  </span>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[oklch(0.13_0.01_256)] shadow-[inset_0_1px_2px_oklch(0_0_0/70%)]">
                    <i
                      className="block h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${m.progress}%`,
                        background: `linear-gradient(90deg, ${m.accent}, var(--blue-hud))`,
                        boxShadow: `0 0 8px ${m.accent}`,
                      }}
                    />
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>

      <button
        onClick={() => createMission("Ad-hoc Directive", "Quick operation dispatched from the Mission Rail.")}
        className="key m-3.5 mt-0 flex items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-bold text-cyan-hud glow-ring"
      >
        <Plus className="h-4 w-4" /> New Mission
      </button>
    </aside>
  );
}
