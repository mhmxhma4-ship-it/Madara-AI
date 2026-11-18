# Madara AI

Mobile-first AI Roblox game builder using Next.js 15, TypeScript and Tailwind CSS.

## Features
- Mobile-first prompt builder with Full game, Map, Gameplay, UI and Luau modes.
- Server-side AI generation at POST /api/generate.
- Structured Luau project files and Roblox Studio setup instructions.
- Code preview, copy and plain-text bundle download.
- Provider secrets stay on the server.

## Required Vercel environment variables
- OPENAI_API_KEY — API key from an OpenAI-compatible provider.
- OPENAI_MODEL — optional model; defaults to gpt-4o-mini.
- OPENAI_BASE_URL — optional API base URL; defaults to https://api.openai.com/v1.

Add these in Vercel → Project → Settings → Environment Variables, then redeploy. API usage may cost money; configure provider billing and limits.

## Run locally
```bash
npm install
npm run dev
```

## Roblox workflow and limitation
Madara AI generates Luau source files and setup instructions. Import each file into the matching location in Roblox Studio, review it and test it before publishing.

Direct Roblox publishing requires a valid place file and authorized Open Cloud credentials. This app does not yet convert generated scripts into a complete .rbxl place file or publish an untested game. A safe publishing pipeline needs a trusted place-building/export step. Never expose Roblox credentials in browser code.

## Safety
Generated scripts are untrusted output. Review before running. Never use executor scripts, unknown asset requires or unreviewed third-party modules.
