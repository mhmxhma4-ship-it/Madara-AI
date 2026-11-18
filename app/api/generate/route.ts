import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type BuildMode = "Full game" | "Game map" | "Gameplay system" | "UI interface" | "Lua script";
type GeneratedFile = { path: string; kind: "server" | "client" | "module"; code: string };
type ScenePart = {
  name: string; parentPath: string; className: "Part" | "SpawnLocation";
  position: { x: number; y: number; z: number }; size: { x: number; y: number; z: number };
  color: { r: number; g: number; b: number }; material: string;
  shape: "Block" | "Ball" | "Cylinder"; rotation: { x: number; y: number; z: number };
  anchored: boolean; canCollide: boolean; transparency: number;
};
type JsonObject = Record<string, unknown>;

const allowedModes: BuildMode[] = ["Full game", "Game map", "Gameplay system", "UI interface", "Lua script"];
const MAX_PROMPT_LENGTH = 5000;
const MAX_FILE_LENGTH = 60000;
const RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 3;
const requestBuckets = new Map<string, { count: number; resetAt: number }>();

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
    if (typeof path !== "string" || typeof code !== "string") return false;
    const segments = path.split("/");
    const allowedRoots = ["ServerScriptService", "ReplicatedStorage", "ServerStorage", "StarterGui", "StarterPlayer", "Workspace"];
    const validStarterPlayerPath = segments[0] !== "StarterPlayer" || ["StarterPlayerScripts", "StarterCharacterScripts"].includes(segments[1] || "");
    return path.length < 180 &&
      segments.length >= 2 &&
      segments.every(segment => segment.length > 0 && segment !== "." && segment !== "..") &&
      allowedRoots.includes(segments[0]) &&
      validStarterPlayerPath &&
      !path.startsWith("/") &&
      !path.includes(String.fromCharCode(92)) &&
      !/[<>:"|?*\u0000-\u001f]/.test(path) &&
      code.trim().length > 0 &&
      code.length < MAX_FILE_LENGTH &&
      ["server", "client", "module"].includes(String(item.kind));
  });
}

function validScenePlan(value: unknown): ScenePart[] {
  if (!Array.isArray(value)) return [];
  const materials = new Set(["SmoothPlastic", "Plastic", "Neon", "Metal", "Wood", "WoodPlanks", "Concrete", "Grass", "Sand", "Brick", "Slate", "Glass", "Ice", "Marble", "Granite", "DiamondPlate", "Fabric", "Foil", "CorrodedMetal", "ForceField", "Asphalt", "Basalt", "Ground", "LeafyGrass", "Limestone", "Mud", "Pavement", "Rock", "Salt", "Sandstone", "Snow", "Water"]);
  const vector = (input: unknown, min: number, max: number) => {
    if (!input || typeof input !== "object") return null;
    const value = input as Record<string, unknown>;
    const { x, y, z } = value;
    if (![x, y, z].every(n => typeof n === "number" && Number.isFinite(n) && n >= min && n <= max)) return null;
    return { x: x as number, y: y as number, z: z as number };
  };
  const color = (input: unknown) => {
    if (!input || typeof input !== "object") return null;
    const { r, g, b } = input as Record<string, unknown>;
    if (![r, g, b].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1)) return null;
    return { r: r as number, g: g as number, b: b as number };
  };
  const valid = value.slice(0, 100).flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const part = item as Record<string, unknown>;
    const name = typeof part.name === "string" ? part.name.trim() : "";
    const parentPath = typeof part.parentPath === "string" ? part.parentPath.trim() : "World";
    const className = part.className;
    const position = vector(part.position, -10000, 10000);
    const size = vector(part.size, 0.2, 512);
    const partColor = color(part.color);
    const rotation = vector(part.rotation ?? { x: 0, y: 0, z: 0 }, -360, 360);
    const segments = parentPath.split("/");
    if (!/^[A-Za-z0-9 _-]{1,50}$/.test(name) || !/^[A-Za-z0-9 _/-]{1,120}$/.test(parentPath) || segments.some(segment => !segment || segment === "." || segment === "..") || !["Part", "SpawnLocation"].includes(String(className)) || !position || !size || !partColor || !rotation) return [];
    const shape = ["Block", "Ball", "Cylinder"].includes(String(part.shape)) ? part.shape as ScenePart["shape"] : "Block";
    const material = typeof part.material === "string" && materials.has(part.material) ? part.material : "SmoothPlastic";
    const transparency = typeof part.transparency === "number" && Number.isFinite(part.transparency) ? Math.max(0, Math.min(1, part.transparency)) : 0;
    return [{ name, parentPath, className: className as ScenePart["className"], position, size, color: partColor, material, shape, rotation, anchored: typeof part.anchored === "boolean" ? part.anchored : true, canCollide: typeof part.canCollide === "boolean" ? part.canCollide : true, transparency }];
  });
  return valid.filter((part, index, all) =>
    all.findIndex(other => other.parentPath.toLowerCase() === part.parentPath.toLowerCase() && other.name.toLowerCase() === part.name.toLowerCase()) === index
  );
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
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 24_000) {
      return NextResponse.json({ error: "The request is too large. Shorten your game description and try again." }, { status: 413 });
    }

    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const clientIp = request.headers.get("x-real-ip") || forwardedFor;
    if (clientIp) {
      const now = Date.now();
      const bucket = requestBuckets.get(clientIp);
      if (bucket && bucket.resetAt > now && bucket.count >= MAX_REQUESTS_PER_WINDOW) {
        return NextResponse.json(
          { error: "Generation limit reached for this minute. Wait a little and try again." },
          { status: 429, headers: { "Retry-After": String(Math.ceil((bucket.resetAt - now) / 1000)) } }
        );
      }
      if (!bucket || bucket.resetAt <= now) {
        requestBuckets.set(clientIp, { count: 1, resetAt: now + RATE_WINDOW_MS });
      } else {
        bucket.count += 1;
      }
      if (requestBuckets.size > 2000) {
        for (const [ip, entry] of requestBuckets) {
          if (entry.resetAt <= now) requestBuckets.delete(ip);
        }
      }
    }

    const body = await request.json();
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const mode = body.mode as BuildMode;

    if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json({ error: "Write a game idea between 1 and 5000 characters." }, { status: 400 });
    }
    if (!allowedModes.includes(mode)) {
      return NextResponse.json({ error: "Choose a valid creation mode." }, { status: 400 });
    }

    // Remove accidental whitespace/newlines from Vercel environment values before using them in headers.
    const cleanSecret = (value?: string) => value?.replace(/\s+/g, "");
    const apiKey = cleanSecret(process.env.OPENAI_API_KEY);
    const model = (process.env.OPENAI_MODEL || "openai/gpt-oss-120b").trim();
    const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").trim().replace(/\/$/, "");
    const geminiApiKey = cleanSecret(process.env.GEMINI_API_KEY);
    const cloudflareAccountId = cleanSecret(process.env.CLOUDFLARE_ACCOUNT_ID);
    const cloudflareApiToken = cleanSecret(process.env.CLOUDFLARE_API_TOKEN);
    if (!apiKey && !geminiApiKey && !(cloudflareAccountId && cloudflareApiToken)) {
      return NextResponse.json({ error: "AI is not connected. Add at least one provider key in Vercel and redeploy." }, { status: 503 });
    }

    // Keep the whole multi-agent pipeline inside Vercel's function window.
    // Individual agents and provider fallbacks share one hard deadline.
    const generationDeadline = Date.now() + 53_000;

    // Once Groq reports its daily token quota is exhausted, bypass it for every
    // remaining agent in this generation instead of repeatedly hitting a dead quota.
    let groqDailyLimitReached = false;

    async function askAgent(
      agentName: string,
      instructions: string,
      maxTokens = 4096,
      extraContext = "",
      timeoutMs = 16000
    ): Promise<JsonObject> {
      const agentDeadline = Math.min(generationDeadline, Date.now() + timeoutMs);
      const payload: Record<string, unknown> = {
        model,
        temperature: 0.2,
        max_completion_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are the ${agentName} inside Madara AI, a professional Roblox Studio production pipeline. Return ONLY one valid JSON object. Be specific, practical and consistent with Roblox Luau. Never use loadstring, exploit APIs, hidden backdoors, or unknown require(assetId). Use server-authoritative validation for currency, damage, rewards and purchases. Do not claim anything was tested or published. Keep output compact and ensure every Luau file is complete, maintainable and syntactically plausible. DEFAULT ART DIRECTION: premium realistic 3D Roblox experience. Never use Minecraft, voxel, blocky or low-poly styling unless the user explicitly asks for it. Avoid giant plain cubes, repetitive platforms and empty flat maps. Prefer natural terrain, believable scale, layered architecture, detailed props, realistic materials, environmental storytelling, polished lighting and atmospheric depth. ${instructions}`
          },
          { role: "user", content: `Creation mode: ${mode}\nUser's exact game idea: ${prompt}\n\nAdditional project context:\n${extraContext}` }
        ]
      };
      if (model.startsWith("openai/gpt-oss-120b") || model.startsWith("openai/gpt-oss-20b")) {
        payload.reasoning_effort = "low";
      }

      const sendRequest = async (requestPayload: Record<string, unknown>): Promise<Response> => {
        const messages = Array.isArray(requestPayload.messages) ? requestPayload.messages as Array<{ role?: string; content?: string }> : [];
        const requestOptions = () => ({
          signal: AbortSignal.timeout(Math.max(1, Math.min(6500, agentDeadline - Date.now()))),
          cache: "no-store" as RequestCache
        });
        const attempts: Array<{ name: string; run: () => Promise<Response> }> = [];

        if (apiKey && !groqDailyLimitReached) {
          attempts.push({
            name: "Groq",
            run: () => fetch(`${baseUrl}/chat/completions`, {
              method: "POST",
              headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify(requestPayload),
              ...requestOptions()
            })
          });
        }

        if (cloudflareAccountId && cloudflareApiToken) {
          attempts.push({
            name: "Cloudflare Workers AI",
            run: async () => {
              const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast`, {
                method: "POST",
                headers: { Authorization: `Bearer ${cloudflareApiToken}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  messages,
                  max_tokens: Number(requestPayload.max_completion_tokens ?? requestPayload.max_tokens ?? 4096),
                  temperature: Number(requestPayload.temperature ?? 0.2),
                  response_format: { type: "json_object" }
                }),
                ...requestOptions()
              });
              if (!response.ok) return response;
              const data = await response.json();
              const content = typeof data.result?.response === "string"
                ? data.result.response
                : typeof data.result?.choices?.[0]?.message?.content === "string"
                  ? data.result.choices[0].message.content
                  : "";
              if (!content) return Response.json({ error: { message: "Cloudflare returned an empty model response." } }, { status: 502 });
              return Response.json({ choices: [{ message: { content } }] });
            }
          });
        }

        if (geminiApiKey) {
          attempts.push({
            name: "Gemini",
            run: async () => {
              const systemText = messages.filter(message => message.role === "system").map(message => message.content || "").join("\\n\\n");
              const userText = messages.filter(message => message.role !== "system").map(message => `${message.role === "assistant" ? "Assistant" : "User"}:\\n${message.content || ""}`).join("\\n\\n");
              const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-goog-api-key": geminiApiKey },
                body: JSON.stringify({
                  systemInstruction: systemText ? { parts: [{ text: systemText }] } : undefined,
                  contents: [{ role: "user", parts: [{ text: userText }] }],
                  generationConfig: {
                    temperature: Number(requestPayload.temperature ?? 0.2),
                    maxOutputTokens: Number(requestPayload.max_completion_tokens ?? requestPayload.max_tokens ?? 4096),
                    responseMimeType: "application/json"
                  }
                }),
                ...requestOptions()
              });
              if (!response.ok) return response;
              const data = await response.json();
              const content = Array.isArray(data.candidates?.[0]?.content?.parts)
                ? data.candidates[0].content.parts.map((part: { text?: string }) => part.text || "").join("")
                : "";
              return Response.json({ choices: [{ message: { content } }] });
            }
          });
        }

        let lastResponse: Response | null = null;
        const failures: string[] = [];
        for (const attempt of attempts) {
          if (Date.now() >= agentDeadline - 250) break;
          try {
            let response: Response | null = null;
            // Gemini can temporarily return 503 during demand spikes.
            // Retry once with a fresh timeout before moving to the next provider.
            const maxAttempts = attempt.name === "Gemini" ? 2 : 1;
            for (let providerTry = 0; providerTry < maxAttempts; providerTry++) {
              try {
                response = await attempt.run();
              } catch (error) {
                if (providerTry + 1 >= maxAttempts) throw error;
                await new Promise(resolve => setTimeout(resolve, 900));
                continue;
              }
              if (response.status !== 503 || providerTry + 1 >= maxAttempts || Date.now() >= agentDeadline - 1300) break;
              await response.text();
              await new Promise(resolve => setTimeout(resolve, Math.min(900, Math.max(0, agentDeadline - Date.now() - 300))));
            }
            if (!response) throw new Error("Provider did not return a response.");
            if (response.ok) return response;
            const detail = await response.text();
            if (attempt.name === "Groq" && response.status === 429 && /tokens per day|token[s]? per day|\bTPD\b/i.test(detail)) {
              groqDailyLimitReached = true;
            }
            failures.push(`${attempt.name} (${response.status}): ${detail.slice(0, 180)}`);
            lastResponse = new Response(JSON.stringify({ error: { message: failures[failures.length - 1] } }), {
              status: response.status,
              headers: { "Content-Type": "application/json", ...(response.headers.get("retry-after") ? { "Retry-After": response.headers.get("retry-after")! } : {}) }
            });
            // A malformed request is unlikely to work on another provider. Auth, quota,
            // model and transient failures are eligible for fallback.
            if (response.status === 400 && !/failed to validate json|failed_generation|response_format|json mode/i.test(detail)) break;
          } catch (error) {
            failures.push(`${attempt.name}: ${error instanceof Error ? error.message : "network error"}`);
            lastResponse = Response.json({ error: { message: failures[failures.length - 1] } }, { status: 503 });
          }
        }
        return lastResponse || Response.json({ error: { message: Date.now() >= agentDeadline ? "Generation time budget exhausted for this agent." : "No AI provider is configured." } }, { status: Date.now() >= agentDeadline ? 504 : 503 });
      };

      let response = await sendRequest(payload);
      let detail = "";
      let responseBodyRead = false;
      const readResponseBody = async () => {
        if (!responseBodyRead) {
          detail = await response.text();
          responseBodyRead = true;
        }
        return detail;
      };

      // sendRequest already tried every configured provider. Do not sleep through
      // a provider cooldown here: that can consume the entire serverless request.
      // Surface the quota error and let the user retry after the provider resets.

      // Groq can reject constrained JSON generation for some GPT-OSS outputs.
      // Retry once in ordinary chat mode while keeping the strict JSON instruction.
      if (!response.ok) {
        await readResponseBody();
        const jsonValidationFailure =
          response.status === 400 &&
          /failed to validate json|failed_generation|json mode|response_format/i.test(detail);
        if (jsonValidationFailure && Date.now() < agentDeadline - 2500) {
          const retryPayload = { ...payload };
          delete retryPayload.response_format;
          retryPayload.temperature = 0.1;
          retryPayload.messages = [
            {
              role: "system",
              content: `You are the ${agentName}. Return exactly one valid JSON object and nothing else. No markdown fences, no commentary, no trailing commas. Follow the requested JSON structure exactly. ${instructions}`
            },
            {
              role: "user",
              content: `Creation mode: ${mode}\nUser's exact game idea: ${prompt}\n\nAdditional project context:\n${extraContext}\n\nIMPORTANT: Output only valid JSON.`
            }
          ];
          response = await sendRequest(retryPayload);
          responseBodyRead = false;
          if (!response.ok) await readResponseBody();
        }
      }

      if (!response.ok) {
        let message = "";
        try {
          const parsed = JSON.parse(detail);
          message = typeof parsed?.error?.message === "string" ? parsed.error.message : "";
          if (!message && typeof parsed?.error === "string") message = parsed.error;
        } catch { message = ""; }
        const clean = message
          .replace(/Bearer\s+\S+/gi, "[hidden]")
          .replace(/gsk_[A-Za-z0-9_-]+/g, "[hidden]")
          .replace(/sk-[A-Za-z0-9_-]+/g, "[hidden]")
          .slice(0, 220);
        throw new Error(clean ? `${agentName}: ${clean}` : `${agentName}: ${safeError(response.status)}`);
      }

      const result = await response.json();
      const generatedContent = result.choices?.[0]?.message?.content;
      try {
        return parseJson(generatedContent);
      } catch (parseError) {
        // Recover malformed/truncated model output with a compact repair request.
        // Repair requests also respect Groq's TPM cooldown instead of failing immediately.
        const originalText = typeof generatedContent === "string"
          ? generatedContent.slice(0, 18000)
          : JSON.stringify(generatedContent ?? "");
        const repairPayload: Record<string, unknown> = {
          ...payload,
          temperature: 0,
          max_completion_tokens: Math.max(1800, Math.min(6000, maxTokens)),
          messages: [
            {
              role: "system",
              content: `You are a strict JSON recovery engine for the ${agentName}. The input may be truncated or contain invalid escaping. Return ONE syntactically valid JSON object matching the requested schema. Preserve the original meaning and all useful complete Luau code. If content is truncated, finish the incomplete JSON/code conservatively rather than inventing unrelated features. Escape every newline and quote inside JSON strings. No markdown fences, no commentary, no trailing commas. The output must be parseable by JSON.parse.`
            },
            {
              role: "user",
              content: `Required JSON schema/task:\n${instructions.slice(0, 7000)}\n\nMalformed model output:\n${originalText}\n\nRepair it now. Return only the complete JSON object.`
            }
          ]
        };
        if (Date.now() >= agentDeadline - 2500) {
          throw new Error(`${agentName}: response was malformed and there was not enough time left for safe JSON repair. Please retry.`);
        }
        const repairedResponse = await sendRequest(repairPayload);
        if (!repairedResponse.ok) {
          throw new Error(`${agentName}: output was malformed and automatic JSON repair failed. Please generate again.`);
        }
        const repaired = await repairedResponse.json();
        try {
          return parseJson(repaired.choices?.[0]?.message?.content);
        } catch {
          throw new Error(`${agentName}: output remained invalid after automatic JSON repair. Please generate again.`);
        }
      }
    }

    // 1. Architect: decide the game loop, world progression and systems before code exists.
    const architect = await askAgent(
      "Game Architect",
      `Create a complete, original game blueprint tailored to the user's exact idea. Return JSON with:
      projectName (string), summary (string), gameDesign (string),
      worldPlan (array of 3-8 concise strings), systemsPlan (array of 3-10 strings),
      environmentBrief (string), gameplayBrief (string), instructions (array of 3-8 strings).
      Define the core gameplay loop, player goals, progression, rewards, failure/retry loop and multiplayer assumptions. Do not invent unrelated themes. Define a premium realistic 3D art direction with believable proportions, natural colors, realistic materials, lighting and weather. Do not choose Minecraft, voxel, blocky or low-poly aesthetics unless explicitly requested.`,
      2200,
      "",
      9000
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

    // 2. Specialist agents build the environment, gameplay and interface from one blueprint.
    // Run specialist agents sequentially. Groq applies TPM limits across the whole
    // organization, so parallel calls create avoidable bursts and 429 responses.
    const environment = await askAgent(
      "Environment Agent",
      `Build the actual Roblox environment from this approved blueprint: ${blueprintContext}
        Return JSON with buildPlan: array of 25-45 objects {name,parentPath,className,position,size,color,material,shape,rotation,anchored,canCollide,transparency}; files: array of 0-3 objects {path,kind,code}; environmentNotes: array of 2-4 strings.
        The Studio Connector creates these 3D objects directly in Workspace. REALISM IS A HARD REQUIREMENT: never make the map look like Minecraft, voxel art, low-poly or a primitive blockout unless the user explicitly requests that style. Build a believable premium 3D environment with natural terrain and elevation, organic paths/coastlines/cliffs where relevant, varied building silhouettes, layered facades, roofs, windows, trim, realistic-scale props, vegetation, rocks and environmental detail. Never build the whole world from giant cubes or repetitive flat platforms. Since buildPlan supports basic Parts only, use Environment Agent Luau builder scripts to create advanced details and Roblox Terrain via Terrain:FillBlock, FillBall and FillWedge, plus decorative models from varied primitives; do not rely on unknown mesh asset IDs. Add a dedicated environment setup script for Lighting, Atmosphere, clouds, color correction and appropriate post effects. Use realistic Roblox materials such as Ground, Grass, Rock, Slate, Concrete, Asphalt, Wood, Glass, Metal, Water, Sand and Snow with restrained natural colors. For Full game or Game map, create a coherent traversable map with spawn, natural paths, boundaries, landmarks and distinct requested areas. For many stages/worlds, build a reusable modular layout and procedural builder; do not pretend they exist if only a few platforms are supplied. Return 25-45 useful structural objects, not filler. For other modes, return buildPlan: []. 
        parentPath is relative to Workspace, such as "World/SpawnArea". className Part or SpawnLocation. Use studs and believable scale. Avoid floating geometry. Every file must be complete Luau source, never pseudocode.`,
      3400,
      "",
      11000
    );

    const gameplay = await askAgent(
      "Gameplay Agent",
      `Build the complete playable game systems from this approved blueprint: ${blueprintContext}
        Return JSON with files: array of 5-8 objects {path,kind,code}; gameplayNotes: array of 3-5 strings.
        THIS IS A FULL GAME BUILD, NOT A DEMO OR PLAN. Implement the core gameplay loop described by the user, not generic placeholder code. Include all essential dependencies and a clear server/client split. For a multiplayer game, implement server-authoritative player/session state and safe handling when players join/leave. For progression games, implement the actual currency/reward/progression loop. For stage games, implement checkpoints, completion and respawn. For combat games, implement validated damage, cooldowns and enemy/boss behavior. Use RemoteEvents created safely by the server and validate every client request. Use DataStoreService with pcall, retries or graceful defaults; the game must still run if saving is unavailable in Studio. Use correct Roblox service paths and full scripts. Do not create UI; the Interface Agent owns UI. Do not duplicate static map parts from buildPlan.`,
      3800,
      "",
      14000
    );

    let interfaceAgent: JsonObject = { files: [], gameplayNotes: [] };
    let interfaceAgentError = "";
    if ((mode === "Full game" || mode === "UI interface") && Date.now() < generationDeadline - 8500) {
      try {
        interfaceAgent = await askAgent(
          "Roblox UI Agent",
          `Create the complete player-facing interface for this Roblox project using this blueprint: ${blueprintContext}
            Return JSON with files: array of 1-3 objects {path,kind,code}; gameplayNotes: array of 2-4 strings.
            For Full game, provide a polished premium mobile-friendly StarterPlayer/StarterPlayerScripts/HUD.client.lua LocalScript that creates its ScreenGui at runtime, scales for touch and desktop, displays the actual game stats/progression, and connects only to RemoteEvents/RemoteFunctions that are part of the blueprint. Use modern high-quality game HUD design, clean typography, restrained colors, subtle gradients and strokes, consistent spacing and responsive controls; never use childish blocky/Minecraft-style UI unless requested. If no remotes are specified, coordinate names with the Gameplay Agent using conventional names and document them in gameplayNotes. Include clear feedback, readable buttons and safe touch input. Do not implement server-authoritative game logic in the client. For UI interface mode, focus on the requested UI and its client behavior. Return full runnable Luau, not pseudocode.`,
          1500,
          "",
          8000
        );
      } catch (error) {
        // UI is an optional specialist: a provider TPM limit must not discard
        // the Architect, environment and gameplay work already completed.
        interfaceAgentError = error instanceof Error ? error.message : "Roblox UI Agent could not finish.";
        console.warn("Madara AI UI agent skipped:", interfaceAgentError);
      }
    }

    const environmentFiles = validFiles(environment.files, 4);
    const gameplayFiles = validFiles(gameplay.files, 8);
    const interfaceFiles = validFiles(interfaceAgent.files, 3);
    const files = uniqueByPath([...environmentFiles, ...gameplayFiles, ...interfaceFiles]).slice(0, 16);

    const environmentPlan = validScenePlan(environment.buildPlan);
    if (mode === "Full game") {
      const hasServer = files.some(file => file.kind === "server");
      const hasClient = files.some(file => file.kind === "client");
      const hasShared = files.some(file => file.kind === "module");
      if (gameplayFiles.length < 3 || !hasServer || !hasClient || !hasShared) {
        return NextResponse.json({
          error: "Madara AI could not complete the game package. A full game must include server gameplay, a client controller and shared configuration/modules. No incomplete ZIP was created. Try Generate again; if it repeats, reduce the game scope or check the Groq model limits."
        }, { status: 502 });
      }
      if (environmentPlan.length < 10) {
        return NextResponse.json({
          error: "The environment agent returned too few 3D objects for a complete game map. Madara AI stopped the export rather than labeling an unfinished map as complete. Try again with a smaller or more specific world layout."
        }, { status: 502 });
      }
    }

    if (files.length === 0 && environmentPlan.length === 0) {
      return NextResponse.json({ error: "The agents completed the plan but did not return usable scripts or 3D scene objects. Try a more specific idea." }, { status: 502 });
    }

    // 3. Reviewer: inspect the combined project and repair concrete defects.
    let reviewChecks: string[] = [];
    let reviewWarnings: string[] = [];
    let reviewerCompleted = false;
    try {
      if (Date.now() >= generationDeadline - 6500) throw new Error("Not enough generation time remains for the optional reviewer.");
      const review = await askAgent(
        "Luau Code Reviewer",
        `Review the complete generated project and 3D scene plan for Roblox Luau correctness, missing dependencies, incorrect service paths, server/client boundary mistakes, unsafe remote handling, DataStore error handling, floating or badly scaled map geometry and obvious logic defects. Return JSON with:
        files: array containing corrected full files {path,kind,code}; qualityChecks: array of concise checks performed; warnings: array of genuine remaining risks; sceneWarnings: array of map-specific issues.
        IMPORTANT: Return a corrected file only when you made a real improvement. Preserve the exact path and kind for every corrected file. Do not rewrite working code just for style. Do not add unrelated systems. If a file is already sound, omit it from files. Never say code was executed or tested.`,
        3000,
        JSON.stringify({ blueprint: architect, files, environmentPlan }),
        6000
      );
      const corrected = validFiles(review.files, 8);
      for (const fix of corrected) {
        const index = files.findIndex(file => file.path.toLowerCase() === fix.path.toLowerCase());
        if (index >= 0 && files[index].kind === fix.kind) files[index] = fix;
      }
      reviewChecks = Array.isArray(review.qualityChecks)
        ? review.qualityChecks.filter((item): item is string => typeof item === "string").slice(0, 8)
        : [];
      reviewWarnings = [
        ...(Array.isArray(review.warnings) ? review.warnings.filter((item): item is string => typeof item === "string").slice(0, 6) : []),
        ...(Array.isArray(review.sceneWarnings) ? review.sceneWarnings.filter((item): item is string => typeof item === "string").slice(0, 6) : [])
      ].slice(0, 10);
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
      environmentPlan,
      worldPlan: strings(architect.worldPlan, 8),
      systemsPlan: strings(architect.systemsPlan, 10),
      instructions: strings(architect.instructions, 12),
      agents: [
        { name: "Game Architect", status: "complete", detail: "Game loop, progression and world blueprint created." },
        { name: "Environment Agent", status: environmentPlan.length > 0 || !["Full game", "Game map"].includes(mode) ? "complete" : "warning", detail: environmentPlan.length > 0 ? `${environmentPlan.length} 3D scene objects planned for direct Studio construction.` : ["Full game", "Game map"].includes(mode) ? "No static 3D scene objects were returned." : "Map generation skipped for this creation mode." },
        { name: "Gameplay Agent", status: mode === "Game map" || gameplayFiles.length > 0 ? "complete" : "warning", detail: mode === "Game map" ? "Gameplay systems skipped by design for map-only mode." : gameplayFiles.length > 0 ? `${gameplayFiles.length} gameplay scripts generated.` : "No gameplay scripts were returned for this mode." },
        { name: "UI Agent", status: mode !== "Full game" && mode !== "UI interface" || interfaceFiles.length > 0 ? "complete" : "warning", detail: mode === "Full game" || mode === "UI interface" ? interfaceFiles.length > 0 ? `${interfaceFiles.length} interface scripts generated.` : interfaceAgentError ? `UI generation skipped so the rest of the game could be saved: ${interfaceAgentError.slice(0, 180)}` : "The UI agent returned no interface scripts." : "Interface generation skipped for this mode." },
        { name: "Luau Reviewer", status: reviewerCompleted && reviewWarnings.length === 0 ? "complete" : "warning", detail: !reviewerCompleted ? "Automated review did not finish; manual Studio testing is required." : reviewWarnings.length > 0 ? "Review completed with remaining warnings. Read the notes before inserting." : "Project reviewed and concrete fixes applied where needed." }
      ],
      agentNotes: [
        ...strings(environment.environmentNotes, 4),
        ...strings(gameplay.gameplayNotes, 5),
        ...strings(interfaceAgent.gameplayNotes, 3),
        ...(interfaceAgentError ? [`UI Agent note: ${interfaceAgentError.slice(0, 220)}. Core gameplay and map generation were preserved; you can retry UI generation separately.`] : []),
        ...reviewChecks.map(item => `Review: ${item}`),
        ...reviewWarnings.map(item => `Review warning: ${item}`)
      ],
      files
    });
  } catch (error) {
    console.error("Madara AI pipeline error:", error);
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Game Architect:") || message.includes("Environment Agent:") || message.includes("Gameplay Agent:") || message.includes("Roblox UI Agent:")) {
      return NextResponse.json({ error: message }, { status: 502 });
    }
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json({ error: "An AI agent took too long to respond. Try a smaller game idea." }, { status: 504 });
    }
    return NextResponse.json({ error: message || "Something went wrong in the Madara AI agent pipeline." }, { status: 500 });
  }
}
