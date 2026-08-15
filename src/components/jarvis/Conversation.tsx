import { useEffect, useRef, useState } from "react";
import {
  Send,
  Sparkles,
  Trash2,
  Loader2,
  Download,
  Copy,
  Check,
  Mic,
  Terminal,
  User,
  Radio,
  Clock,
  Activity,
} from "lucide-react";
import { useJarvis, useMounted } from "./JarvisProvider";
import { PERSONAS } from "@/data/personas";
import { clock, timeAgo } from "@/lib/jarvis-data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const QUICK_DIRECTIVES = [
  "Status report",
  "Run hardware diagnostics",
  "List active swarm agents",
  "Check battery and thermals",
  "Triage unread emails",
  "Help",
];

export function Conversation() {
  const {
    messages,
    sendMessage,
    clearChat,
    thinking,
    selectedPersona,
    connectionState,
    outputVolume,
  } = useJarvis();

  const [value, setValue] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mounted = useMounted();

  // Auto-scroll down when new messages or streaming chunks arrive
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, messages[messages.length - 1]?.text, thinking]);

  const submit = (text?: string) => {
    const t = text ?? value;
    if (!t.trim()) return;
    sendMessage(t);
    setValue("");
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Message copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportChat = () => {
    if (messages.length === 0) {
      toast.error("Conversation log is empty.");
      return;
    }

    const transcript = messages
      .map((m) => {
        const time = new Date(m.at).toLocaleString();
        const sender = m.role === "user" ? "USER" : (m.personaName || m.personaId?.toUpperCase() || "JARVIS");
        const source = m.source ? ` [${m.source.toUpperCase()}]` : "";
        return `[${time}] ${sender}${source}:\n${m.text}\n`;
      })
      .join("\n---\n\n");

    const blob = new Blob([transcript], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `JARVIS-Session-Log-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Transcript exported as Markdown");
  };

  const activeAccent = selectedPersona.accentColor || "var(--cyan-hud)";
  const isSpeaking = connectionState === "speaking";

  return (
    <section className="bezel flex min-h-0 flex-col overflow-hidden rounded-2xl">
      {/* Console Header Bar */}
      <div className="flex items-center justify-between border-b border-[oklch(0_0_0/35%)] px-4 py-2.5 bg-black/20">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="etched text-[11px] font-bold tracking-[0.24em] text-muted-foreground flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            COMMAND CONSOLE &amp; CHAT LOG
          </span>
          <span
            className="neu-inset px-2.5 py-0.5 rounded-full text-[9.5px] font-mono font-bold transition-all duration-300 border"
            style={{
              color: activeAccent,
              borderColor: `color-mix(in oklab, ${activeAccent} 35%, transparent)`,
              boxShadow: `0 0 10px color-mix(in oklab, ${activeAccent} 15%, transparent)`,
            }}
          >
            {selectedPersona.name} ACTIVE
          </span>
          <span className="neu-inset px-2 py-0.5 rounded-full text-[9.5px] font-mono text-muted-foreground">
            {messages.length} Turns
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleExportChat}
            title="Export conversation transcript as Markdown"
            className="key flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-cyan-400 cursor-pointer"
          >
            <Download className="h-3 w-3" />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={clearChat}
            title="Clear conversation history"
            className="key flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-destructive cursor-pointer"
          >
            <Trash2 className="h-3 w-3" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </div>

      {/* Sequential Real-Time Conversation Stream */}
      <div
        ref={scrollContainerRef}
        className="screen flex max-h-72 min-h-36 flex-1 flex-col gap-3.5 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 && (
          <div className="py-10 text-center flex flex-col items-center justify-center">
            <Radio className="w-8 h-8 text-muted-foreground/30 mb-2 animate-pulse" />
            <p className="text-xs font-semibold text-muted-foreground">
              Direct telemetry &amp; conversation stream active.
            </p>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">
              Speak via microphone or type a command below for {selectedPersona.name}.
            </p>
          </div>
        )}

        {messages.map((m, idx) => {
          const isUser = m.role === "user";
          const isSystem = m.role === "system" || m.kind === "error";
          const msgPersona = !isUser && !isSystem
            ? PERSONAS.find((p) => p.id === (m.personaId || selectedPersona.id)) || selectedPersona
            : null;
          const personaColor = msgPersona?.accentColor || activeAccent;
          const isLatestAiMessage = !isUser && idx === messages.length - 1;

          if (isSystem) {
            return (
              <div
                key={m.id}
                className="animate-rise-in flex items-center justify-center gap-2 py-1 px-3 my-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11.5px] font-mono text-amber-300 max-w-xl mx-auto"
              >
                <Activity className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">{m.text}</span>
              </div>
            );
          }

          return (
            <div
              key={m.id}
              className={cn(
                "animate-rise-in relative flex gap-3 group transition-all",
                isUser ? "flex-row-reverse" : "flex-row"
              )}
            >
              {/* Avatar Icon */}
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs transition-all shadow-sm",
                  isUser
                    ? "neu-inset text-cyan-300 border border-cyan-500/30 bg-cyan-950/30"
                    : "neu-sm"
                )}
                style={!isUser ? { color: personaColor, borderColor: `color-mix(in oklab, ${personaColor} 40%, transparent)` } : undefined}
              >
                {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              </span>

              {/* Message Payload Content */}
              <div
                className={cn(
                  "min-w-0 max-w-[85%] sm:max-w-[78%] flex flex-col",
                  isUser ? "items-end" : "items-start"
                )}
              >
                {/* Meta Header */}
                <div className="mb-1 flex items-baseline gap-2 flex-wrap">
                  <span
                    className={cn(
                      "text-xs font-bold tracking-wide transition-colors",
                      isUser ? "text-cyan-hud" : ""
                    )}
                    style={!isUser ? { color: personaColor } : undefined}
                  >
                    {isUser ? "YOU" : (msgPersona ? msgPersona.name : "JARVIS")}
                  </span>

                  {/* Provenance Badge (Voice vs Text) */}
                  <span className="neu-inset px-1.5 py-0.2 rounded text-[8.5px] font-mono text-muted-foreground tracking-wider uppercase flex items-center gap-0.5">
                    {m.source === "voice" ? (
                      <>
                        <Mic className="w-2.5 h-2.5 text-emerald-400" /> Voice
                      </>
                    ) : (
                      <>
                        <Terminal className="w-2.5 h-2.5 text-cyan-400" /> Text
                      </>
                    )}
                  </span>

                  <span className="font-mono text-[9.5px] text-muted-foreground/70">
                    {mounted ? clock(m.at) : ""}
                  </span>
                </div>

                {/* Optional Vision Screenshot Preview */}
                {m.imageUrl && (
                  <div className="mb-2 max-w-xs overflow-hidden rounded-xl border border-white/10 shadow-lg">
                    <img src={m.imageUrl} alt="Vision Capture" className="w-full h-auto object-cover" />
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={cn(
                    "rounded-2xl p-3.5 text-left text-[12.5px] leading-relaxed break-words whitespace-pre-wrap transition-all shadow-md",
                    isUser
                      ? "neu-inset bg-cyan-950/20 border border-cyan-500/30 text-foreground"
                      : "neu gloss border border-white/10 text-foreground/95"
                  )}
                >
                  {m.kind === "confirm" && <span className="mr-1 text-emerald-hud font-bold">✔ </span>}
                  {m.text}

                  {/* Micro audio pulse indicator if AI is currently speaking this turn */}
                  {isLatestAiMessage && isSpeaking && (
                    <span className="inline-flex items-center gap-1 ml-2 text-emerald-400 animate-pulse">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="text-[10px] font-mono font-bold tracking-wider">SPEAKING</span>
                    </span>
                  )}
                </div>

                {/* Hover Copy Quick Action */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 flex items-center gap-1.5">
                  <button
                    onClick={() => handleCopyMessage(m.id, m.text)}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-cyan-400 px-1.5 py-0.5 rounded cursor-pointer"
                  >
                    {copiedId === m.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedId === m.id ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Live Connecting Banner */}
        {connectionState === "connecting" && (
          <div className="animate-rise-in flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-300 shadow-[0_0_12px_var(--amber-hud)]">
            <Loader2 className="h-4 w-4 animate-spin shrink-0 text-amber-400" />
            <div className="min-w-0 flex-1">
              <p className="font-bold tracking-wide">INITIALIZING LIVE VOICE STREAM</p>
              <p className="text-[11px] text-amber-200/80">
                Establishing 16kHz duplex WebSocket connection for <strong>{selectedPersona.name}</strong>…
              </p>
            </div>
          </div>
        )}

        {/* Thinking / Neural Processing Banner */}
        {thinking && (
          <div
            className="flex items-center gap-2 pl-11 text-xs transition-colors"
            style={{ color: activeAccent }}
          >
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <i
                  key={i}
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    backgroundColor: activeAccent,
                    animation: `core-pulse 1s ease-in-out ${i * 0.18}s infinite`,
                  }}
                />
              ))}
            </span>
            <span>{selectedPersona.name} processing directive…</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Quick Directives Bar */}
      <div className="flex flex-wrap gap-1.5 px-4 pb-2 pt-2.5 border-t border-white/5 bg-black/10">
        {QUICK_DIRECTIVES.map((q) => (
          <button
            key={q}
            onClick={() => submit(q)}
            className="key rounded-full px-3 py-1 text-[10.5px] font-semibold text-muted-foreground hover:text-cyan-hud cursor-pointer transition-colors"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input Directive Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-center gap-2 px-4 pb-3.5 pt-1"
      >
        <div className="neu-inset flex min-w-0 flex-1 items-center rounded-xl px-3.5 py-2.5 border border-white/10 focus-within:border-cyan-400 transition-colors">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`Directive for ${selectedPersona.name} (voice & text streaming synchronized)…`}
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/80"
          />
        </div>
        <button
          type="submit"
          aria-label="Send directive"
          style={{ color: activeAccent }}
          className="key grid h-11 w-11 shrink-0 place-items-center rounded-xl glow-ring cursor-pointer transition-colors hover:scale-105 active:scale-95"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}
