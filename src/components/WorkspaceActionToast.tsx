import React from "react";
import { Sparkles, X, ExternalLink } from "lucide-react";
import { WorkspaceActionItem } from "../types";

interface WorkspaceActionToastProps {
  action: WorkspaceActionItem;
  onDismiss: () => void;
}

export function WorkspaceActionToast({ action, onDismiss }: WorkspaceActionToastProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-zinc-900/95 border border-cyan-500/40 rounded-2xl shadow-2xl p-4 backdrop-blur-xl animate-fade-in flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
            J.A.R.V.I.S. Action
          </span>
        </div>
        <button
          onClick={onDismiss}
          className="text-zinc-400 hover:text-white cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="text-xs text-zinc-100 font-medium">
        {action.title}
      </div>
      <p className="text-[11px] text-zinc-400 leading-relaxed">{action.summary}</p>
      {action.linkUrl && (
        <a
          href={action.linkUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-cyan-600/20"
        >
          Open in Google Workspace <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
  );
}
