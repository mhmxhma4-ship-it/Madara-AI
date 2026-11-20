"use client";

import { FileArchive, ExternalLink, ShieldCheck, Layers3 } from "lucide-react";

const MERGER_PLUGIN_URL = "https://raw.githubusercontent.com/mhmxhma4-ship-it/Madara-AI/feature/roblox-xml-file-merger/roblox-plugin/MadaraFileMerger.plugin.lua";

export default function FileMergerPanel() {
  return (
    <section className="publish-panel" id="file-merger">
      <div className="section-kicker">ROBLOX BINARY FILE TOOLS</div>
      <h2>Madara File Merger</h2>
      <p>Bashko nje model binar .rbxm ne lojen qe ke hapur ne Roblox Studio. Ky version perdor serializer-in zyrtar te Roblox Studio, jo ndryshim te prapashtesave.</p>

      <div className="publish-warning">
        <strong>Si funksionon:</strong> hap fillimisht lojen baze (.rbxl ose .rbxlx) ne Roblox Studio. Pastaj perdor plugin-in Madara File Merger per te importuar modelin .rbxm direkt ne Workspace.
      </div>

      <div className="publish-fields">
        <div className="publish-file-name"><FileArchive size={15} /> 1. Hape place baze (.rbxl ose .rbxlx) ne Roblox Studio.</div>
        <div className="publish-file-name"><Layers3 size={15} /> 2. Instalo plugin-in .lua ne folderin Plugins te Roblox Studio dhe rihap Studio.</div>
        <div className="publish-file-name"><Layers3 size={15} /> 3. Kliko butonin MergeRobloxModel ne toolbar dhe zgjidh modelin .rbxm.</div>
        <a className="generate-button publish-submit" href={MERGER_PLUGIN_URL} target="_blank" rel="noreferrer">
          Merr Madara File Merger plugin <ExternalLink size={15} />
        </a>
      </div>

      <p className="publish-security"><ShieldCheck size={14} /> Plugin-i perdor SerializationService te Roblox per te lexuar .rbxm, i vendos objektet ne Workspace dhe krijon nje Undo action. Ai nuk ndryshon file origjinale. Pas bashkimit ruaj nje kopje te re te lojes dhe testo para publikimit.</p>
      <p className="publish-security">Shenim: ruaje lojen pasi te perfundoje importi. Procesi kerkon Roblox Studio ne kompjuter, nuk kryhet direkt nga faqja ne iPhone. Bashkon nje model .rbxm ne nje place te hapur; nuk bashkon dy place .rbxl me njeri-tjetrin.</p>
    </section>
  );
}
