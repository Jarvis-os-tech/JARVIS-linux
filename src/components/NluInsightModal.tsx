import React, { useState } from 'react';
import { NluAnalysisResult, analyzeUtterance } from '../utils/nlu_engine';
import { Brain, Cpu, MessageSquare, Zap, Activity, Clock, Tag, Smile, ShieldAlert, Sparkles, X } from 'lucide-react';

interface NluInsightModalProps {
  isOpen: boolean;
  onClose: () => void;
  latestNluResult: NluAnalysisResult | null;
}

export const NluInsightModal: React.FC<NluInsightModalProps> = ({
  isOpen,
  onClose,
  latestNluResult
}) => {
  const [testInput, setTestInput] = useState('');
  const [interactiveResult, setInteractiveResult] = useState<NluAnalysisResult | null>(null);

  if (!isOpen) return null;

  const handleTestAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testInput.trim()) return;
    const res = analyzeUtterance(testInput.trim());
    setInteractiveResult(res);
  };

  const activeData = interactiveResult || latestNluResult;

  const getIntentColor = (category: string) => {
    switch (category) {
      case 'system_control':
        return 'from-amber-500/20 to-orange-500/10 text-amber-300 border-amber-500/30';
      case 'vision_control':
        return 'from-cyan-500/20 to-blue-500/10 text-cyan-300 border-cyan-500/30';
      case 'application_control':
        return 'from-indigo-500/20 to-purple-500/10 text-indigo-300 border-indigo-500/30';
      case 'question':
      case 'information_query':
        return 'from-sky-500/20 to-teal-500/10 text-sky-300 border-sky-500/30';
      case 'workspace_action':
        return 'from-emerald-500/20 to-teal-500/10 text-emerald-300 border-emerald-500/30';
      case 'greeting':
      case 'farewell':
        return 'from-pink-500/20 to-rose-500/10 text-pink-300 border-pink-500/30';
      default:
        return 'from-zinc-800 to-zinc-900 text-zinc-300 border-zinc-700';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-2xl bg-zinc-950/95 border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-500/10 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Brain className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                Natural Language Understanding (NLU) Engine
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded-md border border-cyan-500/30">
                  Sub-ms Speed
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Real-time speech intent classification, entity extraction & contextual slot filling
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar text-sm">
          {/* Interactive Tester Input */}
          <form onSubmit={handleTestAnalyze} className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Live Speech / Utterance Tester
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="E.g., 'Jarvis, please set screen brightness to 75% and schedule meeting with Tony tomorrow at 5pm'"
                className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all text-xs"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-zinc-950 font-bold rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                Analyze
              </button>
            </div>
          </form>

          {/* NLU Analysis Breakdown */}
          {activeData ? (
            <div className="space-y-4 animate-fadeIn">
              {/* Primary Utterance Card */}
              <div className="p-4 rounded-xl bg-zinc-900/50 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                    Analyzed Speech Utterance
                  </span>
                  <span className="flex items-center gap-1 text-emerald-400 font-mono text-[11px]">
                    <Clock className="w-3 h-3" />
                    {activeData.processingTimeMs}ms
                  </span>
                </div>
                <p className="text-zinc-100 font-medium italic text-sm">
                  "{activeData.rawText}"
                </p>
              </div>

              {/* Grid: Intent & Sentiment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Intent Identification Card */}
                <div className={`p-4 rounded-xl bg-gradient-to-br border ${getIntentColor(activeData.intent.category)} space-y-2`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-bold tracking-wider opacity-80 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5" />
                      Primary Intent
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-black/40 border border-white/10">
                      {Math.round(activeData.intent.confidence * 100)}%
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white capitalize">
                      {activeData.intent.name.replace(/_/g, ' ')}
                    </h3>
                    <p className="text-xs opacity-80 mt-0.5">
                      Category: <span className="font-semibold text-white uppercase">{activeData.intent.category}</span>
                      {activeData.intent.subIntent && ` • Sub: ${activeData.intent.subIntent}`}
                    </p>
                  </div>
                </div>

                {/* Sentiment & Urgency Card */}
                <div className="p-4 rounded-xl bg-zinc-900/70 border border-white/10 space-y-2">
                  <span className="text-xs uppercase font-bold tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <Smile className="w-3.5 h-3.5 text-pink-400" />
                    Sentiment & Urgency
                  </span>
                  <div className="flex items-center gap-2 pt-1">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider ${
                      activeData.sentiment.polarity === 'positive'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : activeData.sentiment.polarity === 'negative'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                    }`}>
                      {activeData.sentiment.polarity}
                    </span>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider ${
                      activeData.sentiment.urgency === 'high'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse'
                        : activeData.sentiment.urgency === 'medium'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                    }`}>
                      {activeData.sentiment.urgency} Urgency
                    </span>
                    {activeData.sentiment.isPolite && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        Polite
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Extracted Entities */}
              <div className="p-4 rounded-xl bg-zinc-900/50 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase font-bold tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-400" />
                    Extracted Named Entities ({activeData.entities.length})
                  </span>
                </div>

                {activeData.entities.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {activeData.entities.map((entity, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-indigo-500/30 flex items-center gap-2 text-xs text-zinc-200"
                      >
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                          {entity.type}
                        </span>
                        <span className="font-semibold text-white">{entity.value}</span>
                        {entity.normalized !== undefined && entity.normalized !== entity.value && (
                          <span className="text-zinc-500 text-[11px]">→ {String(entity.normalized)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 italic">No specific named entities detected in this utterance.</p>
                )}
              </div>

              {/* Suggested Contextual Action / Tool */}
              {activeData.suggestedAction && (
                <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 space-y-2">
                  <span className="text-xs uppercase font-bold tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" />
                    Context-Aware Action Dispatch Recommendation
                  </span>
                  <div className="flex items-center justify-between bg-black/40 p-2.5 rounded-lg border border-cyan-500/20 font-mono text-xs text-cyan-200">
                    <span>Tool: <strong>{activeData.suggestedAction.toolName}</strong></span>
                    <span>Args: {JSON.stringify(activeData.suggestedAction.args)}</span>
                  </div>
                  {activeData.suggestedAction.responseHint && (
                    <p className="text-xs text-cyan-300/80 italic mt-1">
                      {activeData.suggestedAction.responseHint}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-zinc-500 space-y-2">
              <Brain className="w-12 h-12 mx-auto text-zinc-700 animate-pulse" />
              <p className="text-xs">No utterance analyzed yet. Type a test phrase above or speak to Jarvis.</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-white/10 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-400">
          <span>J.A.R.V.I.S. NLU & Intent Engine v1.0</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
