// Calls the real model once for parseStatement and prints the raw answer, to record golden answers.
// Run: npx tsx scripts/ai-probe-statement.ts "<text>" <timezone> <startDate> <endDate>
import "./_env";

async function main() {
  const { parseStatement } = await import("../src/lib/ai/parseStatement");
  const [text, timezone = "Asia/Hong_Kong", startDate, endDate] = process.argv.slice(2);
  const res = await parseStatement({ text, timezone, guestName: "Priya", window: { startDate, endDate } });
  for (const run of res.runs) {
    console.log(`--- run: valid=${run.valid} ms=${run.ms} ${run.error ?? ""}`);
    console.log(run.output);
  }
}

main();
