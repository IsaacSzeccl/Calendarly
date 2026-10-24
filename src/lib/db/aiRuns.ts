import "server-only";
import { extractJson, type AiRun } from "@/lib/ai/complete";
import { explanationSchema, type Explanation } from "@/lib/ai/schemas";
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

/** A previous valid explanation for exactly the same facts, if there is one. */
export async function findExplanation(hash: string): Promise<Explanation | null> {
  if (!dbConfigured()) return null;
  const { data } = await db()
    .from("ai_runs")
    .select("output")
    .eq("job", "explain")
    .eq("valid", true)
    .eq("input->>hash", hash)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.output) return null;
  try {
    const parsed = explanationSchema.safeParse(extractJson(data.output));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
