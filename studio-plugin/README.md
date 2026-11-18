# Madara AI Connector for Roblox Studio

A dockable Roblox Studio plugin that sends a game idea to Madara AI, displays the returned Luau files, and inserts those files into the current place.

## What it does

1. Opens a **Madara AI Connector** panel from the Studio toolbar.
2. Sends the prompt and selected creation mode to the Madara AI generation endpoint.
3. Lists the returned project files.
4. Inserts generated source into Scripts, LocalScripts, and ModuleScripts under clearly named folders in the relevant Roblox services.

The plugin does **not** execute generated code itself. Scripts inserted into the place may run according to normal Roblox behavior when the experience is played. Review generated code before testing or publishing.

## Install in Roblox Studio

1. Download `MadaraAIConnector.plugin.lua` from this folder in the repository.
2. Open Roblox Studio on a computer.
3. In Studio, open **Plugins > Manage Plugins** (or the local plugins folder workflow for your Studio version).
4. Use **Plugins > Save as Local Plugin** after opening the Lua file as a plugin script, or place the plugin file in the Studio local Plugins folder.
5. Restart Studio if the plugin does not appear.
6. Click **Madara AI** in the Plugins toolbar.
7. On the first connection, approve the Studio prompt allowing this plugin to contact `madara-ai.vercel.app`.

## Important

- Requires an internet connection and a working Madara AI deployment.
- Uses the Madara AI server endpoint; the Groq API key stays on the Madara AI server and is not stored in the plugin.
- The generation endpoint is currently public. Do not treat this first version as an authenticated/private account integration.
- Generated scripts are AI output and are not guaranteed to be error-free. Inspect them, test in a separate place, and do not publish without reviewing.
- This first connector inserts generated scripts. It does not yet create a native editable 3D map directly in the Studio viewport or publish the experience for you.
- Roblox Studio plugin installation and use require a computer; the plugin cannot run inside the Roblox mobile app.

## API

The plugin calls:

`POST https://madara-ai.vercel.app/api/generate`

JSON body:

```json
{
  "prompt": "Describe the Roblox game",
  "mode": "Full game"
}
```

Supported modes: `Full game`, `Game map`, `Gameplay system`, `UI interface`, `Lua script`.
