import { NextRequest, NextResponse } from "next/server";
import { runs, tasks } from "@trigger.dev/sdk";
import type { generateRobloxProject } from "@/trigger/generate-roblox-project";
import { runGenerationPipeline, type BuildMode } from "@/lib/generate-pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

const allowedModes: BuildMode[] = ["Full game", "Game map", "Gameplay system", "UI interface", "Lua script"];

export async function POST(request: NextRequest) {
  if (!process.env.TRIGGER_SECRET_KEY) {
    return NextResponse.json({ error: "Background generation is not configured. Add TRIGGER_SECRET_KEY and deploy the Trigger.dev task." }, { status: 503 });
  }
  try {
    const body = await request.json();
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const mode = body.mode as BuildMode;
    if (!prompt || prompt.length > 5000) return NextResponse.json({ error: "Write a game idea between 1 and 5000 characters." }, { status: 400 });
    if (!allowedModes.includes(mode)) return NextResponse.json({ error: "Choose a valid creation mode." }, { status: 400 });
    const handle = await tasks.trigger<typeof generateRobloxProject>(
      "generate-roblox-project",
      { prompt, mode },
      { metadata: { pipelineProgress: {
        stage: "architect",
        title: "Po pergatitet gjenerimi",
        detail: "Run-i u pranua dhe po pret agjentin e pare.",
        next: "Game Architect",
        completed: [],
        status: "running"
      } } }
    );
    return NextResponse.json({ runId: handle.id, status: "QUEUED" }, { status: 202 });
  } catch (error) {
    console.error("Madara AI could not queue generation:", error);
    return NextResponse.json({ error: "Could not start background generation. Check Trigger.dev configuration." }, { status: 503 });
  }
}

export async function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get("runId") || "";
  if (!/^run_[A-Za-z0-9_-]+$/.test(runId)) return NextResponse.json({ error: "Invalid generation ID." }, { status: 400 });
  try {
    const run = await runs.retrieve(runId);
    if (run.status === "COMPLETED") return NextResponse.json({ status: run.status, project: run.output, progress: run.metadata?.pipelineProgress ?? null });
    if (["FAILED", "CRASHED", "SYSTEM_FAILURE", "INTERRUPTED", "CANCELED", "EXPIRED"].includes(run.status)) {
      const error = typeof run.error === "string" ? run.error : "Background generation failed. Open Trigger.dev Runs to inspect the error.";
      return NextResponse.json({ status: run.status, error });
    }
    return NextResponse.json({ status: run.status, progress: run.metadata?.pipelineProgress ?? null });
  } catch (error) {
    console.error("Madara AI run lookup failed:", error);
    return NextResponse.json({ error: "Could not read generation status. Check TRIGGER_SECRET_KEY." }, { status: 503 });
  }
}
