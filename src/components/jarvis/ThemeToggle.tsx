import { Monitor, Moon, Sun } from "lucide-react";
import { applyTheme, useTheme, type Theme } from "@/lib/theme";
import { useMounted } from "./JarvisProvider";
import { cn } from "@/lib/utils";

const opts: { id: Theme; icon: typeof Sun; label: string }[] = [
  { id: "light", icon: Sun, label: "Aluminium (Light)" },
  { id: "dark", icon: Moon, label: "Graphite (Dark)" },
  { id: "system", icon: Monitor, label: "System OS" },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  return (
    <div
      role="radiogroup"
      aria-label="Chassis theme finish"
      className={cn("neu-inset inline-flex items-center gap-1 rounded-xl p-1", className)}
    >
      {opts.map(({ id, icon: Icon, label }) => {
        const active = mounted && theme === id;
        return (
          <button
            key={id}
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(id)}
            className={cn(
              "key relative grid h-8 w-8 place-items-center rounded-lg text-xs transition-colors",
              active
                ? "neu-sm text-cyan-hud glow-ring-soft"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
