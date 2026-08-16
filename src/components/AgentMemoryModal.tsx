import React, { useState, useMemo } from 'react';
import { AgentMemoryState, MemoryFact, saveAgentMemory } from '../utils/agent_memory';
import {
  Brain,
  X,
  Plus,
  Trash2,
  Edit3,
  Check,
  Search,
  Sparkles,
  RefreshCw,
  Layers,
  UserCheck,
  ShieldCheck,
  Clock,
  Database,
  Copy,
  Tag,
  ChevronRight,
  FileText,
  Radio,
  Share2,
  Info,
  Sliders,
  User,
  Globe,
  Bot,
  Shield,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';

interface AgentMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  memoryState: AgentMemoryState;
  onUpdateMemory: (newState: AgentMemoryState) => void;
  onSyncWithAgent?: () => void;
  isConnected?: boolean;
}

const CATEGORY_MAP: Record<
  MemoryFact['category'],
  { label: string; color: string; badgeCls: string; icon: any }
> = {
  work_context: {
    label: 'Work / Project',
    color: '#3b82f6',
    badgeCls: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    icon: Layers,
  },
  preference: {
    label: 'Preference',
    color: '#f43f5e',
    badgeCls: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    icon: Sliders,
  },
  personal_fact: {
    label: 'Personal Fact',
    color: '#a855f7',
    badgeCls: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    icon: User,
  },
  topic: {
    label: 'Topic & Intel',
    color: '#f59e0b',
    badgeCls: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    icon: Globe,
  },
  custom: {
    label: 'Custom Note',
    color: '#06b6d4',
    badgeCls: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    icon: Sparkles,
  },
};

export const AgentMemoryModal: React.FC<AgentMemoryModalProps> = ({
  isOpen,
  onClose,
  memoryState,
  onUpdateMemory,
  onSyncWithAgent,
  isConnected = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [selectedFactId, setSelectedFactId] = useState<string | null>(null);

  // New fact form
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newCategory, setNewCategory] = useState<MemoryFact['category']>('personal_fact');

  // Editing fact state
  const [isEditing, setIsEditing] = useState(false);
  const [editKey, setEditKey] = useState('');
  const [editVal, setEditVal] = useState('');
  const [editCategory, setEditCategory] = useState<MemoryFact['category']>('personal_fact');
  const [copied, setCopied] = useState(false);

  // Editing topic summary
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [summaryText, setSummaryText] = useState(memoryState.recentTopicsSummary);

  const filteredFacts = useMemo(() => {
    return memoryState.facts.filter((f) => {
      const matchesSearch =
        !searchTerm ||
        f.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.value.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || f.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [memoryState.facts, searchTerm, selectedCategory]);

  const activeFact = useMemo(() => {
    if (selectedFactId) {
      const match = memoryState.facts.find((f) => f.id === selectedFactId);
      if (match) return match;
    }
    return filteredFacts.length > 0 ? filteredFacts[0] : null;
  }, [memoryState.facts, selectedFactId, filteredFacts]);

  if (!isOpen) return null;

  const handleToggleEnabled = () => {
    const updated = { ...memoryState, enabled: !memoryState.enabled };
    onUpdateMemory(updated);
    saveAgentMemory(updated);
    toast.success(updated.enabled ? 'Context memory enabled' : 'Context memory disabled');
  };

  const handleAddFact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim()) return;

    const newFact: MemoryFact = {
      id: `fact-user-${Date.now()}`,
      category: newCategory,
      key: newKey.trim(),
      value: newValue.trim(),
      updatedAt: new Date().toISOString(),
      source: 'user_added',
    };

    const updated = {
      ...memoryState,
      facts: [newFact, ...memoryState.facts],
      lastUpdated: new Date().toISOString(),
    };

    onUpdateMemory(updated);
    saveAgentMemory(updated);
    setSelectedFactId(newFact.id);
    setNewKey('');
    setNewValue('');
    setIsAdding(false);
    toast.success('Memory fact created');
  };

  const handleDeleteFact = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = {
      ...memoryState,
      facts: memoryState.facts.filter((f) => f.id !== id),
      lastUpdated: new Date().toISOString(),
    };
    onUpdateMemory(updated);
    saveAgentMemory(updated);
    if (selectedFactId === id) {
      setSelectedFactId(null);
    }
    toast.success('Memory fact deleted');
  };

  const startEditing = (fact: MemoryFact) => {
    setIsEditing(true);
    setEditKey(fact.key);
    setEditVal(fact.value);
    setEditCategory(fact.category);
  };

  const handleSaveEditFact = () => {
    if (!activeFact || !editKey.trim() || !editVal.trim()) return;
    const updated = {
      ...memoryState,
      facts: memoryState.facts.map((f) =>
        f.id === activeFact.id
          ? {
              ...f,
              key: editKey.trim(),
              value: editVal.trim(),
              category: editCategory,
              updatedAt: new Date().toISOString(),
            }
          : f
      ),
      lastUpdated: new Date().toISOString(),
    };
    onUpdateMemory(updated);
    saveAgentMemory(updated);
    setIsEditing(false);
    toast.success('Memory fact updated');
  };

  const handleSaveSummary = () => {
    const updated = {
      ...memoryState,
      recentTopicsSummary: summaryText.trim(),
      lastUpdated: new Date().toISOString(),
    };
    onUpdateMemory(updated);
    saveAgentMemory(updated);
    setIsEditingSummary(false);
    toast.success('Conversation topic summary updated');
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all agent memories? This cannot be undone.')) {
      const updated: AgentMemoryState = {
        enabled: memoryState.enabled,
        facts: [],
        recentTopicsSummary: '',
        lastUpdated: new Date().toISOString(),
      };
      onUpdateMemory(updated);
      saveAgentMemory(updated);
      setSelectedFactId(null);
      toast.success('All agent memories cleared');
    }
  };

  const handleCopyRaw = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Raw payload copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDuplicate = (fact: MemoryFact) => {
    const dup: MemoryFact = {
      id: `fact-dup-${Date.now()}`,
      category: fact.category,
      key: `${fact.key} (Copy)`,
      value: fact.value,
      updatedAt: new Date().toISOString(),
      source: 'user_added',
    };
    const updated = {
      ...memoryState,
      facts: [dup, ...memoryState.facts],
      lastUpdated: new Date().toISOString(),
    };
    onUpdateMemory(updated);
    saveAgentMemory(updated);
    setSelectedFactId(dup.id);
    toast.success('Memory fact duplicated');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in font-sans">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[88vh] text-slate-100">
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-purple-600 via-cyan-600 to-emerald-500 text-white rounded-2xl shadow-lg shadow-purple-500/20">
              <Brain className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white leading-tight">
                  Agent Memory &amp; Context Awareness
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                  <Database className="w-3 h-3 text-purple-400" />
                  {memoryState.facts.length} Memories
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Persistent long-term memory store allowing the agent to remember facts, topics &amp; preferences across sessions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Master Memory Toggle */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/70 border border-slate-700">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-semibold text-slate-300">Live Context Injection</span>
              <label className="relative inline-flex items-center cursor-pointer ml-1">
                <input
                  type="checkbox"
                  checked={memoryState.enabled}
                  onChange={handleToggleEnabled}
                  className="sr-only peer"
                />
                <div className="w-8 h-4.5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-12 gap-3.5 p-3.5 sm:p-4 overflow-hidden">
          {/* Left Column: Mission Rail Style Component Cards */}
          <aside className="lg:col-span-5 flex flex-col min-h-0 overflow-hidden bg-slate-950/40 rounded-2xl border border-slate-800/80">
            {/* Filter & Add Actions Header */}
            <div className="p-3 border-b border-slate-800 flex flex-col gap-2.5 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5 text-cyan-400" /> Memory Cards ({filteredFacts.length})
                </span>
                <button
                  onClick={() => setIsAdding(!isAdding)}
                  className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                >
                  {isAdding ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                  <span>{isAdding ? 'Close' : 'Add Card'}</span>
                </button>
              </div>

              {/* Search & Category Filter */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search facts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-900/90 border border-slate-700/80 rounded-xl focus:outline-none focus:border-cyan-500 text-slate-200 placeholder:text-slate-500"
                  />
                </div>

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="py-1.5 px-2 text-xs bg-slate-900/90 border border-slate-700/80 rounded-xl focus:outline-none focus:border-cyan-500 font-medium text-slate-300 cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  <option value="work_context">Work / Project</option>
                  <option value="preference">Preferences</option>
                  <option value="personal_fact">Personal Facts</option>
                  <option value="topic">Topic &amp; Intel</option>
                  <option value="custom">Custom Notes</option>
                </select>
              </div>
            </div>

            {/* Add New Fact Drawer */}
            {isAdding && (
              <form
                onSubmit={handleAddFact}
                className="p-3 bg-purple-950/30 border-b border-purple-800/40 flex flex-col gap-2 animate-fade-in shrink-0"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-purple-300 flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-purple-400" /> New Memory Entry
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 mb-0.5">Category</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as any)}
                      className="w-full p-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 outline-none"
                    >
                      <option value="personal_fact">Personal Fact</option>
                      <option value="work_context">Work Context</option>
                      <option value="preference">Preference</option>
                      <option value="topic">Topic &amp; Intel</option>
                      <option value="custom">Custom Note</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 mb-0.5">Key Identifier</label>
                    <input
                      type="text"
                      placeholder="e.g. Workstation Specs"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      className="w-full p-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-400 mb-0.5">Content Value</label>
                  <input
                    type="text"
                    placeholder="e.g. 64GB RAM, Linux Ubuntu 24.04 LTS"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className="w-full p-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 outline-none"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-2.5 py-1 text-slate-400 hover:text-white rounded-lg text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs shadow-sm cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </form>
            )}

            {/* Scrollable Component Cards List (Mission Rail Style) */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
              {filteredFacts.length === 0 ? (
                <div className="p-8 text-center text-slate-500 my-auto">
                  <Brain className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                  <p className="font-semibold text-xs text-slate-400">No memory blocks found</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Create a new fact card or adjust your search filter above.
                  </p>
                </div>
              ) : (
                filteredFacts.map((fact) => {
                  const isSelected = activeFact?.id === fact.id;
                  const cat = CATEGORY_MAP[fact.category] || CATEGORY_MAP.custom;
                  const CatIcon = cat.icon;

                  return (
                    <button
                      key={fact.id}
                      onClick={() => {
                        setSelectedFactId(fact.id);
                        setIsEditing(false);
                      }}
                      style={
                        isSelected
                          ? {
                              borderColor: `color-mix(in srgb, ${cat.color} 70%, transparent)`,
                              boxShadow: `0 0 14px color-mix(in srgb, ${cat.color} 20%, transparent)`,
                              backgroundColor: `color-mix(in srgb, ${cat.color} 10%, rgba(15, 23, 42, 0.6))`,
                            }
                          : undefined
                      }
                      className={`w-full group flex gap-3 rounded-xl p-3 text-left transition-all hover:-translate-y-0.5 cursor-pointer relative border ${
                        isSelected
                          ? 'border-cyan-500/60 bg-slate-800/90'
                          : 'border-slate-800/80 bg-slate-900/60 hover:bg-slate-800/50 hover:border-slate-700'
                      }`}
                    >
                      {/* Left Accent Icon */}
                      <span
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm bg-slate-950 border border-slate-800 shadow-inner"
                        style={{ color: cat.color }}
                      >
                        <CatIcon className="h-4 w-4" />
                      </span>

                      {/* Content block */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-full border ${cat.badgeCls}`}
                          >
                            {cat.label}
                          </span>
                          {fact.source === 'auto_extracted' && (
                            <span className="text-[8.5px] font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1 rounded">
                              AUTO
                            </span>
                          )}
                        </div>

                        <span className="mt-1 block truncate text-xs font-bold text-slate-100">
                          {fact.key}
                        </span>

                        <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-slate-400 font-sans break-words">
                          {fact.value}
                        </span>

                        {/* Bottom Status / Meta Line */}
                        <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {new Date(fact.updatedAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                          <span>{fact.value.length} chars</span>
                        </div>

                        {/* Accent Bar */}
                        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-950">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(100, Math.max(20, (fact.value.length / 160) * 100))}%`,
                              background: `linear-gradient(90deg, ${cat.color}, #06b6d4)`,
                            }}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Right Column: Dynamic Detail View Panel */}
          <section className="lg:col-span-7 flex flex-col min-h-0 overflow-hidden bg-slate-950/60 rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-xl">
            {activeFact ? (
              <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto">
                {/* Header Banner */}
                {(() => {
                  const cat = CATEGORY_MAP[activeFact.category] || CATEGORY_MAP.custom;
                  const CatIcon = cat.icon;

                  return (
                    <div
                      className="rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border transition-colors shadow-md bg-slate-900/80"
                      style={{
                        borderColor: `color-mix(in srgb, ${cat.color} 30%, transparent)`,
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg bg-slate-950 border border-slate-800 shadow"
                          style={{ color: cat.color }}
                        >
                          <CatIcon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cat.badgeCls}`}
                            >
                              {cat.label}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ID: {activeFact.id}
                            </span>
                          </div>
                          <h2 className="text-sm sm:text-base font-bold text-white mt-1 break-words">
                            {activeFact.key}
                          </h2>
                        </div>
                      </div>

                      {/* Toolbar Actions */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        <button
                          onClick={() => handleCopyRaw(activeFact.value)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                          title="Copy Raw Content"
                        >
                          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copied ? 'Copied' : 'Copy'}</span>
                        </button>
                        {!isEditing && (
                          <button
                            onClick={() => startEditing(activeFact)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                            title="Edit Fact"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleDuplicate(activeFact)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 cursor-pointer transition-colors"
                          title="Duplicate Fact"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteFact(activeFact.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-rose-400 cursor-pointer transition-colors"
                          title="Delete Fact"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Edit Form or Complete Detail View */}
                {isEditing ? (
                  <div className="bg-slate-900/90 border border-cyan-500/40 rounded-2xl p-4 flex flex-col gap-3 animate-fade-in flex-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">Key Label</label>
                        <input
                          type="text"
                          value={editKey}
                          onChange={(e) => setEditKey(e.target.value)}
                          className="w-full p-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-100 outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">Category</label>
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value as any)}
                          className="w-full p-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-100 outline-none focus:border-cyan-500 cursor-pointer"
                        >
                          <option value="personal_fact">Personal Fact</option>
                          <option value="work_context">Work Context</option>
                          <option value="preference">Preference</option>
                          <option value="topic">Topic &amp; Intel</option>
                          <option value="custom">Custom Note</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col min-h-[140px]">
                      <label className="block text-[11px] font-mono text-slate-400 mb-1">Fact Content</label>
                      <textarea
                        value={editVal}
                        onChange={(e) => setEditVal(e.target.value)}
                        rows={6}
                        className="w-full flex-1 p-3 text-xs font-mono bg-slate-950 border border-slate-700 rounded-xl text-slate-100 outline-none focus:border-cyan-500 resize-none leading-relaxed"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                      <button
                        onClick={() => setIsEditing(false)}
                        className="px-3 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveEditFact}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1 cursor-pointer shadow-md"
                      >
                        <Check className="w-3.5 h-3.5" /> Save Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 flex-1">
                    {/* Raw Text Content */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-cyan-400" />
                          Complete Raw Content (Unmasked)
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {activeFact.value.length} characters
                        </span>
                      </div>
                      <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                        <p className="text-xs leading-relaxed font-mono text-cyan-200/90 break-words whitespace-pre-wrap select-all">
                          {activeFact.value}
                        </p>
                      </div>
                    </div>

                    {/* Serialized System Prompt Syntax */}
                    <div>
                      <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 text-emerald-400" />
                        Injected System Instruction Syntax
                      </span>
                      <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400">
                        <code className="text-cyan-300/80 break-words">
                          - [{activeFact.category.toUpperCase()}] {activeFact.key}: {activeFact.value}
                        </code>
                      </div>
                    </div>

                    {/* Associated Tags */}
                    <div>
                      <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-amber-400" />
                        Associated Tags &amp; Metadata
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                          #{activeFact.category}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700">
                          source:{activeFact.source}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30">
                          status:live_injected
                        </span>
                      </div>
                    </div>

                    {/* Full Metadata Grid */}
                    <div className="mt-auto pt-3 border-t border-slate-800 space-y-2">
                      <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-cyan-400" /> Entity Telemetry
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10.5px] font-mono">
                        <div className="bg-slate-900/80 rounded-xl p-2 border border-slate-800">
                          <span className="text-slate-500 block text-[9px]">ENTITY ID</span>
                          <span className="text-slate-200 font-bold truncate block">{activeFact.id}</span>
                        </div>
                        <div className="bg-slate-900/80 rounded-xl p-2 border border-slate-800">
                          <span className="text-slate-500 block text-[9px]">CATEGORY</span>
                          <span className="text-slate-200 font-bold capitalize truncate block">
                            {activeFact.category.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="bg-slate-900/80 rounded-xl p-2 border border-slate-800">
                          <span className="text-slate-500 block text-[9px]">LAST UPDATED</span>
                          <span className="text-slate-200 font-bold truncate block">
                            {new Date(activeFact.updatedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-16 px-4 my-auto">
                <Brain className="w-10 h-10 text-slate-600 mb-2" />
                <h3 className="text-sm font-bold text-slate-300">No Memory Card Selected</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Click any memory card on the left to inspect full raw text, metadata, and prompt injection format.
                </p>
                <button
                  onClick={() => setIsAdding(true)}
                  className="mt-3 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Create New Card
                </button>
              </div>
            )}
          </section>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <button
            onClick={handleClearAll}
            className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1 px-2.5 py-1.5 hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear All Memories
          </button>

          <div className="flex items-center gap-2">
            {isConnected && onSyncWithAgent && (
              <button
                onClick={onSyncWithAgent}
                className="px-3 py-2 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors border border-purple-500/40 cursor-pointer"
                title="Send updated memory context to active voice session"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Sync with Active Session
              </button>
            )}

            <button
              onClick={onClose}
              className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl transition-colors shadow-md cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
