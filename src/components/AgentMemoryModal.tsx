import React, { useState } from 'react';
import { AgentMemoryState, MemoryFact, saveAgentMemory } from '../utils/agent_memory';
import { Brain, X, Plus, Trash2, Edit3, Check, Search, Sparkles, RefreshCw, Layers, UserCheck, ShieldCheck } from 'lucide-react';

interface AgentMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  memoryState: AgentMemoryState;
  onUpdateMemory: (newState: AgentMemoryState) => void;
  onSyncWithAgent?: () => void;
  isConnected?: boolean;
}

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

  // New fact form
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newCategory, setNewCategory] = useState<MemoryFact['category']>('personal_fact');

  // Editing fact
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');

  // Editing topic summary
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [summaryText, setSummaryText] = useState(memoryState.recentTopicsSummary);

  if (!isOpen) return null;

  const handleToggleEnabled = () => {
    const updated = { ...memoryState, enabled: !memoryState.enabled };
    onUpdateMemory(updated);
    saveAgentMemory(updated);
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
      source: 'user_added'
    };

    const updated = {
      ...memoryState,
      facts: [newFact, ...memoryState.facts]
    };

    onUpdateMemory(updated);
    saveAgentMemory(updated);

    setNewKey('');
    setNewValue('');
    setIsAdding(false);
  };

  const handleDeleteFact = (id: string) => {
    const updated = {
      ...memoryState,
      facts: memoryState.facts.filter(f => f.id !== id)
    };
    onUpdateMemory(updated);
    saveAgentMemory(updated);
  };

  const handleSaveEditFact = (id: string) => {
    if (!editVal.trim()) return;
    const updated = {
      ...memoryState,
      facts: memoryState.facts.map(f => f.id === id ? { ...f, value: editVal.trim(), updatedAt: new Date().toISOString() } : f)
    };
    onUpdateMemory(updated);
    saveAgentMemory(updated);
    setEditingId(null);
  };

  const handleSaveSummary = () => {
    const updated = {
      ...memoryState,
      recentTopicsSummary: summaryText.trim()
    };
    onUpdateMemory(updated);
    saveAgentMemory(updated);
    setIsEditingSummary(false);
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all agent memories? This cannot be undone.')) {
      const updated: AgentMemoryState = {
        enabled: memoryState.enabled,
        facts: [],
        recentTopicsSummary: '',
        lastUpdated: new Date().toISOString()
      };
      onUpdateMemory(updated);
      saveAgentMemory(updated);
    }
  };

  const filteredFacts = memoryState.facts.filter(f => {
    const matchesSearch = f.key.toLowerCase().includes(searchTerm.toLowerCase()) || f.value.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || f.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryBadge = (cat: MemoryFact['category']) => {
    switch (cat) {
      case 'work_context':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20">Work / Project</span>;
      case 'preference':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20">Preference</span>;
      case 'personal_fact':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-600 border border-purple-500/20">Personal</span>;
      case 'topic':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">Topic</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-500/10 text-zinc-600 border border-zinc-500/20">Custom</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-purple-600 via-indigo-600 to-rose-500 text-white rounded-2xl shadow-md shadow-purple-500/20">
              <Brain className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-zinc-900 leading-tight">
                  Agent Memory & Context Awareness
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-purple-100 text-purple-700 border border-purple-200">
                  {memoryState.facts.length} Memories
                </span>
              </div>
              <p className="text-xs text-zinc-500">
                Persistent long-term memory store allowing the agent to remember facts, topics & preferences across conversations.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Master Memory Toggle */}
        <div className="px-5 py-3 bg-purple-50/60 border-b border-purple-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-semibold text-purple-900">
              Context Memory Active in Gemini Live Sessions
            </span>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={memoryState.enabled}
              onChange={handleToggleEnabled}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-zinc-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs sm:text-sm flex-1">
          {/* Conversation Topic Context Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-950 text-white shadow-md border border-zinc-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="font-semibold text-xs text-purple-200 uppercase tracking-wider">
                  Active Conversation Topic Summary
                </span>
              </div>
              {!isEditingSummary ? (
                <button
                  onClick={() => {
                    setSummaryText(memoryState.recentTopicsSummary);
                    setIsEditingSummary(true);
                  }}
                  className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 bg-zinc-800/80 px-2 py-0.5 rounded-lg border border-zinc-700"
                >
                  <Edit3 className="w-3 h-3" /> Edit
                </button>
              ) : (
                <button
                  onClick={handleSaveSummary}
                  className="text-[11px] bg-purple-600 text-white font-medium px-2.5 py-0.5 rounded-lg flex items-center gap-1 hover:bg-purple-500"
                >
                  <Check className="w-3 h-3" /> Save Context
                </button>
              )}
            </div>

            {!isEditingSummary ? (
              <p className="text-xs text-zinc-300 leading-relaxed italic bg-zinc-900/60 p-2.5 rounded-xl border border-white/5">
                "{memoryState.recentTopicsSummary || 'No recent topic context summary recorded yet.'}"
              </p>
            ) : (
              <textarea
                value={summaryText}
                onChange={(e) => setSummaryText(e.target.value)}
                rows={2}
                className="w-full p-2.5 text-xs bg-zinc-900 text-zinc-100 border border-purple-500/50 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-400 resize-none"
              />
            )}
          </div>

          {/* Action Bar: Search, Filter, Add */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search memory facts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-100/80 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="py-1.5 px-2.5 text-xs bg-zinc-100/80 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium text-zinc-700"
              >
                <option value="all">All Categories</option>
                <option value="work_context">Work / Project</option>
                <option value="preference">Preferences</option>
                <option value="personal_fact">Personal Facts</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <button
              onClick={() => setIsAdding(!isAdding)}
              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Add Memory
            </button>
          </div>

          {/* Add New Fact Form Drawer */}
          {isAdding && (
            <form onSubmit={handleAddFact} className="p-4 bg-purple-50/50 border border-purple-200/80 rounded-2xl space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-purple-900 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-purple-600" /> Remember New Fact / Context
                </span>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-700 mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full p-2 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="personal_fact">Personal Fact</option>
                    <option value="work_context">Work / Project Context</option>
                    <option value="preference">User Preference</option>
                    <option value="custom">Custom Note</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-700 mb-1">Key Label</label>
                  <input
                    type="text"
                    placeholder="e.g. Favorite Tech Stack"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    className="w-full p-2 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-700 mb-1">Fact / Detail</label>
                <input
                  type="text"
                  placeholder="e.g. Prefers React, Vite, and Tailwind CSS"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="w-full p-2 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1.5 text-zinc-600 hover:bg-zinc-200/50 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-xs shadow-sm"
                >
                  Save Fact
                </button>
              </div>
            </form>
          )}

          {/* Fact List */}
          <div className="space-y-2.5">
            {filteredFacts.length === 0 ? (
              <div className="p-8 text-center text-zinc-400 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                <Layers className="w-8 h-8 mx-auto mb-2 text-zinc-300" />
                <p className="font-medium text-zinc-600 text-xs">No memories found</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  As you talk, the agent will automatically learn facts about you, or you can add them manually above.
                </p>
              </div>
            ) : (
              filteredFacts.map((fact) => (
                <div
                  key={fact.id}
                  className="p-3.5 bg-zinc-50/90 hover:bg-zinc-100/70 border border-zinc-200/80 rounded-2xl flex items-start justify-between gap-3 transition-all"
                >
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-zinc-900">{fact.key}</span>
                      {getCategoryBadge(fact.category)}
                      {fact.source === 'auto_extracted' && (
                        <span className="text-[9px] text-purple-600 font-semibold bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                          Auto-learned
                        </span>
                      )}
                    </div>

                    {editingId !== fact.id ? (
                      <p className="text-xs text-zinc-700 leading-relaxed font-medium break-words">
                        {fact.value}
                      </p>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="text"
                          value={editVal}
                          onChange={(e) => setEditVal(e.target.value)}
                          className="flex-1 p-1.5 text-xs bg-white border border-purple-400 rounded-lg focus:outline-none"
                        />
                        <button
                          onClick={() => handleSaveEditFact(fact.id)}
                          className="p-1.5 bg-purple-600 text-white rounded-lg text-xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <div className="text-[10px] text-zinc-400">
                      Updated {new Date(fact.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 pt-0.5">
                    {editingId !== fact.id && (
                      <button
                        onClick={() => {
                          setEditingId(fact.id);
                          setEditVal(fact.value);
                        }}
                        className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 rounded-lg transition-colors"
                        title="Edit fact"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteFact(fact.id)}
                      className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete fact"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer Controls */}
        <div className="p-4 border-t border-zinc-100 bg-zinc-50/80 flex items-center justify-between">
          <button
            onClick={handleClearAll}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 px-2 py-1 hover:bg-rose-50 rounded-xl transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear All Memories
          </button>

          <div className="flex items-center gap-2">
            {isConnected && onSyncWithAgent && (
              <button
                onClick={onSyncWithAgent}
                className="px-3 py-2 bg-purple-100 text-purple-700 hover:bg-purple-200 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors border border-purple-200"
                title="Send updated memory context to active voice session"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Sync with Active Session
              </button>
            )}

            <button
              onClick={onClose}
              className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs rounded-xl transition-colors shadow-sm"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
