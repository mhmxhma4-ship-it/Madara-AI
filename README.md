# Madara AI

Mobile-first AI Roblox game builder using Next.js 15, TypeScript and Tailwind CSS.

## Features
- Mobile-first prompt builder with Full game, Map, Gameplay, UI and Luau modes.
- Server-side AI generation at POST /api/generate.
- Multi-agent blueprint, environment and gameplay generation, plus a separate Luau review pass.
- Deterministic checks for unsafe dynamic code and unverified numeric asset requires.
- Structured Luau project files and Roblox Studio setup instructions.
- Code preview, copy and plain-text bundle download.
- Provider secrets stay on the server.

## Required Vercel environment variables
- OPENAI_API_KEY — API key from an OpenAI-compatible provider.
- OPENAI_MODEL — optional model; defaults to openai/gpt-oss-120b.
- OPENAI_BASE_URL — optional API base URL; defaults to https://api.openai.com/v1.

Add these in Vercel → Project → Settings → Environment Variables, then redeploy. API usage may cost money; configure provider billing and limits.

## Run locally
```bash
npm install
npm run dev
```

## Roblox workflow and limitation
Madara AI generates Luau source files and setup instructions. Import each file into the matching location in Roblox Studio, review it and test it before publishing.

Direct Roblox publishing requires a valid place file and authorized Open Cloud credentials. This app does not yet convert generated scripts into a complete .rbxl place file or publish an untested game. The automated reviewer is not a substitute for running the project in Roblox Studio. A safe publishing pipeline needs a trusted place-building/export step. Never expose Roblox credentials in browser code.

## Safety
Generated scripts are untrusted output. Review before running. Never use executor scripts, unknown asset requires or unreviewed third-party modules.


## Publish Now (Roblox Open Cloud)

Madara AI can publish a real Roblox place file to an existing experience using Roblox's official Place Publishing API.

1. In Creator Dashboard, create an API key with **universe-places → Write** permission for the target experience.
2. Copy the target experience's **Universe ID** and the target place's **Place ID**.
3. Export/save a valid `.rbxlx` or `.rbxl` place file from Roblox Studio.
4. Open Madara AI's **Publish Now** section, enter the API key and IDs, select the place file, and confirm publishing.

The publisher accepts place files up to 10 MB. The API key is used for the request and is not saved by Madara AI. Do not share it with anyone.

**Important:** Publishing replaces the selected place's current published content with the uploaded place file. Keep a backup before publishing. Roblox retains place version history, but this app does not currently create or restore backups automatically.

The current AI generator returns Luau script bundles, not complete `.rbxlx`/`.rbxl` place files. Insert and test the generated scripts in Studio, then export the resulting place file before using Publish Now. The publisher does not yet convert the script bundle into a complete place automatically.

Official guide: https://create.roblox.com/docs/cloud/guides/usage-place-publishing
