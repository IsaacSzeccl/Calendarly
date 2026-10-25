import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { explain } from "@/lib/ai/explain";
import { fallbackExplanation } from "@/lib/ai/explainText";
import type { Explanation } from "@/lib/ai/schemas";
import { getOrganizer, testModeOn } from "@/lib/auth/organizer";
import { findExplanation } from "@/lib/db/aiRuns";
import { getPoll } from "@/lib/db/polls";
import type { Label } from "@/lib/engine/types";
import { dateTimeLabel, slotLabel, zoneShort } from "@/lib/format";
import { loadDashboard, type Dashboard } from "@/lib/polls/dashboard";
import { StatusIcon, StatusMark } from "@/components/Availability";
import { Notice } from "@/components/ui";
import { ClosePollButton, CopyLink, PickButton, RefreshButton } from "./controls";

export const metadata: Metadata = { title: "Poll dashboard · Calendarly" };

const labelLook: Record<Label, string> = {
  Recommended: "bg-yes text-paper",
  "Works well": "bg-yes-wash text-yes",
  "Works with trade-offs": "bg-maybe-wash text-maybe",
  "Not recommended": "bg-no-wash text-no",
};

function AiNote({ explanation, basis, pending }: { explanation: Explanation | null; basis: string; pending?: boolean }) {
  return (
    <aside aria-labelledby="note" aria-busy={pending} className="relative rounded-md border border-rule bg-paper-deep py-5 pl-8 pr-5">
      {/* The ribbon marker: the one bold element on the page. */}
      <span aria-hidden className="absolute -top-2 left-3 h-[calc(100%+0.5rem)] w-2.5 bg-ribbon [clip-path:polygon(0_0,100%_0,100%_100%,50%_calc(100%-6px),0_100%)]" />
      <h2 id="note" className="sr-only">
        Note on the times
      </h2>
      {explanation ? (
        <div className="space-y-3 font-serif text-[1.15rem] leading-relaxed">
          <p>{explanation.summary}</p>
          {explanation.conditional.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      ) : (
        <p className="font-serif text-[1.15rem] text-pencil">Reading the answers and writing you a note…</p>
      )}
      <p className="mt-4 text-sm text-pencil">This is {basis}.</p>
    </aside>
  );
}

function Ranking({ d, explanation, canPick }: { d: Dashboard; explanation: Explanation; canPick: boolean }) {
  const zone = d.poll.rules.organizerTimezone;
  const lines = new Map(explanation.perOption.map((p) => [p.optionId, p.text]));
  return (
    <ol className="border-t border-rule">
      {d.ranked.map((a) => {
        const picked = d.poll.finalOptionId === a.option.id;
        return (
          <li key={a.option.id} className="grid grid-cols-[2.5rem_1fr] gap-x-3 border-b border-rule py-4">
            <span className="font-serif text-3xl leading-none text-pencil" aria-hidden>
              {a.number}
            </span>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="font-sans text-lg font-semibold">
                  <span className="sr-only">Option {a.number}: </span>
                  {slotLabel(a.option.start, a.option.end, zone)}
                </h3>
                <span className={`rounded px-2 py-0.5 text-sm font-medium ${labelLook[a.label]}`}>{a.label}</span>
                {a.option.source !== "organizer_free" && (
                  <span className="text-sm text-pencil">Added from a guest's suggestion</span>
                )}
                {picked && <span className="rounded bg-ribbon px-2 py-0.5 text-sm font-semibold text-ribbon-ink">Picked</span>}
              </div>
              <p>{lines.get(a.option.id)}</p>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-pencil">
                <span className="inline-flex items-center gap-1 text-yes"><StatusIcon status="yes" />{a.canCome.length} yes</span>
                <span className="inline-flex items-center gap-1 text-maybe"><StatusIcon status="prefer_not" />{a.preferNot.length} prefer not</span>
                <span className="inline-flex items-center gap-1 text-no"><StatusIcon status="no" />{a.cannotCome.length} no</span>
                {a.unknown.length > 0 && <span>{a.unknown.length} not answered</span>}
              </p>
              {canPick && <PickButton pollId={d.poll.id} optionId={a.option.id} number={a.number} />}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

async function NoteAndRanking({ d, canPick }: { d: Dashboard; canPick: boolean }) {
  const { explanation } = await explain(d.facts, { find: findExplanation });
  return (
    <>
      <AiNote explanation={explanation} basis={d.basis} />
      <section aria-labelledby="ranking" className="space-y-3">
        <h2 id="ranking" className="text-2xl">Times, best first</h2>
        <Ranking d={d} explanation={explanation} canPick={canPick} />
      </section>
    </>
  );
}

function VotesTable({ d }: { d: Dashboard }) {
  const zone = d.poll.rules.organizerTimezone;
  const byTime = [...d.ranked].sort((a, b) => a.number - b.number);
  if (d.respondents.length === 0) return null;
  return (
    <section aria-labelledby="votes" className="space-y-3">
      <h2 id="votes" className="text-2xl">Everyone's answers</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-rule text-sm text-pencil">
              <th scope="col" className="py-2 pr-3 font-medium">Person</th>
              {byTime.map((a) => (
                <th key={a.option.id} scope="col" className="px-2 py-2 text-center font-serif font-normal" title={slotLabel(a.option.start, a.option.end, zone)}>
                  {a.number}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.respondents.map((r) => (
              <tr key={r.id} className="border-b border-rule">
                <th scope="row" className="py-2 pr-3 font-medium">{r.name}</th>
                {byTime.map((a) => (
                  <td key={a.option.id} className="px-2 py-2 text-center">
                    <StatusMark status={a.statuses[r.id] ?? "unknown"} compact />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function People({ d }: { d: Dashboard }) {
  const required = new Set(d.poll.rules.people.filter((p) => p.required).map((p) => p.name.toLowerCase()));
  const organizerCalendar = d.poll.organizerCalendar.kind === "sample" ? "sample calendar" : "calendar connected";
  return (
    <section aria-labelledby="people" className="space-y-3">
      <h2 id="people" className="text-2xl">People</h2>
      <ul className="divide-y divide-rule border-y border-rule">
        <li className="flex flex-wrap justify-between gap-2 py-3">
          <span className="font-medium">{d.poll.organizerName} (you)</span>
          <span className="text-sm text-pencil">{organizerCalendar}</span>
        </li>
        {d.guests.map((g) => (
          <li key={g.id} className="space-y-1 py-3">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-medium">
                {g.name}
                {required.has(g.name.toLowerCase()) && <span className="ml-2 text-sm font-normal text-ribbon">must attend</span>}
              </span>
              <span className="text-sm text-pencil">
                {d.needsReconnect.includes(g.name)
                  ? "calendar needs reconnecting"
                  : g.calendarConnectionId
                    ? "calendar connected"
                    : "answered by hand"}
                , {zoneShort(g.timezone)}
              </span>
            </div>
            {g.preferencesSummary && <p className="text-sm text-pencil">{g.preferencesSummary}</p>}
          </li>
        ))}
        {d.waiting.map((name) => (
          <li key={name} className="flex flex-wrap justify-between gap-2 py-3 text-pencil">
            <span>
              {name}
              {required.has(name.toLowerCase()) && <span className="ml-2 text-sm text-ribbon">must attend</span>}
            </span>
            <span className="text-sm">waiting</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function DashboardBody({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const organizer = await getOrganizer();
  if (!organizer) {
    return (
      <Notice>
        Sign in to see this poll.{" "}
        {testModeOn() && (
          <a className="underline" href={`/api/test-login?next=/poll/${id}`}>
            Use the test sign-in
          </a>
        )}
      </Notice>
    );
  }
  const poll = await getPoll(id);
  if (!poll) notFound();
  if (poll.organizerId !== organizer.id) {
    return <Notice>Only the person who created this poll can see its dashboard.</Notice>;
  }

  const d = await loadDashboard(poll);
  const host = (await headers()).get("host");
  const shareUrl = `${host?.startsWith("localhost") ? "http" : "https"}://${host}/p/${poll.shareToken}`;
  const zone = poll.rules.organizerTimezone;
  const finalOption = d.options.find((o) => o.id === poll.finalOptionId);
  const canPick = d.status !== "finalized" && d.options.length > 0;

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <h1 className="text-4xl">{poll.title}</h1>
        <p className="text-lg">
          <strong className="font-semibold">{d.completion.text}</strong> have answered
          {d.status === "open" && poll.closeAt && `, closes ${dateTimeLabel(poll.closeAt, zone)}`}
          {d.status === "closed" && ". The poll is closed to new answers"}.
        </p>
        <div className="flex flex-wrap gap-3">
          <CopyLink url={shareUrl} />
          <RefreshButton />
          {d.status === "open" && <ClosePollButton pollId={poll.id} />}
        </div>
        <p className="text-sm text-pencil">Times are shown in {zoneShort(zone)}.</p>
      </header>

      {finalOption && (
        <Notice>
          You picked {slotLabel(finalOption.start, finalOption.end, zone)}.{" "}
          {poll.googleEventId ? "It's on your calendar" : "It couldn't be added to your calendar"}, and everyone who
          answered gets a confirmation email.
        </Notice>
      )}
      {d.failedEmails > 0 && (
        <Notice tone="error">
          {d.failedEmails === 1 ? "1 email wasn't sent." : `${d.failedEmails} emails weren't sent.`} Everything else
          still works.
        </Notice>
      )}
      {d.needsReconnect.length > 0 && (
        <Notice>
          {d.needsReconnect.join(", ")} connected a calendar that can't be read any more, so the ranking uses
          their votes only. They can reconnect from the poll link.
        </Notice>
      )}
      {d.respondents.length === 0 && (
        <Notice>
          No answers yet. Send the poll link to the group; answers appear here when you refresh.
        </Notice>
      )}

      <Suspense
        fallback={
          <>
            <AiNote explanation={null} basis={d.basis} pending />
            <section className="space-y-3">
              <h2 className="text-2xl">Times, best first</h2>
              <Ranking d={d} explanation={fallbackExplanation(d.facts)} canPick={canPick} />
            </section>
          </>
        }
      >
        <NoteAndRanking d={d} canPick={canPick} />
      </Suspense>

      <VotesTable d={d} />
      <People d={d} />

      <p>
        <Link href="/new" className="underline underline-offset-4">Start another poll</Link>
      </p>
    </div>
  );
}

export default function PollDashboardPage({ params }: PageProps<"/poll/[id]">) {
  return (
    <Suspense fallback={<p className="text-pencil">Loading your poll…</p>}>
      <DashboardBody params={params} />
    </Suspense>
  );
}
