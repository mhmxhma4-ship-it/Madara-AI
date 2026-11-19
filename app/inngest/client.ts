import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "madara-ai",
  checkpointing: { maxRuntime: "240s" },
});
