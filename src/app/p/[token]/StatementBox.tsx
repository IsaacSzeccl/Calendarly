"use client";

import { DateTime } from "luxon";
import { useRef, useState } from "react";
import type { Interpretation } from "@/lib/ai/parseStatement";
import { zoneShort } from "@/lib/format";
import { Button, Field, Notice, inputClass } from "@/components/ui";

type Added = { id: string; start: number; end: number };

const OUTCOME: Record<string, string> = {
  added: "", // built from the count below
  busy: "The organizer isn't free then, so no times were added. Your note was sent.",
  duplicate: "Those times are already in the poll. Your note was sent.",
  cap: "The poll is full, so no times were added. Your note was sent.",
  note: "Your note was sent to the organizer.",
};

function datesLabel(d: { startDate: string; endDate: string }): string {
  const f = (iso: string) => DateTime.fromISO(iso).toFormat("ccc d LLL");
  return `${f(d.startDate)} – ${f(d.endDate)}`;
}

type Pending = { id: string; interpretation: Interpretation; pollDates: { startDate: string; endDate: string } };

function zones(extra: string[]): string[] {
  const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return [...new Set([...extra, ...all])];
}

/**
 * The plain-language box near the end of the guest form. The guest sees what
 * the AI understood (dates, times, timezone) and nothing is added until they
 * confirms. Words with no times inside the poll can still be passed on as a note.
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
  const [pending, setPending] = useState<Pending | null>(null);
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
      setPending({ id: json.statementId, interpretation: json.interpretation, pollDates: json.pollDates });
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
          ? `Added ${added.length} time${added.length === 1 ? "" : "s"}, marked yes for you.`
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
    <div className="space-y-3">
      <Field label="Or say it in words">
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
          {busy === "reading" ? "Reading…" : "Check it"}
        </Button>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {done && <Notice>{done}</Notice>}

      {pending && (
        <div className="space-y-4 rounded-md border border-ribbon/40 bg-paper-deep p-5" aria-live="polite">
          <h3 className="text-xl">What I understood</h3>
          <p>{pending.interpretation.restatement}</p>
          {pending.interpretation.ranges.length === 0 ? (
            <p className="rounded-md bg-paper p-3 text-sm">
              The poll only covers {datesLabel(pending.pollDates)}. Send it as a note, or edit it.
            </p>
          ) : (
            <>
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
            </>
          )}
          {pending.interpretation.preferencesSummary && (
            <p className="text-sm text-pencil">
              Note for the organizer: “{pending.interpretation.preferencesSummary}”
            </p>
          )}
          {pending.interpretation.ambiguous.length > 0 && (
            <p className="text-sm text-pencil">
              Not sure about: {pending.interpretation.ambiguous.map((a) => `“${a}”`).join(", ")}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={confirm} disabled={busy !== null}>
              {busy === "adding"
                ? "Saving…"
                : pending.interpretation.ranges.length === 0
                  ? "Send as a note"
                  : "Add these"}
            </Button>
            <Button
              variant="quiet"
              type="button"
              onClick={() => {
                setPending(null);
                textRef.current?.focus();
              }}
            >
              Edit
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
