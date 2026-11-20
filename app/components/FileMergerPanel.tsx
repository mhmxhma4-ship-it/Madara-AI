"use client";

import { useState } from "react";
import { FileArchive, Layers3, LoaderCircle, Download, ShieldCheck, AlertCircle } from "lucide-react";

type MergerModule = {
  default: (input?: string | URL | Request | Response | BufferSource) => Promise<unknown>;
  merge_place: (base: Uint8Array, model: Uint8Array) => Uint8Array;
};

const MAX_FILE_SIZE = 40 * 1024 * 1024;

function saveFile(name: string, bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 3000);
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
      setStatus("Zgjidh fillimisht te dy file-t: .rbxl dhe .rbxm.");
      return;
    }
    if (placeFile.size > MAX_FILE_SIZE || modelFile.size > MAX_FILE_SIZE) {
      setError(true);
      setStatus("Secili file duhet te jete maksimumi 40 MB per kete version.");
      return;
    }

    setBusy(true);
    setError(false);
    setStatus("Duke lexuar file-t...");
    try {
      const [placeBuffer, modelBuffer] = await Promise.all([
        placeFile.arrayBuffer(),
        modelFile.arrayBuffer()
      ]);
      const placeBytes = new Uint8Array(placeBuffer);
      const modelBytes = new Uint8Array(modelBuffer);

      if (new TextDecoder().decode(placeBytes.subarray(0, 8)) !== "<roblox!" ||
          new TextDecoder().decode(modelBytes.subarray(0, 8)) !== "<roblox!") {
        throw new Error("File-t nuk duken si Roblox binary files. Ngarko nje .rbxl dhe nje .rbxm origjinal.");
      }

      setStatus("Duke ngarkuar motorin e bashkimit...");
      const mergerModuleUrl = "/roblox-merger/madara_roblox_merger.js";
      const merger = await import(/* webpackIgnore: true */ mergerModuleUrl) as MergerModule;
      await merger.default("/roblox-merger/madara_roblox_merger_bg.wasm");

      setStatus("Duke bashkuar modelin me lojen baze. Mos e mbyll faqen...");
      const output = merger.merge_place(placeBytes, modelBytes);
      if (!output || output.length < 32) {
        throw new Error("Bashkimi nuk prodhoi nje place file te vlefshem.");
      }

      const baseName = placeFile.name.replace(/\.rbxl$/i, "").replace(/[^a-zA-Z0-9_-]/g, "_");
      saveFile(`${baseName}_MADARA_MERGED.rbxl`, output);
      setStatus(`U bashkuan me sukses. File i ri: ${(output.length / 1024 / 1024).toFixed(2)} MB. File-t origjinale nuk u ndryshuan.`);
    } catch (cause) {
      setError(true);
      const message = cause instanceof Error ? cause.message : "Gabim i panjohur gjate bashkimit.";
      setStatus(message.includes("Failed to fetch") || message.includes("404")
        ? "Motori WASM nuk eshte gati ne kete deployment. Prit perfundimin e build-it dhe provo perseri."
        : message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="publish-panel" id="file-merger">
      <div className="section-kicker">MADARA AI · PHONE FILE MERGER</div>
      <h2>Madara File Merger</h2>
      <p>Bashko nje model Roblox .rbxm brenda lojes tende .rbxl direkt nga telefoni. Nuk kerkon Roblox Studio apo kompjuter.</p>
      <div className="publish-warning">
        <strong>Si funksionon:</strong> Ngarko lojen baze, ngarko modelin dhe shkarko nje file te ri .rbxl. Procesi kryhet ne shfletues; file-t nuk dergohen ne server.
      </div>
      <div className="publish-fields">
        <label>
          <span><FileArchive size={16} /> 1. Loja baze (.rbxl)</span>
          <input type="file" accept=".rbxl,application/octet-stream" onChange={event => setPlaceFile(event.target.files?.[0] || null)} disabled={busy} />
        </label>
        {placeFile && <div className="publish-file-name">{placeFile.name} · {(placeFile.size / 1024 / 1024).toFixed(2)} MB</div>}
        <label>
          <span><Layers3 size={16} /> 2. Modeli qe do shtohet (.rbxm)</span>
          <input type="file" accept=".rbxm,application/octet-stream" onChange={event => setModelFile(event.target.files?.[0] || null)} disabled={busy} />
        </label>
        {modelFile && <div className="publish-file-name">{modelFile.name} · {(modelFile.size / 1024 / 1024).toFixed(2)} MB</div>}
        <button className="generate-button publish-submit" type="button" onClick={mergeFiles} disabled={busy || !placeFile || !modelFile}>
          {busy ? <><LoaderCircle size={16} className="spin" /> Duke bashkuar...</> : <>Bashko file-t <Layers3 size={16} /></>}
        </button>
        {status && <p className={error ? "publish-status error" : "publish-status success"} role="status">{error ? <AlertCircle size={15} /> : <Download size={15} />} {status}</p>}
      </div>
      <p className="publish-security"><ShieldCheck size={14} /> Perpunimi behet lokalisht ne Safari. Nuk ndryshohen file-t origjinale. Modeli futet nen Workspace te lojes baze. Mbaje faqen hapur gjate procesit.</p>
      <p className="publish-security">Kufiri aktual: 40 MB per file. File me formate te panjohura ose veçori Roblox ende te pambeshtetura mund te deshtojne; gjithmone testo kopjen e bashkuar para publikimit.</p>
    </section>
  );
}
