import type { Label } from "@/lib/engine/types";
import type { Explanation } from "./schemas";

/** Everything the model is told: computed by code, no raw scores. */
export type ExplainFacts = {
  title: string;
  organizerName: string;
  onlyIfNecessary: boolean;
  noClearFit: boolean;
  noPerfectSlot: boolean;
  basis: string;
  /** Best first. */
  options: {
    id: string;
    number: number;
    when: string;
    label: Label;
    canCome: string[];
    preferNot: string[];
    cannotCome: string[];
    notAnswered: string[];
    reasons: string[];
  }[];
  /** Conditional advice, already decided by code. */
  advice: string[];
};

const list = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

function optionLine(o: ExplainFacts["options"][number]): string {
  if (o.reasons.length === 0) {
    return o.canCome.length ? "Everyone who answered can make it." : "No one has answered for this time yet.";
  }
  const first = o.reasons.slice(0, 2).join("; ");
  return `${first.charAt(0).toUpperCase()}${first.slice(1)}.`;
}

/** A plain note written by code: shown whenever the model is unavailable or unreliable. */
export function fallbackExplanation(f: ExplainFacts): Explanation {
  const top = f.options[0];
  let summary: string;
  if (!top) {
    summary = "There are no times in this poll yet.";
  } else if (f.noClearFit) {
    summary = `Nothing here is a clear fit. Since you only want to meet if it's necessary, it may be better to wait or widen the dates. The closest is option ${top.number} (${top.when}).`;
  } else if (!f.noPerfectSlot) {
    summary = `Option ${top.number} (${top.when}) looks best: ${
      top.preferNot.length ? `it works for everyone, though ${list(top.preferNot)} would prefer not.` : "it works for everyone who has answered."
    }`;
  } else {
    summary = `No time suits everyone. Option ${top.number} (${top.when}) comes closest, without ${list(top.cannotCome)}.`;
  }
  const worst = f.options[f.options.length - 1];
  if (worst && worst !== top && worst.label === "Not recommended") {
    summary += ` Option ${worst.number} is the weakest: ${worst.reasons[0] ?? "it has the most clashes"}.`;
  }
  return {
    summary,
    conditional: f.advice,
    perOption: f.options.map((o) => ({ option: o.number, text: optionLine(o) })),
  };
}
