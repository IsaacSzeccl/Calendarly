"use client";

import { useState } from "react";
import type { PollDraft } from "@/lib/ai/parsePoll";
import type { Constraint, Interval, Person } from "@/lib/engine/types";
import { zoneShort } from "@/lib/format";
import { SlotList } from "@/components/SlotList";
import { Button, Field, Notice, inputClass } from "@/components/ui";

const EXAMPLE =
  "I need a two-hour meeting this week with five other students about our group project: Sam, Priya, Leo, Mei and Jordan. Afternoons are best, and Sam has to be there. Leo only does evenings because of work, and I can't do Tuesdays.";

type Preview = { draft: PollDraft; options: Interval[]; poolSize: number };

function describeRule(c: Constraint): string {
  return c.strength === "hard" ? "Must" : "Preference";
}

type Created = { shareUrl: string; dashboardUrl: string };

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
  connected: "Your Google Calendar is connected. Times now come from your real free time.",
  declined: "Calendar access wasn't given, so I can't see your free time yet.",
  failed: "Connecting your calendar didn't work. Try again.",
  "sign-in-first": "Sign in first, then connect your calendar.",
  expired: "That took too long. Try connecting again.",
};

function AccountStep({ account }: { account: Account }) {
  if (!account.signedIn) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-rule p-4">
        <span className="flex-1">Sign in to save the poll and use your own calendar. You can try it first without signing in.</span>
        <a href="/auth/sign-in?next=/new" className="inline-flex min-h-11 items-center rounded-md bg-ribbon px-4 font-semibold text-ribbon-ink hover:brightness-110">
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
          {account.needsReconnect
            ? "Your Google Calendar connection expired. Reconnect it so I can see when you're free."
            : "Connect your Google Calendar so I can offer times when you're free. I only ever see busy or free, never what's in your events."}
        </span>
        <a href="/api/calendar/connect?for=organizer" className="inline-flex min-h-11 items-center rounded-md bg-ribbon px-4 font-semibold text-ribbon-ink hover:brightness-110">
          {account.needsReconnect ? "Reconnect Google Calendar" : "Connect Google Calendar"}
        </a>
      </div>
    );
  }
  if (account.calendar === "google") {
    return (
      <p className="text-sm text-pencil">
        Your Google Calendar is connected (busy or free only).{" "}
        <button
          type="button"
          className="underline underline-offset-4 hover:text-ink"
          onClick={async () => {
            await fetch("/api/calendar/disconnect", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ for: "organizer" }),
            });
            location.reload();
          }}
        >
          Disconnect
        </button>
      </p>
    );
  }
  return null;
}

export function CreatePoll({ account, again }: { account: Account; again: Again | null }) {
  const signedIn = account.signedIn && account.calendar !== null;
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [draft, setDraft] = useState<PollDraft | null>(null);
  const [busy, setBusy] = useState<"reading" | "updating" | "creating" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edited, setEdited] = useState(false);
  const [closeAt, setCloseAt] = useState("");
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);

  async function create() {
    if (!draft) return;
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
      setCreated(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The poll wasn't created. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    if (!created) return;
    await navigator.clipboard.writeText(created.shareUrl);
    setCopied(true);
  }

  async function send(payload: object, mode: "reading" | "updating") {
    setBusy(mode);
    setError(null);
    try {
      const res = await fetch("/api/polls/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, again: again?.pollId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something went wrong. Try again.");
      setPreview(json);
      setDraft(json.draft);
      setEdited(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  }

  function read() {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    send({ text, timezone }, "reading");
  }

  function edit(change: (d: PollDraft) => PollDraft) {
    setDraft((d) => (d ? change(structuredClone(d)) : d));
    setEdited(true);
  }

  function editPerson(i: number, change: Partial<Person>) {
    edit((d) => {
      d.rules.people[i] = { ...d.rules.people[i], ...change };
      return d;
    });
  }

  const zone = draft?.rules.organizerTimezone ?? "UTC";

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
          Meeting again after “{again.title}”.{" "}
          {again.people.length > 0
            ? `${again.people.join(", ")} ${again.people.length === 1 ? "comes along: their calendar answers" : "come along: their calendars answer"} for them, and the first times favour when they're free.`
            : "Nobody from that poll asked to be remembered with a working calendar, so this starts fresh."}
        </Notice>
      )}
      <section className="space-y-3">
        <Field label="Describe the meeting" hint="Who's coming, roughly when, how long, and anything people can't do.">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            className={`${inputClass} resize-y leading-relaxed`}
            placeholder={EXAMPLE}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-4">
          <Button onClick={read} disabled={text.trim().length < 3 || busy !== null}>
            {busy === "reading" ? "Reading your description…" : "Read my description"}
          </Button>
          {!text && (
            <Button variant="plain" onClick={() => setText(EXAMPLE)}>
              Use the example
            </Button>
          )}
        </div>
        {error && !preview && <Notice tone="error">{error}</Notice>}
      </section>

      {draft && preview && (
        <>
          <section aria-labelledby="understood" className="space-y-6">
            <div>
              <h2 id="understood" className="text-2xl">
                What I understood
              </h2>
              <p className="text-pencil">Check it and change anything that's off.</p>
            </div>

            <Field label="Title">
              <input
                className={inputClass}
                value={draft.title}
                onChange={(e) => edit((d) => ({ ...d, title: e.target.value }))}
              />
            </Field>

            <div className="space-y-2">
              <span className="block text-sm font-medium">People</span>
              {draft.rules.people.length === 0 && <p className="text-pencil">Nobody named yet.</p>}
              <ul className="divide-y divide-rule border-y border-rule">
                {draft.rules.people.map((p, i) => (
                  <li key={i} className="grid gap-3 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="flex flex-wrap items-center gap-3">
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
                    </div>
                    <div className="text-sm text-pencil">
                      {p.timezone !== zone && <span>{zoneShort(p.timezone)}, </span>}
                      {p.hours ? `free ${p.hours.start}–${p.hours.end}` : "any reasonable hour"}
                      {p.notes && <span className="block">{p.notes}</span>}
                    </div>
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

            <div className="grid gap-4 sm:grid-cols-2">
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
                      {m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? "s" : ""}`}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="People in the meeting, including you">
                <input
                  type="number"
                  min={1}
                  max={50}
                  className={inputClass}
                  value={draft.expectedCount}
                  onChange={(e) => edit((d) => ({ ...d, expectedCount: Number(e.target.value) || 1 }))}
                />
              </Field>
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
            </div>

            <div className="space-y-2">
              <span className="block text-sm font-medium">Rules</span>
              {draft.rules.constraints.length === 0 ? (
                <p className="text-pencil">No rules. Any time you're free can be offered.</p>
              ) : (
                <ul className="divide-y divide-rule border-y border-rule">
                  {draft.rules.constraints.map((c, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-2">
                      <span>
                        <span className="mr-2 rounded bg-paper-deep px-1.5 py-0.5 text-sm text-pencil">
                          {describeRule(c)}
                        </span>
                        {c.description}
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
              )}
            </div>

            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                className="size-5 accent-ribbon"
                checked={draft.rules.onlyIfNecessary}
                onChange={(e) => edit((d) => ((d.rules.onlyIfNecessary = e.target.checked), d))}
              />
              Only meet if it's really necessary
            </label>

            {draft.notUnderstood.length > 0 && (
              <Notice>I couldn't use: {draft.notUnderstood.map((q) => `“${q}”`).join(", ")}.</Notice>
            )}

            <Field label="Close the poll at (optional)" hint="After this, nobody can answer. You can still pick a time.">
              <input
                type="datetime-local"
                className={`${inputClass} sm:max-w-xs`}
                value={closeAt}
                onChange={(e) => setCloseAt(e.target.value)}
              />
            </Field>

            {edited && (
              <Button variant="quiet" onClick={() => send({ draft }, "updating")} disabled={busy !== null}>
                {busy === "updating" ? "Updating times…" : "Update the times"}
              </Button>
            )}
          </section>

          <section aria-labelledby="times" className="space-y-4">
            <div>
              <h2 id="times" className="text-2xl">
                Times to offer
              </h2>
              <p className="text-pencil">
                Picked from the free time on{" "}
                {account.calendar === "google" ? "your Google Calendar" : "a sample calendar (sign in to use yours)"}, shown
                in {zoneShort(zone)}.
              </p>
            </div>
            {preview.options.length === 0 ? (
              <Notice>
                No times fit. Try wider dates, longer hours, or fewer rules, then update the times.
              </Notice>
            ) : (
              <SlotList slots={preview.options} zone={zone} />
            )}
          </section>

          <section aria-labelledby="share" className="space-y-4">
            {error && <Notice tone="error">{error}</Notice>}
            {created ? (
              <div className="space-y-4 rounded-md border border-rule bg-paper-deep p-5">
                <h2 id="share" className="text-2xl">
                  Your poll is ready
                </h2>
                <p>Send this link to the group in WhatsApp, email or wherever you talk. Nobody needs an account.</p>
                <div className="flex flex-wrap items-center gap-3">
                  <input readOnly aria-label="Share link" value={created.shareUrl} className={`${inputClass} flex-1`} />
                  <Button variant="quiet" onClick={copy}>
                    {copied ? "Link copied" : "Copy link"}
                  </Button>
                </div>
                <a href={created.dashboardUrl} className="inline-block font-medium underline underline-offset-4">
                  Open your poll's dashboard
                </a>
              </div>
            ) : signedIn ? (
              <Button
                id="share"
                onClick={create}
                disabled={busy !== null || edited || preview.options.length === 0}
              >
                {busy === "creating" ? "Creating the poll…" : edited ? "Update the times first" : "Create poll"}
              </Button>
            ) : (
              <Notice>
                {account.signedIn ? "Connect your calendar above to create the poll." : "Sign in above to create the poll."}
              </Notice>
            )}
          </section>
        </>
      )}
    </div>
  );
}
