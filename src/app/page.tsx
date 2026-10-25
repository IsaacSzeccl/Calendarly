import Link from "next/link";
import { Suspense } from "react";
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

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <div className="space-y-10">
      <Suspense fallback={null}>
        <Problem searchParams={searchParams as Promise<{ signin?: string; calendar?: string }>} />
      </Suspense>
      <section className="space-y-5">
        <h1 className="text-5xl leading-[1.05] sm:text-6xl">
          Stop asking the group chat when everyone's free.
        </h1>
        <p className="max-w-prose text-lg text-pencil">
          Describe the meeting in a sentence. Calendarly offers times from your calendar, lets people
          answer from a link without an account, and tells you plainly which time works and what each
          one costs.
        </p>
        <Link
          href="/new"
          className="inline-flex min-h-11 items-center rounded-md bg-ribbon px-5 py-2 font-semibold text-ribbon-ink hover:brightness-110"
        >
          Start a poll
        </Link>
      </section>
    </div>
  );
}
