import { loadEnvConfig } from "@next/env";
import { vi } from "vitest";

// Evals call the real model only with LIVE=1; everything else uses recorded answers.
if (process.env.LIVE === "1") {
  loadEnvConfig(process.cwd());
  process.env.AI_MODE = "live";
} else {
  process.env.AI_MODE = "mock";
}

// `server-only` throws outside a React Server environment; tests run plain Node.
vi.mock("server-only", () => ({}));
