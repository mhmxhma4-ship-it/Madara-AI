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

    const emitProgress = async (stepName: string, status: "running" | "complete" | "failed") => {
      await step.run(`progress-${stepName}-${status}`, async () => {
        await inngest.send({
          name: "madara/generation.progress",
          data: { runId: event.id, step: stepName, status },
        });
        return { sent: true };
      });
    };

    const response = await runGenerationPipeline(request, async (name, run) => {
      await emitProgress(name, "running");
      try {
        const result = await step.run(name, run);
        await emitProgress(name, "complete");
        return result;
      } catch (error) {
        await emitProgress(name, "failed");
        throw error;
      }
    });
    return await response.json();
  }
);
