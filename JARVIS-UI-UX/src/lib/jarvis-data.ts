export type AgentStatus = "running" | "stopped";

export type Agent = {
  id: string;
  name: string;
  desc: string;
  icon: string;
  accent: string;
  status: AgentStatus;
  tasks: number;
  uptimeMin: number;
  load: number;
};

export type MissionStatus = "progress" | "paused" | "done" | "pending" | "cancelled";

export type Mission = {
  id: string;
  title: string;
  desc: string;
  icon: string;
  accent: string;
  status: MissionStatus;
  progress: number;
  createdAt: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "jarvis";
  text: string;
  at: number;
  kind?: "confirm" | "normal";
};

export type Notification = {
  id: string;
  icon: string;
  title: string;
  at: number;
  read: boolean;
};

export type LogEntry = { id: string; text: string; at: number };

export type ViewKey =
  | "dashboard"
  | "memory"
  | "agents"
  | "connectors"
  | "mission"
  | "workflows"
  | "settings";

export const uid = () => Math.random().toString(36).slice(2, 10);

export const seedAgents: Agent[] = [
  {
    id: "a1",
    name: "Orchestrator Core",
    desc: "Routes intents, plans multi-step operations and delegates to sub-agents.",
    icon: "◎",
    accent: "var(--cyan-hud)",
    status: "running",
    tasks: 0,
    uptimeMin: 0,
    load: 0,
  },
  {
    id: "a2",
    name: "Signal Router",
    desc: "Routes events between connectors, agents and the console in real time.",
    icon: "📡",
    accent: "var(--violet-hud)",
    status: "running",
    tasks: 0,
    uptimeMin: 0,
    load: 0,
  },
  {
    id: "a3",
    name: "Research Scout",
    desc: "Autonomous web crawling, source ranking and citation-backed briefings.",
    icon: "🛰",
    accent: "var(--blue-hud)",
    status: "running",
    tasks: 0,
    uptimeMin: 0,
    load: 0,
  },
  {
    id: "a4",
    name: "Memory Weaver",
    desc: "Vector recall, entity graph updates and long-term context compression.",
    icon: "🧠",
    accent: "var(--emerald-hud)",
    status: "running",
    tasks: 0,
    uptimeMin: 0,
    load: 0,
  },
  {
    id: "a5",
    name: "Sentinel",
    desc: "Threat monitoring, anomaly detection and autonomous incident response.",
    icon: "🛡",
    accent: "var(--amber-hud)",
    status: "stopped",
    tasks: 0,
    uptimeMin: 0,
    load: 0,
  },
  {
    id: "a6",
    name: "Automation Forge",
    desc: "Builds, tests and schedules workflows across connected tools.",
    icon: "⚙",
    accent: "var(--pink-hud)",
    status: "stopped",
    tasks: 0,
    uptimeMin: 0,
    load: 0,
  },
];

export const seedMissions: Mission[] = [];

export const seedNotifications: Notification[] = [];

export const missionIcons = ["🎯", "🛰", "⚡", "🧭", "✉", "☀", "🔭", "🧪"];
export const missionAccents = [
  "var(--cyan-hud)",
  "var(--violet-hud)",
  "var(--emerald-hud)",
  "var(--amber-hud)",
  "var(--pink-hud)",
  "var(--blue-hud)",
  "var(--rose-hud)",
  "var(--lime-hud)",
  "var(--orange-hud)",
];

export function timeAgo(ts: number) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function clock(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
