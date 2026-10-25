import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getGuestByToken, getGuests, getOptions, getPollByToken, getVotes, statusOf } from "@/lib/db/polls";
import { overlaps } from "@/lib/engine/time";
import { readGuestToken } from "@/lib/guest/cookie";
import { guestBusy } from "@/lib/polls/guestCalendar";
import { GuestForm, type GuestFormProps } from "./GuestForm";

export const metadata: Metadata = { title: "Answer a poll · Calendarly" };

async function GuestPoll({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ calendar?: string }>;
}) {
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
  const calendar = me ? await guestBusy(me.calendarConnectionId, options) : ({ state: "none" } as const);
  const calendarMarks =
    calendar.state === "connected"
      ? Object.fromEntries(
          options.map((o) => [o.id, calendar.busy.some((b) => overlaps(b, o)) ? ("no" as const) : ("yes" as const)]),
        )
      : {};

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
    me: me ? { name: me.name, email: me.email, timezone: me.timezone, votes: myVotes } : null,
    calendar: { state: calendar.state, marks: calendarMarks },
    calendarResult: calendarResult ?? null,
  };
  return <GuestForm {...props} />;
}

export default function GuestPollPage({ params, searchParams }: PageProps<"/p/[token]">) {
  return (
    <Suspense fallback={<p className="text-pencil">Loading the poll…</p>}>
      <GuestPoll params={params} searchParams={searchParams as Promise<{ calendar?: string }>} />
    </Suspense>
  );
}
