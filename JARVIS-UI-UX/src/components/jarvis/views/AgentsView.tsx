import { useJarvis, useStats } from "../JarvisProvider";
import { cn } from "@/lib/utils";

export function AgentsView() {
  const { agents, toggleAgent, setAgentStatus } = useJarvis();
  const stats = useStats();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display etched text-2xl font-bold tracking-wide">AI Agent Swarm</h1>
          <div className="mt-2 flex gap-5 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <i className="led h-2 w-2 bg-emerald-hud text-emerald-hud" />
              <b className="text-foreground">{stats.running}</b> running
            </span>
            <span className="flex items-center gap-2">
              <i className="h-2 w-2 rounded-full bg-muted-foreground/60" />
              <b className="text-foreground">{stats.stopped}</b> suspended
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => agents.forEach((a) => setAgentStatus(a.id, "running"))}
            className="key rounded-xl px-3.5 py-2 text-[12px] font-bold text-emerald-hud"
          >
            Activate all
          </button>
          <button
            onClick={() => agents.forEach((a) => setAgentStatus(a.id, "stopped"))}
            className="key rounded-xl px-3.5 py-2 text-[12px] font-bold text-amber-hud"
          >
            Suspend all
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3.5 overflow-y-auto pb-4 pr-1">
        {agents.map((a) => (
          <article
            key={a.id}
            className="neu gloss animate-rise-in flex flex-col gap-2.5 rounded-2xl p-4 transition-transform hover:-translate-y-0.5"
          >
            <div className="flex items-start justify-between gap-2">
              <span
                className="neu-inset grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg"
                style={{ color: a.accent }}
              >
                {a.icon}
              </span>
              <span
                className={cn(
                  "neu-inset flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-wider",
                  a.status === "running" ? "text-emerald-hud" : "text-muted-foreground",
                )}
              >
                <i
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    a.status === "running" ? "led bg-emerald-hud text-emerald-hud" : "bg-muted-foreground/60",
                  )}
                />
                {a.status === "running" ? "ONLINE" : "OFFLINE"}
              </span>
            </div>

            <h3 className="text-sm font-bold">{a.name}</h3>
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">{a.desc}</p>

            <div className="mt-auto space-y-2.5">
              <div className="flex items-center justify-between font-mono text-[10.5px] text-muted-foreground">
                <span>{a.tasks} tasks</span>
                <span>{a.status === "running" ? `${Math.floor(a.uptimeMin / 60)}h uptime` : "offline"}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[oklch(0.13_0.01_256)] shadow-[inset_0_1px_3px_oklch(0_0_0/75%)]">
                <i
                  className="block h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${a.load}%`,
                    background: `linear-gradient(90deg, ${a.accent}, color-mix(in oklab, ${a.accent} 45%, transparent))`,
                    boxShadow: `0 0 8px ${a.accent}`,
                  }}
                />
              </div>
              <button
                onClick={() => toggleAgent(a.id)}
                className={cn(
                  "key w-full rounded-xl py-2.5 text-xs font-bold",
                  a.status === "running" ? "text-amber-hud" : "text-emerald-hud",
                )}
              >
                {a.status === "running" ? "Suspend Agent" : "Activate Agent"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
