import React from 'react';
import { AgentConfig, PrebuiltVoiceName } from '../types';
import { X, Sliders, Volume2, Mic, Sparkles } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AgentConfig;
  onUpdateConfig: (newConfig: Partial<AgentConfig>) => void;
}

const PREBUILT_VOICES: { name: PrebuiltVoiceName; description: string }[] = [
  { name: 'Puck', description: 'Articulate, witty masculine voice (Default for J.A.R.V.I.S.)' },
  { name: 'Kore', description: 'Sharp, confident feminine voice (Default for F.R.I.D.A.Y.)' },
  { name: 'Charon', description: 'Deep, resonant, dramatic voice (Default for ULTRON)' },
  { name: 'Zephyr', description: 'Calm, precise, tactical voice (Default for E.D.I.T.H.)' },
  { name: 'Aoede', description: 'Warm, clear, supportive voice (Default for K.A.R.E.N.)' },
  { name: 'Fenrir', description: 'Serene, intellectual, deep voice (Default for VISION)' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-zinc-900 text-white rounded-xl">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-900 leading-tight">
                Audio & Agent Settings
              </h3>
              <p className="text-xs text-zinc-500">
                Customize voice synthesis and Gemini Live parameters
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto text-xs sm:text-sm">
          {/* Voice Selection */}
          <div>
            <label className="block font-medium text-zinc-800 mb-2 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-zinc-500" />
              Prebuilt Gemini Voice
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PREBUILT_VOICES.map((v) => (
                <button
                  key={v.name}
                  type="button"
                  onClick={() => onUpdateConfig({ voiceName: v.name })}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    config.voiceName === v.name
                      ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                      : 'bg-zinc-50/50 hover:bg-zinc-100/80 border-zinc-200 text-zinc-700'
                  }`}
                >
                  <div className="font-semibold text-xs">{v.name}</div>
                  <div className={`text-[11px] mt-0.5 ${config.voiceName === v.name ? 'text-zinc-300' : 'text-zinc-500'}`}>
                    {v.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Instruction */}
          <div>
            <label className="block font-medium text-zinc-800 mb-1.5 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-500" />
              Custom Personality & Behavior Prompt
            </label>
            <p className="text-xs text-zinc-500 mb-2">
              Override or add specific style guidelines (e.g., "Speak with a friendly British cadence", "Keep sentences under 10 words").
            </p>
            <textarea
              rows={3}
              value={config.customInstruction}
              onChange={(e) => onUpdateConfig({ customInstruction: e.target.value })}
              placeholder="e.g. Talk like a friendly tech enthusiast who loves puns..."
              className="w-full p-3 text-xs bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white resize-none"
            />
          </div>

          {/* Mic Sensitivity */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-medium text-zinc-800 flex items-center gap-2">
                <Mic className="w-4 h-4 text-zinc-500" />
                Mic Input Sensitivity
              </label>
              <span className="text-xs font-semibold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-md">
                Level {config.micSensitivity}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={config.micSensitivity}
              onChange={(e) => onUpdateConfig({ micSensitivity: Number(e.target.value) })}
              className="w-full accent-zinc-900 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-zinc-400 mt-1">
              <span>Low (Quiet room)</span>
              <span>High (Noisy room)</span>
            </div>
          </div>

          {/* Real-time Toggles */}
          <div className="pt-2 border-t border-zinc-100 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-zinc-800">Live Speech Transcription</p>
                <p className="text-xs text-zinc-500">Show real-time transcribed user & agent text</p>
              </div>
              <input
                type="checkbox"
                checked={config.enableTranscription}
                onChange={(e) => onUpdateConfig({ enableTranscription: e.target.checked })}
                className="w-4 h-4 accent-zinc-900 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs rounded-2xl transition-colors"
          >
            Save & Apply
          </button>
        </div>
      </div>
    </div>
  );
};
