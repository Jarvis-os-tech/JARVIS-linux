import React, { Component, useState } from "react";
import { JarvisProvider } from "./components/jarvis/JarvisProvider";
import { JarvisApp } from "./components/jarvis/JarvisApp";
import { ClassicApp } from "./components/ClassicApp";
import { Toaster } from "./components/ui/sonner";
import { AlertTriangle, RefreshCw, LayoutGrid } from "lucide-react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onFallbackToClassic: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ModernUiErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Critical error caught in Modern UI:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white font-sans">
          <div className="max-w-md w-full bg-slate-900 border border-red-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-8 h-8 shrink-0" />
              <div>
                <h2 className="text-lg font-bold">MK-VII Console Exception</h2>
                <p className="text-xs text-slate-400">Safe recovery mode engaged</p>
              </div>
            </div>

            <div className="bg-black/50 border border-white/10 rounded-xl p-3 text-xs font-mono text-slate-300 overflow-x-auto max-h-32">
              {this.state.error?.message || "An unexpected rendering error occurred."}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry MK-VII</span>
              </button>
              <button
                onClick={this.props.onFallbackToClassic}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 transition-all cursor-pointer"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Revert to Classic</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [uiMode, setUiMode] = useState<"modern" | "classic">(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const queryUi = params.get("ui");
      if (queryUi === "classic" || queryUi === "modern") {
        return queryUi;
      }
      const saved = localStorage.getItem("jarvis_ui_version");
      if (saved === "classic" || saved === "modern") {
        return saved;
      }
    }
    return "modern";
  });

  const handleSwitchMode = (mode: "modern" | "classic") => {
    setUiMode(mode);
    localStorage.setItem("jarvis_ui_version", mode);
  };

  return (
    <>
      {uiMode === "modern" ? (
        <ModernUiErrorBoundary onFallbackToClassic={() => handleSwitchMode("classic")}>
          <JarvisProvider onSwitchToClassic={() => handleSwitchMode("classic")}>
            <JarvisApp />
          </JarvisProvider>
        </ModernUiErrorBoundary>
      ) : (
        <ClassicApp onSwitchToModern={() => handleSwitchMode("modern")} />
      )}
      <Toaster richColors position="bottom-right" />
    </>
  );
}
