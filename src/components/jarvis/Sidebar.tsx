import {
  Boxes,
  Layers,
  Brain,
  LayoutDashboard,
  Plug,
  Settings2,
  Target,
} from "lucide-react";
import { useJarvis, useStats } from "./JarvisProvider";
import { cn } from "@/lib/utils";
import type { ViewKey } from "@/lib/jarvis-data";

const items: { key: ViewKey; label: string; sub: string; Icon: typeof Boxes }[] = [
  { key: "dashboard", label: "Dashboard", sub: "Command Deck", Icon: LayoutDashboard },
  { key: "memory", label: "Memory", sub: "Knowledge Vault", Icon: Brain },
  { key: "connectors", label: "Connectors", sub: "Plugins & Sensors", Icon: Plug },
  { key: "mission", label: "Mission Control", sub: "Tasks & Ops", Icon: Target },
  { key: "settings", label: "Settings", sub: "System Prefs", Icon: Settings2 },
];

export function Sidebar() {
  const { view, setView } = useJarvis();
  const stats = useStats();

  return (
    <nav className="bezel flex shrink-0 gap-2 overflow-x-auto rounded-2xl p-2.5 lg:w-[15.5rem] lg:flex-col lg:overflow-visible">
      {items.map(({ key, label, sub, Icon }) => {
        const active = view === key;
        return (
          <button
            key={key}
            onClick={() => setView(key)}
            className={cn(
              "group relative flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all lg:w-full",
              active
                ? "neu-inset text-foreground"
                : "key text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <span className="led absolute left-1.5 top-1/2 hidden h-6 w-1 -translate-y-1/2 bg-cyan-hud text-cyan-hud lg:block" />
            )}
            <Icon
              className={cn(
                "h-4.5 w-4.5 shrink-0 transition-colors lg:ml-2",
                active && "text-cyan-hud drop-shadow-[0_0_6px_var(--cyan-hud)]",
              )}
            />
            <span className="hidden min-w-0 lg:block">
              <span className="block truncate text-[13px] font-bold leading-tight">{label}</span>
              <span className="block truncate text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {sub}
              </span>
            </span>
            <span className="text-[13px] font-bold lg:hidden">{label}</span>
          </button>
        );
      })}

      <div className="hidden flex-1 lg:block" />

      <div className="neu-inset hidden rounded-2xl p-3 lg:block">
        <div className="flex items-center gap-2.5">
          <span className="neu relative grid h-9 w-9 place-items-center rounded-xl overflow-hidden p-0.5">
            <img src="/jarvis-logo.png" alt="JARVIS OS" className="h-full w-full object-cover rounded-lg drop-shadow-[0_0_6px_var(--cyan-hud)]" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-foreground">JARVIS OS Core</p>
            <p className="truncate font-mono text-[10px] text-cyan-hud/80">Sovereign MK-VII</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="neu-sm rounded-lg py-1.5">
            <p className="font-mono text-sm font-bold text-cyan-hud">1</p>
            <p className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Sovereign</p>
          </div>
          <div className="neu-sm rounded-lg py-1.5">
            <p className="font-mono text-sm font-bold text-emerald-hud">{stats.active}</p>
            <p className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Missions</p>
          </div>
        </div>
      </div>
    </nav>
  );
}
