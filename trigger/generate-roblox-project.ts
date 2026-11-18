import { task } from "@trigger.dev/sdk";
import { NextRequest } from "next/server";
import { POST as runGeneration } from "../app/api/generate/route";

type BuildMode = "Full game" | "Game map" | "Gameplay system" | "UI interface" | "Lua script";

export const generateRobloxProject = task({
  id: "generate-roblox-project",
  maxDuration: 3600,
  retry: { maxAttempts: 1 },
  run: async (payload: { prompt: string; mode: BuildMode }) => {
    const request = new NextRequest("http://localhost/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const response = await runGeneration(request);
    const result = await response.json() as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(typeof result.error === "string" ? result.error : "Roblox generation failed.");
    }
    return result;
  },
});
