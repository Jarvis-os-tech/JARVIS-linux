import { useState } from "react";
import { Send, Loader2, Terminal } from "lucide-react";
import { useJarvis } from "./JarvisProvider";
import { cn } from "@/lib/utils";

export function Conversation() {
  const {
    sendMessage,
    thinking,
    selectedPersona,
  } = useJarvis();

  const [value, setValue] = useState("");

  const submit = (text?: string) => {
    const t = text ?? value;
    if (!t.trim()) return;
    sendMessage(t);
    setValue("");
  };

  const activeAccent = selectedPersona?.accentColor || "var(--cyan-hud)";

  return (
    <div className="w-full pt-1">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="relative flex items-center gap-2"
      >
        <div className="neu-inset flex min-w-0 flex-1 items-center rounded-2xl px-4 py-3 border border-white/10 focus-within:border-cyan-400/60 focus-within:shadow-[0_0_15px_rgba(6,182,212,0.15)] transition-all bg-black/30 backdrop-blur-md">
          <Terminal className="w-4 h-4 text-cyan-400/70 mr-2.5 shrink-0" />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`Directive for ${selectedPersona?.name || "JARVIS"} (Type command and press Enter)...`}
            className="min-w-0 flex-1 bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground/60 font-medium"
          />
          {thinking && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 text-[11px] font-mono animate-pulse shrink-0">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="hidden sm:inline">Processing…</span>
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={!value.trim()}
          aria-label="Send directive"
          style={{
            color: value.trim() ? activeAccent : undefined,
            borderColor: value.trim() ? `color-mix(in oklab, ${activeAccent} 40%, transparent)` : undefined,
          }}
          className={cn(
            "key grid h-12 w-12 shrink-0 place-items-center rounded-2xl glow-ring cursor-pointer transition-all",
            value.trim()
              ? "hover:scale-105 active:scale-95 text-cyan-hud shadow-[0_0_12px_rgba(6,182,212,0.25)]"
              : "opacity-40 cursor-not-allowed text-muted-foreground"
          )}
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
