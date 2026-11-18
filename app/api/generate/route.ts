import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type BuildMode = "Full game" | "Game map" | "Gameplay system" | "UI interface" | "Lua script";

const allowedModes: BuildMode[] = ["Full game", "Game map", "Gameplay system", "UI interface", "Lua script"];

const systemPrompt = `You are Madara AI, an expert Roblox Luau game architect. Generate practical, secure, maintainable Roblox Studio projects.
Return ONLY valid JSON with this exact shape:
{"projectName":"string","summary":"string","instructions":["string"],"files":[{"path":"string","kind":"server|client|module|readme","code":"string"}]}
Rules:
- Generate real Luau source code, not pseudocode.
- Use Roblox services correctly and server-authoritative validation for currency, purchases, damage, rewards and progression.
- Never use loadstring, external executors, exploit APIs, hidden admin backdoors, or require(assetId) for unknown code.
- Use RemoteEvents/RemoteFunctions with validation and rate limits where needed.
- Include clear file paths under ServerScriptService, ReplicatedStorage, StarterPlayerScripts, StarterGui, or Workspace setup instructions.
- Keep each file focused and include all required scripts/modules for the requested scope.
- For maps, generate a build script that creates the map using Parts, Models, Lighting and safe Roblox APIs. Explain where to run it in Studio.
- For full games, create a playable MVP, not an empty template. Include setup instructions and a sensible folder structure.
- Do not claim the project has been tested or published.
- Keep output concise enough to fit a normal response. Generate up to 8 files.`;

function providerError(status: number) {
  if (status === 401) return "Groq rejected the API key. Check that OPENAI_API_KEY contains your Groq key.";
  if (status === 403) return "Groq denied this request. Check your account or model access in Groq Console.";
  if (status === 404) return "The selected AI model was not found. Check OPENAI_MODEL in Vercel.";
  if (status === 429) return "Groq rate limit or daily token limit reached. Wait and try again.";
  if (status === 400) return "Groq rejected the request settings. Check OPENAI_MODEL and try again.";
  if (status >= 500) return "Groq is temporarily unavailable. Try again shortly.";
  return `The AI provider returned error ${status}. Check your Groq settings.`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const mode = body.mode as BuildMode;

    if (!prompt || prompt.length > 5000) {
      return NextResponse.json({ error: "Write a game idea between 1 and 5000 characters." }, { status: 400 });
    }
    if (!allowedModes.includes(mode)) {
      return NextResponse.json({ error: "Choose a valid creation mode." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");

    if (!apiKey) {
      return NextResponse.json({
        error: "AI is not connected yet. Add OPENAI_API_KEY in Vercel → Project → Settings → Environment Variables, then redeploy."
      }, { status: 503 });
    }

    const requestPayload: Record<string, unknown> = {
      model,
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Creation mode: ${mode}\nGame request: ${prompt}\nReturn a complete starter project in the required JSON format.` }
      ]
    };

    // GPT-OSS does not accept reasoning_format; use include_reasoning instead.
    if (model.startsWith("openai/gpt-oss-")) {
      requestPayload.include_reasoning = false;
    }

    const requestHeaders = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    };

    const sendCompletion = (payload: Record<string, unknown>) => fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(55000)
    });

    let upstream = await sendCompletion(requestPayload);

    // GPT-OSS deployments can differ in accepted optional sampling/reasoning fields.
    // On a validation error, retry the same model with only the essential JSON request.
    if (upstream.status === 400 && model.startsWith("openai/gpt-oss-")) {
      await upstream.text();
      const compatibilityPayload = {
        model,
        response_format: { type: "json_object" },
        messages: requestPayload.messages
      };
      upstream = await sendCompletion(compatibilityPayload);
    }

    if (!upstream.ok) {
      const detail = await upstream.text();
      console.error("AI provider error:", upstream.status, detail.slice(0, 1000));

      let providerMessage = "";
      try {
        const parsed = JSON.parse(detail);
        providerMessage = typeof parsed?.error?.message === "string"
          ? parsed.error.message
          : typeof parsed?.message === "string" ? parsed.message : "";
      } catch {
        providerMessage = detail;
      }

      const safeMessage = providerMessage
        .replace(/Bearer\\s+\\S+/gi, "[hidden]")
        .replace(/gsk_[A-Za-z0-9_-]+/g, "[hidden]")
        .replace(/sk-[A-Za-z0-9_-]+/g, "[hidden]")
        .slice(0, 350);

      return NextResponse.json({
        error: safeMessage ? `Groq error (${upstream.status}): ${safeMessage}` : providerError(upstream.status)
      }, { status: 502 });
    }

    const data = await upstream.json();
    const raw = data.choices?.[0]?.message?.content;
    if (typeof raw !== "string") {
      return NextResponse.json({ error: "The AI provider returned an empty response. Try again." }, { status: 502 });
    }

    let project: { projectName?: string; summary?: string; instructions?: string[]; files?: Array<{ path?: string; kind?: string; code?: string }> };
    try {
      project = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "The AI response was not valid project JSON. Please try again." }, { status: 502 });
    }

    const files = Array.isArray(project.files) ? project.files.slice(0, 8).filter((file) =>
      typeof file.path === "string" &&
      typeof file.code === "string" &&
      file.path.length < 180 &&
      file.code.length < 60000 &&
      !file.path.includes("..") &&
      !file.path.startsWith("/")
    ) : [];

    if (!files.length) {
      return NextResponse.json({ error: "The AI did not return any usable Luau files. Try a more specific prompt." }, { status: 502 });
    }

    return NextResponse.json({
      projectName: typeof project.projectName === "string" ? project.projectName.slice(0, 100) : "My Roblox Game",
      summary: typeof project.summary === "string" ? project.summary : "Roblox starter project generated by Madara AI.",
      instructions: Array.isArray(project.instructions) ? project.instructions.filter((item) => typeof item === "string").slice(0, 20) : [],
      files
    });
  } catch (error) {
    console.error("Madara AI generation error:", error);
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json({ error: "Groq took too long to respond. Try a smaller game request." }, { status: 504 });
    }
    return NextResponse.json({ error: "Something went wrong while generating your project. Please try again." }, { status: 500 });
  }
}
