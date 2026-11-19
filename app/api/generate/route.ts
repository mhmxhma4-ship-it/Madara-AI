import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/app/inngest/client";
import type { BuildMode } from "@/lib/generate-pipeline";

export const runtime = "nodejs";
export const maxDuration = 30;

const allowedModes: BuildMode[] = ["Full game", "Game map", "Gameplay system", "UI interface", "Lua script"];

export async function POST(request: NextRequest) {
  if (!process.env.INNGEST_EVENT_KEY) {
    return NextResponse.json({ error: "Background generation is not configured. Connect the Inngest Vercel integration and redeploy." }, { status: 503 });
  }

  try {
    const body = await request.json();
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const mode = body.mode as BuildMode;
    if (!prompt || prompt.length > 5000) return NextResponse.json({ error: "Write a game idea between 1 and 5000 characters." }, { status: 400 });
    if (!allowedModes.includes(mode)) return NextResponse.json({ error: "Choose a valid creation mode." }, { status: 400 });

    const { ids } = await inngest.send({
      name: "madara/generate.requested",
      data: { prompt, mode },
    });
    const runId = ids?.[0];
    if (!runId) throw new Error("Inngest did not return an event ID.");
    return NextResponse.json({ runId, status: "QUEUED" }, { status: 202 });
  } catch (error) {
    console.error("Madara AI could not queue generation:", error);
    return NextResponse.json({ error: "Could not start background generation. Check the Inngest integration and event key." }, { status: 503 });
  }
}

export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("runId") || "";
  if (!/^[A-Za-z0-9_-]{10,80}$/.test(eventId)) return NextResponse.json({ error: "Invalid generation ID." }, { status: 400 });

  const signingKey = process.env.INNGEST_SIGNING_KEY;
  if (!signingKey) return NextResponse.json({ error: "Inngest signing key is missing. Reconnect the Vercel integration and redeploy." }, { status: 503 });

  try {
    const response = await fetch(`https://api.inngest.com/v1/events/${encodeURIComponent(eventId)}/runs`, {
      headers: { Authorization: `Bearer ${signingKey}` },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Inngest status API returned ${response.status}.`);

    const payload = await response.json() as {
      data?: Array<{
        status?: string;
        output?: Record<string, unknown> | null;
      }>;
    };
    const run = payload.data?.[0];
    if (!run) return NextResponse.json({ status: "QUEUED" });

    const status = String(run.status || "UNKNOWN").toUpperCase();
    const output = run.output && typeof run.output === "object" ? run.output : {};

    if (status === "COMPLETED") {
      if (typeof output.error === "string") return NextResponse.json({ status: "FAILED", error: output.error });
      return NextResponse.json({ status: "COMPLETED", project: output });
    }

    if (status === "FAILED" || status === "CANCELLED" || status === "SKIPPED") {
      const errorMessage =
        typeof output.message === "string" ? output.message :
        typeof output.error === "string" ? output.error :
        "Background generation failed. Open Inngest Runs to inspect the error.";
      return NextResponse.json({ status: "FAILED", error: errorMessage });
    }

    return NextResponse.json({ status: status === "QUEUED" ? "QUEUED" : "RUNNING" });
  } catch (error) {
    console.error("Madara AI run lookup failed:", error);
    return NextResponse.json({ error: "Could not read generation status. Check the Inngest signing key and Runs dashboard." }, { status: 503 });
  }
}
