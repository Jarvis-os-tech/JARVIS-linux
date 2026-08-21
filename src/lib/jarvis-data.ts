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
  role: "user" | "jarvis" | "system";
  text: string;
  at: number;
  kind?: "confirm" | "normal" | "error" | "action" | "tool_call";
  imageUrl?: string;
  personaId?: string;
  personaName?: string;
  source?: "voice" | "text" | "relay" | "system";
  actionDetails?: string;
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
  | "connectors"
  | "mission"
  | "settings";

export const uid = () => Math.random().toString(36).slice(2, 10);

export const seedAgents: Agent[] = [
  {
    id: "jarvis",
    name: "JARVIS",
    desc: "Sovereign AI Chief of Staff & Tactical Operating Partner. Autonomous Linux Control & Spatial Stage.",
    icon: "◎",
    accent: "var(--cyan-hud)",
    status: "running",
    tasks: 0,
    uptimeMin: 0,
    load: 0,
    voiceName: "Puck"
  }
];

export const seedMissions: Mission[] = [
  {
    id: "m-briefing",
    title: "Morning Executive Briefing",
    desc: "Aggregate overnight telemetry, check Google Calendar, triage emails, and prepare daily summary.",
    icon: "☀",
    accent: "var(--amber-hud)",
    status: "progress",
    progress: 70,
    createdAt: Date.now() - 3600000,
  },
];

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
