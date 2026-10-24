// Calls the real model once for parsePoll and prints the raw answer.
// Used to record golden answers. Run: npx tsx scripts/ai-probe.ts "<text>" [timezone]
import "./_env";

async function main() {
  const { parsePoll } = await import("../src/lib/ai/parsePoll");
  const text = process.argv[2];
  const timezone = process.argv[3] ?? "America/New_York";
  const res = await parsePoll({ text, timezone });
  for (const run of res.runs) {
    console.log(`--- run: valid=${run.valid} ms=${run.ms} ${run.error ?? ""}`);
    console.log(run.output);
  }
  console.log("--- result");
  console.log(JSON.stringify(res.ok ? res.data : res.error, null, 2));
}

main();
