// Diagnostic: what does Google say is busy for the connected calendars of one poll, over the next 7 days?
// Prints times only (never event titles or tokens), in the timezone you pass, so you can compare with your
// calendar. Usage: npx tsx scripts/diag-busy.ts <poll id> [timezone, default Asia/Hong_Kong]
import "./_env";
import { DateTime } from "luxon";
import { db } from "../src/lib/db/client";
import { GoogleCalendarProvider } from "../src/lib/calendar/google";
import { connectionStore } from "../src/lib/db/connections";

const pollId = process.argv[2];
const zone = process.argv[3] ?? "Asia/Hong_Kong";
const fmt = (ms: number) => DateTime.fromMillis(ms, { zone }).toFormat("ccc d LLL HH:mm");

async function main() {
  const { data: poll } = await db().from("polls").select("organizer_id, organizer_calendar").eq("id", pollId).single();
  const { data: guests } = await db().from("guests").select("name, calendar_connection_id").eq("poll_id", pollId);
  const provider = new GoogleCalendarProvider(connectionStore);
  const from = DateTime.now().setZone(zone).startOf("day").toMillis();
  const to = DateTime.now().setZone(zone).plus({ days: 7 }).startOf("day").toMillis();

  const accounts: [string, string][] = [];
  const org = poll?.organizer_calendar as { kind: string; connectionId?: string };
  if (org?.kind === "google") accounts.push(["organizer", org.connectionId!]);
  for (const g of guests ?? []) if (g.calendar_connection_id) accounts.push([`guest ${g.name}`, g.calendar_connection_id]);

  for (const [label, id] of accounts) {
    const busy = await provider.getBusy({ kind: "google", connectionId: id }, from, to);
    console.log(`\n${label}: ${busy.length} busy block(s) reported by Google freeBusy (primary), shown in ${zone}`);
    for (const b of busy) console.log(`  ${fmt(b.start)} – ${fmt(b.end)}`);
  }
}
main().catch((e) => { console.error("failed:", e instanceof Error ? e.message : e); process.exit(1); });
