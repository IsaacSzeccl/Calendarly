import { DateTime } from "luxon";
import { RECORDINGS } from "./recordings";

/**
 * Stand-in for the model in tests and the end-to-end demo path.
 * Replays a recorded real answer whose `match` appears in the input text.
 * Dates in recordings are written as "@D+n" (today plus n days) so they never go stale.
 */
export function mockAnswer(job: string, input: Record<string, unknown>, attempt: number): string {
  if (job === "explain") return JSON.stringify(mockExplain(input));
  const text = String(input.text ?? "").toLowerCase();
  const hit = RECORDINGS.find((r) => r.job === job && text.includes(r.match.toLowerCase()));
  if (!hit) return attempt === 0 ? "Sorry, I am not sure." : "{}";
  const today = DateTime.fromISO(String(input.today));
  return JSON.stringify(hit.answer).replace(/@D\+(\d+)/g, (_, n) =>
    today.plus({ days: Number(n) }).toISODate()!,
  );
}

/** A plain, deterministic explanation built from the facts code already computed. */
function mockExplain(input: Record<string, unknown>) {
  const facts = input.facts as
    | {
        options: { id: string; number: number; label: string; reasons: string[] }[];
        advice: { text: string }[];
        basis: string;
      }
    | undefined;
  if (!facts) return {};
  const top = facts.options[0];
  return {
    summary: top
      ? `Option ${top.number} looks best (${top.label}). This is ${facts.basis}.`
      : `No options yet. This is ${facts.basis}.`,
    conditional: facts.advice.map((a) => a.text),
    perOption: facts.options.map((o) => ({
      optionId: o.id,
      text: o.reasons.length ? o.reasons.join("; ") : "Everyone who answered can make it.",
    })),
  };
}
