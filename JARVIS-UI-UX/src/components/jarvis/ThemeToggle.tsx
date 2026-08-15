import { Monitor, Moon, Sun } from "lucide-react";
import { applyTheme, useTheme, type Theme } from "@/lib/theme";
import { useMounted } from "./JarvisProvider";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Theme; label: string; Icon: typeof Moon }[] = [
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
  { value: "light", label: "Bright", Icon: Sun },
];

/**
 * Segmented chassis-mode switch. Stays neutral (no active segment) during SSR
 * and the first client render so hydration matches byte-for-byte; the no-flash
 * inline script in __root has already applied the correct chassis to <html>,
 * and this control settles its highlight to the stored choice right after mount.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const mounted = useMounted();
  const { theme, setTheme } = useTheme();
  // Before mount both server and client render "system" → identical markup.
  const active = mounted ? theme : "system";

  return (
    <div
      role="radiogroup"
      aria-label="Chassis mode"
      className={cn("neu-inset flex items-center gap-1 rounded-xl p-1", className)}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const on = active === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${label} mode`}
            title={label}
            onClick={() => {
              setTheme(value);
              applyTheme(value);
            }}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-lg transition-all",
              on
                ? "key text-cyan-hud glow-ring-soft"
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
