import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const json = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const rawApiKey = form.get("apiKey");
    const apiKey = typeof rawApiKey === "string" ? rawApiKey.trim() : "";
    const rawUniverseId = form.get("universeId");
    const rawPlaceId = form.get("placeId");
    const file = form.get("placeFile");

    // Roblox Open Cloud keys can be longer than 500 characters.
    // Validate a generous upper bound instead of rejecting valid long keys.
    if (!apiKey || apiKey.length < 10 || apiKey.length > 4096 || /\s/.test(apiKey)) {
      return json("API key is missing or malformed. Paste the complete Roblox Open Cloud key without spaces.", 400);
    }
    if (typeof rawUniverseId !== "string" || !/^\d{1,25}$/.test(rawUniverseId.trim())) {
      return json("Enter the numeric Universe ID.", 400);
    }
    if (typeof rawPlaceId !== "string" || !/^\d{1,25}$/.test(rawPlaceId.trim())) {
      return json("Enter the numeric Place ID.", 400);
    }
    if (!(file instanceof File)) {
      return json("Choose an .rbxlx or .rbxl place file first.", 400);
    }

    const fileName = file.name.toLowerCase();
    const isXml = fileName.endsWith(".rbxlx") || fileName.endsWith(".rbxlx.xml");
    const isBinary = fileName.endsWith(".rbxl");
    if (!isXml && !isBinary) {
      return json("Only Roblox .rbxlx, .rbxlx.xml and .rbxl files are supported.", 400);
    }
    if (file.size < 20 || file.size > 10 * 1024 * 1024) {
      return json("The place file must be between 20 bytes and 10 MB.", 400);
    }

    const bytes = await file.arrayBuffer();
    const universeId = (rawUniverseId as string).trim();
    const placeId = (rawPlaceId as string).trim();
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
      signal: AbortSignal.timeout(25000),
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
        400: "Roblox rejected this place file. Make sure it is a valid Roblox place file.",
        401: "Roblox rejected the API key or its permissions. Enable universe-places: Write for this experience.",
        403: "Roblox denied publishing to this place. Check the API key permissions and ownership.",
        404: "Roblox could not find this Universe ID or Place ID.",
        409: "This Place ID does not belong to the selected Universe ID.",
        413: "The place file is too large for Roblox Open Cloud.",
      };
      const upstreamDetail = responseText.trim().slice(0, 1200);
      const diagnostic = upstreamDetail ? ` Roblox details: ${upstreamDetail}` : "";
      return json((messages[upstream.status] || `Roblox publishing failed (${upstream.status}).`) + diagnostic, upstream.status >= 500 ? 502 : upstream.status);
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
    return json("Could not complete the Roblox publishing request.", 500);
  }
}
