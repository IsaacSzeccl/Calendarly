import type { Metadata } from "next";
import { Suspense } from "react";
import { getOrganizer, testModeOn } from "@/lib/auth/organizer";
import { CreatePoll } from "./CreatePoll";

export const metadata: Metadata = { title: "New poll · Calendarly" };

async function CreatePollForOrganizer({ searchParams }: { searchParams: Promise<{ calendar?: string }> }) {
  const [organizer, { calendar }] = await Promise.all([getOrganizer(), searchParams]);
  return (
    <CreatePoll
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
      <div className="space-y-2">
        <h1 className="text-4xl">Find a time</h1>
        <p className="max-w-prose text-pencil">
          Describe the meeting the way you'd tell a friend. I'll turn it into a poll and suggest times
          when you're free.
        </p>
      </div>
      <Suspense fallback={<p className="text-pencil">Loading…</p>}>
        <CreatePollForOrganizer searchParams={searchParams as Promise<{ calendar?: string }>} />
      </Suspense>
    </div>
  );
}
