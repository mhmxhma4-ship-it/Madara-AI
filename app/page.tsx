"use client";

import { useState } from "react";
import { ArrowUp, Bot, Check, ChevronDown, Code2, Gamepad2, Github, Layers3, Menu, Sparkles, WandSparkles } from "lucide-react";

const examples = [
  "Create a cute pink Hello Kitty-inspired obby tower",
  "Build an anime simulator with 5 worlds and rebirths",
  "Make a romantic hangout map with a sunset and glowing stars"
];

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState("Full game");
  const [notice, setNotice] = useState("");

  function startBuild() {
    if (!prompt.trim()) {
      setNotice("Write your game idea first.");
      return;
    }
    setNotice("Your idea is ready. AI generation will be connected in the next build step.");
  }

  return (
    <main className="min-h-screen overflow-hidden">
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-mark"><WandSparkles size={19} /></span><span>madara<span className="brand-ai">.ai</span></span></a>
        <nav className="desktop-nav"><a href="#builder">Builder</a><a href="#how-it-works">How it works</a><a href="https://github.com/mhmxhma4-ship-it/Madara-AI" target="_blank" rel="noreferrer">GitHub</a></nav>
        <a className="top-cta" href="#builder">Start creating <ArrowUp size={15} className="rotate-45" /></a>
        <button className="mobile-menu" aria-label="Menu"><Menu size={21} /></button>
      </header>

      <section className="hero">
        <div className="hero-glow glow-one" /><div className="hero-glow glow-two" />
        <div className="eyebrow"><span className="pulse-dot" /> YOUR ROBLOX CREATION STUDIO</div>
        <h1>Imagine it.<br /><span className="gradient-text">Build it with AI.</span></h1>
        <p className="hero-copy">Turn a simple idea into a Roblox game. Describe your world, mechanics, and style — Madara AI will help bring it to life.</p>
        <div className="hero-tags"><span><Sparkles size={14} /> AI powered</span><span><Gamepad2 size={14} /> Made for Roblox</span><span><Layers3 size={14} /> Mobile friendly</span></div>
      </section>

      <section className="builder-wrap" id="builder">
        <div className="builder-card">
          <div className="builder-heading"><div><div className="section-kicker">THE CREATION LAB</div><h2>What are we building?</h2></div><span className="beta-pill">EARLY ACCESS</span></div>
          <div className="mode-row"><span className="mode-label">CREATE</span><div className="mode-select"><Gamepad2 size={15} /><select value={mode} onChange={(event) => setMode(event.target.value)}><option>Full game</option><option>Game map</option><option>Gameplay system</option><option>UI interface</option><option>Lua script</option></select><ChevronDown size={14} /></div></div>
          <label className="sr-only" htmlFor="game-prompt">Describe your Roblox game</label>
          <textarea id="game-prompt" value={prompt} onChange={(event) => { setPrompt(event.target.value); setNotice(""); }} placeholder="Describe the Roblox game you want to create...&#10;&#10;Example: A magical anime simulator with 5 worlds, character companions, quests, boss fights and rebirths." />
          <div className="prompt-footer"><span>{prompt.length} / 5000</span><button className="generate-button" onClick={startBuild}> <Sparkles size={16} /> Generate game <ArrowUp size={16} /></button></div>
          {notice && <p className="notice" role="status">{notice}</p>}
          <div className="examples"><span>TRY AN IDEA</span>{examples.map((example) => <button key={example} onClick={() => { setPrompt(example); setNotice(""); }}>{example}<ArrowUp size={12} className="rotate-45" /></button>)}</div>
        </div>
      </section>

      <section className="steps" id="how-it-works">
        <div className="section-kicker">FROM IDEA TO EXPERIENCE</div><h2>Your game starts here.</h2>
        <div className="steps-grid">
          <article className="step-card"><div className="step-icon"><Bot /></div><span>01 / DESCRIBE</span><h3>Tell us your idea</h3><p>Explain the game, its world, mechanics, and the feeling you want players to have.</p></article>
          <article className="step-card"><div className="step-icon"><Code2 /></div><span>02 / GENERATE</span><h3>AI builds the pieces</h3><p>Generate Roblox Lua scripts, systems, and structured project files from your prompt.</p></article>
          <article className="step-card"><div className="step-icon"><Gamepad2 /></div><span>03 / PUBLISH</span><h3>Bring it to Roblox</h3><p>Prepare your project for Roblox and connect publishing securely when your account is configured.</p></article>
        </div>
      </section>

      <footer><a className="brand" href="#"><span className="brand-mark"><WandSparkles size={17} /></span><span>madara<span className="brand-ai">.ai</span></span></a><span>Built for creators, powered by imagination.</span><a href="https://github.com/mhmxhma4-ship-it/Madara-AI" target="_blank" rel="noreferrer"><Github size={15} /> Source code</a></footer>
    </main>
  );
}
