import { serve } from "inngest/next";
import { inngest } from "@/app/inngest/client";
import { generateRobloxProject } from "@/app/inngest/functions";

export const runtime = "nodejs";
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generateRobloxProject],
});
