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
        <div className="publish-file-name"><FileArchive size={15} /> Place baze: .rbxl / .rbxlx — hape ne Studio para bashkimit.</div>
        <div className="publish-file-name"><Layers3 size={15} /> Model per import: .rbxm — zgjidhe nga dritarja qe hap plugin-i.</div>
        <a className="generate-button publish-submit" href={MERGER_PLUGIN_URL} target="_blank" rel="noreferrer">
          Merr Madara File Merger plugin <ExternalLink size={15} />
        </a>
      </div>

      <p className="publish-security"><ShieldCheck size={14} /> Plugin-i perdor SerializationService te Roblox per te lexuar .rbxm, i vendos objektet ne Workspace dhe krijon nje Undo action. Ai nuk ndryshon file origjinale. Pas bashkimit ruaj nje kopje te re te lojes dhe testo para publikimit.</p>
      <p className="publish-security">Shenim: ky proces kerkon Roblox Studio ne kompjuter. Nuk kryhet direkt nga faqja ne iPhone. Versioni aktual bashkon .rbxm ne nje place te hapur; nuk bashkon dy place .rbxl me njeri-tjetrin.</p>
    </section>
  );
}
