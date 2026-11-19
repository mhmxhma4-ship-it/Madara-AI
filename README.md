# Madara AI

Mobile-first AI Roblox game builder using Next.js 15, TypeScript and Tailwind CSS.

## Features
- Mobile-first prompt builder with Full game, Map, Gameplay, UI and Luau modes.
- Server-side AI generation at POST /api/generate.
- Multi-agent blueprint, gameplay generation and a structured 3D scene plan.
- Studio Connector builds validated Parts and SpawnLocations directly in Workspace, then inserts Luau scripts.
- Separate Luau review pass and deterministic unsafe-code checks.
- Deterministic checks for unsafe dynamic code and unverified numeric asset requires.
- Structured Luau project files and Roblox Studio setup instructions.
- Code preview, copy, structured Rojo-compatible ZIP export and generated Roblox XML place-file export (`.rbxlx`).
- Provider secrets stay on the server.

## Required Vercel environment variables
- OPENAI_API_KEY — API key from an OpenAI-compatible provider.
- OPENAI_MODEL — optional model; defaults to openai/gpt-oss-120b.
- OPENAI_BASE_URL — optional API base URL; defaults to https://api.openai.com/v1.

Add these in Vercel → Project → Settings → Environment Variables, then redeploy. API usage may cost money; configure provider billing and limits.

## Long-running background generation (Inngest)

Game generation runs as a durable Inngest function. The Architect, Environment, Gameplay, UI and Reviewer agents are separate durable steps so completed work is checkpointed and a single Vercel request does not need to run the entire pipeline. Each AI-agent step is capped at approximately four minutes to stay below the Vercel Hobby function limit; the overall Inngest run can continue across multiple requests.

### Connect the project

1. Connect the **Madara AI** Vercel project using the Inngest Vercel integration.
2. Keep the Inngest app enabled and its serving path set to `/api/inngest`.
3. The Vercel integration should provide `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` to the project. Confirm both exist in Vercel → Settings → Environment Variables, then redeploy.
4. Deploy the Next.js app. Inngest should sync the functions from `/api/inngest` automatically.
5. Confirm `generate-roblox-project` appears in Inngest → Functions before testing a generation.

For local development, run the Inngest Dev Server with `npx inngest-cli@latest dev` alongside `npm run dev`.

Inngest is durable orchestration, not unlimited AI compute. Provider rate limits, model availability, execution quotas and Vercel request limits still apply. Set usage limits in the Inngest and AI-provider dashboards.

## Run locally
```bash
npm install
npm run dev
```

## Roblox workflow and limitation
Madara AI generates Luau source files and setup instructions. Use the Studio Connector plugin to insert scripts directly, or download the structured Rojo-compatible ZIP and use it with Rojo. Review and test before publishing.

Madara AI can export the generated scene parts and Luau scripts into a Roblox XML place file (`.rbxlx`) directly from the generated result. Open the exported file in Roblox Studio and test it before publishing. The automated reviewer is not a substitute for running the project in Roblox Studio. Never expose Roblox credentials in browser code.

## Safety
Generated scripts are untrusted output. Review before running. Never use executor scripts, unknown asset requires or unreviewed third-party modules.


## Publish Now (Roblox Open Cloud)

Madara AI can publish a real Roblox place file to an existing experience using Roblox's official Place Publishing API.

1. In Creator Dashboard, create an API key with **universe-places → Write** permission for the target experience.
2. Copy the target experience's **Universe ID** and the target place's **Place ID**.
3. Generate your game in Madara AI, then click **Export .rbxlx** in the result panel. This creates a place file containing the generated scene parts and Luau scripts.
4. Open the exported `.rbxlx` in Roblox Studio, inspect the map and scripts, and run Play tests. Save a backup before publishing.
5. Open Madara AI's **Publish Now** section. The generated `.rbxlx` is attached automatically; enter the API key and IDs, then confirm publishing.

The publisher accepts place files up to 10 MB. The API key is used for the request and is not saved by Madara AI. Do not share it with anyone.

**Important:** Publishing replaces the selected place's current published content with the uploaded place file. Keep a backup before publishing. Roblox retains place version history, but this app does not currently create or restore backups automatically.

The `.rbxlx` exporter serializes the generated scene plan into Workspace parts/folders and maps generated server, client and module scripts into their Roblox services. It does not run Roblox Studio's compiler or simulate gameplay; opening and testing the file in Studio remains mandatory. Unsupported or invalid generated paths stop export rather than being silently dropped.

Official guide: https://create.roblox.com/docs/cloud/guides/usage-place-publishing


## Roblox Studio Connector

A source plugin is included at [roblox-plugin/MadaraAI.plugin.lua](roblox-plugin/MadaraAI.plugin.lua).

1. Open Roblox Studio on a computer.
2. Create a temporary Script in ServerStorage and paste the plugin source into it.
3. Select the script, then choose **Plugins → Save as Local Plugin**.
4. Open the Madara AI toolbar panel and confirm the website URL.
5. Describe the game and generate. Review the result, then press **Insert generated scripts into Studio** twice to confirm.
6. Test with Play and inspect Output before publishing.

The plugin uses Roblox Studio's plugin HTTP permission prompt for the Madara AI domain. It does not need your Roblox password, cookie, or publishing API key. Generated scripts are inserted into service paths and same-path scripts may be updated. The map is built inside `Workspace/MadaraAI_Generated`; that dedicated folder is replaced on the next map insert. Studio undo recording is used for the insertion. Roblox Studio is required — this plugin cannot run inside the Roblox iPhone app.

For ZIP import, install [Rojo](https://rojo.space/) and use its build/sync workflow. Official references: [Create and install Studio plugins](https://create.roblox.com/docs/studio/plugins) · [HTTP requests from plugins](https://create.roblox.com/docs/cloud-services/http-service)
