import React from 'react';
import { QuickPrompt } from '../types';
import { 
  Smile, Lightbulb, Sparkles, Coffee, 
  Calendar, Mail, FileText, Table, CheckSquare, Bot, Zap, Skull, Glasses, Shield, Compass,
  Cpu, Terminal, Search, Camera, Volume2, Sun, BatteryCharging, Activity
} from 'lucide-react';

interface QuickPromptsProps {
  prompts: QuickPrompt[];
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Smile: <Smile className="w-4 h-4 text-rose-400" />,
  Lightbulb: <Lightbulb className="w-4 h-4 text-amber-400" />,
  Sparkles: <Sparkles className="w-4 h-4 text-indigo-400" />,
  Coffee: <Coffee className="w-4 h-4 text-emerald-400" />,
  Calendar: <Calendar className="w-4 h-4 text-blue-400" />,
  Mail: <Mail className="w-4 h-4 text-rose-400" />,
  FileText: <FileText className="w-4 h-4 text-cyan-400" />,
  Table: <Table className="w-4 h-4 text-emerald-400" />,
  CheckSquare: <CheckSquare className="w-4 h-4 text-amber-400" />,
  Bot: <Bot className="w-4 h-4 text-cyan-400" />,
  Zap: <Zap className="w-4 h-4 text-amber-400" />,
  Skull: <Skull className="w-4 h-4 text-red-400" />,
  Glasses: <Glasses className="w-4 h-4 text-indigo-400" />,
  Shield: <Shield className="w-4 h-4 text-emerald-400" />,
  Compass: <Compass className="w-4 h-4 text-yellow-400" />,
  Cpu: <Cpu className="w-4 h-4 text-cyan-400" />,
  Terminal: <Terminal className="w-4 h-4 text-amber-400" />,
  Search: <Search className="w-4 h-4 text-indigo-400" />,
  Camera: <Camera className="w-4 h-4 text-rose-400" />,
  Volume2: <Volume2 className="w-4 h-4 text-blue-400" />,
  Sun: <Sun className="w-4 h-4 text-amber-400" />,
  BatteryCharging: <BatteryCharging className="w-4 h-4 text-emerald-400" />,
  Activity: <Activity className="w-4 h-4 text-rose-400" />
};


export const QuickPrompts: React.FC<QuickPromptsProps> = ({
  prompts,
  onSelectPrompt,
  disabled,
}) => {
  return (
    <div className="w-full max-w-xl mx-auto my-2 px-4">
      <p className="text-center text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-2.5">
        Or tap a topic to kick off conversation
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {prompts.map((p) => {
          const icon = ICON_MAP[p.iconName] || <Sparkles className="w-4 h-4 text-rose-400" />;

          return (
            <button
              key={p.id}
              onClick={() => onSelectPrompt(p.prompt)}
              disabled={disabled}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full glass-pill hover:bg-white/15 text-xs font-medium text-zinc-200 shadow-md transition-all hover:scale-105 disabled:opacity-50 cursor-pointer border border-white/10"
            >
              {icon}
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
