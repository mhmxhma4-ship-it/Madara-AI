import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_avbmstwbqmwimzbolntr",
  dirs: ["./trigger"],
  runtime: "node",
  logLevel: "info",
  maxDuration: 7200,
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 1,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
});
