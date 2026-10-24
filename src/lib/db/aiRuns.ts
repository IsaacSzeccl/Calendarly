import "server-only";
import type { AiRun } from "@/lib/ai/complete";
import { db, dbConfigured } from "./client";
import type { Json } from "./database.types";

/** Record one model call in `ai_runs`. A logging failure never breaks the request. */
export async function logAiRun(run: AiRun): Promise<void> {
  if (!dbConfigured()) return;
  const { error } = await db().from("ai_runs").insert({
    job: run.job,
    input: run.input as Json,
    output: run.output,
    valid: run.valid,
    ms: run.ms,
    error: run.error ?? null,
  });
  if (error) console.error("ai_runs insert failed:", error.message);
}
