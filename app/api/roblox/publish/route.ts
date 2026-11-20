import { del, get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PLACE_SIZE = 50 * 1024 * 1024;
const json = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

export async function POST(request: NextRequest) {
  let uploadedPath: string | null = null;

  try {
    const body = await request.json();
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const universeId = typeof body.universeId === "string" ? body.universeId.trim() : "";
    const placeId = typeof body.placeId === "string" ? body.placeId.trim() : "";
    const pathname = typeof body.pathname === "string" ? body.pathname : "";
    const fileName = typeof body.fileName === "string" ? body.fileName.trim().toLowerCase() : "";

    if (!apiKey || apiKey.length < 10 || apiKey.length > 4096 || /\s/.test(apiKey)) {
      return json("API key is missing or malformed. Paste the complete Roblox Open Cloud key without spaces.", 400);
    }
    if (!/^\d{1,25}$/.test(universeId)) {
      return json("Enter the numeric Universe ID.", 400);
    }
    if (!/^\d{1,25}$/.test(placeId)) {
      return json("Enter the numeric Place ID.", 400);
    }
    if (!pathname.startsWith("roblox-publish/") || pathname.includes("..")) {
      return json("The uploaded place file could not be found. Upload it again.", 400);
    }
    if (!fileName.endsWith(".rbxl") && !fileName.endsWith(".rbxlx") && !fileName.endsWith(".rbxlx.xml")) {
      return json("Only Roblox .rbxlx, .rbxlx.xml and .rbxl files are supported.", 400);
    }

    uploadedPath = pathname;
    const stored = await get(pathname, { access: "private" });
    if (!stored || stored.statusCode !== 200) {
      return json("The temporary uploaded file has expired or is unavailable. Upload it again.", 404);
    }

    const bytes = await new Response(stored.stream).arrayBuffer();
    if (bytes.byteLength < 20 || bytes.byteLength > MAX_PLACE_SIZE) {
      return json("The place file must be between 20 bytes and 50 MB.", 400);
    }

    const isXml = fileName.endsWith(".rbxlx") || fileName.endsWith(".rbxlx.xml");
    const robloxUrl =
      `https://apis.roblox.com/universes/v1/${universeId}/places/${placeId}/versions?versionType=Published`;

    const upstream = await fetch(robloxUrl, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": isXml ? "application/xml" : "application/octet-stream",
      },
      body: bytes,
      cache: "no-store",
      signal: AbortSignal.timeout(55000),
    });

    const responseText = await upstream.text();
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      payload = {};
    }

    if (!upstream.ok) {
      const messages: Record<number, string> = {
        400: "Roblox rejected this place file. Make sure it is a valid Roblox place file and that the IDs match.",
        401: "Roblox rejected the API key or its permissions. Enable universe-places: Write for this experience.",
        403: "Roblox denied publishing to this place. Check the API key permissions and ownership.",
        404: "Roblox could not find this Universe ID or Place ID.",
        409: "This Place ID does not belong to the selected Universe ID.",
        413: "Roblox rejected the place because it exceeds Roblox's upload size limit.",
      };
      const upstreamDetail = responseText.trim().slice(0, 1200);
      const diagnostic = upstreamDetail ? ` Roblox details: ${upstreamDetail}` : "";
      return json((messages[upstream.status] || `Roblox publishing failed (${upstream.status}).`) + diagnostic, upstream.status >= 500 ? 502 : upstream.status);
    }

    try {
      await del(pathname);
    } catch {
      // Publishing succeeded; a leftover temporary blob can be cleaned up later.
    }

    return NextResponse.json({
      success: true,
      versionNumber: payload.versionNumber ?? null,
      message: "Roblox accepted the place file for publishing.",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return json("Roblox took too long to respond. Check the experience version before retrying.", 504);
    }
    const message = error instanceof Error ? error.message : "Unknown publishing error.";
    return json(`Could not complete the Roblox publishing request: ${message}`, 500);
  }
}
