import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type BuildMode = "Full game" | "Game map" | "Gameplay system" | "UI interface" | "Lua script";
type GeneratedFile = { path: string; kind: "server" | "client" | "module" | "readme"; code: string };
type JsonObject = Record<string, unknown>;

const allowedModes: BuildMode[] = ["Full game", "Game map", "Gameplay system", "UI interface", "Lua script"];

const safeError = (status: number) => {
  if (status === 401) return "Groq rejected the API key. Check OPENAI_API_KEY in Vercel.";
  if (status === 403) return "Groq denied this request. Check model access in Groq Console.";
  if (status === 404) return "The selected model was not found. Check OPENAI_MODEL in Vercel.";
  if (status === 429) return "Groq rate limit reached. Wait a moment and try again.";
  if (status === 400) return "Groq rejected the request. Check OPENAI_MODEL and try again.";
  if (status >= 500) return "Groq is temporarily unavailable. Try again shortly.";
  return `AI provider error (${status}).`;
};

function parseJson(content: unknown): JsonObject {
  if (typeof content !== "string") throw new Error("An AI agent returned an empty response.");
  const cleaned = content.trim().replace(/^\x60{3}(?:json)?\s*/i, "").replace(/\s*\x60{3}$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("An AI agent returned invalid JSON. Please generate again.");
  return JSON.parse(cleaned.slice(start, end + 1)) as JsonObject;
}

function validFiles(value: unknown, maxFiles: number): GeneratedFile[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxFiles).filter((file): file is GeneratedFile => {
    if (!file || typeof file !== "object") return false;
    const item = file as Record<string, unknown>;
    return typeof item.path === "string" &&
      item.path.length < 180 &&
      !item.path.includes("..") &&
      !item.path.startsWith("/") &&
      typeof item.code === "string" &&
      item.code.length > 0 &&
      item.code.length < 60000 &&
      ["server", "client", "module", "readme"].includes(String(item.kind));
  });
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
    const model = process.env.OPENAI_MODEL || "openai/gpt-oss-120b";
    const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    if (!apiKey) {
      return NextResponse.json({ error: "AI is not connected. Add OPENAI_API_KEY in Vercel Environment Variables and redeploy." }, { status: 503 });
    }

    async function askAgent(agentName: string, instructions: string, maxTokens = 4096): Promise<JsonObject> {
      const payload: Record<string, unknown> = {
        model,
        temperature: 0.25,
        max_completion_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are the ${agentName} inside Madara AI, a Roblox Studio production pipeline. Return ONLY one valid JSON object. Be specific, practical and consistent with Roblox Luau. Never use loadstring, exploit APIs, hidden backdoors, or unknown require(assetId). Use server-authoritative validation for currency, damage, rewards and purchases. Do not claim anything was tested or published. Keep output compact and ensure every Luau file is complete and syntactically plausible. ${instructions}`
          },
          { role: "user", content: `Creation mode: ${mode}\nUser's game idea: ${prompt}` }
        ]
      };
      if (model.startsWith("openai/gpt-oss-120b") || model.startsWith("openai/gpt-oss-20b")) {
        payload.reasoning_effort = "low";
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(22000)
      });

      if (!response.ok) {
        const detail = await response.text();
        let message = "";
        try {
          const parsed = JSON.parse(detail);
          message = typeof parsed?.error?.message === "string" ? parsed.error.message : "";
        } catch { message = ""; }
        const clean = message
          .replace(/Bearer\s+\S+/gi, "[hidden]")
          .replace(/gsk_[A-Za-z0-9_-]+/g, "[hidden]")
          .replace(/sk-[A-Za-z0-9_-]+/g, "[hidden]")
          .slice(0, 240);
        throw new Error(clean ? `${agentName}: ${clean}` : `${agentName}: ${safeError(response.status)}`);
      }

      const result = await response.json();
      return parseJson(result.choices?.[0]?.message?.content);
    }

    // Agent 1: plan the experience before any code is written.
    const architect = await askAgent(
      "Game Architect",
      `Create the complete game blueprint, not code. Return JSON with:
      projectName (string), summary (string), gameDesign (string),
      worldPlan (array of 3-8 concise strings), systemsPlan (array of 3-10 strings),
      environmentBrief (string), gameplayBrief (string), instructions (array of 3-8 strings).
      Make the plan coherent and tailored to the user's idea. Avoid generic unrelated game concepts.`,
      2500
    );

    const blueprintContext = JSON.stringify({
      projectName: architect.projectName,
      summary: architect.summary,
      gameDesign: architect.gameDesign,
      worldPlan: architect.worldPlan,
      systemsPlan: architect.systemsPlan,
      environmentBrief: architect.environmentBrief,
      gameplayBrief: architect.gameplayBrief
    });

    // Agents 2 and 3 work from the same approved blueprint.
    const [environment, gameplay] = await Promise.all([
      askAgent(
        "Environment Agent",
        `Build the actual Roblox environment from this architect blueprint: ${blueprintContext}
        Return JSON with files: array of 1-4 objects {path,kind,code}.
        Focus on a complete environment/map builder script using Roblox Parts, Models, Lighting and safe APIs.
        Include sensible spawn points, navigation and named folders. Use kind "server" or "module".
        Also return environmentNotes: array of 2-5 strings. Every file must be full source code, not pseudocode.`,
        4096
      ),
      askAgent(
        "Gameplay Agent",
        `Build playable systems from this architect blueprint: ${blueprintContext}
        Return JSON with files: array of 1-5 objects {path,kind,code}.
        Focus on functional gameplay scripts, server validation, RemoteEvents setup where needed, and a simple client interface only if useful.
        Do not duplicate the environment builder. Use correct Roblox service locations in paths.
        Also return gameplayNotes: array of 2-5 strings. Every file must be full source code, not pseudocode.`,
        4096
      )
    ]);

    const combined = [
      ...validFiles(environment.files, 4),
      ...validFiles(gameplay.files, 5)
    ];
    const uniqueFiles = combined.filter((file, index, all) =>
      all.findIndex(other => other.path.toLowerCase() === file.path.toLowerCase()) === index
    ).slice(0, 8);

    if (uniqueFiles.length === 0) {
      return NextResponse.json({ error: "The agents completed the plan but did not return usable Luau files. Try a more specific idea." }, { status: 502 });
    }

    const strings = (value: unknown, max = 12) =>
      Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, max) : [];

    return NextResponse.json({
      projectName: typeof architect.projectName === "string" ? architect.projectName.slice(0, 100) : "My Roblox Game",
      summary: typeof architect.summary === "string" ? architect.summary : "A Roblox project planned and built by Madara AI agents.",
      gameDesign: typeof architect.gameDesign === "string" ? architect.gameDesign : "",
      worldPlan: strings(architect.worldPlan, 8),
      systemsPlan: strings(architect.systemsPlan, 10),
      instructions: strings(architect.instructions, 12),
      agents: [
        { name: "Game Architect", status: "complete", detail: "Game design and world blueprint created." },
        { name: "Environment Agent", status: "complete", detail: "World and map scripts generated." },
        { name: "Gameplay Agent", status: "complete", detail: "Gameplay systems and Luau scripts generated." },
        { name: "Project Builder", status: "complete", detail: "Agent outputs combined into one project." }
      ],
      agentNotes: [...strings(environment.environmentNotes, 5), ...strings(gameplay.gameplayNotes, 5)],
      files: uniqueFiles
    });
  } catch (error) {
    console.error("Madara AI pipeline error:", error);
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Game Architect:") || message.includes("Environment Agent:") || message.includes("Gameplay Agent:")) {
      return NextResponse.json({ error: message }, { status: 502 });
    }
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json({ error: "An AI agent took too long to respond. Try a smaller game idea." }, { status: 504 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "An AI agent returned invalid JSON. Please try again." }, { status: 502 });
    }
    return NextResponse.json({ error: message || "Something went wrong in the Madara AI agent pipeline." }, { status: 500 });
  }
}
