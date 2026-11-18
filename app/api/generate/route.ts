import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type BuildMode = "Full game" | "Game map" | "Gameplay system" | "UI interface" | "Lua script";
type GeneratedFile = { path: string; kind: "server" | "client" | "module" | "readme"; code: string };
type JsonObject = Record<string, unknown>;

const allowedModes: BuildMode[] = ["Full game", "Game map", "Gameplay system", "UI interface", "Lua script"];
const MAX_PROMPT_LENGTH = 5000;
const MAX_FILE_LENGTH = 60000;

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
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("An AI agent returned an empty response.");
  }
  const cleaned = content.trim().replace(/^`{3}(?:json)?\s*/i, "").replace(/\s*`{3}$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("An AI agent returned invalid JSON. Please generate again.");
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as JsonObject;
  } catch {
    throw new Error("An AI agent returned malformed JSON. Please generate again.");
  }
}

function validFiles(value: unknown, maxFiles: number): GeneratedFile[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxFiles).filter((file): file is GeneratedFile => {
    if (!file || typeof file !== "object") return false;
    const item = file as Record<string, unknown>;
    const path = item.path;
    const code = item.code;
    return typeof path === "string" &&
      path.length < 180 &&
      !path.includes("..") &&
      !path.startsWith("/") &&
      !path.includes(String.fromCharCode(92)) &&
      !/[<>:"|?*\u0000-\u001f]/.test(path) &&
      typeof code === "string" &&
      code.trim().length > 0 &&
      code.length < MAX_FILE_LENGTH &&
      ["server", "client", "module", "readme"].includes(String(item.kind));
  });
}

function uniqueByPath(files: GeneratedFile[]) {
  return files.filter((file, index, all) =>
    all.findIndex(other => other.path.toLowerCase() === file.path.toLowerCase()) === index
  );
}

function findUnsafePatterns(files: GeneratedFile[]) {
  const checks: string[] = [];
  for (const file of files) {
    if (/\bloadstring\s*\(/i.test(file.code)) checks.push(`${file.path}: contains loadstring, which is not allowed.`);
    if (/\b(getfenv|setfenv)\s*\(/i.test(file.code)) checks.push(`${file.path}: contains dynamic environment access.`);
    if (/\brequire\s*\(\s*\d+\s*\)/i.test(file.code)) checks.push(`${file.path}: contains an unverified numeric asset require.`);
  }
  return checks;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const mode = body.mode as BuildMode;

    if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
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

    async function askAgent(
      agentName: string,
      instructions: string,
      maxTokens = 4096,
      extraContext = ""
    ): Promise<JsonObject> {
      const payload: Record<string, unknown> = {
        model,
        temperature: 0.2,
        max_completion_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are the ${agentName} inside Madara AI, a professional Roblox Studio production pipeline. Return ONLY one valid JSON object. Be specific, practical and consistent with Roblox Luau. Never use loadstring, exploit APIs, hidden backdoors, or unknown require(assetId). Use server-authoritative validation for currency, damage, rewards and purchases. Do not claim anything was tested or published. Keep output compact and ensure every Luau file is complete, maintainable and syntactically plausible. ${instructions}`
          },
          { role: "user", content: `Creation mode: ${mode}\nUser's exact game idea: ${prompt}\n\nAdditional project context:\n${extraContext}` }
        ]
      };
      if (model.startsWith("openai/gpt-oss-120b") || model.startsWith("openai/gpt-oss-20b")) {
        payload.reasoning_effort = "low";
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(16000),
        cache: "no-store"
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
          .slice(0, 220);
        throw new Error(clean ? `${agentName}: ${clean}` : `${agentName}: ${safeError(response.status)}`);
      }

      const result = await response.json();
      return parseJson(result.choices?.[0]?.message?.content);
    }

    // 1. Architect: decide the game loop, world progression and systems before code exists.
    const architect = await askAgent(
      "Game Architect",
      `Create a complete, original game blueprint tailored to the user's exact idea. Return JSON with:
      projectName (string), summary (string), gameDesign (string),
      worldPlan (array of 3-8 concise strings), systemsPlan (array of 3-10 strings),
      environmentBrief (string), gameplayBrief (string), instructions (array of 3-8 strings).
      Define the core gameplay loop, player goals, progression, rewards, failure/retry loop and multiplayer assumptions. Do not invent unrelated themes.`,
      2200
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

    // 2. Environment and gameplay agents build from the same blueprint in parallel.
    const [environment, gameplay] = await Promise.all([
      askAgent(
        "Environment Agent",
        `Build the actual Roblox environment from this approved blueprint: ${blueprintContext}
        Return JSON with files: array of 1-4 objects {path,kind,code}.
        Produce complete map/world builder scripts with intentional layout, readable names, spawn points, navigation, lighting and organized folders. Use native Roblox Instances and safe APIs. Use paths that clearly identify Roblox services, such as ServerScriptService/WorldBuilder.server.lua or ReplicatedStorage/Shared/WorldConfig.module.lua. Also return environmentNotes: array of 2-4 strings. Every file must be full source code, never pseudocode.`,
        3600
      ),
      askAgent(
        "Gameplay Agent",
        `Build playable systems from this approved blueprint: ${blueprintContext}
        Return JSON with files: array of 1-5 objects {path,kind,code}.
        Create real gameplay behavior, not empty placeholders. Include server-side validation for all important state changes, RemoteEvents/RemoteFunctions where needed, safe DataStore handling with pcall and sensible defaults, and a clear client/server split. Avoid duplicating the environment builder. Use paths that clearly identify Roblox services, such as ServerScriptService/Game.server.lua, StarterPlayer/StarterPlayerScripts/HUD.client.lua or ReplicatedStorage/Shared/Config.module.lua. Also return gameplayNotes: array of 2-4 strings. Every file must be full source code, never pseudocode.`,
        4200
      )
    ]);

    let files = uniqueByPath([
      ...validFiles(environment.files, 4),
      ...validFiles(gameplay.files, 5)
    ]).slice(0, 8);

    if (files.length === 0) {
      return NextResponse.json({ error: "The agents completed the plan but did not return usable Luau files. Try a more specific idea." }, { status: 502 });
    }

    // 3. Reviewer: inspect the combined project and repair concrete defects.
    let reviewChecks: string[] = [];
    let reviewWarnings: string[] = [];
    let reviewerCompleted = false;
    try {
      const review = await askAgent(
        "Luau Code Reviewer",
        `Review the complete generated project for Roblox Luau correctness, missing dependencies, incorrect service paths, server/client boundary mistakes, unsafe remote handling, DataStore error handling and obvious logic defects. Return JSON with:
        files: array containing corrected full files {path,kind,code}; qualityChecks: array of concise checks performed; warnings: array of genuine remaining risks.
        IMPORTANT: Return a corrected file only when you made a real improvement. Preserve the exact path and kind for every corrected file. Do not rewrite working code just for style. Do not add unrelated systems. If a file is already sound, omit it from files. Never say code was executed or tested.`,
        3000,
        JSON.stringify({ blueprint: architect, files })
      );
      const corrected = validFiles(review.files, 8);
      for (const fix of corrected) {
        const index = files.findIndex(file => file.path.toLowerCase() === fix.path.toLowerCase());
        if (index >= 0 && files[index].kind === fix.kind) files[index] = fix;
      }
      reviewChecks = Array.isArray(review.qualityChecks)
        ? review.qualityChecks.filter((item): item is string => typeof item === "string").slice(0, 8)
        : [];
      reviewWarnings = Array.isArray(review.warnings)
        ? review.warnings.filter((item): item is string => typeof item === "string").slice(0, 8)
        : [];
      reviewerCompleted = true;
    } catch (reviewError) {
      console.warn("Madara AI reviewer unavailable:", reviewError);
      reviewWarnings.push("The automated code review did not finish. Review and test the generated scripts in Roblox Studio.");
    }

    // 4. Deterministic safety gate: never silently ship known-dangerous patterns.
    const safetyFindings = findUnsafePatterns(files);
    if (safetyFindings.length > 0) {
      return NextResponse.json({
        error: "The generated project failed Madara AI's safety checks. Generate again with a simpler request.",
        safetyFindings
      }, { status: 422 });
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
        { name: "Game Architect", status: "complete", detail: "Game loop, progression and world blueprint created." },
        { name: "Environment Agent", status: "complete", detail: "World and map scripts generated from the shared blueprint." },
        { name: "Gameplay Agent", status: "complete", detail: "Gameplay systems and client/server scripts generated." },
        { name: "Luau Reviewer", status: reviewerCompleted ? "complete" : "warning", detail: reviewerCompleted ? "Project reviewed and concrete fixes applied where needed." : "Automated review did not finish; manual Studio testing is required." }
      ],
      agentNotes: [
        ...strings(environment.environmentNotes, 4),
        ...strings(gameplay.gameplayNotes, 4),
        ...reviewChecks.map(item => `Review: ${item}`),
        ...reviewWarnings.map(item => `Review warning: ${item}`)
      ],
      files
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
    return NextResponse.json({ error: message || "Something went wrong in the Madara AI agent pipeline." }, { status: 500 });
  }
}
