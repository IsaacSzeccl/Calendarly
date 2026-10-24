"use client";

import { DateTime } from "luxon";
import { useRef, useState } from "react";
import type { Interpretation } from "@/lib/ai/parseStatement";
import { zoneShort } from "@/lib/format";
import { Button, Field, Notice, inputClass } from "@/components/ui";

type Added = { id: string; start: number; end: number };

const OUTCOME: Record<string, string> = {
  added: "", // built from the count below
  busy: "Those times don't work for the organizer (they're busy, or it's outside the times they set), so nothing new was added. Your note was still passed on.",
  duplicate: "Those times are already in the poll, so nothing new was added. Your note was passed on.",
  cap: "This poll already has as many suggested times as it can take. Your note was passed on.",
};

function zones(extra: string[]): string[] {
  const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return [...new Set([...extra, ...all])];
}

/**
 * The plain-language box near the end of the guest form. The guest sees what
 * the AI understood (dates, times, timezone) and nothing is added until they
 * press "Looks right".
 */
export function StatementBox({
  token,
  zone,
  ensureSaved,
  onAdded,
}: {
  token: string;
  zone: string;
  ensureSaved: () => Promise<boolean>;
  onAdded: (added: Added[]) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"reading" | "adding" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: string; interpretation: Interpretation } | null>(null);
  const [tz, setTz] = useState(zone);
  const [done, setDone] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  async function call(url: string, payload: object) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "That didn't work. Try again.");
    return json;
  }

  async function read() {
    setError(null);
    setDone(null);
    setBusy("reading");
    try {
      if (!(await ensureSaved())) return;
      const json = await call("/api/guest/statement", { token, text, timezone: zone });
      setPending({ id: json.statementId, interpretation: json.interpretation });
      setTz(json.interpretation.timezone);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function confirm() {
    if (!pending) return;
    setError(null);
    setBusy("adding");
    try {
      const json = await call("/api/guest/statement/confirm", { token, statementId: pending.id, timezone: tz });
      const added: Added[] = json.added;
      setDone(
        json.outcome === "added"
          ? `Added ${added.length} new time${added.length === 1 ? "" : "s"}, marked yes for you. Everyone who already answered will get an email.`
          : OUTCOME[json.outcome],
      );
      setPending(null);
      setText("");
      onAdded(added);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="say" className="space-y-4">
      <div>
        <h2 id="say" className="text-2xl">
          None of these work? Say when you can.
        </h2>
        <p className="text-pencil">Write it your way. You'll see what I understood before anything is added.</p>
      </div>
      <Field label="When are you free?">
        <textarea
          ref={textRef}
          rows={3}
          className={`${inputClass} resize-y`}
          placeholder="Tuesday or Wednesday afternoons, not Mondays"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPending(null);
          }}
        />
      </Field>
      {!pending && (
        <Button variant="quiet" type="button" onClick={read} disabled={text.trim().length < 3 || busy !== null}>
          {busy === "reading" ? "Reading…" : "Check what I meant"}
        </Button>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {done && <Notice>{done}</Notice>}

      {pending && (
        <div className="space-y-4 rounded-md border border-ribbon/40 bg-paper-deep p-5" aria-live="polite">
          <h3 className="text-xl">What I understood</h3>
          <p>{pending.interpretation.restatement}</p>
          <ul className="divide-y divide-rule border-y border-rule">
            {pending.interpretation.ranges.map((r, i) => {
              const s = DateTime.fromISO(`${r.date}T${r.start}`, { zone: tz });
              return (
                <li key={i} className="tabular flex justify-between py-2">
                  <span>{s.toFormat("cccc d LLLL")}</span>
                  <span>
                    {r.start}–{r.end}
                  </span>
                </li>
              );
            })}
          </ul>
          <Field label="In this timezone">
            <select className={`${inputClass} sm:max-w-sm`} value={tz} onChange={(e) => setTz(e.target.value)}>
              {zones([tz, zone]).map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, " ")} ({zoneShort(z)})
                </option>
              ))}
            </select>
          </Field>
          {pending.interpretation.preferencesSummary && (
            <p className="text-sm text-pencil">
              The organizer will see: “{pending.interpretation.preferencesSummary}”
            </p>
          )}
          {pending.interpretation.ambiguous.length > 0 && (
            <p className="text-sm text-pencil">
              I wasn't sure about: {pending.interpretation.ambiguous.map((a) => `“${a}”`).join(", ")}.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={confirm} disabled={busy !== null}>
              {busy === "adding" ? "Adding…" : "Looks right"}
            </Button>
            <Button
              variant="quiet"
              type="button"
              onClick={() => {
                setPending(null);
                textRef.current?.focus();
              }}
            >
              Correct it
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
