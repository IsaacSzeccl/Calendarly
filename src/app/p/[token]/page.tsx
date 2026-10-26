import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getGuestByToken, getGuests, getOptions, getPollByToken, getVotes, statusOf } from "@/lib/db/polls";
import { overlaps } from "@/lib/engine/time";
import { testModeOn } from "@/lib/auth/organizer";
import { config } from "@/lib/config";
import { readGuestToken } from "@/lib/guest/cookie";
import { suggestFromCalendar } from "@/lib/polls/calendarSuggest";
import { pickableStarts } from "@/lib/polls/pickable";
import { guestBusy } from "@/lib/polls/guestCalendar";
import { GuestForm, type GuestFormProps } from "./GuestForm";

export const metadata: Metadata = { title: "Answer a poll · Calendarly" };

/** The moment of this request. Only read after connection(), so it's never part of a prerendered shell. */
function requestTime(): number {
  return Date.now();
}

async function GuestPoll({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ calendar?: string }>;
}) {
  // Answers, calendars and "is it still open?" depend on the moment of the request: never part of a prerendered shell.
  await connection();
  const [{ token }, { calendar: calendarResult }] = await Promise.all([params, searchParams]);
  const poll = await getPollByToken(token);
  if (!poll) notFound();

  const [options, guests, guestToken] = await Promise.all([
    getOptions(poll.id),
    getGuests(poll.id),
    readGuestToken(poll.id),
  ]);
  const me = guestToken ? await getGuestByToken(poll.id, guestToken) : null;
  const myVotes = me
    ? Object.fromEntries(
        (await getVotes(options.map((o) => o.id)))
          .filter((v) => v.guestId === me.id)
          .map((v) => [v.optionId, v.choice]),
      )
    : {};

  // A connected calendar pre-fills yes/no; the guest's own votes always win.
  const calendar = me ? await guestBusy(me.calendarConnectionId, options, me.timezone) : ({ state: "none" } as const);
  const calendarMarks =
    calendar.state === "connected"
      ? Object.fromEntries(
          options.map((o) => [o.id, calendar.busy.some((b) => overlaps(b, o)) ? ("no" as const) : ("yes" as const)]),
        )
      : {};

  // A connected calendar can also offer new times that fit this guest and the organizer.
  const suggest =
    me && calendar.state === "connected" && statusOf(poll) === "open" ? await suggestFromCalendar(poll, me) : null;

  const room = config.guestSlotCap - options.filter((o) => o.source !== "organizer_free").length;
  const pickable = statusOf(poll) === "open" && room > 0 ? await pickableStarts(poll, options, requestTime()) : [];

  const claimed = new Set(guests.filter((g) => g.id !== me?.id).map((g) => g.name.toLowerCase()));
  const finalOption = options.find((o) => o.id === poll.finalOptionId) ?? null;

  const props: GuestFormProps = {
    token,
    title: poll.title,
    organizerName: poll.organizerName,
    organizerTimezone: poll.rules.organizerTimezone,
    durationMinutes: poll.rules.durationMinutes,
    status: statusOf(poll),
    closeAt: poll.closeAt,
    listedNames: poll.rules.people.map((p) => p.name).filter((n) => !claimed.has(n.toLowerCase())),
    options: options.map(({ id, start, end, source }) => ({ id, start, end, source })),
    finalOption: finalOption ? { start: finalOption.start, end: finalOption.end } : null,
    me: me ? { name: me.name, email: me.email, timezone: me.timezone, votes: myVotes, remember: me.remember } : null,
    calendar: {
      state: calendar.state,
      sample: calendar.state === "connected" && calendar.sample,
      marks: calendarMarks,
      suggestions:
        suggest?.state === "suggested"
          ? suggest.suggestions.map(({ start, end }) => ({ start, end }))
          : suggest?.state === "full"
            ? "full"
            : null,
    },
    othersConnected: guests.filter((g) => g.id !== me?.id && g.calendarConnectionId).length,
    testMode: testModeOn(),
    room,
    pickable,
    calendarResult: calendarResult ?? null,
  };
  return <GuestForm {...props} />;
}

export default function GuestPollPage({ params, searchParams }: PageProps<"/p/[token]">) {
  return (
    <div className="max-w-2xl">
      <Suspense fallback={<p className="text-pencil">Loading the poll…</p>}>
        <GuestPoll params={params} searchParams={searchParams as Promise<{ calendar?: string }>} />
      </Suspense>
    </div>
  );
}
