// Seeds the demo: a 6-person group project where no time suits everyone.
// The four seeded guests are labeled "sample guest" in the app; Priya is left
// for a real answer during the demo.
//
//   npm run demo:seed                          → owned by the test organizer (needs E2E_TEST_MODE=1 to view)
//   npm run demo:seed -- you@gmail.com         → owned by a real organizer who has signed in once
import "./_env";
import { DateTime } from "luxon";

const SAMPLE_ANSWERS: Record<string, ("yes" | "prefer_not" | "no")[]> = {
  // One entry per option, in time order. Sam must attend.
  Sam: ["yes", "yes", "no", "yes", "no"],
  Leo: ["no", "no", "yes", "yes", "yes"],
  Mei: ["yes", "yes", "yes", "no", "yes"],
  Jordan: ["yes", "prefer_not", "no", "yes", "no"],
};

async function main() {
  const { db } = await import("../src/lib/db/client");
  const { findConnection } = await import("../src/lib/db/connections");
  const { createPoll, getOptions, newToken } = await import("../src/lib/db/polls");
  const { previewOptions } = await import("../src/lib/polls/preview");
  const { setVotes } = await import("../src/lib/db/statements");
  type CalendarAccount = import("../src/lib/calendar/provider").CalendarAccount;

  const email = process.argv[2];
  const timezone = process.env.DEMO_TIMEZONE ?? "Asia/Hong_Kong";
  let organizer = { id: "test:alex@example.com", email: "alex@example.com" as string | null, name: "Alex (test organizer)" };
  let calendar: CalendarAccount = { kind: "sample", key: "organizer", timezone };

  if (email) {
    const { data, error } = await db().auth.admin.listUsers({ perPage: 200 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) throw new Error(`No organizer with ${email}. Sign in to Calendarly once first.`);
    const meta = user.user_metadata as { full_name?: string };
    organizer = { id: user.id, email: user.email ?? null, name: meta.full_name ?? email.split("@")[0] };
    const connection = await findConnection("organizer", user.id);
    if (connection?.status === "active") calendar = { kind: "google", connectionId: connection.id };
    else console.log("No connected Google Calendar for this organizer: using the sample calendar.");
  }

  const monday = DateTime.now().setZone(timezone).startOf("week").plus({ weeks: 1 });
  const rules = {
    organizerName: organizer.name,
    organizerTimezone: timezone,
    people: ["Sam", "Priya", "Leo", "Mei", "Jordan"].map((name) => ({
      name,
      timezone,
      required: name === "Sam",
      hours: null,
      notes: null,
    })),
    window: { startDate: monday.toISODate()!, endDate: monday.plus({ days: 4 }).toISODate()! },
    durationMinutes: 90,
    workingHours: { start: "10:00", end: "18:00" },
    constraints: [
      {
        appliesTo: "everyone",
        type: "prefer" as const,
        strength: "soft" as const,
        timeOfDay: "afternoon" as const,
        weight: 1 as const,
        description: "Afternoons are best",
      },
    ],
    reasonableHours: { start: "08:00", end: "21:00" },
    onlyIfNecessary: false,
  };

  const { options } = await previewOptions(rules, calendar);
  if (options.length < 5) throw new Error(`Only ${options.length} free times next week; the demo needs 5.`);

  const poll = await createPoll({
    organizer,
    title: "Group project: presentation prep",
    rules,
    expectedCount: 6,
    calendar,
    closeAt: null,
    options,
  });
  const saved = await getOptions(poll.id);

  for (const [name, answers] of Object.entries(SAMPLE_ANSWERS)) {
    const { data: guest, error } = await db()
      .from("guests")
      .insert({
        poll_id: poll.id,
        name,
        email: `${name.toLowerCase()}@example.com`,
        timezone,
        guest_token: newToken(),
        is_sample: true,
      })
      .select("id")
      .single();
    if (error || !guest) throw error ?? new Error("guest insert failed");
    await setVotes(guest.id, Object.fromEntries(saved.slice(0, 5).map((o, i) => [o.id, answers[i]])));
  }

  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  console.log(`Demo poll ready.\n  Guest link:  ${base}/p/${poll.shareToken}\n  Dashboard:   ${base}/poll/${poll.id}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
