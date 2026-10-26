"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { PollDraft } from "@/lib/ai/parsePoll";
import type { Interval, Person } from "@/lib/engine/types";
import { zoneShort } from "@/lib/format";
import { draftSchema } from "@/lib/polls/schema";
import { SlotList } from "@/components/SlotList";
import { Button, Field, Notice, inputClass } from "@/components/ui";

const EXAMPLE =
  "I need a two-hour meeting this week with five other students about our group project: Sam, Priya, Leo, Mei and Jordan. Afternoons are best, and Sam has to be there. Leo only does evenings because of work, and I can't do Tuesdays.";

type Preview = { draft: PollDraft; options: Interval[]; poolSize: number };

export type Account = {
  signedIn: boolean;
  calendar: "google" | "sample" | null;
  needsReconnect: boolean;
  testMode: boolean;
  /** From ?calendar=… after the Google consent screen. */
  calendarResult: string | null;
};

/** Meet again: the earlier poll and the remembered guests coming along. */
export type Again = { pollId: string; title: string; people: string[] };

const CALENDAR_RESULT: Record<string, string> = {
  connected: "Calendar connected.",
  declined: "Calendar access wasn't given.",
  failed: "Connecting didn't work. Try again.",
  "sign-in-first": "Sign in first, then connect your calendar.",
  expired: "That took too long. Try again.",
};

const primaryLink =
  "inline-flex min-h-11 items-center rounded-md bg-ribbon px-4 font-semibold text-ribbon-ink hover:brightness-110";

function AccountStep({ account }: { account: Account }) {
  if (!account.signedIn) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-rule p-4">
        <span className="flex-1">Sign in to create a poll. You can try it first.</span>
        <a href="/auth/sign-in?next=/new" className={primaryLink}>
          Sign in with Google
        </a>
        {account.testMode && (
          <a className="text-sm underline" href="/api/test-login?next=/new">
            Test sign-in
          </a>
        )}
      </div>
    );
  }
  if (account.calendar === null) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-rule p-4">
        <span className="flex-1">
          {account.needsReconnect ? "Your calendar connection expired." : "Connect your calendar so I can offer times you're free."}
        </span>
        <a href="/api/calendar/connect?for=organizer" className={primaryLink}>
          {account.needsReconnect ? "Reconnect Google Calendar" : "Connect Google Calendar"}
        </a>
      </div>
    );
  }
  return null;
}

export function CreatePoll({ account, again }: { account: Account; again: Again | null }) {
  const router = useRouter();
  const canCreate = account.signedIn && account.calendar !== null;
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [draft, setDraft] = useState<PollDraft | null>(null);
  const [busy, setBusy] = useState<"reading" | "updating" | "creating" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closeAt, setCloseAt] = useState("");
  // Every edit gets a version number; the times on screen belong to `shownVersion`.
  // Create only works when they match, so the poll always gets the times the organizer saw.
  const version = useRef(0);
  const [draftVersion, setDraftVersion] = useState(0);
  const [shownVersion, setShownVersion] = useState(0);
  const [failed, setFailed] = useState(false);
  const latest = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const creating = useRef(false);

  async function preview_(payload: object, mode: "reading" | "updating", forVersion: number) {
    if (creating.current) return;
    const request = ++latest.current;
    setBusy(mode);
    setError(null);
    try {
      const res = await fetch("/api/polls/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, again: again?.pollId }),
      });
      const json = await res.json();
      if (request !== latest.current) return; // a newer request is already on its way
      if (!res.ok) throw new Error(json.error ?? "Something went wrong. Try again.");
      setPreview(json);
      if (mode === "reading") {
        // A fresh reading replaces the details, and its times match them.
        const v = ++version.current;
        setDraft(json.draft);
        setDraftVersion(v);
        setShownVersion(v);
      } else {
        // Updating only refreshes the times; edits made meanwhile stay and get their own refresh.
        setShownVersion(forVersion);
      }
      setFailed(false);
    } catch (e) {
      if (request !== latest.current) return;
      setFailed(true);
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      if (request === latest.current) setBusy(null);
    }
  }

  const invalid = draft ? !draftSchema.safeParse(draft).success : false;

  // The times follow the details on their own, a moment after each change.
  useEffect(() => {
    if (!draft || draftVersion === shownVersion || failed || invalid) return;
    const v = draftVersion;
    timer.current = setTimeout(() => preview_({ draft }, "updating", v), 600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftVersion, shownVersion, failed, invalid]);

  function read() {
    if (timer.current) clearTimeout(timer.current); // a re-read replaces any pending refresh
    preview_({ text, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }, "reading", version.current);
  }

  async function create() {
    if (!draft || creating.current) return;
    creating.current = true;
    setBusy("creating");
    setError(null);
    try {
      const res = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft,
          closeAt: closeAt ? new Date(closeAt).toISOString() : null,
          again: again?.pollId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "The poll wasn't created. Try again.");
      router.push(`${json.dashboardUrl}?new=1`);
    } catch (e) {
      creating.current = false;
      setError(e instanceof Error ? e.message : "The poll wasn't created. Try again.");
      setBusy(null);
    }
  }

  function edit(change: (d: PollDraft) => PollDraft) {
    setDraft((d) => (d ? change(structuredClone(d)) : d));
    setDraftVersion(++version.current);
    setFailed(false);
  }

  function editPerson(i: number, change: Partial<Person>) {
    edit((d) => {
      d.rules.people[i] = { ...d.rules.people[i], ...change };
      return d;
    });
  }

  const zone = draft?.rules.organizerTimezone ?? "UTC";
  const stale = draftVersion !== shownVersion;
  const updating = (stale && !failed && !invalid) || busy === "updating";

  return (
    <div className="space-y-10">
      {account.calendarResult && CALENDAR_RESULT[account.calendarResult] && (
        <Notice tone={account.calendarResult === "connected" ? "info" : "error"}>
          {CALENDAR_RESULT[account.calendarResult]}
        </Notice>
      )}
      <AccountStep account={account} />
      {again && (
        <Notice>
          {again.people.length > 0
            ? `${again.people.join(", ")} ${again.people.length === 1 ? "comes" : "come"} along from “${again.title}”. Their calendars answer for them.`
            : `Nobody from “${again.title}” asked to be remembered, so this starts fresh.`}
        </Notice>
      )}

      <section className="max-w-2xl space-y-3">
        <Field label="Describe the meeting">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className={`${inputClass} resize-y leading-relaxed`}
            placeholder="Who's coming, roughly when, how long, and anything people can't do."
          />
        </Field>
        <div className="flex flex-wrap items-center gap-4">
          <Button
            variant={draft ? "quiet" : "primary"}
            onClick={read}
            disabled={text.trim().length < 3 || busy !== null}
          >
            {busy === "reading" ? "Reading…" : draft ? "Read it again" : "Find times"}
          </Button>
          {!text && (
            <Button variant="plain" onClick={() => setText(EXAMPLE)}>
              Try an example
            </Button>
          )}
        </div>
        {error && !preview && <Notice tone="error">{error}</Notice>}
      </section>

      {draft && preview && (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-12">
          <section aria-labelledby="understood" className="space-y-6">
            <h2 id="understood" className="text-2xl">
              Check the details
            </h2>

            <Field label="Title">
              <input className={inputClass} value={draft.title} onChange={(e) => edit((d) => ({ ...d, title: e.target.value }))} />
            </Field>

            <div className="space-y-2">
              <span className="block text-sm font-medium">People</span>
              <ul className="divide-y divide-rule border-y border-rule">
                {draft.rules.people.map((p, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
                    <input
                      aria-label="Name"
                      className={`${inputClass} max-w-44`}
                      value={p.name}
                      onChange={(e) => editPerson(i, { name: e.target.value })}
                    />
                    <label className="flex min-h-11 items-center gap-2">
                      <input
                        type="checkbox"
                        className="size-5 accent-ribbon"
                        checked={p.required}
                        onChange={(e) => editPerson(i, { required: e.target.checked })}
                      />
                      Must attend
                    </label>
                    <Button
                      variant="plain"
                      aria-label={`Remove ${p.name || "this person"}`}
                      onClick={() => edit((d) => (d.rules.people.splice(i, 1), d))}
                    >
                      Remove
                    </Button>
                    {/* Notes repeat the rules below, so only what the rules don't say is shown. */}
                    {(p.hours || p.timezone !== zone) && (
                      <span className="text-sm text-pencil">
                        {[p.timezone !== zone && zoneShort(p.timezone), p.hours && `${p.hours.start}–${p.hours.end}`]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <Button
                variant="plain"
                onClick={() =>
                  edit((d) => {
                    d.rules.people.push({ name: "", timezone: zone, required: false, hours: null });
                    return d;
                  })
                }
              >
                Add a person
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="From">
                <input
                  type="date"
                  className={inputClass}
                  value={draft.rules.window.startDate}
                  onChange={(e) => edit((d) => ((d.rules.window.startDate = e.target.value), d))}
                />
              </Field>
              <Field label="To">
                <input
                  type="date"
                  className={inputClass}
                  value={draft.rules.window.endDate}
                  onChange={(e) => edit((d) => ((d.rules.window.endDate = e.target.value), d))}
                />
              </Field>
              <Field label="Length">
                <select
                  className={inputClass}
                  value={draft.rules.durationMinutes}
                  onChange={(e) => edit((d) => ((d.rules.durationMinutes = Number(e.target.value)), d))}
                >
                  {[30, 45, 60, 90, 120, 180].map((m) => (
                    <option key={m} value={m}>
                      {m < 60 ? `${m} min` : `${m / 60} hour${m > 60 ? "s" : ""}`}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {draft.rules.constraints.length > 0 && (
              <div className="space-y-2">
                <span className="block text-sm font-medium">Rules</span>
                <ul className="divide-y divide-rule border-y border-rule">
                  {draft.rules.constraints.map((c, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-2">
                      <span>
                        {c.description}
                        {c.strength === "soft" && <span className="ml-2 text-sm text-pencil">(preference)</span>}
                      </span>
                      <Button
                        variant="plain"
                        aria-label={`Remove rule: ${c.description}`}
                        onClick={() => edit((d) => (d.rules.constraints.splice(i, 1), d))}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {draft.notUnderstood.length > 0 && (
              <Notice>Not used: {draft.notUnderstood.map((q) => `“${q}”`).join(", ")}</Notice>
            )}

            <details className="group rounded-md border border-rule">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 font-medium [&::-webkit-details-marker]:hidden">
                More options
                <svg aria-hidden viewBox="0 0 16 16" className="size-4 text-pencil transition-transform group-open:rotate-180">
                  <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>
              <div className="grid gap-4 border-t border-rule p-4 sm:grid-cols-2">
                <Field label="Your hours start">
                  <input
                    type="time"
                    step={900}
                    className={inputClass}
                    value={draft.rules.workingHours.start}
                    onChange={(e) => edit((d) => ((d.rules.workingHours.start = e.target.value), d))}
                  />
                </Field>
                <Field label="Your hours end">
                  <input
                    type="time"
                    step={900}
                    className={inputClass}
                    value={draft.rules.workingHours.end}
                    onChange={(e) => edit((d) => ((d.rules.workingHours.end = e.target.value), d))}
                  />
                </Field>
                <Field label="People, including you">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    className={inputClass}
                    value={draft.expectedCount}
                    onChange={(e) => edit((d) => ({ ...d, expectedCount: Number(e.target.value) || 1 }))}
                  />
                </Field>
                <Field label="Close answers at">
                  <input
                    type="datetime-local"
                    className={inputClass}
                    value={closeAt}
                    onChange={(e) => setCloseAt(e.target.value)}
                  />
                </Field>
                <label className="flex min-h-11 items-center gap-3 sm:col-span-2">
                  <input
                    type="checkbox"
                    className="size-5 accent-ribbon"
                    checked={draft.rules.onlyIfNecessary}
                    onChange={(e) => edit((d) => ((d.rules.onlyIfNecessary = e.target.checked), d))}
                  />
                  Only meet if it's really necessary
                </label>
              </div>
            </details>
          </section>

          <section aria-labelledby="times" className="space-y-4 lg:sticky lg:top-6">
            <div>
              <h2 id="times" className="text-2xl">
                Times to offer
              </h2>
              <p className="text-sm text-pencil" aria-live="polite">
                {invalid
                  ? "Fill in every name, the title and both dates to see times."
                  : updating
                    ? "Updating…"
                    : `From ${account.calendar === "google" ? "your calendar" : "a sample calendar"}, in ${zoneShort(zone)}.`}
              </p>
            </div>
            <div className={stale ? "opacity-50 transition-opacity" : "transition-opacity"}>
              {preview.options.length === 0 ? (
                <Notice>No times fit. Try wider dates or hours, or fewer rules.</Notice>
              ) : (
                <SlotList slots={preview.options} zone={zone} />
              )}
            </div>
            {error && <Notice tone="error">{error}</Notice>}
            {failed && stale && (
              <Button variant="quiet" onClick={() => preview_({ draft }, "updating", draftVersion)} disabled={busy !== null}>
                Try again
              </Button>
            )}
            {canCreate ? (
              <Button
                className="w-full"
                onClick={create}
                disabled={busy !== null || stale || preview.options.length === 0}
              >
                {busy === "creating" ? "Creating…" : "Create poll"}
              </Button>
            ) : (
              <p className="text-sm text-pencil">
                {account.signedIn ? "Connect your calendar above to create the poll." : "Sign in above to create the poll."}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
