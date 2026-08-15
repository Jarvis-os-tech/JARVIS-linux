import React from 'react';
import { VoicePersona } from '../types';
import { Sparkles, Compass, Zap, Bot, Skull, Glasses, Shield, Check, Cpu } from 'lucide-react';

interface PersonaCardProps {
  personas: VoicePersona[];
  selectedPersonaId: string;
  onSelectPersona: (persona: VoicePersona) => void;
  disabled?: boolean;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Bot: <Bot className="w-5 h-5" />,
  Zap: <Zap className="w-5 h-5" />,
  Skull: <Skull className="w-5 h-5" />,
  Glasses: <Glasses className="w-5 h-5" />,
  Shield: <Shield className="w-5 h-5" />,
  Compass: <Compass className="w-5 h-5" />,
  Sparkles: <Sparkles className="w-5 h-5" />,
  Cpu: <Cpu className="w-5 h-5" />
};

export const PersonaCard: React.FC<PersonaCardProps> = ({
  personas,
  selectedPersonaId,
  onSelectPersona,
  disabled,
}) => {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-2">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Choose MCU AI Persona
        </h2>
        <span className="text-xs text-zinc-500">
          Powered by Gemini Live & 24kHz Audio
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {personas.map((persona) => {
          const isSelected = persona.id === selectedPersonaId;
          const icon = ICON_MAP[persona.avatarIcon] || <Bot className="w-5 h-5" />;

          return (
            <button
              key={persona.id}
              onClick={() => onSelectPersona(persona)}
              disabled={disabled}
              className={`group relative text-left p-3.5 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
                isSelected
                  ? 'bg-white/15 border-cyan-500/50 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/40'
                  : 'glass-card hover:bg-white/10 border-white/10 hover:border-white/20'
              } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:scale-[1.02]'}`}
            >
              {isSelected && (
                <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-cyan-500 text-black flex items-center justify-center shadow-md font-bold">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              )}

              <div>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2.5 ${
                  isSelected ? 'bg-cyan-500 text-zinc-950 shadow-md shadow-cyan-500/30 font-bold' : 'glass-pill text-zinc-300 group-hover:bg-white/20 group-hover:text-white'
                }`}>
                  {icon}
                </div>

                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-1.5">
                  {persona.name}
                </h3>
                <p className="text-[11px] font-medium text-cyan-300 mb-1 line-clamp-1">
                  {persona.role}
                </p>
                <p className="text-xs text-zinc-400 line-clamp-2 leading-tight">
                  {persona.tagline}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] text-zinc-400">
                <span>Voice: <strong className="text-zinc-200 font-medium">{persona.voiceName}</strong></span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
