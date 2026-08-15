export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_-10%,var(--backdrop-top),var(--background)_62%)]" />
      <div className="hud-grid absolute inset-0 opacity-50" />
      <div className="brushed absolute inset-0 opacity-40" />
      <div className="animate-drift-a absolute -left-40 -top-48 h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--cyan-hud)_30%,transparent),transparent_70%)] blur-[110px] opacity-40" />
      <div className="animate-drift-b absolute -bottom-52 -right-32 h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--blue-hud)_28%,transparent),transparent_70%)] blur-[120px] opacity-35" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_38%,var(--vignette)_100%)]" />
    </div>
  );
}
