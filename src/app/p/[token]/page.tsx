import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getGuestByToken, getGuests, getOptions, getPollByToken, getVotes, statusOf } from "@/lib/db/polls";
import { readGuestToken } from "@/lib/guest/cookie";
import { GuestForm, type GuestFormProps } from "./GuestForm";

export const metadata: Metadata = { title: "Answer a poll · Calendarly" };

async function GuestPoll({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
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
  };
  return <GuestForm {...props} />;
}

export default function GuestPollPage({ params }: PageProps<"/p/[token]">) {
  return (
    <Suspense fallback={<p className="text-pencil">Loading the poll…</p>}>
      <GuestPoll params={params} />
    </Suspense>
  );
}
