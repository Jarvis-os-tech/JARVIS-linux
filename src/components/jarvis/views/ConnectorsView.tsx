import { useState, useEffect } from "react";
import { Plug, Key, CheckCircle, ExternalLink, RefreshCw } from "lucide-react";
import { useJarvis } from "../JarvisProvider";
import { Toggle } from "../Toggle";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ConnectorItem {
  id: string;
  name: string;
  desc: string;
  status: boolean;
  color: string;
  category: string;
  statusText?: string;
}

export function ConnectorsView() {
  const { pushLog, pushNotification, googleAccessToken, setGoogleAccessToken, connectionState } = useJarvis();
  const [isTokenOpen, setIsTokenOpen] = useState(false);
  const [tokenValue, setTokenValue] = useState(googleAccessToken);
  const [loading, setLoading] = useState(false);

  const [connectors, setConnectors] = useState<ConnectorItem[]>([
    {
      id: "c1",
      name: "Google Workspace Hub",
      desc: "Autonomous read/write integration across Gmail, Calendar, Docs, Sheets & Drive.",
      status: !!googleAccessToken,
      color: "var(--cyan-hud)",
      category: "Cloud Services",
      statusText: googleAccessToken ? "Active & Linked" : "OAuth Token Required",
    },
    {
      id: "c2",
      name: "C++ Linux Actuators (workers_cpp)",
      desc: "Sub-millisecond POSIX C++ binaries for Mutter D-Bus, PulseAudio & system controls.",
      status: true,
      color: "var(--emerald-hud)",
      category: "System Hardware",
      statusText: "Active & Linked",
    },
    {
      id: "c3",
      name: "Gemini Live API WebSocket",
      desc: "16kHz/24kHz bi-directional live conversational voice and multimodal vision streaming.",
      status: true,
      color: "var(--violet-hud)",
      category: "Voice & Vision",
      statusText: connectionState === "speaking" || connectionState === "listening" ? "Streaming Live" : "Ready to Connect",
    },
    {
      id: "c4",
      name: "Groq Cloud High-Speed Dispatch",
      desc: "Sub-25ms ultra-fast tactical reasoning and command parsing engine.",
      status: false,
      color: "var(--amber-hud)",
      category: "AI Reasoning",
      statusText: "Checking...",
    },
    {
      id: "c5",
      name: "NVIDIA NIM Systems Architecture",
      desc: "Deep code analysis, system forensics, and multi-step architectural planning.",
      status: false,
      color: "var(--blue-hud)",
      category: "Deep Systems",
      statusText: "Checking...",
    },
    {
      id: "c6",
      name: "Playwright Browser Automation",
      desc: "Headless web crawling, DOM extraction, and autonomous form execution.",
      status: true,
      color: "var(--pink-hud)",
      category: "Web & Network",
      statusText: "Available",
    },
  ]);

  const pollRealStatuses = async () => {
    setLoading(true);
    try {
      const [healthRes, provRes] = await Promise.all([
        fetch("/api/health").then((r) => r.json()).catch(() => ({ hasApiKey: false })),
        fetch("/api/providers/status").then((r) => r.json()).catch(() => ({ activeEngines: {} })),
      ]);

      const groqConfigured = !!provRes?.activeEngines?.groq?.configured;
      const nvidiaConfigured = !!provRes?.activeEngines?.nvidia?.configured;
      const geminiConfigured = !!healthRes?.hasApiKey;
      const hasGoogle = !!(googleAccessToken || localStorage.getItem("g_access_token"));

      setConnectors((prev) =>
        prev.map((c) => {
          if (c.id === "c1") {
            return {
              ...c,
              status: hasGoogle,
              statusText: hasGoogle ? "Active & Linked" : "OAuth Token Required",
            };
          }
          if (c.id === "c3") {
            return {
              ...c,
              status: geminiConfigured,
              statusText: geminiConfigured ? "Live API Linked" : "GEMINI_API_KEY Required",
            };
          }
          if (c.id === "c4") {
            return {
              ...c,
              status: groqConfigured,
              statusText: groqConfigured ? "Groq Cloud Online" : "GROQ_API_KEY Missing",
            };
          }
          if (c.id === "c5") {
            return {
              ...c,
              status: nvidiaConfigured,
              statusText: nvidiaConfigured ? "NVIDIA NIM Online" : "NVIDIA_API_KEY Missing",
            };
          }
          return c;
        })
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    pollRealStatuses();
  }, [googleAccessToken]);

  const onlineCount = connectors.filter((c) => c.status).length;

  const toggle = (id: string) => {
    setConnectors((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next = !c.status;
        queueMicrotask(() => {
          pushLog(`${c.name} ${next ? "enabled" : "disabled"}.`);
          pushNotification("🔌", `${c.name} ${next ? "enabled" : "disabled"}.`);
          toast(`${c.name} ${next ? "enabled" : "disabled"}`);
        });
        return { ...c, status: next, statusText: next ? "Manual Link" : "Offline" };
      })
    );
  };

  const handleSaveToken = () => {
    setGoogleAccessToken(tokenValue.trim());
    localStorage.setItem("g_access_token", tokenValue.trim());
    pushLog("Google Workspace OAuth access token updated.");
    toast.success("Google Workspace token updated");
    setIsTokenOpen(false);
    pollRealStatuses();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display etched text-2xl font-bold tracking-wide">MCPs &amp; Connectors</h1>
            <span className="neu-inset px-2.5 py-0.5 rounded-full text-[10.5px] font-bold text-cyan-hud border border-cyan-500/20">
              {onlineCount} of {connectors.length} Ports Active
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Actuators, tool protocols, cloud hubs, and microservices reachable by the JARVIS orchestrator.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setIsTokenOpen(!isTokenOpen)}
            className="key flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-bold text-blue-400 cursor-pointer"
          >
            <Key className="w-3.5 h-3.5" />
            <span>OAuth Tokens</span>
          </button>
          <button
            onClick={() => {
              setConnectors((prev) => prev.map((c) => ({ ...c, status: true })));
              pushLog("All connector ports activated.");
              toast.success("All connectors online");
            }}
            className="key rounded-xl px-3.5 py-2 text-[12px] font-bold text-cyan-hud cursor-pointer"
          >
            Connect All
          </button>
        </div>
      </header>

      {/* Google Token Config Box */}
      {isTokenOpen && (
        <div className="animate-rise-in mb-4 neu rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-2">
              <Key className="w-4 h-4 text-cyan-400" />
              Google Workspace OAuth Access Token
            </span>
            <span className="text-[10px] text-muted-foreground">Used for Gmail, Calendar, Docs, Sheets, Drive</span>
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="ya29.a0AfH6SM..."
              value={tokenValue}
              onChange={(e) => setTokenValue(e.target.value)}
              className="flex-1 neu-inset rounded-xl px-3.5 py-2 text-xs font-mono text-foreground outline-none"
            />
            <button
              onClick={handleSaveToken}
              className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Save Token
            </button>
          </div>
        </div>
      )}

      {/* Connectors Grid */}
      <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(17.5rem,1fr))] gap-3.5 overflow-y-auto pb-4 pr-1">
        {connectors.map((c) => (
          <article key={c.id} className="neu gloss animate-rise-in rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-3">
                <span
                  className="neu-inset grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                  style={{ color: c.color }}
                >
                  <Plug className="h-4.5 w-4.5" />
                </span>
                <Toggle on={c.status} onToggle={() => toggle(c.id)} label={`Toggle ${c.name}`} />
              </div>

              <div className="mt-3">
                <span className="neu-inset rounded-md px-2 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground font-bold font-mono">
                  {c.category}
                </span>
                <h3 className="mt-1 text-[13.5px] font-bold text-foreground">{c.name}</h3>
                <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{c.desc}</p>
              </div>
            </div>

            <div className="mt-4 pt-2 border-t border-white/5 flex items-center justify-between">
              <p
                className={cn(
                  "flex items-center gap-2 text-[11px] font-bold",
                  c.status ? "text-emerald-hud" : "text-muted-foreground",
                )}
              >
                <i
                  className={cn(
                    "h-2 w-2 rounded-full",
                    c.status ? "led bg-emerald-hud text-emerald-hud" : "bg-muted-foreground/50",
                  )}
                />
                {c.statusText || (c.status ? "Active & Linked" : "Offline")}
              </p>
              <span className="font-mono text-[10px] text-muted-foreground font-bold">
                {c.status ? "PORT OPEN" : "STANDBY"}
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
