import { inngest } from "@/app/inngest/client";
import { runGenerationPipeline, type BuildMode } from "@/lib/generate-pipeline";

export const generateRobloxProject = inngest.createFunction(
  {
    id: "generate-roblox-project",
    retries: 0,
    triggers: { event: "madara/generate.requested" },
  },
  async ({ event, step }) => {
    const { prompt, mode } = event.data as { prompt: string; mode: BuildMode };
    const request = new Request("https://madara-ai.internal/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, mode }),
    });

    const response = await runGenerationPipeline(request, (name, run) => step.run(name, run));
    return await response.json();
  }
);
