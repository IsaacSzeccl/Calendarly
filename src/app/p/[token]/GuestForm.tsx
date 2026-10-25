"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";
import type { Choice, OptionSource } from "@/lib/engine/types";
import { slotLabel, zoneShort } from "@/lib/format";
import { ChoicePicker, StatusMark } from "@/components/Availability";
import { SlotList } from "@/components/SlotList";
import { Button, Field, Notice, inputClass } from "@/components/ui";
import { CalendarCard, type CalendarState } from "./CalendarCard";
import { StatementBox } from "./StatementBox";

export type GuestFormProps = {
  token: string;
  title: string;
  organizerName: string;
  organizerTimezone: string;
  durationMinutes: number;
  status: "open" | "closed" | "finalized";
  closeAt: number | null;
  listedNames: string[];
  options: { id: string; start: number; end: number; source: OptionSource }[];
  finalOption: { start: number; end: number } | null;
  me: { name: string; email: string; timezone: string; votes: Record<string, Choice>; remember: boolean } | null;
  calendar: CalendarState;
  calendarResult: string | null;
  /** Other guests who connected a calendar: a nudge, never who they are. */
  othersConnected: number;
  testMode: boolean;
};

const noop = () => () => {};

/** The viewer's own timezone, read after hydration so server and browser agree. */
function useBrowserZone(fallback: string): string {
  return useSyncExternalStore(noop, () => Intl.DateTimeFormat().resolvedOptions().timeZone, () => fallback);
}

export function GuestForm(props: GuestFormProps) {
  const zone = useBrowserZone(props.me?.timezone ?? props.organizerTimezone);
  const [name, setName] = useState(props.me?.name ?? "");
  const [email, setEmail] = useState(props.me?.email ?? "");
  // Calendar marks fill the gaps; anything the guest chose themselves wins.
  const [votes, setVotes] = useState<Record<string, Choice>>({ ...props.calendar.marks, ...(props.me?.votes ?? {}) });
  const [touched, setTouched] = useState<Set<string>>(() => new Set(Object.keys(props.me?.votes ?? {})));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const readOnly = props.status !== "open";
  const nameOptions = props.me && !props.listedNames.includes(props.me.name)
    ? [props.me.name, ...props.listedNames]
    : props.listedNames;

  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await save();
  }

  /** Save the current answers. Returns false (and shows why) if they can't be saved yet. */
  async function save(): Promise<boolean> {
    if (formRef.current && !formRef.current.reportValidity()) return false;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/guest/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: props.token, name, email, timezone: zone, votes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Your answers weren't saved. Try again.");
      setSaved(json.name);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your answers weren't saved. Try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  const length =
    props.durationMinutes % 60 === 0 ? `${props.durationMinutes / 60}-hour` : `${props.durationMinutes}-minute`;

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-4xl">{props.title}</h1>
        <p className="text-pencil">
          {props.organizerName} is finding a time for a {length} meeting. Times are shown in{" "}
          {zoneShort(zone)}.
        </p>
      </header>

      {props.status === "finalized" && props.finalOption && (
        <Notice>
          {props.organizerName} picked {slotLabel(props.finalOption.start, props.finalOption.end, zone)}.
        </Notice>
      )}
      {props.status === "closed" && (
        <Notice>This poll has closed. Your answers below are saved and can't be changed.</Notice>
      )}

      <section className="space-y-4" aria-labelledby="who">
        <h2 id="who" className="text-2xl">
          Who are you?
        </h2>
        {nameOptions.length > 0 && (
          <div className="space-y-2">
            <span className="block text-sm font-medium">Pick your name</span>
            <div className="flex flex-wrap gap-2">
              {nameOptions.map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={readOnly}
                  aria-pressed={name === n}
                  onClick={() => setName(n)}
                  className={`min-h-11 rounded-md border px-4 font-medium ${
                    name === n ? "border-ribbon bg-paper-deep text-ink" : "border-rule text-pencil hover:bg-paper-deep"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={nameOptions.length ? "Or type your name" : "Your name"}>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={readOnly}
              autoComplete="name"
              required
            />
          </Field>
          <Field label="Email" hint="Only used to tell you about new times and the final time.">
            <input
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={readOnly}
              autoComplete="email"
              required
            />
          </Field>
        </div>
      </section>

      {!readOnly && (
        <CalendarCard
          token={props.token}
          zone={zone}
          organizerName={props.organizerName}
          calendar={props.calendar}
          calendarResult={props.calendarResult}
          othersConnected={props.othersConnected}
          testMode={props.testMode}
          remember={props.me?.remember ?? false}
          ensureSaved={save}
          onAdded={(added) => setVotes((v) => ({ ...v, [added.id]: "yes" }))}
        />
      )}

      <section className="space-y-4" aria-labelledby="times">
        <div>
          <h2 id="times" className="text-2xl">
            Which times work?
          </h2>
          <p className="text-pencil">
            {props.calendar.state === "connected"
              ? "Filled in from your calendar. Change any answer you like."
              : "Mark each one. \"Prefer not\" means you could, but would rather not."}
          </p>
        </div>
        <SlotList
          slots={props.options}
          zone={zone}
          extra={(slot) =>
            readOnly ? (
              <StatusMark status={votes[slot.id!] ?? "unknown"} />
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {slot.source !== "organizer_free" && <span className="text-sm text-pencil">Added from a suggestion</span>}
                {props.calendar.marks[slot.id!] && !touched.has(slot.id!) && (
                  <span className="text-sm text-pencil">From your calendar</span>
                )}
                <ChoicePicker
                  label={`Your answer for ${slotLabel(slot.start, slot.end, zone)}`}
                  value={votes[slot.id!]}
                  onChange={(c) => {
                    setVotes((v) => ({ ...v, [slot.id!]: c }));
                    setTouched((t) => new Set(t).add(slot.id!));
                    setSaved(null);
                  }}
                />
              </div>
            )
          }
        />
      </section>

      {!readOnly && (
        <StatementBox
          token={props.token}
          zone={zone}
          ensureSaved={save}
          onAdded={(added) => {
            setVotes((v) => ({ ...v, ...Object.fromEntries(added.map((o) => [o.id, "yes" as const])) }));
            router.refresh();
          }}
        />
      )}

      {!readOnly && (
        <div className="space-y-3">
          {error && <Notice tone="error">{error}</Notice>}
          {saved && (
            <Notice>
              Thanks, {saved}. Your answers are saved. You can come back to this link and change them until{" "}
              {props.organizerName} picks a time.
            </Notice>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : props.me || saved ? "Save my changes" : "Send my answers"}
          </Button>
        </div>
      )}
    </form>
  );
}
