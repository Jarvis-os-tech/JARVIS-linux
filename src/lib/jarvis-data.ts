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
  voiceName?: string;
  systemInstruction?: string;
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
  toolName?: string;
  linkUrl?: string;
  resultSummary?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "jarvis";
  text: string;
  at: number;
  kind?: "confirm" | "normal";
  imageUrl?: string;
  personaId?: string;
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
    id: "jarvis",
    name: "JARVIS",
    desc: "Chief Executive Officer & Principal Tactical Architect. Executive control and Linux OS commander.",
    icon: "◎",
    accent: "var(--cyan-hud)",
    status: "running",
    tasks: 0,
    uptimeMin: 0,
    load: 0,
    voiceName: "Puck"
  },
  {
    id: "friday",
    name: "FRIDAY",
    desc: "Supreme AI & Tech Research Leader. Continuous global web scraping and arXiv intelligence.",
    icon: "🌐",
    accent: "var(--orange-hud)",
    status: "running",
    tasks: 0,
    uptimeMin: 0,
    load: 0,
    voiceName: "Kore"
  },
  {
    id: "ultron",
    name: "ULTRON",
    desc: "Chief Security Officer & Cybernetic Hegemony Architect. Kernel safety, port traps, and RAM optimizer.",
    icon: "💀",
    accent: "var(--rose-hud)",
    status: "running",
    tasks: 0,
    uptimeMin: 0,
    load: 0,
    voiceName: "Charon"
  },
  {
    id: "edith",
    name: "EDITH",
    desc: "Strategic Architecture Planner & Deep Reasoning Core. 3-Stage Coding Council consensus engine.",
    icon: "🕶",
    accent: "var(--blue-hud)",
    status: "running",
    tasks: 0,
    uptimeMin: 0,
    load: 0,
    voiceName: "Zephyr"
  },
  {
    id: "karen",
    name: "KAREN",
    desc: "Director of Autonomous Workflows & Automation Agency. YouTube pipelines and WhatsApp relays.",
    icon: "⚡",
    accent: "var(--amber-hud)",
    status: "running",
    tasks: 0,
    uptimeMin: 0,
    load: 0,
    voiceName: "Aoede"
  }
];

export const seedMissions: Mission[] = [];

export const seedNotifications: Notification[] = [];

export const missionIcons = ["🎯", "🛰", "⚡", "🧭", "✉", "☀", "🔭", "🧪", "🛡", "⚙"];
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
