import { createClient } from "@supabase/supabase-js";
import { expect, test, type Browser } from "@playwright/test";

// The demo path: an organizer describes a meeting, one guest votes without an
// account, another states availability in plain language and confirms what the
// AI understood, slots are added, the organizer sees the ranking and picks.
const ORGANIZER = "e2e-organizer@example.com";

test.afterAll(async () => {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  await db.from("polls").delete().eq("organizer_id", `test:${ORGANIZER}`);
});

async function guestPage(browser: Browser, url: string) {
  const context = await browser.newContext({ timezoneId: "Asia/Hong_Kong" });
  const page = await context.newPage();
  await page.goto(url);
  return page;
}

test("organizer creates, guests answer, organizer picks", async ({ page, browser }) => {
  // Organizer describes the meeting in plain language.
  await page.goto(`/api/test-login?name=Alex&email=${ORGANIZER}&next=/new`);
  await page.getByLabel("Describe the meeting").fill(
    "A one-hour check-in with Priya and Mei this week. Afternoons are best.",
  );
  await page.getByRole("button", { name: "Read my description" }).click();
  await expect(page.getByRole("heading", { name: "What I understood" })).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue("Check-in");
  await page.getByRole("button", { name: "Create poll" }).click();
  const shareUrl = await page.getByLabel("Share link").inputValue();
  expect(shareUrl).toContain("/p/");

  // Mei votes from the link, no account.
  const mei = await guestPage(browser, shareUrl);
  await mei.getByRole("button", { name: "Mei", exact: true }).click();
  await mei.getByLabel("Email").fill("mei@example.com");
  const groups = mei.getByRole("radiogroup");
  const count = await groups.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await groups.nth(i).getByRole("radio", { name: i === 0 ? "Yes" : "No", exact: true }).click();
  }
  await mei.getByRole("button", { name: "Send my answers" }).click();
  await expect(mei.getByText("Your answers are saved")).toBeVisible();

  // Priya states availability, checks what the AI understood, confirms.
  const priya = await guestPage(browser, shareUrl);
  await priya.getByRole("button", { name: "Priya", exact: true }).click();
  await priya.getByLabel("Email").fill("priya@example.com");
  await priya.getByLabel("When are you free?").fill("Tuesday or Wednesday afternoons, not Mondays");
  await priya.getByRole("button", { name: "Check what I meant" }).click();
  await expect(priya.getByRole("heading", { name: "What I understood" })).toBeVisible();
  await priya.getByRole("button", { name: "Looks right, add these" }).click();
  await expect(priya.getByText(/Added \d new times?/)).toBeVisible();
  await expect(priya.getByText("Added from a suggestion").first()).toBeVisible();

  // Organizer sees everyone, the note with its basis, and picks the top time.
  await page.getByRole("link", { name: "Open your poll's dashboard" }).click();
  await expect(page.getByText("3 of 3")).toBeVisible();
  await expect(page.getByText(/This is based on .*stated availability/)).toBeVisible();
  await expect(page.getByText("Prefers Tuesday or Wednesday afternoons")).toBeVisible();
  await expect(page.getByText("writing you a note")).toBeHidden();
  // Retry until the page is interactive: a click before hydration does nothing.
  await expect(async () => {
    await page.getByRole("button", { name: /Pick option/ }).first().click();
    await expect(page.getByText(/You picked/)).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });

  // The guest link now shows the final time.
  await mei.reload();
  await expect(mei.getByText(/Alex picked/)).toBeVisible();
});

test("a guest's calendar answers, suggests a time, and brings them to the next meeting", async ({ page, browser }) => {
  await page.goto(`/api/test-login?name=Alex&email=${ORGANIZER}&next=/new`);
  await page.getByLabel("Describe the meeting").fill(
    "A one-hour check-in with Priya and Mei this week. Afternoons are best.",
  );
  await page.getByRole("button", { name: "Read my description" }).click();
  await page.getByRole("button", { name: "Create poll" }).click();
  const shareUrl = await page.getByLabel("Share link").inputValue();

  // Mei connects a calendar (the labeled sample one in test mode): her answers fill themselves in.
  const mei = await guestPage(browser, shareUrl);
  await mei.getByRole("button", { name: "Mei", exact: true }).click();
  await mei.getByLabel("Email").fill("mei@example.com");
  await mei.getByRole("button", { name: "Use a sample calendar (test mode)" }).click();
  await expect(mei.getByRole("heading", { name: "Your calendar is answering" })).toBeVisible();
  await expect(mei.getByText("From your calendar").first()).toBeVisible();

  // It offers a new time that fits her and the organizer; adding it marks her yes.
  await expect(mei.getByRole("heading", { name: "More times that fit your calendar" })).toBeVisible();
  await mei.getByRole("button", { name: "Add to the poll" }).first().click();
  await expect(mei.getByText("Added to the poll and marked yes for you")).toBeVisible();

  // She asks to be remembered for this organizer's next meeting.
  const saved = mei.waitForResponse((r) => r.url().includes("/api/guest/remember") && r.ok());
  await mei.getByLabel(/Remember me for future meetings with Alex/).check();
  await saved;

  // The organizer meets the group again: Mei comes along and her calendar answers for her.
  await page.getByRole("link", { name: "Open your poll's dashboard" }).click();
  await expect(page.getByText("Mei asked to be remembered")).toBeVisible();
  await page.getByRole("link", { name: "New meeting with this group" }).click();
  await expect(page.getByText(/Mei comes along/)).toBeVisible();
  await page.getByLabel("Describe the meeting").fill(
    "A one-hour check-in with Priya and Mei this week. Afternoons are best.",
  );
  await page.getByRole("button", { name: "Read my description" }).click();
  await page.getByRole("button", { name: "Create poll" }).click();
  const againUrl = await page.getByLabel("Share link").inputValue();

  // Mei opens the new poll's shared link on a fresh device: she's already in it, so she's sent a private link.
  const meiElsewhere = await guestPage(browser, againUrl);
  await meiElsewhere.getByLabel(/type your name/).fill("Mei");
  await meiElsewhere.getByLabel("Email").fill("mei@example.com");
  await meiElsewhere.getByRole("button", { name: "Send my answers" }).click();
  await expect(meiElsewhere.getByText(/We've emailed a private link/)).toBeVisible();

  await page.getByRole("link", { name: "Open your poll's dashboard" }).click();
  await expect(page.getByText("2 of 3")).toBeVisible();
  await expect(page.getByText("sample calendar connected")).toBeVisible();
});
