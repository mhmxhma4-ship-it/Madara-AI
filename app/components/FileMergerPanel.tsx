"use client";

import { useState } from "react";
import { Download, FileArchive, Layers3, LoaderCircle, ShieldCheck, Upload, X } from "lucide-react";

const MAX_FILE_BYTES = 50 * 1024 * 1024;

function parseXml(source: string, label: string): XMLDocument {
  const document = new DOMParser().parseFromString(source, "application/xml");
  if (document.querySelector("parsererror") || document.documentElement.tagName !== "roblox") {
    throw new Error(label + " nuk eshte nje file XML Roblox i vlefshem.");
  }
  return document;
}

function directItems(document: XMLDocument): Element[] {
  return Array.from(document.documentElement.children).filter((node) => node.tagName === "Item");
}

function mergeModelIntoPlace(placeSource: string, modelSource: string): string {
  const place = parseXml(placeSource, "Place");
  const model = parseXml(modelSource, "Model");

  if (model.querySelector("SharedString")) {
    throw new Error("Modeli perdor SharedString. Ky model kerkon konvertim te avancuar dhe nuk do te bashkohet ne menyre te pasigurt.");
  }

  const placeItems = directItems(place);
  const modelItems = directItems(model);
  if (!placeItems.length || !modelItems.length) {
    throw new Error("Nuk u gjet struktura Item ne njeren prej file-ve.");
  }

  const workspace = place.querySelector('Item[class="Workspace"]');
  if (!workspace) {
    throw new Error("Place file nuk ka Workspace. Zgjidh nje .rbxlx te plote, jo nje model.");
  }
  const workspaceChildren = workspace.querySelector(":scope > Properties");
  if (!workspaceChildren) {
    throw new Error("Workspace ka strukture XML te panjohur.");
  }

  const used = new Set<string>();
  place.querySelectorAll("Item[referent]").forEach((item) => used.add(item.getAttribute("referent") || ""));
  const remap = new Map<string, string>();
  let counter = 1;

  model.querySelectorAll("Item[referent]").forEach((item) => {
    const oldRef = item.getAttribute("referent");
    if (!oldRef) return;
    let next = "RBXMERGE_" + counter++;
    while (used.has(next)) next = "RBXMERGE_" + counter++;
    used.add(next);
    remap.set(oldRef, next);
    item.setAttribute("referent", next);
  });

  model.querySelectorAll("Ref").forEach((ref) => {
    const oldValue = ref.textContent?.trim() || "";
    if (remap.has(oldValue)) ref.textContent = remap.get(oldValue) as string;
  });

  const imported = modelItems.map((item) => place.importNode(item, true));
  imported.forEach((item) => workspace.appendChild(item));

  const serialized = new XMLSerializer().serializeToString(place);
  return '<?xml version="1.0" encoding="utf-8"?>\n' + serialized;
}

export default function FileMergerPanel() {
  const [placeFile, setPlaceFile] = useState<File | null>(null);
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);

  async function mergeFiles() {
    if (!placeFile || !modelFile) {
      setError(true);
      setStatus("Zgjidh place file .rbxlx dhe model file .rbxmx.");
      return;
    }
    if (placeFile.size > MAX_FILE_BYTES || modelFile.size > MAX_FILE_BYTES) {
      setError(true);
      setStatus("Secili file duhet te jete maksimumi 50 MB.");
      return;
    }
    if (!placeFile.name.toLowerCase().endsWith(".rbxlx") || !modelFile.name.toLowerCase().endsWith(".rbxmx")) {
      setError(true);
      setStatus("Ky version bashkon .rbxlx me .rbxmx. File binare .rbxl/.rbxm nuk mbeshteten ende.");
      return;
    }

    setBusy(true);
    setStatus("");
    setError(false);
    try {
      const [placeText, modelText] = await Promise.all([placeFile.text(), modelFile.text()]);
      const merged = mergeModelIntoPlace(placeText, modelText);
      const blob = new Blob([merged], { type: "application/xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = placeFile.name.replace(/\.rbxlx$/i, "") + "-merged.rbxlx";
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      setStatus("Bashkimi perfundoi. U shkarkua nje kopje e re; file origjinale nuk u ndryshuan.");
    } catch (cause) {
      setError(true);
      setStatus(cause instanceof Error ? cause.message : "Bashkimi deshtoi. Kontrollo formatin e file-ve.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="publish-panel" id="file-merger">
      <div className="section-kicker">ROBLOX FILE TOOLS</div>
      <h2>File Merger</h2>
      <p>Bashko nje model Roblox ne nje place ekzistues pa prekur file-t origjinale.</p>
      <div className="publish-warning">Mbeshte .rbxlx + .rbxmx (XML). File binare .rbxl dhe .rbxm nuk mbeshteten ne kete version, ndaj nuk do te pranohen gabimisht.</div>
      <div className="publish-fields">
        <label>1. Place kryesor (.rbxlx)
          <input type="file" accept=".rbxlx,.rbxlx.xml,application/xml,text/xml" onChange={(event) => setPlaceFile(event.target.files?.[0] || null)} />
        </label>
        {placeFile && <span className="publish-file-name"><FileArchive size={13} /> {placeFile.name} · {(placeFile.size / 1024 / 1024).toFixed(2)} MB</span>}
        <label>2. Model per bashkim (.rbxmx)
          <input type="file" accept=".rbxmx,application/xml,text/xml" onChange={(event) => setModelFile(event.target.files?.[0] || null)} />
        </label>
        {modelFile && <span className="publish-file-name"><Layers3 size={13} /> {modelFile.name} · {(modelFile.size / 1024 / 1024).toFixed(2)} MB</span>}
        <button className="generate-button publish-submit" onClick={mergeFiles} disabled={busy}>
          {busy ? <><LoaderCircle size={16} className="spin" /> Duke bashkuar...</> : <><Upload size={16} /> Bashko file-t <Download size={16} /></>}
        </button>
        {status && <p className={error ? "publish-status error" : "publish-status success"} role="status">{error ? <X size={14} /> : <ShieldCheck size={14} />}{status}</p>}
      </div>
      <p className="publish-security">Bashkimi vendos objektet e modelit ne Workspace dhe rinumeron referencat e objekteve per te shmangur perplasjet. Perpara publikimit, hape rezultatin ne Roblox Studio dhe testo lojen.</p>
    </section>
  );
}
