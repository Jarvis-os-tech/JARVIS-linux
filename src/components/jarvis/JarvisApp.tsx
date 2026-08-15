import { Backdrop } from "./Backdrop";
import { MissionRail } from "./MissionRail";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useJarvis } from "./JarvisProvider";
import { DashboardView } from "./views/DashboardView";
import { AgentsView } from "./views/AgentsView";
import { ConnectorsView } from "./views/ConnectorsView";
import { MemoryView } from "./views/MemoryView";
import { MissionControlView } from "./views/MissionControlView";
import { SettingsView } from "./views/SettingsView";
import { WorkflowsView } from "./views/WorkflowsView";
import { WorkspaceActionToast } from "@/components/WorkspaceActionToast";
import { VisionPreviewModal } from "@/components/VisionPreviewModal";

function ViewRouter() {
  const { view } = useJarvis();
  switch (view) {
    case "dashboard":
      return <DashboardView />;
    case "memory":
      return <MemoryView />;
    case "agents":
      return <AgentsView />;
    case "connectors":
      return <ConnectorsView />;
    case "mission":
      return <MissionControlView />;
    case "workflows":
      return <WorkflowsView />;
    case "settings":
      return <SettingsView />;
    default:
      return <DashboardView />;
  }
}

export function JarvisApp() {
  const {
    latestActionToast,
    setLatestActionToast,
    isVisionActive,
    visionMode,
    visionStream,
    stopVision,
    startVision,
    handleCaptureAndSend,
    isLiveStreaming,
    setIsLiveStreaming,
    handleLiveStreamFrame,
  } = useJarvis();

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden p-2.5 sm:p-4 text-foreground selection:bg-cyan-hud selection:text-background">
      <Backdrop />

      <TopBar />

      <main className="relative z-10 mt-3 flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <Sidebar />

        <section className="bezel flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl p-4 sm:p-5">
          <ViewRouter />
        </section>

        <MissionRail />
      </main>

      {/* Vision Preview PiP Widget */}
      <VisionPreviewModal
        isOpen={isVisionActive}
        mode={visionMode}
        stream={visionStream}
        onClose={stopVision}
        onSwitchMode={(newMode) => startVision(newMode)}
        onCaptureAndSend={handleCaptureAndSend}
        isLiveStreaming={isLiveStreaming}
        onToggleLiveStreaming={() => setIsLiveStreaming(!isLiveStreaming)}
        onLiveStreamFrame={handleLiveStreamFrame}
      />

      {/* Floating Workspace Action Toast */}
      {latestActionToast && (
        <WorkspaceActionToast
          action={latestActionToast}
          onDismiss={() => setLatestActionToast(null)}
        />
      )}
    </div>
  );
}
