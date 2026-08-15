export function Backdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{
        background: `
          radial-gradient(130% 90% at 50% 0%, var(--backdrop-top) 0%, transparent 65%),
          radial-gradient(90% 70% at 50% 100%, var(--vignette) 0%, transparent 80%),
          var(--background)
        `,
      }}
    >
      {/* subtle brushed metal pattern */}
      <div className="brushed absolute inset-0 opacity-70" />

      {/* geometric HUD grid overlay */}
      <div className="hud-grid absolute inset-0 opacity-40" />

      {/* ambient floating color flares */}
      <div
        className="animate-drift-a absolute -left-24 -top-32 h-[34rem] w-[34rem] rounded-full opacity-35 blur-3xl"
        style={{
          background: "radial-gradient(circle, var(--cyan-hud) 0%, transparent 70%)",
        }}
      />
      <div
        className="animate-drift-b absolute -bottom-40 -right-24 h-[38rem] w-[38rem] rounded-full opacity-30 blur-3xl"
        style={{
          background: "radial-gradient(circle, var(--violet-hud) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}
