import { cn } from "@/lib/utils";

export function Toggle({
  on,
  onToggle,
  label,
}: {
  on: boolean;
  onToggle: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label ?? "Toggle"}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors",
        on
          ? "bg-[color-mix(in_oklab,var(--cyan-hud)_85%,transparent)] shadow-[0_0_12px_var(--cyan-hud)]"
          : "neu-inset bg-[color-mix(in_oklab,var(--track-bg)_90%,transparent)]",
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 rounded-full shadow-[0_2px_4px_oklch(0_0_0/50%)] transition-transform",
          on
            ? "translate-x-5 bg-primary-foreground"
            : "translate-x-0 bg-muted-foreground/80",
        )}
      />
    </button>
  );
}
