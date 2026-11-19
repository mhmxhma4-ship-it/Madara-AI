import { task, metadata } from "@trigger.dev/sdk";
import { runGenerationPipeline } from "../lib/generate-pipeline";

type BuildMode = "Full game" | "Game map" | "Gameplay system" | "UI interface" | "Lua script";

export const generateRobloxProject = task({
  id: "generate-roblox-project",
  maxDuration: 7200,
  retry: { maxAttempts: 1 },
  run: async (payload: { prompt: string; mode: BuildMode }) => {
    const request = new Request("http://localhost/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    metadata.set("pipelineProgress", {
      stage: "architect",
      title: "Po pergatitet gjenerimi",
      detail: "Run-i u pranua. Agjenti Architect do te nise planifikimin.",
      next: "Environment Agent",
      completed: [],
      status: "running"
    });
    const response = await runGenerationPipeline(request, (progress) => {
      metadata.set("pipelineProgress", progress);
    });
    const result = await response.json() as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(typeof result.error === "string" ? result.error : "Roblox generation failed.");
    }
    metadata.set("pipelineProgress", {
      stage: "complete",
      title: "Gjenerimi perfundoi me sukses",
      detail: "Projekti u krijua dhe eshte gati.",
      next: "Project ready",
      completed: ["architect", "environment", "gameplay", "ui", "review", "finalize"],
      status: "complete"
    });
    return result;
  },
});
