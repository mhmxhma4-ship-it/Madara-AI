"use client";

import { useEffect, useState } from "react";
import { FileArchive, Layers3, LoaderCircle, Download, ShieldCheck, AlertCircle, CheckCircle2 } from "lucide-react";

type MergerModule = {
  default: (input?: string | URL | Request | Response | BufferSource) => Promise<unknown>;
  merge_place: (base: Uint8Array, model: Uint8Array) => Uint8Array;
};

const MAX_FILE_SIZE = 40 * 1024 * 1024;

function hasRobloxBinaryHeader(bytes: Uint8Array) {
  return bytes.length >= 32 &&
    bytes[0] === 60 && bytes[1] === 114 && bytes[2] === 111 && bytes[3] === 98 &&
    bytes[4] === 108 && bytes[5] === 111 && bytes[6] === 120 && bytes[7] === 33;
}

export default function FileMergerPanel() {
  const [placeFile, setPlaceFile] = useState<File | null>(null);
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
  const [outputUrl, setOutputUrl] = useState("");
  const [outputName, setOutputName] = useState("");

  useEffect(() => {
    return () => {
      if (outputUrl) URL.revokeObjectURL(outputUrl);
    };
  }, [outputUrl]);

  async function mergeFiles() {
    if (!placeFile || !modelFile) {
      setError(true);
      setStatus("Zgjidh fillimisht lojen baze .rbxl dhe modelin .rbxm.");
      return;
    }
    if (!placeFile.name.toLowerCase().endsWith(".rbxl") ||
        !modelFile.name.toLowerCase().endsWith(".rbxm")) {
      setError(true);
      setStatus("Formati nuk eshte i sakte. Duhet nje .rbxl dhe nje .rbxm.");
      return;
    }
    if (placeFile.size > MAX_FILE_SIZE || modelFile.size > MAX_FILE_SIZE) {
      setError(true);
      setStatus("Secili file duhet te jete maksimumi 40 MB.");
      return;
    }

    setBusy(true);
    setError(false);
    setOutputUrl("");
    setOutputName("");
    setStatus("Duke lexuar dhe kontrolluar file-t...");
    try {
      const [placeBuffer, modelBuffer] = await Promise.all([
        placeFile.arrayBuffer(),
        modelFile.arrayBuffer()
      ]);
      const placeBytes = new Uint8Array(placeBuffer);
      const modelBytes = new Uint8Array(modelBuffer);

      if (!hasRobloxBinaryHeader(placeBytes)) {
        throw new Error("Loja baze nuk eshte nje .rbxl binary file i vlefshem. Zgjidh file-in origjinal te lojes.");
      }
      if (!hasRobloxBinaryHeader(modelBytes)) {
        throw new Error("Modeli nuk eshte nje .rbxm binary file i vlefshem.");
      }

      setStatus("Duke hapur motorin e bashkimit...");
      const moduleUrl = new URL("/roblox-merger/madara_roblox_merger.js", window.location.href);
      const wasmUrl = new URL("/roblox-merger/madara_roblox_merger_bg.wasm", window.location.href);
      const merger = await import(/* webpackIgnore: true */ moduleUrl.href) as MergerModule;
      await merger.default(wasmUrl);

      setStatus("Duke futur modelin ne Workspace dhe krijuar lojen e re...");
      const output = merger.merge_place(placeBytes, modelBytes);
      if (!(output instanceof Uint8Array) || !hasRobloxBinaryHeader(output)) {
        throw new Error("Motori nuk prodhoi nje .rbxl te vlefshem. File-t origjinale mbeten te paprekura.");
      }

      const safeBaseName = placeFile.name.replace(/\.rbxl$/i, "").replace(/[^a-zA-Z0-9_-]/g, "_");
      const name = `${safeBaseName}_MADARA_MERGED.rbxl`;
      const blob = new Blob([output.slice().buffer], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const mergedFile = new File([blob], name, { type: "application/octet-stream" });

      setOutputName(name);
      setOutputUrl(url);
      window.dispatchEvent(new CustomEvent<File>("madara:merged-place-ready", { detail: mergedFile }));
      setStatus(`Bashkimi perfundoi: ${(output.length / 1024 / 1024).toFixed(2)} MB. File-i i ri eshte vendosur automatikisht te Publish Now.`);
    } catch (cause) {
      setError(true);
      const message = cause instanceof Error ? cause.message : String(cause);
      if (/failed to fetch|404|load failed/i.test(message)) {
        setStatus("Motori i bashkimit nuk u ngarkua. Rifresko faqen dhe provo perseri; nese vazhdon, deployment-i nuk ka skedaret WASM.");
      } else {
        setStatus(message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="publish-panel" id="file-merger">
      <div className="section-kicker">MADARA AI · PHONE FILE MERGER</div>
      <h2>Madara File Merger</h2>
      <p>Bashko nje model Roblox .rbxm brenda lojes tende .rbxl direkt nga iPhone, pa Roblox Studio apo kompjuter.</p>
      <div className="publish-warning">
        <strong>Si funksionon:</strong> Zgjidh lojen baze dhe modelin. Madara krijon nje .rbxl te ri, e shkarkon dhe e vendos automatikisht si file te zgjedhur te Publish Now.
      </div>
      <div className="publish-fields">
        <label>
          <span><FileArchive size={16} /> 1. Loja baze (.rbxl)</span>
          <input type="file" accept=".rbxl,application/octet-stream" onChange={event => { setPlaceFile(event.target.files?.[0] || null); setOutputUrl(""); setOutputName(""); }} disabled={busy} />
        </label>
        {placeFile && <div className="publish-file-name">{placeFile.name} · {(placeFile.size / 1024 / 1024).toFixed(2)} MB</div>}
        <label>
          <span><Layers3 size={16} /> 2. Modeli qe do shtohet (.rbxm)</span>
          <input type="file" accept=".rbxm,application/octet-stream" onChange={event => { setModelFile(event.target.files?.[0] || null); setOutputUrl(""); setOutputName(""); }} disabled={busy} />
        </label>
        {modelFile && <div className="publish-file-name">{modelFile.name} · {(modelFile.size / 1024 / 1024).toFixed(2)} MB</div>}
        <button className="generate-button publish-submit" type="button" onClick={mergeFiles} disabled={busy || !placeFile || !modelFile}>
          {busy ? <><LoaderCircle size={16} className="spin" /> Duke bashkuar...</> : <>Bashko file-t <Layers3 size={16} /></>}
        </button>
        {status && <p className={error ? "publish-status error" : "publish-status success"} role="status">{error ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />} {status}</p>}
        {outputUrl && <a className="generate-button publish-submit" href={outputUrl} download={outputName}><Download size={16} /> Shkarko {outputName}</a>}
      </div>
      <p className="publish-security"><ShieldCheck size={14} /> Perpunimi kryhet ne Safari. File-t origjinale nuk ndryshohen. Modeli vendoset nen Workspace te lojes baze. Mbaje faqen hapur deri sa te perfundoje.</p>
      <p className="publish-security">Kufiri: 40 MB per secilin file. Kontrollo gjithmone file-in e krijuar para publikimit.</p>
    </section>
  );
}
