import { createFileRoute } from "@tanstack/react-router";
import { ChatAssistant } from "@/components/ChatAssistant";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Sidekick — AI Workplace Productivity Assistant" },
      {
        name: "description",
        content:
          "Draft emails, summarize meetings, plan your day, and research topics — all in one AI assistant built for professionals.",
      },
      { property: "og:title", content: "Sidekick — AI Workplace Productivity Assistant" },
      {
        property: "og:description",
        content: "Automate email writing, meeting notes, task planning, and research.",
      },
    ],
  }),
});

function Index() {
  return (
    <>
      <ChatAssistant />
      <Toaster richColors position="top-center" />
    </>
  );
}
