"use client";
import { useState } from "react";
import { ArrowUp, Bot, Check, Code2, Copy, Download, ExternalLink, Gamepad2, Github, Layers3, LoaderCircle, Sparkles, WandSparkles, X, BrainCircuit, Globe2, Workflow } from "lucide-react";

type GeneratedFile = { path: string; kind: string; code: string };
type Agent = { name: string; status: string; detail: string };
type Project = {
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

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
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

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState("Full game");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const [activeFile, setActiveFile] = useState(0);
  const [copied, setCopied] = useState(false);

  async function generate() {
    if (!prompt.trim()) { setError("Write your Roblox game idea first."); return; }
    setLoading(true); setError(""); setProject(null);
    try {
      const response = await fetch("/api/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), mode })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Generation failed.");
      setProject(data as Project); setActiveFile(0);
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
    const bundle = project.files.map(f => `-- FILE: ${f.path}\n${f.code}`).join("\n\n");
    downloadText(`${project.projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "madara-project"}.txt`,
      `-- Generated by Madara AI multi-agent pipeline\n-- Import each script into the matching Roblox Studio location.\n\n${bundle}`);
  }

  const currentFile = project?.files[activeFile];

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
        {loading && <div className="agent-running"><div className="agent-running-title"><Workflow size={16}/> MADARA AGENT PIPELINE</div><div className="agent-running-steps"><span><BrainCircuit size={14}/> Architect</span><span><Globe2 size={14}/> Environment</span><span><Code2 size={14}/> Gameplay</span><span><Layers3 size={14}/> Builder</span></div><p>Agents are working on one shared game blueprint. This can take a little longer than a single prompt.</p></div>}
        <div className="examples"><span>TRY AN IDEA</span>{examples.map(x => <button key={x} onClick={() => { setPrompt(x); setError(""); }}>{x}<ArrowUp size={12} className="rotate-45"/></button>)}</div>
      </div>
    </section>

    {project && <section className="result-wrap" aria-live="polite">
      <div className="result-heading"><div><div className="section-kicker">YOUR GENERATED PROJECT</div><h2>{project.projectName}</h2><p>{project.summary}</p></div><button className="download-button" onClick={downloadProject}><Download size={16}/> Download scripts</button></div>

      {project.agents && <div className="agent-results"><div className="agent-results-title"><Workflow size={17}/> AGENT WORKFLOW <span>{project.agents.filter(agent => agent.status === "complete").length} / {project.agents.length} PASSED</span></div><div className="agent-results-grid">{project.agents.map(agent => <article className={agent.status === "warning" ? "agent-result agent-result-warning" : "agent-result"} key={agent.name}><div className="agent-result-icon">{agent.status === "warning" ? <X size={15}/> : <Check size={15}/>}</div><strong>{agent.name}</strong><p>{agent.detail}</p></article>)}</div></div>}

      {(project.gameDesign || (project.worldPlan?.length ?? 0) > 0 || (project.systemsPlan?.length ?? 0) > 0) && <div className="blueprint-card">
        <div className="section-kicker">GAME BLUEPRINT</div>{project.gameDesign && <p className="blueprint-description">{project.gameDesign}</p>}
        <div className="blueprint-columns">{(project.worldPlan?.length ?? 0) > 0 && <div><h3><Globe2 size={15}/> World plan</h3><ul>{project.worldPlan?.map((x,i) => <li key={i}>{x}</li>)}</ul></div>}{(project.systemsPlan?.length ?? 0) > 0 && <div><h3><Workflow size={15}/> Gameplay systems</h3><ul>{project.systemsPlan?.map((x,i) => <li key={i}>{x}</li>)}</ul></div>}</div>
      </div>}

      <div className="result-card">
        <aside className="file-list"><div className="file-list-title"><Layers3 size={15}/> PROJECT FILES <span>{project.files.length}</span></div>{project.files.map((f,i) => <button key={f.path} className={activeFile === i ? "file-tab active" : "file-tab"} onClick={() => setActiveFile(i)}><Code2 size={14}/><span>{f.path.split("/").pop()}</span></button>)}</aside>
        <div className="code-panel"><div className="code-toolbar"><span>{currentFile?.path}</span><button onClick={copyCode}>{copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? "Copied" : "Copy"}</button></div><pre><code>{currentFile?.code}</code></pre></div>
      </div>
      {project.instructions.length > 0 && <div className="instructions"><h3><Check size={17}/> Setup in Roblox Studio</h3><ol>{project.instructions.map((x,i) => <li key={i}>{x}</li>)}</ol></div>}
      {project.agentNotes && project.agentNotes.length > 0 && <div className="instructions"><h3><Sparkles size={17}/> Agent build notes</h3><ul>{project.agentNotes.map((x,i) => <li key={i}>{x}</li>)}</ul></div>}
      <p className="publish-note">Madara AI uses separate planning, environment, gameplay and code-review agents. Scripts still need testing in Roblox Studio. This export is a script bundle, not yet a Roblox place file.</p>
    </section>}

    <PublishNowPanel />\n\n    <section className="steps" id="how-it-works">
      <div className="section-kicker">FROM IDEA TO EXPERIENCE</div><h2>Your AI team starts here.</h2>
      <div className="steps-grid">
        <article className="step-card"><div className="step-icon"><BrainCircuit/></div><span>01 / ARCHITECT</span><h3>Plan the experience</h3><p>The architect defines the game loop, worlds, progression and systems.</p></article>
        <article className="step-card"><div className="step-icon"><Globe2/></div><span>02 / ENVIRONMENT</span><h3>Build the world</h3><p>The environment agent creates the map and world-building scripts.</p></article>
        <article className="step-card"><div className="step-icon"><Code2/></div><span>03 / GAMEPLAY</span><h3>Make it playable</h3><p>The gameplay agent creates Luau systems, then the project builder combines the files.</p></article>
      </div>
    </section>
    <footer><a className="brand" href="#"><span className="brand-mark"><WandSparkles size={17}/></span><span>madara<span className="brand-ai">.ai</span></span></a><span>Built for creators, powered by imagination.</span><a href="https://github.com/mhmxhma4-ship-it/Madara-AI" target="_blank" rel="noreferrer"><Github size={15}/> Source code <ExternalLink size={12}/></a></footer>
  </main>;
}
