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
  await priya.getByRole("button", { name: "Looks right" }).click();
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
