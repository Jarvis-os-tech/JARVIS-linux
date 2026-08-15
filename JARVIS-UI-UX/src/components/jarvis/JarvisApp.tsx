import { Backdrop } from "./Backdrop";
import { JarvisProvider, useJarvis } from "./JarvisProvider";
import { MissionRail } from "./MissionRail";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { AgentsView } from "./views/AgentsView";
import { ConnectorsView } from "./views/ConnectorsView";
import { DashboardView } from "./views/DashboardView";
import { MemoryView } from "./views/MemoryView";
import { MissionControlView } from "./views/MissionControlView";
import { SettingsView } from "./views/SettingsView";
import { WorkflowsView } from "./views/WorkflowsView";

function Views() {
  const { view } = useJarvis();
  return (
    <div key={view} className="animate-view-in flex min-h-0 flex-1 flex-col">
      {(() => {
        switch (view) {
          case "agents":
            return <AgentsView />;
          case "mission":
            return <MissionControlView />;
          case "memory":
            return <MemoryView />;
          case "connectors":
            return <ConnectorsView />;
          case "workflows":
            return <WorkflowsView />;
          case "settings":
            return <SettingsView />;
          default:
            return <DashboardView />;
        }
      })()}
    </div>
  );
}

function Shell() {
  return (
    <div className="relative z-10 flex min-h-screen flex-col gap-3 p-3 lg:h-screen">
      <TopBar />
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <Sidebar />
        <main className="glass flex min-h-0 flex-1 flex-col rounded-2xl p-4 sm:p-5">
          <Views />
        </main>
        <MissionRail />
      </div>
    </div>
  );
}

export function JarvisApp() {
  return (
    <JarvisProvider>
      <Backdrop />
      <Shell />
    </JarvisProvider>
  );
}
