"use client";
import { useEffect, useState } from "react";
import { strToU8, zipSync } from "fflate";
import { ArrowUp, Check, Code2, Copy, Download, ExternalLink, Gamepad2, Github, Layers3, LoaderCircle, Sparkles, WandSparkles, X, BrainCircuit, Globe2, Workflow, Clock3, Activity } from "lucide-react";

type GeneratedFile = { path: string; kind: string; code: string };
type Agent = { name: string; status: string; detail: string };
type ScenePart = {
  name: string; parentPath: string; className: "Part" | "SpawnLocation";
  position: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
  color: { r: number; g: number; b: number };
};
type Project = {
  environmentPlan?: ScenePart[];
  projectName: string; summary: string; gameDesign?: string; worldPlan?: string[];
  systemsPlan?: string[]; instructions: string[]; files: GeneratedFile[];
  agents?: Agent[]; agentNotes?: string[];
};

const examples = [
  "Create a cute pink obby tower with 30 stages, checkpoints, wins and a rebirth shop.",
  "Build an anime simulator with 5 worlds, companion followers, training zones, bosses and rebirths.",
  "Make a romantic hangout map with a sunset, glowing stars, a heart garden and interactive places."
];
const modes = ["Full game", "Game map", "Gameplay system", "UI interface", "Lua script"];

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}


function PublishNowPanel() {
  const [apiKey, setApiKey] = useState("");
  const [universeId, setUniverseId] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [placeFile, setPlaceFile] = useState<File | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);

  async function publishNow() {
    if (!apiKey || !universeId || !placeId || !placeFile) {
      setFailed(true); setStatus("Complete all fields and select your Roblox place file."); return;
    }
    const confirmed = window.confirm("Publish this place file to the selected Roblox experience? This creates a new published version and updates the live game.");
    if (!confirmed) return;
    setPublishing(true); setStatus(""); setFailed(false);
    try {
      const form = new FormData();
      form.append("apiKey", apiKey);
      form.append("universeId", universeId.trim());
      form.append("placeId", placeId.trim());
      form.append("placeFile", placeFile);
      const response = await fetch("/api/roblox/publish", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Publishing failed.");
      setStatus(data.versionNumber ? `Published successfully. Roblox version: ${data.versionNumber}` : "Roblox accepted the place file for publishing.");
      setApiKey("");
    } catch (error) {
      setFailed(true);
      setStatus(error instanceof Error ? error.message : "Could not publish this place.");
    } finally { setPublishing(false); }
  }

  return <section className="publish-panel" id="publish-now">
    <div className="section-kicker">ROBLOX OPEN CLOUD</div>
    <h2>Publish Now</h2>
    <p>Replace the content of an existing Roblox place with a new .rbxlx or .rbxl version.</p>
    <div className="publish-warning">Publishing updates the selected live place. Save a backup version in Roblox Studio before continuing.</div>
    <div className="publish-fields">
      <label>Roblox API Key<input type="password" autoComplete="off" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Paste your Open Cloud API key" /></label>
      <div className="publish-id-row">
        <label>Universe ID<input inputMode="numeric" value={universeId} onChange={e => setUniverseId(e.target.value)} placeholder="Experience Universe ID" /></label>
        <label>Place ID<input inputMode="numeric" value={placeId} onChange={e => setPlaceId(e.target.value)} placeholder="Place ID" /></label>
      </div>
      <label>New Roblox place file<input type="file" accept=".rbxlx,.rbxl" onChange={e => setPlaceFile(e.target.files?.[0] || null)} /></label>
      {placeFile && <span className="publish-file-name">{placeFile.name} · {(placeFile.size / 1024 / 1024).toFixed(2)} MB</span>}
      <button className="generate-button publish-submit" onClick={publishNow} disabled={publishing}>{publishing ? <><LoaderCircle size={16} className="spin"/> Publishing...</> : <>Publish Now <ArrowUp size={16}/></>}</button>
      {status && <p className={failed ? "publish-status error" : "publish-status success"} role="status">{status}</p>}
    </div>
    <p className="publish-security">Your API key is sent only for this request and is not saved by Madara AI. Use a key limited to the target experience with <strong>universe-places: Write</strong> permission. Current generator output is a script bundle; export a real .rbxlx/.rbxl from Studio before using this publisher.</p>
    <a className="publish-doc-link" href="https://create.roblox.com/docs/cloud/guides/usage-place-publishing" target="_blank" rel="noreferrer">Roblox publishing setup guide <ExternalLink size={13}/></a>
  </section>;
}

function ScenePlanPreview({ parts }: { parts: ScenePart[] }) {
  if (!parts.length) return null;
  const minX = Math.min(...parts.map(part => part.position.x - part.size.x / 2));
  const maxX = Math.max(...parts.map(part => part.position.x + part.size.x / 2));
  const minZ = Math.min(...parts.map(part => part.position.z - part.size.z / 2));
  const maxZ = Math.max(...parts.map(part => part.position.z + part.size.z / 2));
  const spanX = Math.max(1, maxX - minX);
  const spanZ = Math.max(1, maxZ - minZ);

  return <div className="scene-preview-card">
    <div className="scene-preview-heading"><Globe2 size={15}/> TOP-DOWN MAP PREVIEW <span>{parts.length} objects</span></div>
    <div className="scene-preview-canvas">
      {parts.map(part => {
        const left = 4 + ((part.position.x - part.size.x / 2 - minX) / spanX) * 92;
        const top = 4 + ((part.position.z - part.size.z / 2 - minZ) / spanZ) * 92;
        const width = Math.max(1.5, Math.min(40, (part.size.x / spanX) * 92));
        const height = Math.max(1.5, Math.min(40, (part.size.z / spanZ) * 92));
        const color = "rgb(" + Math.round(part.color.r * 255) + ", " + Math.round(part.color.g * 255) + ", " + Math.round(part.color.b * 255) + ")";
        return <div
          key={part.parentPath + "/" + part.name}
          className={part.className === "SpawnLocation" ? "scene-preview-part scene-preview-spawn" : "scene-preview-part"}
          title={part.name}
          style={{ left: left + "%", top: top + "%", width: width + "%", height: height + "%", backgroundColor: color }}
        />;
      })}
    </div>
    <p>Approximate top-down layout. Final geometry is created in Roblox Studio by the connector.</p>
  </div>;
}

function StudioConnectorPanel() {
  return <section className="studio-connector-panel" id="studio-connector">
    <div className="section-kicker">ROBLOX STUDIO INTEGRATION</div>
    <h2>Build inside Roblox Studio.</h2>
    <p>Use the Madara AI Studio Connector to send a game idea from Studio, construct the 3D map in Workspace and insert scripts into the correct Roblox services.</p>
    <div className="studio-connector-steps">
      <span><strong>01</strong> Install the local Studio plugin</span>
      <span><strong>02</strong> Generate with Madara AI agents</span>
      <span><strong>03</strong> Build the map and insert scripts</span>
      <span><strong>04</strong> Test in Play mode</span>
    </div>
    <a className="generate-button studio-plugin-link" href="https://raw.githubusercontent.com/mhmxhma4-ship-it/Madara-AI/main/roblox-plugin/MadaraAI.plugin.lua" target="_blank" rel="noreferrer">Open Studio Connector source <ExternalLink size={15}/></a>
    <p className="studio-connector-note">Requires Roblox Studio on a computer. The Roblox iPhone app cannot install or run Studio plugins. The connector never asks for your Roblox password or security cookie.</p>
  </section>;
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState("Full game");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const [activeFile, setActiveFile] = useState(0);
  const [copied, setCopied] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => setElapsedSeconds(seconds => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [loading]);

  useEffect(() => {
    const savedRunId = window.localStorage.getItem("madara-active-run");
    if (!savedRunId) return;
    let active = true;
    setLoading(true);
    setError("");
    const resume = async () => {
      const deadline = Date.now() + 115 * 60 * 1000;
      try {
        while (active && Date.now() < deadline) {
          const response = await fetch("/api/generate?runId=" + encodeURIComponent(savedRunId), { cache: "no-store" });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Could not resume generation.");
          if (data.status === "COMPLETED" && data.project) {
            window.localStorage.removeItem("madara-active-run");
            if (active) { setProject(data.project as Project); setActiveFile(0); }
            return;
          }
          if (data.error || ["FAILED", "CRASHED", "SYSTEM_FAILURE", "INTERRUPTED", "CANCELED", "EXPIRED"].includes(data.status)) {
            window.localStorage.removeItem("madara-active-run");
            throw new Error(data.error || "The saved generation failed. Open Trigger.dev Runs for details.");
          }
          await new Promise(resolve => window.setTimeout(resolve, 2500));
        }
      } catch (error) {
        if (active) setError(error instanceof Error ? error.message : "Could not resume generation.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void resume();
    return () => { active = false; };
  }, []);

  async function generate() {
    if (!prompt.trim()) { setError("Write your Roblox game idea first."); return; }
    setElapsedSeconds(0); setLoading(true); setError(""); setProject(null);
    try {
      const startResponse = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), mode })
      });
      const started = await startResponse.json();
      if (!startResponse.ok) throw new Error(started.error || "Could not start generation.");
      const runId = started.runId as string;
      if (!runId) throw new Error("Trigger.dev did not return a generation ID.");
      window.localStorage.setItem("madara-active-run", runId);

      const deadline = Date.now() + 115 * 60 * 1000;
      while (Date.now() < deadline) {
        await new Promise(resolve => window.setTimeout(resolve, 2500));
        const statusResponse = await fetch("/api/generate?runId=" + encodeURIComponent(runId), { cache: "no-store" });
        const statusData = await statusResponse.json();
        if (!statusResponse.ok) throw new Error(statusData.error || "Could not read generation status.");
        if (statusData.status === "COMPLETED" && statusData.project) {
          window.localStorage.removeItem("madara-active-run");
          setProject(statusData.project as Project); setActiveFile(0);
          return;
        }
        if (statusData.error || ["FAILED", "CRASHED", "SYSTEM_FAILURE", "INTERRUPTED", "CANCELED", "EXPIRED"].includes(statusData.status)) {
          window.localStorage.removeItem("madara-active-run");
          throw new Error(statusData.error || "Generation failed. Open Trigger.dev Runs for details.");
        }
      }
      throw new Error("Generation is still running or exceeded the 115-minute wait. Check Trigger.dev Runs.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate the project.");
    } finally { setLoading(false); }
  }

  async function copyCode() {
    if (!project?.files[activeFile]) return;
    await navigator.clipboard.writeText(project.files[activeFile].code);
    setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  }

  function downloadProject() {
    if (!project) return;
    const archive: Record<string, Uint8Array> = {};
    const sourceFolders: Record<string, string> = {
      ServerScriptService: "src/server",
      ReplicatedStorage: "src/shared",
      ServerStorage: "src/serverStorage",
      StarterGui: "src/starterGui",
      Workspace: "src/workspace",
    };
    const manifest: Array<{ originalPath: string; zipPath: string; kind: string }> = [];

    for (const file of project.files) {
      if (file.kind === "readme") continue;
      const segments = file.path.split("/");
      const service = segments.shift() || "";
      let destinationRoot = sourceFolders[service];
      if (service === "StarterPlayer") {
        if (segments[0] === "StarterPlayerScripts") {
          segments.shift();
          destinationRoot = "src/client";
        } else if (segments[0] === "StarterCharacterScripts") {
          segments.shift();
          destinationRoot = "src/character";
        }
      }
      if (!destinationRoot || segments.length === 0) continue;

      let relativePath = segments.join("/");
      if (file.kind === "module") {
        relativePath = relativePath.replace(/\.module\.lua$/i, ".lua");
        if (!/\.lua$/i.test(relativePath)) relativePath += ".lua";
      }
      if (file.kind === "server" && !/\.server\.lua$/i.test(relativePath)) {
        relativePath = relativePath.replace(/\.lua$/i, "") + ".server.lua";
      }
      if (file.kind === "client" && !/\.client\.lua$/i.test(relativePath)) {
        relativePath = relativePath.replace(/\.lua$/i, "") + ".client.lua";
      }
      const zipPath = destinationRoot + "/" + relativePath;
      archive[zipPath] = strToU8(file.code);
      manifest.push({ originalPath: file.path, zipPath, kind: file.kind });
    }

    const tree: Record<string, unknown> = { $className: "DataModel" };
    for (const [service, folder] of Object.entries(sourceFolders)) {
      if (Object.keys(archive).some(path => path.startsWith(folder + "/"))) {
        tree[service] = { $path: folder };
      }
    }
    const starterPlayerTree: Record<string, unknown> = { $className: "StarterPlayer" };
    if (Object.keys(archive).some(path => path.startsWith("src/client/"))) {
      starterPlayerTree.StarterPlayerScripts = { $path: "src/client" };
    }
    if (Object.keys(archive).some(path => path.startsWith("src/character/"))) {
      starterPlayerTree.StarterCharacterScripts = { $path: "src/character" };
    }
    if (Object.keys(starterPlayerTree).length > 1) {
      tree.StarterPlayer = starterPlayerTree;
    }
    const projectConfig = {
      name: project.projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "madara-project",
      tree
    };

    archive["default.project.json"] = strToU8(JSON.stringify(projectConfig, null, 2));
    archive["madara-scene-plan.json"] = strToU8(JSON.stringify(project.environmentPlan || [], null, 2));
    archive["madara-manifest.json"] = strToU8(JSON.stringify({
      projectName: project.projectName,
      summary: project.summary,
      files: manifest,
      note: "Generated by Madara AI. Review and test every script in Roblox Studio before publishing."
    }, null, 2));
    archive["README.md"] = strToU8(
      "# " + project.projectName + "\n\n" + project.summary +
      "\n\nGenerated by Madara AI multi-agent pipeline. This is a Rojo-compatible source project with a JSON scene plan, not a compiled .rbxlx place file. Use Rojo to sync/build scripts. Use the Madara AI Studio Connector to generate and insert the 3D scene directly in Studio. Review and test before publishing.\n"
    );

    const bytes = zipSync(archive, { level: 6 });
    const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: "application/zip" });
    const filename = project.projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "madara-project";
    downloadBlob(filename + ".zip", blob);
  }

  const currentFile = project?.files[activeFile];
  const elapsedPercent = Math.min(99, Math.round((elapsedSeconds / (55 * 60)) * 100));
  const elapsedLabel = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")}:${String(elapsedSeconds % 60).padStart(2, "0")}`;
  const currentStage = "Background generation";
  const currentWork = {
    title: "Gjenerimi po vazhdon ne sfond",
    tasks: [
      "Agjentet AI po punojne ne Trigger.dev, jashte kufirit te kerkeses Vercel",
      "Run-i vazhdon ne Trigger.dev edhe nese faqja rifreskohet ose mbyllet",
      "Rezultati do te shfaqet ketu kur gjenerimi te perfundoje"
    ]
  };

  return <main className="min-h-screen overflow-hidden">
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-mark"><WandSparkles size={19}/></span><span>madara<span className="brand-ai">.ai</span></span></a>
      <nav className="desktop-nav"><a href="#builder">Builder</a><a href="#how-it-works">How it works</a><a href="https://github.com/mhmxhma4-ship-it/Madara-AI" target="_blank" rel="noreferrer">GitHub</a></nav>
      <a className="top-cta" href="#builder">Start creating <ArrowUp size={15} className="rotate-45"/></a>
    </header>

    <section className="hero">
      <div className="hero-glow glow-one"/><div className="hero-glow glow-two"/>
      <div className="eyebrow"><span className="pulse-dot"/> MULTI-AGENT ROBLOX GAME STUDIO</div>
      <h1>Imagine it.<br/><span className="gradient-text">Build it with AI.</span></h1>
      <p className="hero-copy">A team of AI agents plans your Roblox game, builds its world and creates playable Luau systems. Designed for your phone.</p>
      <div className="hero-tags"><span><BrainCircuit size={14}/> AI agents</span><span><Gamepad2 size={14}/> Roblox Luau</span><span><Layers3 size={14}/> Project builder</span></div>
    </section>

    <section className="builder-wrap" id="builder">
      <div className="builder-card">
        <div className="builder-heading"><div><div className="section-kicker">THE CREATION LAB</div><h2>What are we building?</h2></div><span className="beta-pill">AGENT BUILDER</span></div>
        <div className="mode-row"><span className="mode-label">CREATE</span><div className="mode-select"><Gamepad2 size={15}/><select value={mode} onChange={e => setMode(e.target.value)}>{modes.map(m => <option key={m}>{m}</option>)}</select></div></div>
        <label className="sr-only" htmlFor="game-prompt">Describe your Roblox game</label>
        <textarea id="game-prompt" maxLength={5000} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder={"Describe the Roblox game you want to create...\n\nExample: An anime simulator with 5 worlds, character companions, quests, boss fights and rebirths."}/>
        <div className="prompt-footer"><span>{prompt.length} / 5000</span><button className="generate-button" onClick={generate} disabled={loading}>{loading ? <><LoaderCircle size={16} className="spin"/> Agents working...</> : <><Sparkles size={16}/> Generate project <ArrowUp size={16}/></>}</button></div>
        {error && <p className="error-message" role="alert"><X size={15}/>{error}</p>}
        {loading && <div className="agent-running"><div className="agent-running-title"><Workflow size={16}/> MADARA AGENT PIPELINE <span className="pipeline-live"><i/> LIVE</span></div><div className="generation-stats"><div className="generation-stat"><span><Clock3 size={14}/> KOHA LIVE</span><strong>{elapsedLabel}</strong></div><div className="generation-stat"><span><Activity size={14}/> KOHA E LIMITIT</span><strong>{elapsedPercent}%</strong></div></div><div className="generation-progress-track" role="progressbar" aria-label="Elapsed time against the 115-minute generation window" aria-valuemin={0} aria-valuemax={100} aria-valuenow={elapsedPercent}><div className="generation-progress-fill" style={{ width: elapsedPercent + "%" }}/></div><div className="generation-progress-caption"><span>{currentStage}</span><span>{elapsedPercent}%</span></div><div className="current-work-panel"><div className="current-work-heading"><WandSparkles size={14}/><strong>{currentWork.title}</strong><span>STATUS</span></div><ul>{currentWork.tasks.map((task, index) => <li key={index}><span className="work-check"><Check size={11}/></span>{task}</li>)}</ul><p>Keto jane fazat e pipeline-it, jo nje raport i sakte i fazes qe po ekzekutohet ne kete moment.</p></div><div className="agent-running-steps"><span><BrainCircuit size={14}/> Architect</span><span><Globe2 size={14}/> Environment</span><span><Code2 size={14}/> Gameplay</span><span><Check size={14}/> UI + Review</span></div><p>Koha tregon sa nga dritarja maksimale 115-minuteshe ka kaluar; nuk eshte matje e progresit te brendshem te agjenteve.</p></div>}
        <div className="examples"><span>TRY AN IDEA</span>{examples.map(x => <button key={x} onClick={() => { setPrompt(x); setError(""); }}>{x}<ArrowUp size={12} className="rotate-45"/></button>)}</div>
      </div>
    </section>

    {project && <section className="result-wrap" aria-live="polite">
      <div className="result-heading"><div><div className="section-kicker">YOUR GENERATED PROJECT</div><h2>{project.projectName}</h2><p>{project.summary}</p></div><button className="download-button" onClick={downloadProject}><Download size={16}/> Download project ZIP</button></div>

      {(project.environmentPlan?.length ?? 0) > 0 && <div className="scene-plan-note"><Globe2 size={16}/> <strong>{project.environmentPlan?.length} 3D objects</strong> are ready for direct construction by the Madara AI Studio Connector.</div>}
      {(project.environmentPlan?.length ?? 0) > 0 && <ScenePlanPreview parts={project.environmentPlan || []} />}
      {project.agents && <div className="agent-results"><div className="agent-results-title"><Workflow size={17}/> AGENT WORKFLOW <span>{project.agents.filter(agent => agent.status === "complete").length} / {project.agents.length} PASSED</span></div><div className="agent-results-grid">{project.agents.map(agent => <article className={agent.status === "warning" ? "agent-result agent-result-warning" : "agent-result"} key={agent.name}><div className="agent-result-icon">{agent.status === "warning" ? <X size={15}/> : <Check size={15}/>}</div><strong>{agent.name}</strong><p>{agent.detail}</p></article>)}</div></div>}

      {(project.gameDesign || (project.worldPlan?.length ?? 0) > 0 || (project.systemsPlan?.length ?? 0) > 0) && <div className="blueprint-card">
        <div className="section-kicker">GAME BLUEPRINT</div>{project.gameDesign && <p className="blueprint-description">{project.gameDesign}</p>}
        <div className="blueprint-columns">{(project.worldPlan?.length ?? 0) > 0 && <div><h3><Globe2 size={15}/> World plan</h3><ul>{project.worldPlan?.map((x,i) => <li key={i}>{x}</li>)}</ul></div>}{(project.systemsPlan?.length ?? 0) > 0 && <div><h3><Workflow size={15}/> Gameplay systems</h3><ul>{project.systemsPlan?.map((x,i) => <li key={i}>{x}</li>)}</ul></div>}</div>
      </div>}

      {project.files.length === 0 && <p className="no-script-note">This build contains a 3D scene plan and does not need separate Luau files. Use the Madara AI Studio Connector to create the map in Workspace.</p>}
      {project.files.length > 0 && <div className="result-card">
        <aside className="file-list"><div className="file-list-title"><Layers3 size={15}/> PROJECT FILES <span>{project.files.length}</span></div>{project.files.map((f,i) => <button key={f.path} className={activeFile === i ? "file-tab active" : "file-tab"} onClick={() => setActiveFile(i)}><Code2 size={14}/><span>{f.path.split("/").pop()}</span></button>)}</aside>
        <div className="code-panel"><div className="code-toolbar"><span>{currentFile?.path}</span><button onClick={copyCode}>{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? "Copied" : "Copy"}</button></div><pre><code>{currentFile?.code}</code></pre></div>
      </div>}
      {project.instructions.length > 0 && <div className="instructions"><h3><Check size={17}/> Setup in Roblox Studio</h3><ol>{project.instructions.map((x,i) => <li key={i}>{x}</li>)}</ol></div>}
      {project.agentNotes && project.agentNotes.length > 0 && <div className="instructions"><h3><Sparkles size={17}/> Agent build notes</h3><ul>{project.agentNotes.map((x,i) => <li key={i}>{x}</li>)}</ul></div>}
      <p className="publish-note">Madara AI uses separate planning, environment, gameplay and code-review agents. Scripts and map geometry still need testing in Roblox Studio. The ZIP is a Rojo source package, not a compiled Roblox place file.</p>
    </section>}

    <StudioConnectorPanel />\n    <PublishNowPanel />\n\n    <section className="steps" id="how-it-works">
      <div className="section-kicker">FROM IDEA TO EXPERIENCE</div><h2>Your AI team starts here.</h2>
      <div className="steps-grid">
        <article className="step-card"><div className="step-icon"><BrainCircuit/></div><span>01 / ARCHITECT</span><h3>Plan the experience</h3><p>The architect defines the game loop, worlds, progression and systems.</p></article>
        <article className="step-card"><div className="step-icon"><Globe2/></div><span>02 / ENVIRONMENT</span><h3>Build the world</h3><p>The environment agent plans the 3D layout; the Studio Connector constructs it in Workspace.</p></article>
        <article className="step-card"><div className="step-icon"><Code2/></div><span>03 / GAMEPLAY</span><h3>Make it playable</h3><p>The gameplay agent creates Luau systems, then a reviewer checks the scripts and scene plan.</p></article>
      </div>
    </section>
    <footer><a className="brand" href="#"><span className="brand-mark"><WandSparkles size={17}/></span><span>madara<span className="brand-ai">.ai</span></span></a><span>Built for creators, powered by imagination.</span><a href="https://github.com/mhmxhma4-ship-it/Madara-AI" target="_blank" rel="noreferrer"><Github size={15}/> Source code <ExternalLink size={12}/></a></footer>
  </main>;
}
