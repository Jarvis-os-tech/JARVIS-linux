import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  clock,
  missionAccents,
  missionIcons,
  seedAgents,
  seedMissions,
  seedNotifications,
  uid,
  type Agent,
  type ChatMessage,
  type LogEntry,
  type Mission,
  type MissionStatus,
  type Notification,
  type ViewKey,
} from "@/lib/jarvis-data";

type Ctx = ReturnType<typeof useJarvisState>;

const JarvisContext = createContext<Ctx | null>(null);

const VIEWS: ViewKey[] = [
  "dashboard",
  "memory",
  "agents",
  "connectors",
  "mission",
  "workflows",
  "settings",
];

function useJarvisState() {
  const [view, setView] = useState<ViewKey>("dashboard");
  const [agents, setAgents] = useState<Agent[]>(seedAgents);
  const [missions, setMissions] = useState<Mission[]>(seedMissions);
  const [notifications, setNotifications] = useState<Notification[]>(seedNotifications);
  const [log, setLog] = useState<LogEntry[]>([
    { id: uid(), text: "Orchestrator core online — 4 agents linked.", at: Date.now() - 600_000 },
    { id: uid(), text: "Mission “Infrastructure Health Check” completed.", at: Date.now() - 3_500_000 },
  ]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: "jarvis",
      text: "Console ready, Gopi. Type a directive or tap a command chip below.",
      at: Date.now() - 5_000,
    },
  ]);
  const [thinking, setThinking] = useState(false);
  const [autonomy, setAutonomy] = useState(72);
  const [density, setDensity] = useState(64);
  const [telemetryOn, setTelemetryOn] = useState(true);
  const [autoDispatch, setAutoDispatch] = useState(true);
  const [confirmDestructive, setConfirmDestructive] = useState(true);
  const [cpu, setCpu] = useState(18);
  const [ram, setRam] = useState(42);
  const [net, setNet] = useState(120.4);

  const stateRef = useRef({ agents, missions, cpu, ram, net, autonomy });
  stateRef.current = { agents, missions, cpu, ram, net, autonomy };

  /* ------- live telemetry ------- */
  useEffect(() => {
    if (!telemetryOn) return;
    const t = setInterval(() => {
      setCpu(14 + Math.round(Math.random() * 16));
      setRam(36 + Math.round(Math.random() * 14));
      setNet(Number((80 + Math.random() * 90).toFixed(1)));
      setAgents((prev) =>
        prev.map((a) =>
          a.status === "running"
            ? { ...a, load: Math.max(8, Math.min(96, a.load + Math.round((Math.random() - 0.5) * 14))) }
            : a,
        ),
      );
    }, 2500);
    return () => clearInterval(t);
  }, [telemetryOn]);

  const pushLog = useCallback((text: string) => {
    setLog((l) => [{ id: uid(), text, at: Date.now() }, ...l].slice(0, 40));
  }, []);

  const pushNotification = useCallback((icon: string, title: string) => {
    setNotifications((n) => [{ id: uid(), icon, title, at: Date.now(), read: false }, ...n].slice(0, 30));
    // surface every signal as a stacked toast so it visibly appears even when
    // the bell panel is closed.
    toast(title, { icon: <span aria-hidden>{icon}</span> });
  }, []);

  /* ------- autonomous mission progress ------- */
  useEffect(() => {
    if (!autoDispatch) return;
    const t = setInterval(() => {
      setMissions((prev) =>
        prev.map((m) => {
          if (m.status !== "progress") return m;
          const next = Math.min(100, m.progress + Math.random() * 4);
          if (next >= 100) {
            queueMicrotask(() => {
              pushNotification("✔", `Mission “${m.title}” completed autonomously.`);
              pushLog(`Mission “${m.title}” reached 100% and closed.`);
            });
            return { ...m, progress: 100, status: "done" as MissionStatus };
          }
          return { ...m, progress: next };
        }),
      );
    }, 3000);
    return () => clearInterval(t);
  }, [autoDispatch, pushLog, pushNotification]);

  const markAllRead = useCallback(
    () => setNotifications((n) => n.map((x) => ({ ...x, read: true }))),
    [],
  );
  const clearNotifications = useCallback(() => setNotifications([]), []);
  const dismissNotification = useCallback(
    (id: string) => setNotifications((n) => n.filter((x) => x.id !== id)),
    [],
  );

  /* ------- agents ------- */
  const setAgentStatus = useCallback(
    (id: string, status: Agent["status"]) => {
      setAgents((prev) =>
        prev.map((a) => {
          if (a.id !== id || a.status === status) return a;
          queueMicrotask(() => {
            pushLog(`${a.name} ${status === "running" ? "activated" : "suspended"}.`);
            pushNotification(status === "running" ? "▶" : "⏸", `${a.name} ${status}.`);
            toast(`${a.name} ${status === "running" ? "activated" : "suspended"}`);
          });
          return {
            ...a,
            status,
            load: status === "running" ? 20 + Math.round(Math.random() * 30) : 0,
            uptimeMin: status === "running" ? 1 : 0,
            tasks: status === "running" ? a.tasks : 0,
          };
        }),
      );
    },
    [pushLog, pushNotification],
  );

  const toggleAgent = useCallback(
    (id: string) => {
      const a = stateRef.current.agents.find((x) => x.id === id);
      if (!a) return;
      setAgentStatus(id, a.status === "running" ? "stopped" : "running");
    },
    [setAgentStatus],
  );

  /* ------- missions ------- */
  const createMission = useCallback(
    (title: string, desc: string) => {
      const m: Mission = {
        id: uid(),
        title,
        desc: desc || "Planned by the orchestrator core.",
        icon: missionIcons[Math.floor(Math.random() * missionIcons.length)] ?? "🎯",
        accent: missionAccents[Math.floor(Math.random() * missionAccents.length)] ?? "var(--cyan-hud)",
        status: "progress",
        progress: 0,
        createdAt: Date.now(),
      };
      setMissions((prev) => [m, ...prev]);
      pushLog(`Mission “${title}” dispatched.`);
      pushNotification("🎯", `New mission dispatched: ${title}`);
      toast.success(`Mission dispatched: ${title}`);
      return m;
    },
    [pushLog, pushNotification],
  );

  const setMissionStatus = useCallback(
    (id: string, status: MissionStatus) => {
      setMissions((prev) =>
        prev.map((m) => {
          if (m.id !== id) return m;
          queueMicrotask(() => pushLog(`Mission “${m.title}” → ${status}.`));
          return { ...m, status, progress: status === "done" ? 100 : m.progress };
        }),
      );
    },
    [pushLog],
  );

  const removeMission = useCallback(
    (id: string) => {
      setMissions((prev) => {
        const m = prev.find((x) => x.id === id);
        if (m) queueMicrotask(() => pushLog(`Mission “${m.title}” removed.`));
        return prev.filter((x) => x.id !== id);
      });
    },
    [pushLog],
  );

  /* ------- console (deterministic command interpreter) ------- */
  const respond = useCallback(
    (text: string): { reply: string; confirm?: boolean } => {
      const q = text.toLowerCase().trim();
      const s = stateRef.current;

      const createMatch = q.match(/^(?:create|new|dispatch|start)\s+mission[:\s]+(.+)$/);
      if (createMatch?.[1]) {
        const title = createMatch[1].trim();
        createMission(title.charAt(0).toUpperCase() + title.slice(1), "Dispatched from the console.");
        return { reply: `Mission “${title}” dispatched and now running.`, confirm: true };
      }

      const navMatch = q.match(/^(?:open|go to|show)\s+(\w+)/);
      if (navMatch?.[1]) {
        const key = VIEWS.find((v) => v.startsWith(navMatch[1]!.slice(0, 4)));
        if (key) {
          setView(key);
          return { reply: `Opening ${key}.`, confirm: true };
        }
      }

      const agentMatch = q.match(/^(start|stop|activate|suspend)\s+(.+)$/);
      if (agentMatch?.[2]) {
        const target = agentMatch[2].trim();
        const a = s.agents.find((x) => x.name.toLowerCase().includes(target));
        if (a) {
          const on = /start|activate/.test(agentMatch[1]!);
          setAgentStatus(a.id, on ? "running" : "stopped");
          return { reply: `${a.name} ${on ? "activated" : "suspended"}.`, confirm: true };
        }
      }

      if (/pause (all|every)? ?mission/.test(q)) {
        s.missions
          .filter((m) => m.status === "progress")
          .forEach((m) => setMissionStatus(m.id, "paused"));
        return { reply: "All active missions paused.", confirm: true };
      }

      if (/status|report|diagnostic|health/.test(q)) {
        return {
          reply: `Systems nominal. CPU ${s.cpu}%, memory ${s.ram}%, network ${s.net} KB/s. ${
            s.agents.filter((a) => a.status === "running").length
          } of ${s.agents.length} agents online, ${
            s.missions.filter((m) => m.status === "progress").length
          } missions in flight.`,
        };
      }

      if (/agents?/.test(q)) {
        return {
          reply: `Online: ${
            s.agents
              .filter((a) => a.status === "running")
              .map((a) => `${a.name} (${a.load}%)`)
              .join(", ") || "none"
          }.`,
        };
      }

      if (/mission|in flight|tasks?/.test(q)) {
        return {
          reply: `In flight: ${
            s.missions
              .filter((m) => m.status === "progress")
              .map((m) => `${m.title} — ${Math.round(m.progress)}%`)
              .join(" · ") || "nothing right now"
          }.`,
        };
      }

      if (/help|command/.test(q)) {
        return {
          reply:
            "Try: “status report”, “create mission: weekly digest”, “stop sentinel”, “pause all missions”, or “open workflows”.",
        };
      }

      return {
        reply: `Logged “${text}”. Say “help” for the command set, or dispatch it as a mission from Mission Control.`,
      };
    },
    [createMission, setAgentStatus, setMissionStatus],
  );

  const sendMessage = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      setMessages((m) => [...m, { id: uid(), role: "user", text: clean, at: Date.now() }]);
      setThinking(true);
      const out = respond(clean);
      window.setTimeout(() => {
        setMessages((m) => [
          ...m,
          {
            id: uid(),
            role: "jarvis",
            text: out.reply,
            at: Date.now(),
            kind: out.confirm ? "confirm" : "normal",
          },
        ]);
        setThinking(false);
      }, 420);
    },
    [respond],
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    toast("Console log cleared");
  }, []);

  const unread = notifications.filter((n) => !n.read).length;

  return {
    view,
    setView,
    agents,
    toggleAgent,
    setAgentStatus,
    missions,
    createMission,
    setMissionStatus,
    removeMission,
    notifications,
    unread,
    pushNotification,
    markAllRead,
    clearNotifications,
    dismissNotification,
    log,
    pushLog,
    messages,
    sendMessage,
    clearChat,
    thinking,
    autonomy,
    setAutonomy,
    density,
    setDensity,
    telemetryOn,
    setTelemetryOn,
    autoDispatch,
    setAutoDispatch,
    confirmDestructive,
    setConfirmDestructive,
    cpu,
    ram,
    net,
    clock,
  };
}

export function JarvisProvider({ children }: { children: ReactNode }) {
  const value = useJarvisState();
  return <JarvisContext.Provider value={value}>{children}</JarvisContext.Provider>;
}

export function useJarvis() {
  const ctx = useContext(JarvisContext);
  if (!ctx) throw new Error("useJarvis must be used inside JarvisProvider");
  return ctx;
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function useStats() {
  const { missions, agents } = useJarvis();
  return useMemo(
    () => ({
      active: missions.filter((m) => m.status === "progress").length,
      paused: missions.filter((m) => m.status === "paused").length,
      done: missions.filter((m) => m.status === "done").length,
      pending: missions.filter((m) => m.status === "pending").length,
      running: agents.filter((a) => a.status === "running").length,
      stopped: agents.filter((a) => a.status === "stopped").length,
    }),
    [missions, agents],
  );
}
