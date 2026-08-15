import { useEffect, useRef, useState } from "react";
import { Send, Sparkle, Trash2 } from "lucide-react";
import { useJarvis, useMounted } from "./JarvisProvider";
import { clock } from "@/lib/jarvis-data";
import { cn } from "@/lib/utils";

const quick = [
  "Status report",
  "List agents",
  "Create mission: weekly digest",
  "Pause all missions",
  "Help",
];

export function Conversation() {
  const { messages, sendMessage, clearChat, thinking } = useJarvis();
  const [value, setValue] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const mounted = useMounted();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, thinking]);

  const submit = (text?: string) => {
    const t = text ?? value;
    if (!t.trim()) return;
    sendMessage(t);
    setValue("");
  };

  return (
    <section className="bezel flex min-h-0 flex-col overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-[oklch(0_0_0/35%)] px-4 py-2.5">
        <span className="etched text-[11px] font-bold tracking-[0.24em] text-muted-foreground">
          COMMAND CONSOLE
        </span>
        <button
          onClick={clearChat}
          className="key flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" /> Clear
        </button>
      </div>

      <div className="screen flex max-h-64 min-h-32 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            Channel clear. Type a directive to brief me.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="animate-rise-in relative flex gap-3">
            <span
              className={cn(
                "grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs",
                m.role === "jarvis" ? "neu-sm text-cyan-hud" : "neu-inset text-muted-foreground",
              )}
            >
              {m.role === "jarvis" ? <Sparkle className="h-3.5 w-3.5" /> : "Y"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-baseline gap-2">
                <span
                  className={cn(
                    "text-xs font-bold tracking-wide",
                    m.role === "jarvis" ? "text-cyan-hud" : "text-foreground",
                  )}
                >
                  {m.role === "jarvis" ? "JARVIS" : "YOU"}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {mounted ? clock(m.at) : ""}
                </span>
              </div>
              <p
                className={cn(
                  "text-[13px] leading-relaxed",
                  m.kind === "confirm" ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {m.kind === "confirm" && <span className="mr-1 text-emerald-hud">✔</span>}
                {m.text}
              </p>
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex items-center gap-2 pl-10 text-xs text-cyan-hud">
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <i
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-cyan-hud"
                  style={{ animation: `core-pulse 1s ease-in-out ${i * 0.18}s infinite` }}
                />
              ))}
            </span>
            Processing directive…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex flex-wrap gap-2 px-4 pb-2 pt-3">
        {quick.map((q) => (
          <button
            key={q}
            onClick={() => submit(q)}
            className="key rounded-full px-3 py-1 text-[11px] font-semibold text-muted-foreground hover:text-cyan-hud"
          >
            {q}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-center gap-2 px-4 pb-4"
      >
        <div className="neu-inset flex min-w-0 flex-1 items-center rounded-xl px-3.5 py-2.5">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter a directive…"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
          />
        </div>
        <button
          type="submit"
          aria-label="Send directive"
          className="key grid h-11 w-11 shrink-0 place-items-center rounded-xl text-cyan-hud glow-ring"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}
