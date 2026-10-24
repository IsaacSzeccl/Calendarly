import type { z } from "zod";
import { config } from "@/lib/config";
import { mockAnswer } from "./mock";

export type AiJob = "parsePoll" | "parseStatement" | "explain";

export type AiRun = {
  job: AiJob;
  input: unknown;
  output: string | null;
  valid: boolean;
  ms: number;
  error?: string;
};

export type AiResult<T> =
  | { ok: true; data: T; runs: AiRun[] }
  | { ok: false; error: string; runs: AiRun[] };

type Logger = (run: AiRun) => Promise<void> | void;
let logRun: Logger = async (run) => {
  const { logAiRun } = await import("@/lib/db/aiRuns");
  await logAiRun(run);
};

/** Where every model call is recorded (the `ai_runs` table, once wired). */
export function setAiRunLogger(logger: Logger) {
  logRun = logger;
}

type Message = { role: "system" | "user" | "assistant"; content: string };

export function aiMode(): "live" | "mock" {
  if (process.env.AI_MODE === "mock") return "mock";
  if (process.env.AI_MODE === "live") return "live";
  return process.env.AI_API_KEY ? "live" : "mock";
}

async function callModel(messages: Message[]): Promise<string> {
  const base = (process.env.AI_BASE_URL || "https://api.z.ai/api/paas/v4").replace(/\/$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL,
      messages,
      temperature: 0.2,
      response_format: { type: "json_object" },
      // GLM-5.3 always thinks; keep it brief. Override with AI_REASONING_EFFORT.
      reasoning_effort: process.env.AI_REASONING_EFFORT || "low",
    }),
    signal: AbortSignal.timeout(config.ai.timeoutMs),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(`Model HTTP ${res.status}: ${body}`);
  }
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Model reply had no message content");
  return content;
}

/** Pull the JSON object out of a reply, tolerating code fences or stray prose. */
export function extractJson(text: string): unknown {
  const unfenced = text.replace(/```(?:json)?/gi, "");
  const first = unfenced.indexOf("{");
  const last = unfenced.lastIndexOf("}");
  if (first === -1 || last <= first) throw new Error("No JSON object in reply");
  return JSON.parse(unfenced.slice(first, last + 1));
}

/**
 * Ask the model, and accept the answer only if it passes the schema.
 * One automatic retry with the validation problems; then a plain failure.
 * The model's output is never trusted for permissions or limits.
 */
export async function complete<S extends z.ZodType>(args: {
  job: AiJob;
  system: string;
  user: string;
  schema: S;
  /** What gets logged as the input; also lets the mock pick a recording. */
  input: Record<string, unknown>;
}): Promise<AiResult<z.infer<S>>> {
  const messages: Message[] = [
    { role: "system", content: args.system },
    { role: "user", content: args.user },
  ];
  const runs: AiRun[] = [];
  let lastError = "unknown";

  for (let attempt = 0; attempt < 2; attempt++) {
    const started = Date.now();
    let output: string | null = null;
    try {
      output =
        aiMode() === "mock"
          ? mockAnswer(args.job, args.input, attempt)
          : await callModel(messages);
      const parsed = args.schema.safeParse(extractJson(output));
      const run: AiRun = {
        job: args.job,
        input: args.input,
        output,
        valid: parsed.success,
        ms: Date.now() - started,
      };
      if (parsed.success) {
        runs.push(run);
        await logRun(run);
        return { ok: true, data: parsed.data, runs };
      }
      lastError = parsed.error.issues
        .slice(0, 8)
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
      run.error = lastError;
      runs.push(run);
      await logRun(run);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      const run: AiRun = {
        job: args.job,
        input: args.input,
        output,
        valid: false,
        ms: Date.now() - started,
        error: lastError,
      };
      runs.push(run);
      await logRun(run);
    }
    if (output) {
      messages.push({ role: "assistant", content: output });
      messages.push({
        role: "user",
        content: `That answer did not match the required format (${lastError}). Reply with only the corrected JSON object.`,
      });
    }
  }
  return { ok: false, error: lastError, runs };
}
