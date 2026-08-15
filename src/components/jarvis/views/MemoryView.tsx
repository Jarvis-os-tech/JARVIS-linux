import React, { useState } from "react";
import { Brain, Search, Plus, Trash2, RefreshCw, Sparkles } from "lucide-react";
import { useJarvis } from "../JarvisProvider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { saveAgentMemory, MemoryFact } from "@/utils/agent_memory";

const DEFAULT_CATEGORIES = ["all", "preference", "work_context", "personal_fact", "topic", "custom"];

export function MemoryView() {
  const { agentMemoryState, setAgentMemoryState, pushLog } = useJarvis();
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newCategory, setNewCategory] = useState<MemoryFact["category"]>("work_context");

  // Transform memory facts into displayable nodes
  const memoryItems = agentMemoryState.facts.map((f, i) => ({
    id: f.id || `fact-${i}`,
    title: f.key || f.category.toUpperCase(),
    desc: f.value,
    tag: f.category,
    source: f.source || "user_added",
    updatedAt: f.updatedAt,
    color:
      f.category === "work_context" ? "var(--cyan-hud)" :
      f.category === "preference" ? "var(--violet-hud)" :
      f.category === "personal_fact" ? "var(--emerald-hud)" :
      f.category === "topic" ? "var(--blue-hud)" : "var(--amber-hud)",
  }));

  const filtered = memoryItems.filter(
    (m) =>
      (tag === "all" || m.tag === tag) &&
      (m.title.toLowerCase().includes(q.toLowerCase()) || m.desc.toLowerCase().includes(q.toLowerCase())),
  );

  const handleAddMemory = () => {
    if (!newKey.trim() || !newValue.trim()) return;
    const newItem: MemoryFact = {
      id: `fact-${Date.now()}`,
      category: newCategory,
      key: newKey.trim(),
      value: newValue.trim(),
      updatedAt: new Date().toISOString(),
      source: "user_added",
    };

    const nextState = {
      ...agentMemoryState,
      facts: [newItem, ...agentMemoryState.facts],
      lastUpdated: new Date().toISOString(),
    };

    setAgentMemoryState(nextState);
    saveAgentMemory(nextState);
    pushLog(`Memory node added: [${newCategory}] ${newKey.trim()}: ${newValue.trim()}`);
    toast.success("Fact added to agent memory");
    setNewKey("");
    setNewValue("");
    setIsAddOpen(false);
  };

  const handleDeleteMemory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextState = {
      ...agentMemoryState,
      facts: agentMemoryState.facts.filter((f) => f.id !== id),
      lastUpdated: new Date().toISOString(),
    };
    setAgentMemoryState(nextState);
    saveAgentMemory(nextState);
    toast("Memory node deleted");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display etched text-2xl font-bold tracking-wide">Knowledge Hub &amp; Memory</h1>
            <span className="neu-inset px-2.5 py-0.5 rounded-full text-[10.5px] font-bold text-emerald-hud border border-emerald-500/20">
              {agentMemoryState.facts.length} Nodes Indexed
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Long-term memory, entity graph, and conversational recall continuously injected into the AI co-pilot.
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(!isAddOpen)}
          className="key flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-cyan-hud glow-ring cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Add Memory Node
        </button>
      </header>

      {/* Add Memory Form */}
      {isAddOpen && (
        <div className="animate-rise-in mb-4 neu rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">Add New Fact to Long-Term Memory</span>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as any)}
              className="neu-inset rounded-lg px-2.5 py-1 text-xs text-foreground bg-transparent outline-none cursor-pointer"
            >
              <option value="work_context" className="bg-slate-900 text-white">Work Context</option>
              <option value="preference" className="bg-slate-900 text-white">Preference</option>
              <option value="personal_fact" className="bg-slate-900 text-white">Personal Fact</option>
              <option value="topic" className="bg-slate-900 text-white">Topic</option>
              <option value="custom" className="bg-slate-900 text-white">Custom</option>
            </select>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Key (e.g. Preferred Language, OS Environment)…"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="sm:w-1/3 neu-inset rounded-xl px-3.5 py-2.5 text-xs text-foreground outline-none placeholder:text-muted-foreground"
            />
            <input
              type="text"
              placeholder="Value / Details…"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddMemory()}
              className="flex-1 neu-inset rounded-xl px-3.5 py-2.5 text-xs text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              onClick={handleAddMemory}
              className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-600/20 cursor-pointer"
            >
              Save Fact
            </button>
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="neu-inset mb-3 flex items-center gap-2 rounded-xl px-3.5 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Recall anything across long-term knowledge graph…"
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* Categories */}
      <div className="mb-3 flex flex-wrap gap-2">
        {DEFAULT_CATEGORIES.map((t) => (
          <button
            key={t}
            onClick={() => setTag(t)}
            className={cn(
              "rounded-full px-3 py-1 text-[11px] font-bold capitalize transition-all cursor-pointer",
              tag === t ? "neu-inset text-cyan-hud border border-cyan-500/40" : "key text-muted-foreground hover:text-foreground",
            )}
          >
            {t.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Memory Nodes Grid */}
      <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-3.5 overflow-y-auto pb-4 pr-1">
        {filtered.map((m) => (
          <div
            key={m.id}
            onClick={() => {
              pushLog(`Recalled memory node: ${m.title} - ${m.desc}`);
              toast(`Recalled node: ${m.title} (${m.desc.slice(0, 35)}…)`);
            }}
            className="neu gloss animate-rise-in rounded-2xl p-4 text-left transition-transform hover:-translate-y-0.5 cursor-pointer relative group"
          >
            <div className="flex items-start justify-between">
              <span
                className="neu-inset grid h-10 w-10 place-items-center rounded-xl"
                style={{ color: m.color }}
              >
                <Brain className="h-4.5 w-4.5" />
              </span>
              <button
                onClick={(e) => handleDeleteMemory(m.id, e)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-rose-400 cursor-pointer"
                title="Delete Memory Fact"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <h3 className="mt-3 text-[13.5px] font-bold flex items-center gap-2">
              <span>{m.title}</span>
            </h3>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{m.desc}</p>
            <span className="neu-inset mt-3 inline-block rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-cyan-hud font-bold">
              {m.tag.replace("_", " ")}
            </span>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full py-10 text-center text-xs text-muted-foreground">
            No memory facts match your search query.
          </p>
        )}
      </div>
    </div>
  );
}
