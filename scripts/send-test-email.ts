// Sends one confirmation-style email through Brevo to check the email setup.
// Run: npx tsx scripts/send-test-email.ts you@example.org
import "./_env";

async function main() {
  const to = process.argv[2];
  if (!to) throw new Error("Pass the address to send to.");
  const { sendEmail } = await import("../src/lib/email/send");
  const { confirmationEmail } = await import("../src/lib/email/templates");
  const start = Date.now() + 3 * 86_400_000;
  const email = confirmationEmail({
    guestName: "there",
    guestZone: "Asia/Hong_Kong",
    title: "Calendarly email test",
    organizerName: "Calendarly",
    start,
    end: start + 3_600_000,
  });
  const result = await sendEmail({ kind: "confirmation", to, pollId: null as unknown as string, ...email });
  console.log(`Result: ${result}`);
}

main();
