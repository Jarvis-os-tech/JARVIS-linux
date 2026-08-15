import { createFileRoute } from "@tanstack/react-router";
import { JarvisApp } from "@/components/jarvis/JarvisApp";

const title = "JARVIS — Autonomous Agent Command Console";
const description =
  "A tactile command deck for an autonomous agent swarm: live telemetry, mission control, memory recall and workflow automation.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JarvisApp,
});
