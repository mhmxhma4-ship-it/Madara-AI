import { handleUpload } from "@vercel/blob/client";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_PLACE_SIZE = 500 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname: string) => {
        if (!pathname.startsWith("roblox-publish/")) {
          throw new Error("Invalid Roblox upload path.");
        }

        return {
          allowedContentTypes: ["application/octet-stream", "application/xml", "text/xml"],
          maximumSizeInBytes: MAX_PLACE_SIZE,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // The publishing endpoint removes the private temporary blob after Roblox accepts it.
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload authorization failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
