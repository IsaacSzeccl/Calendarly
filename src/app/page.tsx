import Link from "next/link";
import { Suspense } from "react";
import { StatusIcon } from "@/components/Availability";
import { Notice } from "@/components/ui";

const PROBLEMS: Record<string, string> = {
  failed: "Signing in didn't work. Try again.",
  expired: "Connecting your calendar took too long. Start again from your poll.",
};

async function Problem({ searchParams }: { searchParams: Promise<{ signin?: string; calendar?: string }> }) {
  const { signin, calendar } = await searchParams;
  const message = (signin && PROBLEMS[signin]) || (calendar && PROBLEMS[calendar]);
  return message ? <Notice tone="error">{message}</Notice> : null;
}

const STEPS = [
  ["Describe it", "“Two hours this week with Sam and Priya, afternoons.”"],
  ["Share the link", "Everyone answers in a minute. No account."],
  ["Pick the time", "See which time wins, and who it leaves out."],
];

/** A still picture of the dashboard's top: the ribbon note and the best time. */
function Preview() {
  return (
    <div aria-hidden className="space-y-3 rounded-lg border border-rule bg-paper-deep p-5 shadow-[0_1px_0_var(--rule)]">
      <div className="relative rounded-md bg-paper py-3 pl-7 pr-4">
        <span className="absolute -top-1.5 left-2.5 h-[calc(100%+0.375rem)] w-2 bg-ribbon [clip-path:polygon(0_0,100%_0,100%_100%,50%_calc(100%-5px),0_100%)]" />
        <p className="font-serif">Option 2 has everyone but Leo. If Leo must come, pick option 4.</p>
      </div>
      <div className="rounded-md border-2 border-yes bg-yes-wash/50 p-3">
        <p className="text-sm font-semibold text-yes">Best time</p>
        <p className="font-semibold">Wed 28 Oct, 14:00–16:00</p>
        <p className="mt-1 inline-flex items-center gap-1 text-sm text-yes">
          <StatusIcon status="yes" /> 4 of 5 can come
        </p>
      </div>
      <div className="rounded-md border border-rule bg-paper p-3">
        <p className="font-semibold">Fri 30 Oct, 15:00–17:00</p>
        <p className="mt-1 inline-flex items-center gap-1 text-sm text-maybe">
          <StatusIcon status="prefer_not" /> Works with trade-offs
        </p>
      </div>
    </div>
  );
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <div className="space-y-14">
      <Suspense fallback={null}>
        <Problem searchParams={searchParams as Promise<{ signin?: string; calendar?: string }>} />
      </Suspense>
      <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <h1 className="text-5xl leading-[1.05] sm:text-6xl">Find a time that works for everyone.</h1>
          <p className="max-w-md text-lg text-pencil">One link for the group. Calendarly shows which time wins, and why.</p>
          <Link
            href="/new"
            className="inline-flex min-h-12 items-center rounded-md bg-ribbon px-6 text-lg font-semibold text-ribbon-ink hover:brightness-110"
          >
            Start a poll
          </Link>
        </div>
        <Preview />
      </section>
      <ol className="grid gap-6 border-t border-rule pt-8 sm:grid-cols-3">
        {STEPS.map(([title, line], i) => (
          <li key={title} className="space-y-1">
            <p className="font-serif text-lg">
              <span className="mr-2 text-ribbon">{i + 1}</span>
              {title}
            </p>
            <p className="text-pencil">{line}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
