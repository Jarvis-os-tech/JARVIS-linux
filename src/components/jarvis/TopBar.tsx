import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Activity, Bell, Gauge, Power, Settings2, X, Sparkles, LayoutGrid, Loader2 } from "lucide-react";
import { useJarvis, useNow } from "./JarvisProvider";
import { ThemeToggle } from "./ThemeToggle";
import { timeAgo } from "@/lib/jarvis-data";
import { cn } from "@/lib/utils";

function Gauge3({ label, value, unit, color }: { label: string; value: number; unit?: string; color: string }) {
  return (
    <div className="neu-inset flex items-center gap-2.5 rounded-xl px-3 py-1.5">
      <span className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground">{label}</span>
      <span className="font-mono text-[12px] font-bold tabular-nums" style={{ color }}>
        {value}
        {unit}
      </span>
      <span className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-[oklch(0.13_0.01_256)] shadow-[inset_0_1px_2px_oklch(0_0_0/70%)] lg:inline-block">
        <i
          className="block h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.min(100, Math.max(5, value))}%`,
            background: `linear-gradient(90deg, ${color}, color-mix(in oklab, ${color} 35%, transparent))`,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
      </span>
    </div>
  );
}

export function TopBar() {
  const {
    unread,
    notifications,
    markAllRead,
    clearNotifications,
    dismissNotification,
    cpu,
    ram,
    net,
    batteryPercent,
    telemetryOn,
    setTelemetryOn,
    setView,
    connectionState,
    selectedPersona,
    handleStartSession,
    handleStopSession,
    onSwitchToClassic,
  } = useJarvis();
  const now = useNow();

  const isConnecting = connectionState === "connecting";
  const isConnected = connectionState !== "disconnected" && connectionState !== "error";

  return (
    <header className="bezel gloss relative z-50 flex h-[4.25rem] items-center justify-between gap-3 rounded-2xl px-4 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="neu relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl overflow-hidden p-0.5 group">
          <span className="absolute inset-0 animate-ping-ring rounded-2xl border border-cyan-hud/40 pointer-events-none" />
          <img
            src="/jarvis-logo.png"
            alt="JARVIS OS"
            className="h-full w-full object-cover rounded-[14px] drop-shadow-[0_0_10px_var(--cyan-hud)] transition-transform duration-300 group-hover:scale-105"
          />
        </span>
        <div className="min-w-0">
          <span className="font-display etched block truncate text-lg font-bold tracking-[0.25em] text-foreground">
            JARVIS OS
          </span>
          <span className="block text-[9.5px] font-semibold uppercase tracking-[0.28em] text-cyan-hud/90">
            Console MK-VII
          </span>
        </div>
      </div>

      {/* Voice Status Pill */}
      {isConnecting ? (
        <div className="neu-inset hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-hud animate-pulse shadow-[0_0_12px_var(--amber-hud)]">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span className="text-[11px] font-mono font-bold tracking-wider">
            CONNECTING TO {selectedPersona?.name?.toUpperCase() || "VOICE"}…
          </span>
        </div>
      ) : isConnected ? (
        <div className="neu-inset hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-emerald-500/30 text-emerald-hud shadow-[0_0_8px_var(--emerald-hud)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] font-mono font-bold tracking-wider">
            {selectedPersona?.name?.toUpperCase()} · LIVE ONLINE
          </span>
        </div>
      ) : null}

      <div className="hidden items-center gap-2 xl:flex">
        <Gauge3 label="CPU" value={cpu} unit="%" color="var(--cyan-hud)" />
        <Gauge3 label="RAM" value={ram} unit="%" color="var(--violet-hud)" />
        <Gauge3 label="NET" value={Math.round(net)} unit=" KB/s" color="var(--emerald-hud)" />
        {batteryPercent !== null && (
          <Gauge3 label="BAT" value={batteryPercent} unit="%" color="var(--amber-hud)" />
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="neu-inset hidden rounded-xl px-3 py-1.5 font-mono text-xs tabular-nums text-cyan-hud sm:inline-block">
          {now
            ? new Date(now).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true,
              })
            : "--:--:--"}
        </span>

        {/* Live Telemetry toggle */}
        <button
          onClick={() => setTelemetryOn(!telemetryOn)}
          aria-label="Toggle live telemetry"
          title={telemetryOn ? "Live telemetry active" : "Telemetry paused"}
          className={cn(
            "key grid h-10 w-10 place-items-center rounded-xl",
            telemetryOn ? "text-emerald-hud glow-ring" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Activity className="h-4 w-4" />
        </button>

        {/* Notifications */}
        <Popover onOpenChange={(o) => o && markAllRead()}>
          <PopoverTrigger asChild>
            <button
              aria-label="Notifications"
              className="key relative grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:text-cyan-hud"
            >
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="led absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center bg-amber-hud px-1 text-[10px] font-extrabold text-background">
                  {unread}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={12}
            className="glass z-[200] w-[min(23rem,calc(100vw-2rem))] border-hairline bg-[color-mix(in_oklab,var(--popover)_92%,transparent)] p-0 backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
              <span className="text-xs font-bold tracking-[0.2em] text-foreground">NOTIFICATIONS</span>
              <button
                onClick={clearNotifications}
                className="key rounded-lg px-2.5 py-1 text-[11px] font-semibold text-cyan-hud"
              >
                Clear all
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2.5">
              {notifications.length === 0 && (
                <p className="py-10 text-center text-xs text-muted-foreground">
                  No signals. All quiet on the network.
                </p>
              )}
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className="neu-sm group animate-rise-in mb-2 flex gap-3 rounded-xl p-3 last:mb-0"
                >
                  <span className="neu-inset grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm">
                    {n.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-relaxed text-foreground">{n.title}</p>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">{timeAgo(n.at)}</p>
                  </div>
                  <button
                    onClick={() => dismissNotification(n.id)}
                    aria-label="Dismiss"
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Mission Control button */}
        <button
          onClick={() => setView("mission")}
          aria-label="Mission control"
          title="Mission Control"
          className="key hidden h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:text-cyan-hud sm:grid"
        >
          <Gauge className="h-4 w-4" />
        </button>

        {/* Theme Toggle */}
        <ThemeToggle className="h-10 rounded-xl p-1" />

        {/* Settings button */}
        <button
          onClick={() => setView("settings")}
          aria-label="Settings"
          title="System Preferences"
          className="key grid h-10 w-10 place-items-center rounded-xl text-muted-foreground hover:text-cyan-hud"
        >
          <Settings2 className="h-4 w-4" />
        </button>

        {/* Instant Switch to Classic HUD Fallback */}
        {onSwitchToClassic && (
          <button
            onClick={onSwitchToClassic}
            aria-label="Switch to Classic HUD"
            title="Switch to Classic Glassmorphism HUD Design"
            className="key flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-cyan-hud glow-ring"
          >
            <LayoutGrid className="h-3.5 w-3.5 text-cyan-400" />
            <span className="hidden md:inline">Classic HUD</span>
          </button>
        )}

        {/* Power / Live Connect Toggle */}
        <button
          onClick={isConnected ? handleStopSession : handleStartSession}
          disabled={isConnecting}
          aria-label={
            isConnecting
              ? "Connecting Live Voice Stream…"
              : isConnected
              ? "Disconnect Voice Session"
              : "Connect Live Voice Session"
          }
          title={
            isConnecting
              ? "Connecting to Voice Stream (Please wait)…"
              : isConnected
              ? "Live Voice Connected (Click to Disconnect)"
              : "Voice Standby (Click to Connect)"
          }
          className={cn(
            "neu grid h-10 w-10 place-items-center rounded-full transition-all cursor-pointer",
            isConnecting
              ? "text-amber-hud glow-ring animate-pulse shadow-[0_0_14px_var(--amber-hud)] bg-amber-500/10 cursor-wait"
              : isConnected
              ? "text-emerald-hud glow-ring shadow-[0_0_12px_var(--emerald-hud)]"
              : "text-muted-foreground hover:text-cyan-hud",
          )}
        >
          {isConnecting ? (
            <Loader2 className="h-4 w-4 animate-spin text-amber-hud" />
          ) : (
            <Power className="h-4 w-4" />
          )}
        </button>
      </div>
    </header>
  );
}
