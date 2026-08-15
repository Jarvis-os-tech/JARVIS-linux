import React, { useState, useMemo } from "react";
import {
  Brain,
  Search,
  Plus,
  Trash2,
  Edit3,
  Copy,
  Check,
  Sparkles,
  Clock,
  Database,
  Tag,
  ChevronRight,
  X,
  Layers,
  FileText,
  Radio,
  CheckCircle2,
  Shield,
  Globe,
  Bot,
  Eye,
  User,
  Sliders,
  Terminal,
  Share2,
  RotateCcw,
} from "lucide-react";
import { useJarvis } from "../JarvisProvider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { saveAgentMemory, MemoryFact } from "@/utils/agent_memory";

const DEFAULT_CATEGORIES = [
  { id: "all", label: "All Nodes" },
  { id: "work_context", label: "Work Context" },
  { id: "preference", label: "Preferences" },
  { id: "personal_fact", label: "Personal Facts" },
  { id: "topic", label: "Topics & Intel" },
  { id: "custom", label: "Custom Entities" },
] as const;

const AGENT_MAP: Record<
  string,
  { name: string; title: string; color: string; border: string; bg: string; icon: any }
> = {
  ultron: {
    name: "ULTRON",
    title: "Autonomous Security & Isolation Sentinel",
    color: "#f43f5e",
    border: "border-rose-500/40",
    bg: "rgba(244,63,94,0.12)",
    icon: Shield,
  },
  friday: {
    name: "FRIDAY",
    title: "AI & Tech Research Department Leader",
    color: "#f59e0b",
    border: "border-amber-500/40",
    bg: "rgba(245,158,11,0.12)",
    icon: Globe,
  },
  jarvis: {
    name: "JARVIS",
    title: "Chief Executive Tactical Core & OS Master",
    color: "#06b6d4",
    border: "border-cyan-500/40",
    bg: "rgba(6,182,212,0.12)",
    icon: Bot,
  },
  edith: {
    name: "EDITH",
    title: "Tactical Recon & POSIX Actuator Controller",
    color: "#8b5cf6",
    border: "border-violet-500/40",
    bg: "rgba(139,92,246,0.12)",
    icon: Eye,
  },
  karen: {
    name: "KAREN",
    title: "Infrastructure & Continuous Automation Core",
    color: "#10b981",
    border: "border-emerald-500/40",
    bg: "rgba(16,185,129,0.12)",
    icon: Layers,
  },
  user: {
    name: "OPERATOR",
    title: "User-Defined Knowledge & Directives",
    color: "#38bdf8",
    border: "border-sky-500/40",
    bg: "rgba(56,189,248,0.12)",
    icon: User,
  },
};

export function MemoryView() {
  const { agentMemoryState, setAgentMemoryState, pushLog, pushNotification } = useJarvis();
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedFactId, setSelectedFactId] = useState<string | null>(null);

  // New Memory Form State
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newCategory, setNewCategory] = useState<MemoryFact["category"]>("work_context");
  const [newAgentId, setNewAgentId] = useState<string>("ultron");

  // In-place Editing State for Selected Fact
  const [isEditing, setIsEditing] = useState(false);
  const [editKey, setEditKey] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editCategory, setEditCategory] = useState<MemoryFact["category"]>("work_context");
  const [editAgentId, setEditAgentId] = useState<string>("ultron");
  const [copied, setCopied] = useState(false);

  // Derive memory items enriched with Agent metadata
  const memoryItems = useMemo(() => {
    return agentMemoryState.facts.map((f, i) => {
      // Auto-detect agent if not explicitly defined
      let resolvedAgentId = f.agentId || "user";
      if (!f.agentId) {
        const lowerKey = (f.key || "").toLowerCase();
        const lowerVal = (f.value || "").toLowerCase();
        if (lowerKey.includes("ultron") || lowerVal.includes("firewall") || lowerVal.includes("security") || lowerVal.includes("ports")) {
          resolvedAgentId = "ultron";
        } else if (lowerKey.includes("friday") || lowerVal.includes("briefing") || lowerVal.includes("research") || lowerVal.includes("priorities")) {
          resolvedAgentId = "friday";
        } else if (lowerKey.includes("edith") || lowerVal.includes("actuator") || lowerVal.includes("recon") || lowerVal.includes("posix")) {
          resolvedAgentId = "edith";
        } else if (lowerKey.includes("jarvis") || lowerVal.includes("multilingual") || lowerVal.includes("tactical")) {
          resolvedAgentId = "jarvis";
        }
      }

      const agentInfo = AGENT_MAP[resolvedAgentId.toLowerCase()] || AGENT_MAP.user;

      return {
        ...f,
        id: f.id || `fact-${i}`,
        title: f.key || f.category.toUpperCase(),
        desc: f.value,
        tag: f.category,
        source: f.source || "user_added",
        agentId: resolvedAgentId,
        agentInfo,
        updatedAt: f.updatedAt || new Date().toISOString(),
        color: agentInfo.color,
      };
    });
  }, [agentMemoryState.facts]);

  const filtered = useMemo(() => {
    return memoryItems.filter((m) => {
      const matchesCategory = tag === "all" || m.tag === tag;
      const matchesAgent = agentFilter === "all" || m.agentId.toLowerCase() === agentFilter.toLowerCase();
      const matchesQuery =
        !q ||
        m.title.toLowerCase().includes(q.toLowerCase()) ||
        m.desc.toLowerCase().includes(q.toLowerCase()) ||
        m.agentInfo.name.toLowerCase().includes(q.toLowerCase());
      return matchesCategory && matchesAgent && matchesQuery;
    });
  }, [memoryItems, tag, agentFilter, q]);

  // Active selected fact object (dynamically resolves to first filtered item if none selected)
  const activeFact = useMemo(() => {
    if (selectedFactId) {
      const match = memoryItems.find((f) => f.id === selectedFactId);
      if (match) return match;
    }
    return filtered.length > 0 ? filtered[0] : null;
  }, [memoryItems, selectedFactId, filtered]);

  const startEditing = (fact: typeof memoryItems[0]) => {
    setIsEditing(true);
    setEditKey(fact.key);
    setEditValue(fact.value);
    setEditCategory(fact.category);
    setEditAgentId(fact.agentId || "ultron");
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    if (!activeFact || !editKey.trim() || !editValue.trim()) return;

    const nextFacts = agentMemoryState.facts.map((f) => {
      if (f.id === activeFact.id) {
        return {
          ...f,
          key: editKey.trim(),
          value: editValue.trim(),
          category: editCategory,
          agentId: editAgentId,
          agentName: AGENT_MAP[editAgentId]?.name || editAgentId.toUpperCase(),
          updatedAt: new Date().toISOString(),
        };
      }
      return f;
    });

    const nextState = {
      ...agentMemoryState,
      facts: nextFacts,
      lastUpdated: new Date().toISOString(),
    };

    setAgentMemoryState(nextState);
    saveAgentMemory(nextState);
    pushLog(`Memory node updated: [${editCategory}] ${editKey.trim()} (${editAgentId})`);
    toast.success("Memory node updated successfully");
    setIsEditing(false);
  };

  const handleAddMemory = () => {
    if (!newKey.trim() || !newValue.trim()) {
      toast.error("Please provide both a key/identifier and content value.");
      return;
    }

    const newItem: MemoryFact = {
      id: `fact-${Date.now()}`,
      category: newCategory,
      key: newKey.trim(),
      value: newValue.trim(),
      updatedAt: new Date().toISOString(),
      source: "user_added",
      agentId: newAgentId,
      agentName: AGENT_MAP[newAgentId]?.name || newAgentId.toUpperCase(),
    };

    const nextState = {
      ...agentMemoryState,
      facts: [newItem, ...agentMemoryState.facts],
      lastUpdated: new Date().toISOString(),
    };

    setAgentMemoryState(nextState);
    saveAgentMemory(nextState);
    pushLog(`Memory node added: [${newCategory}] ${newKey.trim()} (${newAgentId})`);
    pushNotification("🧠", `New fact indexed: ${newKey.trim()}`);
    toast.success("Fact added to agent memory graph");
    setSelectedFactId(newItem.id);
    setNewKey("");
    setNewValue("");
    setIsAddOpen(false);
  };

  const handleDeleteMemory = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextState = {
      ...agentMemoryState,
      facts: agentMemoryState.facts.filter((f) => f.id !== id),
      lastUpdated: new Date().toISOString(),
    };
    setAgentMemoryState(nextState);
    saveAgentMemory(nextState);
    if (selectedFactId === id) {
      setSelectedFactId(null);
    }
    pushLog(`Deleted memory node [${id}]`);
    toast("Memory node deleted");
  };

  const handleCopyRaw = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Raw memory text copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInjectContext = (fact: typeof memoryItems[0]) => {
    pushLog(`Injected memory node to active context: [${fact.category}] ${fact.key}`);
    pushNotification("⚡", `Context Injected: ${fact.key}`);
    toast.success(`Context injected to active session: "${fact.key}"`);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3.5 animate-fade-in">
      {/* Top Header Controls */}
      <header className="flex flex-wrap items-end justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display etched text-2xl font-bold tracking-wide">Knowledge Hub &amp; Memory</h1>
            <span className="neu-inset px-2.5 py-0.5 rounded-full text-[10.5px] font-bold text-emerald-hud border border-emerald-500/20 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              {agentMemoryState.facts.length} Active Nodes
            </span>
            <span className="neu-inset px-2.5 py-0.5 rounded-full text-[10px] font-mono text-cyan-hud border border-cyan-500/20 flex items-center gap-1">
              <Database className="w-3 h-3 text-cyan-400" /> SQLite Persistent Graph
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Zero-loss long-term knowledge repository dynamically linked to stored agent telemetry &amp; live session context.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsAddOpen(!isAddOpen);
              setIsEditing(false);
            }}
            className="key flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-cyan-hud glow-ring cursor-pointer"
          >
            {isAddOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            <span>{isAddOpen ? "Close Entry Form" : "Add Memory Node"}</span>
          </button>
        </div>
      </header>

      {/* Add Memory Modal/Form */}
      {isAddOpen && (
        <div className="animate-rise-in neu rounded-2xl p-4 flex flex-col gap-3 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.1)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Index New Fact to Long-Term Memory Graph
            </span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground font-mono">Agent Link:</span>
                <select
                  value={newAgentId}
                  onChange={(e) => setNewAgentId(e.target.value)}
                  className="neu-inset rounded-lg px-2.5 py-1 text-xs text-foreground bg-transparent outline-none cursor-pointer border border-white/10"
                >
                  <option value="ultron" className="bg-slate-900 text-white">ULTRON (Security)</option>
                  <option value="friday" className="bg-slate-900 text-white">FRIDAY (Research)</option>
                  <option value="jarvis" className="bg-slate-900 text-white">JARVIS (Tactical)</option>
                  <option value="edith" className="bg-slate-900 text-white">EDITH (Recon)</option>
                  <option value="karen" className="bg-slate-900 text-white">KAREN (Automation)</option>
                  <option value="user" className="bg-slate-900 text-white">Operator (User)</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground font-mono">Category:</span>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="neu-inset rounded-lg px-2.5 py-1 text-xs text-foreground bg-transparent outline-none cursor-pointer border border-white/10"
                >
                  <option value="work_context" className="bg-slate-900 text-white">Work Context</option>
                  <option value="preference" className="bg-slate-900 text-white">User Preference</option>
                  <option value="personal_fact" className="bg-slate-900 text-white">Personal Fact</option>
                  <option value="topic" className="bg-slate-900 text-white">Topic &amp; Intel</option>
                  <option value="custom" className="bg-slate-900 text-white">Custom Entity</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Key / Identifier (e.g. ULTRON Firewall Policies, Workstation Specs, Primary Codebase)…"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="sm:w-1/3 neu-inset rounded-xl px-3.5 py-2.5 text-xs text-foreground outline-none placeholder:text-muted-foreground border border-white/10 focus:border-cyan-400"
              />
              <input
                type="text"
                placeholder="Full Raw Stored Value / Unmasked Payload…"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddMemory()}
                className="flex-1 neu-inset rounded-xl px-3.5 py-2.5 text-xs text-foreground outline-none placeholder:text-muted-foreground border border-white/10 focus:border-cyan-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setIsAddOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMemory}
                className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-600/20 cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" /> Save to Memory Graph
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 shrink-0">
        <div className="neu-inset flex flex-1 items-center gap-2 rounded-xl px-3.5 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search memory graph (keys, raw values, or agent sources)…"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="text-xs text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Agent Filter Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setAgentFilter("all")}
            className={cn(
              "rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1",
              agentFilter === "all"
                ? "neu-inset text-cyan-hud border border-cyan-500/40"
                : "key text-muted-foreground hover:text-foreground"
            )}
          >
            <Layers className="w-3 h-3" /> All Agents
          </button>
          {Object.entries(AGENT_MAP).map(([id, ag]) => {
            const Icon = ag.icon;
            const isSelected = agentFilter === id;
            return (
              <button
                key={id}
                onClick={() => setAgentFilter(id)}
                style={isSelected ? { color: ag.color, borderColor: ag.color } : undefined}
                className={cn(
                  "rounded-xl px-2.5 py-1.5 text-[11px] font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1",
                  isSelected
                    ? "neu-inset border shadow-sm"
                    : "key text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-3 h-3" />
                {ag.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0">
        {DEFAULT_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setTag(c.id)}
            className={cn(
              "rounded-full px-3 py-1 text-[10.5px] font-bold transition-all cursor-pointer shrink-0",
              tag === c.id
                ? "neu-inset text-cyan-hud border border-cyan-500/40"
                : "key text-muted-foreground hover:text-foreground"
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* 2-Column Responsive Layout (Interactive Card Rail + Main Dynamic Detail Stage) */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-12 gap-3.5 overflow-hidden">
        {/* Left Column: Vertical List of Interactive Memory Cards */}
        <aside className="lg:col-span-4 xl:col-span-4 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between mb-2 px-1 shrink-0">
            <span className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground uppercase flex items-center gap-1">
              <Brain className="w-3.5 h-3.5 text-cyan-400" />
              Stored Cards ({filtered.length})
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              Tap card to inspect
            </span>
          </div>

          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1 pb-4">
            {filtered.map((m) => {
              const isSelected = activeFact?.id === m.id;
              const AgentIcon = m.agentInfo.icon;

              return (
                <article
                  key={m.id}
                  onClick={() => {
                    setSelectedFactId(m.id);
                    setIsEditing(false);
                  }}
                  style={
                    isSelected
                      ? {
                          borderColor: `color-mix(in oklab, ${m.color} 60%, transparent)`,
                          boxShadow: `0 0 16px color-mix(in oklab, ${m.color} 20%, transparent)`,
                          background: `color-mix(in oklab, ${m.color} 6%, transparent)`,
                        }
                      : undefined
                  }
                  className={cn(
                    "neu gloss animate-rise-in rounded-2xl p-3.5 text-left transition-all cursor-pointer relative group flex flex-col justify-between border border-white/5",
                    isSelected
                      ? "neu-inset border"
                      : "hover:border-white/20 hover:-translate-y-0.5 hover:bg-white/[0.02]"
                  )}
                >
                  <div>
                    {/* Agent Header & Actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="neu-inset grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sm border border-white/5"
                          style={{ color: m.color }}
                        >
                          <AgentIcon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0">
                          <span
                            className="text-[9.5px] font-mono font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded neu-inset inline-block"
                            style={{ color: m.color }}
                          >
                            {m.agentInfo.name}
                          </span>
                          <h3 className="text-[12.5px] font-bold tracking-wide text-foreground truncate mt-0.5">
                            {m.title}
                          </h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFactId(m.id);
                            startEditing(m);
                          }}
                          className="p-1 text-muted-foreground hover:text-cyan-400 rounded-md hover:bg-white/5 cursor-pointer"
                          title="Edit Memory Fact"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteMemory(m.id, e)}
                          className="p-1 text-muted-foreground hover:text-rose-400 rounded-md hover:bg-white/5 cursor-pointer"
                          title="Delete Fact"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <ChevronRight
                          className={cn(
                            "w-3.5 h-3.5 text-muted-foreground transition-transform",
                            isSelected && "text-cyan-400 translate-x-0.5"
                          )}
                        />
                      </div>
                    </div>

                    {/* Excerpt */}
                    <div className="mt-2.5 neu-inset rounded-xl p-2.5 bg-black/30 border border-white/5">
                      <p className="text-[11.5px] leading-relaxed text-muted-foreground font-sans line-clamp-2 break-words">
                        {m.desc}
                      </p>
                    </div>
                  </div>

                  {/* Card Footer Metadata */}
                  <div className="mt-2.5 flex items-center justify-between text-[9.5px] text-muted-foreground font-mono pt-1 border-t border-white/5">
                    <span className="flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5 text-muted-foreground" />
                      {new Date(m.updatedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span className="capitalize text-muted-foreground/80">{m.tag.replace("_", " ")}</span>
                    <span className="text-muted-foreground/60">{m.desc.length} chars</span>
                  </div>
                </article>
              );
            })}

            {filtered.length === 0 && (
              <div className="neu rounded-2xl py-12 px-4 text-center">
                <Brain className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-xs font-semibold text-muted-foreground">
                  No memory cards match this filter.
                </p>
                <button
                  onClick={() => {
                    setQ("");
                    setTag("all");
                    setAgentFilter("all");
                  }}
                  className="mt-3 key px-3 py-1.5 rounded-xl text-[11px] font-bold text-cyan-hud cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Right / Central Dynamic Detail Area: Displays Complete Unmasked Content */}
        <section className="lg:col-span-8 xl:col-span-8 flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between mb-2 px-1 shrink-0">
            <span className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground uppercase flex items-center gap-1">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              Main Detailed Memory Inspector
            </span>
            {activeFact && (
              <span className="text-[10px] font-mono text-cyan-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Live Injected to Session
              </span>
            )}
          </div>

          <div className="neu gloss min-h-0 flex-1 flex flex-col rounded-2xl p-5 overflow-y-auto border border-white/10 shadow-2xl">
            {activeFact ? (
              <div className="flex flex-col gap-4 flex-1">
                {/* Agent Header Banner */}
                <div
                  className="rounded-2xl p-3.5 flex items-center justify-between gap-3 border transition-colors"
                  style={{
                    backgroundColor: activeFact.agentInfo.bg,
                    borderColor: `color-mix(in oklab, ${activeFact.color} 35%, transparent)`,
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="neu-inset grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg shadow-md"
                      style={{ color: activeFact.color }}
                    >
                      {React.createElement(activeFact.agentInfo.icon, { className: "h-5 w-5" })}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs font-mono font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full neu-inset shadow-inner"
                          style={{ color: activeFact.color }}
                        >
                          {activeFact.agentInfo.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                          {activeFact.agentInfo.title}
                        </span>
                      </div>
                      <h2 className="text-base font-bold tracking-wide text-foreground mt-1 break-words">
                        {activeFact.title}
                      </h2>
                    </div>
                  </div>

                  {/* Toolbar Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleCopyRaw(activeFact.desc)}
                      title="Copy Full Raw Payload"
                      className="key p-2 rounded-xl text-muted-foreground hover:text-cyan-400 cursor-pointer flex items-center gap-1 text-xs"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
                    </button>
                    {!isEditing && (
                      <button
                        onClick={() => startEditing(activeFact)}
                        title="Edit Node In-Place"
                        className="key p-2 rounded-xl text-muted-foreground hover:text-cyan-400 cursor-pointer flex items-center gap-1 text-xs"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteMemory(activeFact.id)}
                      title="Delete Node"
                      className="key p-2 rounded-xl text-muted-foreground hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Edit Form or Complete Raw Content Display */}
                {isEditing ? (
                  <div className="flex flex-col gap-3 animate-fade-in flex-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10.5px] font-bold text-muted-foreground tracking-wider uppercase block mb-1">
                          Key / Identifier
                        </label>
                        <input
                          type="text"
                          value={editKey}
                          onChange={(e) => setEditKey(e.target.value)}
                          className="w-full neu-inset rounded-xl px-3.5 py-2.5 text-xs text-foreground outline-none border border-white/10 focus:border-cyan-400"
                        />
                      </div>

                      <div>
                        <label className="text-[10.5px] font-bold text-muted-foreground tracking-wider uppercase block mb-1">
                          Attributed Agent Link
                        </label>
                        <select
                          value={editAgentId}
                          onChange={(e) => setEditAgentId(e.target.value)}
                          className="w-full neu-inset rounded-xl px-3.5 py-2 text-xs text-foreground bg-transparent outline-none cursor-pointer border border-white/10"
                        >
                          <option value="ultron" className="bg-slate-900 text-white">ULTRON (Security Sentinel)</option>
                          <option value="friday" className="bg-slate-900 text-white">FRIDAY (AI &amp; Research)</option>
                          <option value="jarvis" className="bg-slate-900 text-white">JARVIS (Tactical Core)</option>
                          <option value="edith" className="bg-slate-900 text-white">EDITH (Recon &amp; Actuators)</option>
                          <option value="karen" className="bg-slate-900 text-white">KAREN (Automation)</option>
                          <option value="user" className="bg-slate-900 text-white">Operator (Direct User)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10.5px] font-bold text-muted-foreground tracking-wider uppercase block mb-1">
                        Category Classification
                      </label>
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value as any)}
                        className="w-full neu-inset rounded-xl px-3.5 py-2 text-xs text-foreground bg-transparent outline-none cursor-pointer border border-white/10"
                      >
                        <option value="work_context" className="bg-slate-900 text-white">Work Context</option>
                        <option value="preference" className="bg-slate-900 text-white">User Preference</option>
                        <option value="personal_fact" className="bg-slate-900 text-white">Personal Fact</option>
                        <option value="topic" className="bg-slate-900 text-white">Topic &amp; Intel</option>
                        <option value="custom" className="bg-slate-900 text-white">Custom Entity</option>
                      </select>
                    </div>

                    <div className="flex-1 flex flex-col min-h-[160px]">
                      <label className="text-[10.5px] font-bold text-muted-foreground tracking-wider uppercase block mb-1">
                        Raw Text Content Payload
                      </label>
                      <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        rows={7}
                        className="w-full flex-1 neu-inset rounded-xl p-3.5 text-xs font-mono text-foreground outline-none resize-none border border-white/10 focus:border-cyan-400 leading-relaxed bg-black/40"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        onClick={cancelEditing}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" /> Save Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 flex-1">
                    {/* Full Raw Content Display */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10.5px] font-bold text-muted-foreground tracking-wider uppercase flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-cyan-400" />
                          Complete Raw Content (Unmasked &amp; Zero Truncation)
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {activeFact.desc.length} characters · {new Blob([activeFact.desc]).size} bytes
                        </span>
                      </div>
                      <div className="neu-inset rounded-xl p-4 bg-black/40 border border-white/5 selection:bg-cyan-500/30">
                        <p className="text-[13px] leading-relaxed font-mono text-cyan-200/90 break-words whitespace-pre-wrap select-all">
                          {activeFact.desc}
                        </p>
                      </div>
                    </div>

                    {/* System Prompt Injected Format */}
                    <div>
                      <span className="text-[10.5px] font-bold text-muted-foreground tracking-wider uppercase block mb-1.5 flex items-center gap-1">
                        <Radio className="w-3.5 h-3.5 text-emerald-400" />
                        Live Injected System Prompt Syntax
                      </span>
                      <div className="neu-inset rounded-xl p-3 bg-black/25 text-[11px] font-mono text-muted-foreground border border-white/5">
                        <code>- [{activeFact.tag.toUpperCase()}] ({activeFact.agentInfo.name}) {activeFact.key}: {activeFact.value}</code>
                      </div>
                    </div>

                    {/* Metadata & Actions */}
                    <div className="mt-auto space-y-3 pt-3 border-t border-white/10">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10.5px] font-mono">
                        <div className="neu-inset rounded-lg p-2.5">
                          <span className="text-muted-foreground block text-[9px]">SOURCE AGENT</span>
                          <span className="text-foreground font-bold flex items-center gap-1 mt-0.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeFact.color }} />
                            {activeFact.agentInfo.name}
                          </span>
                        </div>
                        <div className="neu-inset rounded-lg p-2.5">
                          <span className="text-muted-foreground block text-[9px]">CATEGORY CLASSIFICATION</span>
                          <span className="text-foreground font-bold capitalize mt-0.5 block">
                            {activeFact.tag.replace("_", " ")}
                          </span>
                        </div>
                        <div className="neu-inset rounded-lg p-2.5">
                          <span className="text-muted-foreground block text-[9px]">LAST SYNCHRONIZED</span>
                          <span className="text-foreground font-bold mt-0.5 block">
                            {new Date(activeFact.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleInjectContext(activeFact)}
                          className="flex-1 key flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold text-cyan-hud hover:text-foreground cursor-pointer shadow-md"
                        >
                          <Radio className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Inject Into Active Session</span>
                        </button>
                        <button
                          onClick={() => startEditing(activeFact)}
                          className="key flex items-center justify-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-16 px-4">
                <Brain className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <h3 className="text-sm font-bold text-foreground">No Memory Card Selected</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Click any memory card from the left panel to inspect its full raw text payload, edit content in-place, or inject into live conversational reasoning.
                </p>
                <button
                  onClick={() => setIsAddOpen(true)}
                  className="mt-4 key px-4 py-2 rounded-xl text-xs font-bold text-cyan-hud cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Create New Memory Node
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
