import type { Metadata } from "next";
import { Suspense } from "react";
import { getOrganizer, testModeOn } from "@/lib/auth/organizer";
import { rosterFrom } from "@/lib/polls/meetAgain";
import { CreatePoll } from "./CreatePoll";

export const metadata: Metadata = { title: "New poll · Calendarly" };

async function CreatePollForOrganizer({
  searchParams,
}: {
  searchParams: Promise<{ calendar?: string; again?: string }>;
}) {
  const [organizer, { calendar, again }] = await Promise.all([getOrganizer(), searchParams]);
  // Meet again: only the organizer's own poll, and only guests who asked to be remembered.
  const roster = organizer && again && /^[0-9a-f-]{36}$/i.test(again) ? await rosterFrom(again, organizer.id) : null;
  return (
    <CreatePoll
      again={
        roster ? { pollId: roster.from.id, title: roster.from.title, people: roster.people.map((p) => p.name) } : null
      }
      account={{
        signedIn: organizer !== null,
        calendar: organizer?.calendar?.kind ?? null,
        needsReconnect: organizer?.calendarNeedsReconnect ?? false,
        testMode: testModeOn(),
        calendarResult: calendar ?? null,
      }}
    />
  );
}

export default function NewPollPage({ searchParams }: PageProps<"/new">) {
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-4xl">New poll</h1>
        <p className="text-pencil">Describe it like you'd tell a friend. I'll find times you're free.</p>
      </div>
      <Suspense fallback={<p className="text-pencil">Loading…</p>}>
        <CreatePollForOrganizer searchParams={searchParams as Promise<{ calendar?: string; again?: string }>} />
      </Suspense>
    </div>
  );
}
