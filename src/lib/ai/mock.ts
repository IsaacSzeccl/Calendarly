import { DateTime } from "luxon";
import { fallbackExplanation, type ExplainFacts } from "./explainText";
import { RECORDINGS } from "./recordings";

/**
 * Stand-in for the model in tests and the end-to-end demo path.
 * Replays a recorded real answer whose `match` appears in the input text.
 * Dates in recordings are written as "@D+n" (today plus n days) so they never go stale.
 */
export function mockAnswer(job: string, input: Record<string, unknown>, attempt: number): string {
  if (job === "explain") return JSON.stringify(fallbackExplanation(input.facts as ExplainFacts));
  const text = String(input.text ?? "").toLowerCase();
  const hit = RECORDINGS.find((r) => r.job === job && text.includes(r.match.toLowerCase()));
  if (!hit) return attempt === 0 ? "Sorry, I am not sure." : "{}";
  const today = DateTime.fromISO(String(input.today));
  return JSON.stringify(hit.answer).replace(/@D\+(\d+)/g, (_, n) =>
    today.plus({ days: Number(n) }).toISODate()!,
  );
}
