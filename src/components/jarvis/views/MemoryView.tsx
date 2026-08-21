import React, { useState, useMemo, useEffect } from "react";
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
  Zap,
  Code2,
  FileCode,
  CopyCheck,
  Cpu,
  Info,
  Network,
  RefreshCw,
  Compass,
} from "lucide-react";
import { useJarvis } from "../JarvisProvider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { saveAgentMemory, MemoryFact } from "@/utils/agent_memory";
import { InteractiveMemoryGraph } from "../memory/InteractiveMemoryGraph";
import { GraphNodeData, GraphLinkData } from "../memory/memoryGraphLayout";

const DEFAULT_CATEGORIES = [
  { id: "all", label: "All Nodes", icon: Database },
  { id: "work_context", label: "Work Context", icon: Layers },
  { id: "preference", label: "Preferences", icon: Sliders },
  { id: "personal_fact", label: "Personal Facts", icon: User },
  { id: "topic", label: "Topics & Intel", icon: Globe },
  { id: "custom", label: "Custom Entities", icon: Sparkles },
] as const;

export const SOVEREIGN_SPHERES: Record<
  string,
  { name: string; title: string; color: string; border: string; bg: string; icon: any; role: string }
> = {
  system_os: {
    name: "SYSTEM & OS",
    title: "Linux Kernel, Hardware Sensors & C++ Actuators",
    color: "#06b6d4",
    border: "border-cyan-500/40",
    bg: "rgba(6,182,212,0.12)",
    icon: Cpu,
    role: "System Actuation & Telemetry",
  },
  operator_profile: {
    name: "OPERATOR",
    title: "Gopi's Profile, Preferences & Telgish Protocols",
    color: "#38bdf8",
    border: "border-sky-500/40",
    bg: "rgba(56,189,248,0.12)",
    icon: User,
    role: "Operator Directives",
  },
  knowledge_intel: {
    name: "INTELLIGENCE",
    title: "Grounded Research, Executive Briefings & arXiv",
    color: "#f59e0b",
    border: "border-amber-500/40",
    bg: "rgba(245,158,11,0.12)",
    icon: Globe,
    role: "Research & Grounded Intel",
  },
  codebase_dev: {
    name: "CODEBASE",
    title: "Codebase Knowledge Graph, AST & Git Architecture",
    color: "#8b5cf6",
    border: "border-violet-500/40",
    bg: "rgba(139,92,246,0.12)",
    icon: Code2,
    role: "Codebase Memory & Graph",
  },
  workspace_ops: {
    name: "WORKSPACE",
    title: "Google Workspace, Gmail, Calendar, Docs & Drive",
    color: "#10b981",
    border: "border-emerald-500/40",
    bg: "rgba(16,185,129,0.12)",
    icon: Layers,
    role: "Cloud Services & Tasks",
  },
  security_groundtruth: {
    name: "GROUND TRUTH",
    title: "Zero-Hallucination Contract & Capability Guardrails",
    color: "#f43f5e",
    border: "border-rose-500/40",
    bg: "rgba(244,63,94,0.12)",
    icon: Shield,
    role: "Security & Anti-Hallucination",
  },
};

export const AGENT_MAP = SOVEREIGN_SPHERES;

const CATEGORY_STYLES: Record<string, { label: string; badgeCls: string }> = {
  work_context: { label: "Work Context", badgeCls: "text-blue-400 border-blue-500/30 bg-blue-500/10" },
  preference: { label: "Preference", badgeCls: "text-rose-400 border-rose-500/30 bg-rose-500/10" },
  personal_fact: { label: "Personal Fact", badgeCls: "text-purple-400 border-purple-500/30 bg-purple-500/10" },
  topic: { label: "Topic & Intel", badgeCls: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  custom: { label: "Custom Entity", badgeCls: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10" },
};

export function MemoryView() {
  const { agentMemoryState, setAgentMemoryState, pushLog, pushNotification } = useJarvis();
  const [viewMode, setViewMode] = useState<"graph" | "cards">("graph");
  const [vaultStats, setVaultStats] = useState<any>(null);
  const [isFlushing, setIsFlushing] = useState(false);

  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedFactId, setSelectedFactId] = useState<string | null>(null);

  // Fetch Universal Memory Status on mount
  useEffect(() => {
    fetch("/api/memory/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setVaultStats(data);
      })
      .catch(() => {});
  }, []);

  const handleFlushBuffers = async () => {
    setIsFlushing(true);
    try {
      const res = await fetch("/api/memory/flush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stale_threshold_secs: 0 }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Flushed ${data.flushed_buffers} buffer(s) into ${data.sealed_summaries?.length || 0} summary notes.`);
        fetch("/api/memory/status")
          .then((r) => r.json())
          .then((d) => d.success && setVaultStats(d));
      }
    } catch (err: any) {
      toast.error(`Flush failed: ${err.message}`);
    } finally {
      setIsFlushing(false);
    }
  };

  // New Memory Form State
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newCategory, setNewCategory] = useState<MemoryFact["category"]>("work_context");
  const [newAgentId, setNewAgentId] = useState<string>("system_os");

  // In-place Editing State for Selected Fact
  const [isEditing, setIsEditing] = useState(false);
  const [editKey, setEditKey] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editCategory, setEditCategory] = useState<MemoryFact["category"]>("work_context");
  const [editAgentId, setEditAgentId] = useState<string>("system_os");
  const [copied, setCopied] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Derive memory items enriched with Sovereign Sphere metadata
  const memoryItems = useMemo(() => {
    return agentMemoryState.facts.map((f, i) => {
      let resolvedSphereId = f.agentId || "operator_profile";
      if (!f.agentId || !SOVEREIGN_SPHERES[f.agentId]) {
        const lowerKey = (f.key || "").toLowerCase();
        const lowerVal = (f.value || "").toLowerCase();
        if (
          lowerKey.includes("firewall") ||
          lowerKey.includes("security") ||
          lowerKey.includes("ground") ||
          lowerKey.includes("truth") ||
          lowerKey.includes("boundary") ||
          lowerVal.includes("hallucination") ||
          lowerVal.includes("security") ||
          lowerKey.includes("ultron")
        ) {
          resolvedSphereId = "security_groundtruth";
        } else if (
          lowerKey.includes("system") ||
          lowerKey.includes("actuator") ||
          lowerKey.includes("posix") ||
          lowerKey.includes("telemetry") ||
          lowerVal.includes("c++") ||
          lowerVal.includes("mutter") ||
          lowerKey.includes("edith")
        ) {
          resolvedSphereId = "system_os";
        } else if (
          lowerKey.includes("briefing") ||
          lowerKey.includes("research") ||
          lowerKey.includes("intel") ||
          lowerVal.includes("arxiv") ||
          lowerVal.includes("search") ||
          lowerKey.includes("friday")
        ) {
          resolvedSphereId = "knowledge_intel";
        } else if (
          lowerKey.includes("codebase") ||
          lowerKey.includes("ast") ||
          lowerKey.includes("graph") ||
          lowerVal.includes("repo")
        ) {
          resolvedSphereId = "codebase_dev";
        } else if (
          lowerKey.includes("workspace") ||
          lowerKey.includes("gmail") ||
          lowerKey.includes("calendar") ||
          lowerVal.includes("google") ||
          lowerKey.includes("karen")
        ) {
          resolvedSphereId = "workspace_ops";
        } else {
          resolvedSphereId = "operator_profile";
        }
      }

      const sphereInfo = SOVEREIGN_SPHERES[resolvedSphereId.toLowerCase()] || SOVEREIGN_SPHERES.operator_profile;

      return {
        ...f,
        id: f.id || `fact-${i}`,
        title: f.key || f.category.toUpperCase(),
        desc: f.value,
        tag: f.category,
        source: f.source || "user_added",
        agentId: resolvedSphereId,
        sphereInfo,
        agentInfo: sphereInfo,
        updatedAt: f.updatedAt || new Date().toISOString(),
        color: sphereInfo.color,
      };
    });
  }, [agentMemoryState.facts]);

  // Construct Sovereign Knowledge Graph Nodes & Links
  const { graphNodes, graphLinks } = useMemo(() => {
    const nodes: GraphNodeData[] = [];
    const links: GraphLinkData[] = [];

    // 1. Root Master Hub
    nodes.push({
      id: "root-jarvis",
      title: "J.A.R.V.I.S. Core Brain",
      content: "Central neural orchestrator and root universal memory vault.",
      kind: "root",
      level: 0,
      importance: 1.0,
      radius: 22,
    });

    // 2. Sovereign Knowledge Spheres Sub-Hubs
    const sphereHubs = [
      { id: "hub-system_os", title: "System & Linux Actuators", sphereId: "system_os", color: "#06B6D4" },
      { id: "hub-operator_profile", title: "Operator Profile & Directives", sphereId: "operator_profile", color: "#38BDF8" },
      { id: "hub-knowledge_intel", title: "Intelligence & Research", sphereId: "knowledge_intel", color: "#F59E0B" },
      { id: "hub-codebase_dev", title: "Codebase Architecture & AST", sphereId: "codebase_dev", color: "#8B5CF6" },
      { id: "hub-workspace_ops", title: "Workspace & Cloud Tasks", sphereId: "workspace_ops", color: "#10B981" },
      { id: "hub-security_groundtruth", title: "Security & Ground Truth", sphereId: "security_groundtruth", color: "#F43F5E" },
    ];

    for (const hub of sphereHubs) {
      nodes.push({
        id: hub.id,
        title: hub.title,
        content: `Sovereign knowledge cluster for ${hub.title}`,
        kind: "source",
        scope: hub.sphereId,
        level: 1,
        color: hub.color,
        radius: 16,
      });

      links.push({
        source: "root-jarvis",
        target: hub.id,
        strength: 0.8,
      });
    }

    // 3. Memory Fact Leaf Nodes
    for (const item of memoryItems) {
      const parentHubId = `hub-${item.agentId.toLowerCase()}`;
      nodes.push({
        id: item.id,
        title: item.title,
        content: item.desc,
        kind: (item.tag === "preference" ? "preference" : item.tag === "work_context" ? "decision" : item.tag === "personal_fact" ? "fact" : "pattern") as any,
        scope: item.agentId,
        importance: 0.8,
        tags: [item.tag, item.agentId],
        color: item.color,
      });

      links.push({
        source: parentHubId,
        target: item.id,
        strength: 0.6,
      });
    }

    return { graphNodes: nodes, graphLinks: links };
  }, [memoryItems]);

  const filtered = useMemo(() => {
    return memoryItems.filter((m) => {
      const matchesCategory = tag === "all" || m.tag === tag;
      const matchesAgent =
        agentFilter === "all" || m.agentId.toLowerCase() === agentFilter.toLowerCase();
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
    setEditAgentId(fact.agentId || "system_os");
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
          agentName: SOVEREIGN_SPHERES[editAgentId]?.name || editAgentId.toUpperCase(),
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
      agentName: SOVEREIGN_SPHERES[newAgentId]?.name || newAgentId.toUpperCase(),
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

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    toast.success("Memory Entity ID copied");
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleInjectContext = (fact: typeof memoryItems[0]) => {
    pushLog(`Injected memory node to active context: [${fact.category}] ${fact.key}`);
    pushNotification("⚡", `Context Injected: ${fact.key}`);
    toast.success(`Context injected to active session: "${fact.key}"`);
  };

  const handleDuplicate = (fact: typeof memoryItems[0]) => {
    const dupItem: MemoryFact = {
      id: `fact-${Date.now()}`,
      category: fact.category,
      key: `${fact.key} (Copy)`,
      value: fact.value,
      updatedAt: new Date().toISOString(),
      source: "user_added",
      agentId: fact.agentId,
      agentName: fact.agentName,
    };
    const nextState = {
      ...agentMemoryState,
      facts: [dupItem, ...agentMemoryState.facts],
      lastUpdated: new Date().toISOString(),
    };
    setAgentMemoryState(nextState);
    saveAgentMemory(nextState);
    setSelectedFactId(dupItem.id);
    toast.success("Memory node duplicated");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 animate-fade-in">
      {/* Top Header Controls */}
      <header className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-display etched text-2xl font-bold tracking-wide text-foreground">
              Knowledge Hub &amp; Memory
            </h1>
            <span className="neu-inset px-2.5 py-0.5 rounded-full text-[10.5px] font-bold text-emerald-hud border border-emerald-500/20 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              {agentMemoryState.facts.length} Active Nodes
            </span>
            <span className="neu-inset px-2.5 py-0.5 rounded-full text-[10px] font-mono text-cyan-hud border border-cyan-500/20 flex items-center gap-1">
              <Database className="w-3 h-3 text-cyan-400" /> {vaultStats ? `Rust WAL (${vaultStats.node_count || agentMemoryState.facts.length} nodes)` : "SQLite Persistent Graph"}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Zero-loss long-term knowledge repository dynamically linked to stored agent telemetry &amp; live session context.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle: 3D Brain Graph vs Ledger View */}
          <div className="flex items-center bg-slate-900/90 border border-slate-700/60 rounded-xl p-0.5 shadow-sm">
            <button
              onClick={() => setViewMode("graph")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                viewMode === "graph"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              <Network className="w-3.5 h-3.5" />
              <span>3D Brain Graph</span>
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                viewMode === "cards"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Ledger View</span>
            </button>
          </div>

          <button
            onClick={handleFlushBuffers}
            disabled={isFlushing}
            className="neu-inset px-3 py-1.5 rounded-xl text-xs font-semibold text-purple-300 hover:text-purple-200 border border-purple-500/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Consolidate unsealed memory buffers into L1 summaries"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isFlushing && "animate-spin")} />
            <span>{isFlushing ? "Flushing..." : "Flush Buffers"}</span>
          </button>

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
        <div className="animate-rise-in neu rounded-2xl p-4 flex flex-col gap-3 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.1)] shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Index New Fact to Long-Term Memory Graph
            </span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground font-mono">Knowledge Sphere:</span>
                <select
                  value={newAgentId}
                  onChange={(e) => setNewAgentId(e.target.value)}
                  className="neu-inset rounded-lg px-2.5 py-1 text-xs text-foreground bg-transparent outline-none cursor-pointer border border-white/10"
                >
                  <option value="system_os" className="bg-slate-900 text-white">System &amp; OS (Linux &amp; C++ Actuators)</option>
                  <option value="operator_profile" className="bg-slate-900 text-white">Operator Profile &amp; Directives</option>
                  <option value="knowledge_intel" className="bg-slate-900 text-white">Intelligence &amp; Research</option>
                  <option value="codebase_dev" className="bg-slate-900 text-white">Codebase Architecture &amp; AST</option>
                  <option value="workspace_ops" className="bg-slate-900 text-white">Workspace &amp; Cloud Tasks</option>
                  <option value="security_groundtruth" className="bg-slate-900 text-white">Security &amp; Ground Truth</option>
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
                placeholder="Key / Identifier (e.g. System Actuator Specs, Gopi Profile, Ground Truth Boundaries)…"
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
            placeholder="Search memory graph (keys, raw values, or knowledge spheres)…"
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

        {/* Sovereign Spheres Filter Selector */}
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
            <Layers className="w-3 h-3" /> All Spheres
          </button>
          {Object.entries(SOVEREIGN_SPHERES).map(([id, ag]) => {
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
        {DEFAULT_CATEGORIES.map((c) => {
          const CatIcon = c.icon;
          return (
            <button
              key={c.id}
              onClick={() => setTag(c.id)}
              className={cn(
                "rounded-full px-3 py-1 text-[10.5px] font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5",
                tag === c.id
                  ? "neu-inset text-cyan-hud border border-cyan-500/40 shadow-sm"
                  : "key text-muted-foreground hover:text-foreground"
              )}
            >
              <CatIcon className="w-3 h-3" />
              <span>{c.label}</span>
            </button>
          );
        })}
      </div>

      {/* MAIN VIEW AREA: Conditional 3D Brain Graph vs 2-Column Ledger */}
      {viewMode === "graph" ? (
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3.5 overflow-hidden">
          <div className="flex-1 min-h-[480px]">
            <InteractiveMemoryGraph
              nodes={graphNodes}
              links={graphLinks}
              searchFilter={q}
              scopeFilter={agentFilter}
              selectedNodeId={selectedFactId}
              onSelectNode={(node) => {
                if (node) {
                  setSelectedFactId(node.id);
                }
              }}
            />
          </div>

          {/* Side Drawer for Node Inspection in Graph View */}
          {activeFact && (
            <div className="w-full lg:w-88 neu rounded-2xl p-4 border border-cyan-500/30 bg-slate-900/90 backdrop-blur-xl flex flex-col gap-3 shrink-0 overflow-y-auto max-h-[640px] shadow-2xl">
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border"
                  style={{
                    backgroundColor: `${activeFact.color}20`,
                    color: activeFact.color,
                    borderColor: `${activeFact.color}50`,
                  }}
                >
                  {activeFact.tag}
                </span>
                <span className="text-xs font-mono text-muted-foreground">{activeFact.agentInfo.name}</span>
              </div>

              <h3 className="text-sm font-bold text-white">{activeFact.title}</h3>

              <div className="neu-inset rounded-xl p-3 bg-slate-950/70 border border-white/5 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                {activeFact.desc}
              </div>

              <div className="flex flex-wrap gap-1">
                <span className="neu-inset px-2 py-0.5 rounded text-[10px] font-mono text-cyan-400 border border-cyan-500/20">
                  #{activeFact.tag}
                </span>
                <span className="neu-inset px-2 py-0.5 rounded text-[10px] font-mono text-muted-foreground border border-white/5">
                  source:{activeFact.source}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-white/10 mt-auto">
                <span>Updated: {new Date(activeFact.updatedAt).toLocaleTimeString()}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyRaw(activeFact.desc)}
                    className="hover:text-cyan-400 flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                  <button
                    onClick={() => handleInjectContext(activeFact)}
                    className="hover:text-amber-400 flex items-center gap-1 cursor-pointer"
                  >
                    <Zap className="w-3 h-3" /> Inject
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* 2-Column Responsive Layout (Left: Card Grid Matrix | Right: Memory Rail Detail View Panel) */
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-12 gap-3.5 overflow-hidden">
          {/* Left Column: Responsive Card Grid Matrix */}
          <aside className="lg:col-span-7 xl:col-span-7 bezel flex min-h-0 flex-col overflow-hidden rounded-2xl shadow-xl">
            {/* Card Grid Header Toolbar */}
            <div className="flex items-center justify-between border-b border-[oklch(0_0_0/35%)] px-4 py-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="neu-sm grid h-9 w-9 place-items-center rounded-xl text-cyan-hud">
                  <Brain className="w-4 h-4 text-cyan-400" />
                </span>
                <div>
                  <span className="etched block text-[12px] font-bold tracking-[0.16em] text-foreground">
                    MEMORY CARDS
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {filtered.length} of {memoryItems.length} entities indexed
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setQ("");
                  setTag("all");
                  setAgentFilter("all");
                }}
                className="key rounded-lg px-2.5 py-1 text-[11px] font-bold text-cyan-hud cursor-pointer"
              >
                Reset Filters
              </button>
            </div>

            {/* Scrollable Responsive Card Grid (2-columns on sm/md/lg) */}
            <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto p-3.5 auto-rows-min">
              {filtered.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-center neu-inset rounded-2xl p-6 my-auto">
                  <Brain className="w-10 h-10 text-muted-foreground/40 mb-2.5" />
                  <p className="text-sm font-bold text-muted-foreground">No memory nodes found</p>
                  <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">
                    Adjust filters, clear search terms, or index a new fact into the knowledge graph
                  </p>
                  <button
                    onClick={() => setIsAddOpen(true)}
                    className="mt-4 key px-4 py-1.5 rounded-xl text-xs font-bold text-cyan-hud cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Create Memory Node
                  </button>
                </div>
              ) : (
                filtered.map((m) => {
                  const isSelected = activeFact?.id === m.id;
                  const AgentIcon = m.agentInfo.icon;
                  const catStyle = CATEGORY_STYLES[m.tag] || {
                    label: m.tag,
                    badgeCls: "text-zinc-400 border-zinc-500/20 bg-zinc-500/10",
                  };

                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        setSelectedFactId(m.id);
                        setIsEditing(false);
                      }}
                      style={
                        isSelected
                          ? {
                              borderColor: `color-mix(in oklab, ${m.color} 80%, transparent)`,
                              boxShadow: `0 0 18px color-mix(in oklab, ${m.color} 30%, transparent)`,
                              background: `color-mix(in oklab, ${m.color} 10%, var(--metal-soft))`,
                            }
                          : undefined
                      }
                      className={cn(
                        "neu group flex flex-col justify-between rounded-2xl p-3.5 text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-xl cursor-pointer relative overflow-hidden border border-white/5 min-h-[160px]",
                        isSelected && "neu-inset border ring-1 ring-cyan-400/40"
                      )}
                    >
                      {/* Card Top Meta Header */}
                      <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="neu-inset grid h-8 w-8 shrink-0 place-items-center rounded-xl text-sm border border-white/5 shadow-inner"
                            style={{ color: m.color }}
                          >
                            <AgentIcon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex flex-col">
                            <span
                              className="text-[9.5px] font-mono font-extrabold uppercase tracking-wider truncate"
                              style={{ color: m.color }}
                            >
                              {m.agentInfo.name}
                            </span>
                            <span className="text-[8.5px] text-muted-foreground font-mono truncate">
                              {m.agentInfo.role}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            className={cn(
                              "text-[8.5px] font-semibold px-2 py-0.5 rounded-full border truncate max-w-[90px]",
                              catStyle.badgeCls
                            )}
                          >
                            {catStyle.label}
                          </span>
                          {m.source === "auto_extracted" && (
                            <span className="text-[8px] font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1 py-0.5 rounded">
                              AUTO
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Middle: Title & Plain Text Excerpt */}
                      <div className="my-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: m.color }}
                          />
                          <h4 className="truncate text-[13px] font-bold text-foreground">
                            {m.title}
                          </h4>
                        </div>
                        <p className="line-clamp-3 text-[11px] leading-relaxed text-muted-foreground font-sans break-words select-none">
                          {m.desc}
                        </p>
                      </div>

                      {/* Card Bottom: Metrics & HUD Telemetry Bar */}
                      <div className="mt-2.5 pt-2 border-t border-white/5 shrink-0">
                        <div className="flex items-center justify-between text-[9.5px] font-mono text-muted-foreground mb-1.5">
                          <span className="flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-muted-foreground/70" />
                            {new Date(m.updatedAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span className="text-muted-foreground/80">
                            {m.desc.split(/\s+/).filter(Boolean).length} words · {m.desc.length} chars
                          </span>
                        </div>

                        {/* HUD Accent Bar */}
                        <div className="h-1 w-full overflow-hidden rounded-full bg-[oklch(0.13_0.01_256)] shadow-[inset_0_1px_2px_oklch(0_0_0/70%)]">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${Math.min(100, Math.max(25, (m.desc.length / 180) * 100))}%`,
                              background: `linear-gradient(90deg, ${m.color}, var(--cyan-hud))`,
                              boxShadow: isSelected ? `0 0 10px ${m.color}` : undefined,
                            }}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Bottom Quick Action */}
            <div className="p-3 border-t border-[oklch(0_0_0/35%)] shrink-0">
              <button
                onClick={() => setIsAddOpen(true)}
                className="key w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold text-cyan-hud glow-ring cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Index New Memory Card
              </button>
            </div>
          </aside>

          {/* Right Column: Main Memory Rail Detail View Panel */}
          <section className="lg:col-span-5 xl:col-span-5 bezel flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl p-4 sm:p-5 shadow-2xl">
            {/* Detail View Header Title Bar */}
            <div className="flex items-center justify-between pb-3 border-b border-[oklch(0_0_0/35%)] shrink-0">
              <div className="flex items-center gap-2">
                <span className="neu-sm grid h-8 w-8 place-items-center rounded-xl text-cyan-hud">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                </span>
                <div>
                  <span className="etched block text-[12px] font-bold tracking-[0.16em] text-foreground uppercase">
                    MEMORY RAIL CONTEXT
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Zero-latency plain text &amp; live prompt injection
                  </span>
                </div>
              </div>

              {activeFact && (
                <span className="neu-inset px-2.5 py-1 rounded-full text-[10px] font-mono text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Active Injected
                </span>
              )}
            </div>

            {/* Main Detail View Content (Scrollable) */}
          <div className="min-h-0 flex-1 flex flex-col overflow-y-auto py-3.5 space-y-4">
            {activeFact ? (
              <div className="flex flex-col gap-4 flex-1">
                {/* Agent Header Banner */}
                <div
                  className="rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border transition-colors shadow-lg"
                  style={{
                    backgroundColor: activeFact.agentInfo.bg,
                    borderColor: `color-mix(in oklab, ${activeFact.color} 40%, transparent)`,
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="neu-inset grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg shadow-md border border-white/10"
                      style={{ color: activeFact.color }}
                    >
                      {React.createElement(activeFact.agentInfo.icon, { className: "h-5 w-5" })}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-xs font-mono font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full neu-inset shadow-inner"
                          style={{ color: activeFact.color }}
                        >
                          {activeFact.agentInfo.name}
                        </span>
                        <span className="text-[10.5px] text-muted-foreground font-mono uppercase tracking-wider">
                          {activeFact.agentInfo.title}
                        </span>
                      </div>
                      <h2 className="text-base sm:text-lg font-bold tracking-wide text-foreground mt-1 break-words">
                        {activeFact.title}
                      </h2>
                    </div>
                  </div>

                  {/* Toolbar Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => handleCopyRaw(activeFact.desc)}
                      title="Copy Full Raw Payload"
                      className="key px-3 py-1.5 rounded-xl text-muted-foreground hover:text-cyan-400 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                    {!isEditing && (
                      <button
                        onClick={() => startEditing(activeFact)}
                        title="Edit Node In-Place"
                        className="key px-3 py-1.5 rounded-xl text-muted-foreground hover:text-cyan-400 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleDuplicate(activeFact)}
                      title="Duplicate Node"
                      className="key p-2 rounded-xl text-muted-foreground hover:text-amber-400 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteMemory(activeFact.id)}
                      title="Delete Node"
                      className="key p-2 rounded-xl text-muted-foreground hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Edit Mode vs Read Mode */}
                {isEditing ? (
                  <div className="neu-inset rounded-2xl p-4 flex flex-col gap-3.5 animate-fade-in flex-1 border border-cyan-500/30">
                    <div className="flex items-center justify-between pb-2 border-b border-white/5">
                      <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                        <Edit3 className="w-4 h-4" /> Editing Memory Node: {activeFact.title}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10.5px] font-bold text-muted-foreground tracking-wider uppercase block mb-1">
                          Key / Identifier
                        </label>
                        <input
                          type="text"
                          value={editKey}
                          onChange={(e) => setEditKey(e.target.value)}
                          className="w-full neu-inset rounded-xl px-3.5 py-2 text-xs text-foreground outline-none border border-white/10 focus:border-cyan-400"
                        />
                      </div>

                      <div>
                        <label className="text-[10.5px] font-bold text-muted-foreground tracking-wider uppercase block mb-1">
                          Knowledge Sphere Link
                        </label>
                        <select
                          value={editAgentId}
                          onChange={(e) => setEditAgentId(e.target.value)}
                          className="w-full neu-inset rounded-xl px-3.5 py-2 text-xs text-foreground bg-transparent outline-none cursor-pointer border border-white/10"
                        >
                          <option value="system_os" className="bg-slate-900 text-white">System &amp; OS (Linux &amp; C++ Actuators)</option>
                          <option value="operator_profile" className="bg-slate-900 text-white">Operator Profile &amp; Directives</option>
                          <option value="knowledge_intel" className="bg-slate-900 text-white">Intelligence &amp; Research</option>
                          <option value="codebase_dev" className="bg-slate-900 text-white">Codebase Architecture &amp; AST</option>
                          <option value="workspace_ops" className="bg-slate-900 text-white">Workspace &amp; Cloud Tasks</option>
                          <option value="security_groundtruth" className="bg-slate-900 text-white">Security &amp; Ground Truth</option>
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

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
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
                    {/* Section 1: Complete Raw Text Content (Unmasked) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-cyan-400" />
                          Text Content Payload (Unmasked &amp; Zero Truncation)
                        </span>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                          <span>{activeFact.desc.split(/\s+/).filter(Boolean).length} words</span>
                          <span>·</span>
                          <span>{activeFact.desc.length} chars</span>
                          <span>·</span>
                          <span>{new Blob([activeFact.desc]).size} bytes</span>
                        </div>
                      </div>
                      <div className="neu-inset rounded-xl p-4 bg-black/40 border border-white/5 relative group">
                        <p className="text-[13px] leading-relaxed font-mono text-cyan-200/90 break-words whitespace-pre-wrap select-all">
                          {activeFact.desc}
                        </p>
                      </div>
                    </div>

                    {/* Section 2: Live Injected System Prompt Syntax */}
                    <div>
                      <span className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase block mb-1.5 flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 text-emerald-400" />
                        Live Serialized LLM Instruction Syntax
                      </span>
                      <div className="neu-inset rounded-xl p-3 bg-black/30 text-[11.5px] font-mono text-muted-foreground border border-white/5 flex items-center justify-between">
                        <code className="text-cyan-300/80 break-words">
                          - [{activeFact.tag.toUpperCase()}] ({activeFact.agentInfo.name}) {activeFact.key}: {activeFact.value}
                        </code>
                      </div>
                    </div>

                    {/* Section 3: Associated Tags */}
                    <div>
                      <span className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase block mb-2 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-amber-400" />
                        Associated Tags &amp; Classification Entities
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="neu-inset px-2.5 py-1 rounded-lg text-xs font-mono font-bold text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
                          #{activeFact.tag}
                        </span>
                        <span
                          className="neu-inset px-2.5 py-1 rounded-lg text-xs font-mono font-bold border flex items-center gap-1"
                          style={{
                            color: activeFact.color,
                            borderColor: `color-mix(in oklab, ${activeFact.color} 30%, transparent)`,
                          }}
                        >
                          @{activeFact.agentInfo.name.toLowerCase()}
                        </span>
                        <span className="neu-inset px-2.5 py-1 rounded-lg text-xs font-mono text-muted-foreground border border-white/5">
                          source:{activeFact.source}
                        </span>
                        <span className="neu-inset px-2.5 py-1 rounded-lg text-xs font-mono text-muted-foreground border border-white/5">
                          role:{activeFact.agentInfo.role}
                        </span>
                        <span className="neu-inset px-2.5 py-1 rounded-lg text-xs font-mono text-emerald-400 border border-emerald-500/20">
                          status:injected_active
                        </span>
                      </div>
                    </div>

                    {/* Section 4: Full Metadata Grid */}
                    <div className="mt-auto pt-3 border-t border-white/10 space-y-3">
                      <span className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase block flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-cyan-400" />
                        Entity Metadata &amp; Hardware Telemetry
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[10.5px] font-mono">
                        <div className="neu-inset rounded-xl p-2.5">
                          <span className="text-muted-foreground block text-[9px]">ENTITY ID</span>
                          <button
                            onClick={() => handleCopyId(activeFact.id)}
                            className="text-foreground font-bold flex items-center gap-1 mt-0.5 hover:text-cyan-400 truncate cursor-pointer"
                            title="Click to copy ID"
                          >
                            <span className="truncate">{activeFact.id}</span>
                            {copiedId ? (
                              <Check className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                            ) : (
                              <Copy className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                            )}
                          </button>
                        </div>
                        <div className="neu-inset rounded-xl p-2.5">
                          <span className="text-muted-foreground block text-[9px]">SOURCE AGENT</span>
                          <span className="text-foreground font-bold flex items-center gap-1 mt-0.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeFact.color }} />
                            {activeFact.agentInfo.name}
                          </span>
                        </div>
                        <div className="neu-inset rounded-xl p-2.5">
                          <span className="text-muted-foreground block text-[9px]">CATEGORY</span>
                          <span className="text-foreground font-bold capitalize mt-0.5 block truncate">
                            {activeFact.tag.replace("_", " ")}
                          </span>
                        </div>
                        <div className="neu-inset rounded-xl p-2.5">
                          <span className="text-muted-foreground block text-[9px]">INGESTION ORIGIN</span>
                          <span className="text-foreground font-bold capitalize mt-0.5 block truncate">
                            {activeFact.source.replace("_", " ")}
                          </span>
                        </div>
                        <div className="neu-inset rounded-xl p-2.5">
                          <span className="text-muted-foreground block text-[9px]">LAST SYNCHRONIZED</span>
                          <span className="text-foreground font-bold mt-0.5 block truncate">
                            {new Date(activeFact.updatedAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </span>
                        </div>
                        <div className="neu-inset rounded-xl p-2.5">
                          <span className="text-muted-foreground block text-[9px]">MEMORY REPOSITORIES</span>
                          <span className="text-cyan-400 font-bold mt-0.5 block truncate">
                            SQLite + In-Memory RAM
                          </span>
                        </div>
                      </div>

                      {/* Detail Bottom Action Dock */}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleInjectContext(activeFact)}
                          className="flex-1 key flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold text-cyan-hud hover:text-foreground cursor-pointer shadow-md glow-ring"
                        >
                          <Radio className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Inject Into Active Session Context</span>
                        </button>
                        <button
                          onClick={() => startEditing(activeFact)}
                          className="key flex items-center justify-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit Node</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-16 px-4 my-auto">
                <Brain className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <h3 className="text-sm font-bold text-foreground">No Memory Card Selected</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Click any memory card from the left column to inspect its full raw text payload, metadata, tags, and live prompt injection.
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
      )}
    </div>
  );
}

