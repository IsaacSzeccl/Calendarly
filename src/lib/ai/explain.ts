import { createHash } from "node:crypto";
import { z } from "zod";
import { complete } from "./complete";
import { fallbackExplanation, type ExplainFacts } from "./explainText";
import { explanationSchema, type Explanation } from "./schemas";

export type { ExplainFacts } from "./explainText";

const SYSTEM = `You write the short note at the top of a group-scheduling poll, for the organizer.
Write like a helpful colleague leaving a note: plain, warm, specific, no greeting, no sign-off.

You are given facts that code has already worked out. Use only those facts:
- Refer to times as "option N" and may add the day and time given.
- Never mention scores, points or percentages. Use the given labels only if helpful.
- Never suggest new times and never change which option is best. Code decided that.
- You may mention that a different meeting length could help, but never propose a slot.

Write:
- summary: 2 to 4 sentences. Say which option is best and why, and which is weakest and why. Name the trade-off with people's names ("Option 1 has everyone but Leo; option 3 has Leo but not Priya"). If noClearFit is true, say plainly that nothing is a clear fit and that, since they only want to meet if necessary, waiting or widening the dates may be better. Do not include the "based on" line; it is shown separately.
- conditional: rewrite each sentence in "advice" in your own words, keeping the same option numbers and names. Empty if advice is empty.
- perOption: one short sentence for every option id given, about who can and can't come and any preference it breaks.

Reply with only a JSON object matching this JSON Schema:
${JSON.stringify(z.toJSONSchema(explanationSchema))}`;

export function factsHash(facts: ExplainFacts): string {
  return createHash("sha256").update(JSON.stringify(facts)).digest("hex").slice(0, 32);
}

/** Does the note stick to the facts? Every option covered, advice kept, numbers real. */
export function faithful(e: Explanation, facts: ExplainFacts): boolean {
  const ids = new Set(facts.options.map((o) => o.id));
  const covered = new Set(e.perOption.map((p) => p.optionId));
  if (covered.size !== ids.size || [...covered].some((id) => !ids.has(id))) return false;
  if (facts.advice.length > 0 && e.conditional.length === 0) return false;
  const numbers = new Set(facts.options.map((o) => String(o.number)));
  const mentioned = [e.summary, ...e.conditional].join(" ").match(/option (\d+)/gi) ?? [];
  if (mentioned.some((m) => !numbers.has(m.replace(/\D/g, "")))) return false;
  return !/\d+\s?%|percent|score/i.test([e.summary, ...e.conditional, ...e.perOption.map((p) => p.text)].join(" "));
}

export type ExplainResult = { explanation: Explanation; source: "model" | "fallback" };

/**
 * Ask the model to phrase what code decided. A previous valid answer for the
 * same facts is reused, so reloading the dashboard doesn't call the model again.
 */
export async function explain(
  facts: ExplainFacts,
  cache?: { find(hash: string): Promise<Explanation | null> },
): Promise<ExplainResult> {
  if (facts.options.length === 0) return { explanation: fallbackExplanation(facts), source: "fallback" };
  const hash = factsHash(facts);
  const cached = await cache?.find(hash).catch(() => null);
  if (cached && faithful(cached, facts)) return { explanation: cached, source: "model" };

  const result = await complete({
    job: "explain",
    system: SYSTEM,
    user: JSON.stringify(facts),
    schema: explanationSchema,
    input: { hash, facts },
  });
  if (result.ok && faithful(result.data, facts)) return { explanation: result.data, source: "model" };
  return { explanation: fallbackExplanation(facts), source: "fallback" };
}
