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

    const normalizeProgressStep = (stepName: string) =>
      stepName.startsWith("environment-recovery") ? "environment-recovery" :
      stepName.startsWith("package-recovery") ? "package-recovery" : stepName;

    const emitProgress = async (stepName: string, status: "running" | "complete" | "failed") => {
      const progressStep = normalizeProgressStep(stepName);
      await step.run(`progress-${stepName}-${status}`, async () => {
        await inngest.send({
          name: "madara/generation.progress",
          data: { runId: event.id, step: progressStep, status },
        });
        return { sent: true };
      });
    };

    const emitActivity = async (agent: string, activity: string) => {
      try {
        await inngest.send({
          name: "madara/generation.progress",
          data: { runId: event.id, step: ({ "Game Architect": "architect", "Environment Agent": "environment", "Environment Recovery Agent": "environment-recovery", "Gameplay Agent": "gameplay", "Package Recovery Agent": "package-recovery", "Roblox UI Agent": "ui-agent", "Luau Code Reviewer": "code-review" } as Record<string, string>)[agent] || "agent", status: "running", activity },
        });
      } catch (error) {
        console.warn("Madara AI activity update could not be sent:", error);
      }
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
    }, emitActivity);
    return await response.json();
  }
);
