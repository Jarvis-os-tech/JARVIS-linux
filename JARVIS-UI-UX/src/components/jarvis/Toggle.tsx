import { cn } from "@/lib/utils";

/** Skeuomorphic hardware switch: recessed track + machined knob. */
export function Toggle({
  on,
  onToggle,
  label,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={cn(
        "neu-inset relative h-7 w-[3.25rem] shrink-0 rounded-full transition-colors",
        on && "bg-[color-mix(in_oklab,var(--cyan-hud)_22%,oklch(0.19_0.012_256))]",
      )}
    >
      <span
        className={cn(
          "absolute top-1/2 h-5.5 w-5.5 -translate-y-1/2 rounded-full transition-all duration-200",
          "bg-[var(--metal)] border border-[oklch(1_0_0/18%)]",
          on
            ? "left-[1.6rem] shadow-[0_2px_6px_oklch(0_0_0/60%),inset_0_1px_0_oklch(1_0_0/40%),0_0_12px_var(--cyan-hud)]"
            : "left-1 shadow-[0_2px_6px_oklch(0_0_0/60%),inset_0_1px_0_oklch(1_0_0/30%)]",
        )}
      />
    </button>
  );
}
