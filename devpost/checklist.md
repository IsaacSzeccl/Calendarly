---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast. The learner asked for an unattended build ("continue building the code and testing, and only ask me questions at the end"), so hands-on checkpoints move to one session at the end. They can switch to learn mode at any time. Confirmed at the end-of-build session: "Keep fast mode first".

## Slices

- [x] **1. Describe a meeting and see what the AI understood, with the first time options**
  Becomes usable: A running site where the organizer types the Tom/Jamie description at `/new` and sees the poll as the AI read it (people, required, window, duration, hours, constraints) plus about 5 first options taken from the organizer's free time on a sample calendar. Nothing is saved yet.
  Why now: The model is the riskiest unfamiliar part (Z.ai endpoint, model ID, output format) and is half of the kernel. Bootstrapping, the "code decides, the model interprets" rule, and the slot engine all start here so every later slice builds on them.
  PRD ref: `prd.md > Poll creation in plain language`, `prd.md > Screens and Layout > Organizer: Create Poll`
  Spec ref: `spec.md > Stack`, `spec.md > AI Layer`, `spec.md > Slot and Ranking Engine (pure code)` (`buildCandidatePool`, `chooseInitialOptions`), `spec.md > Calendar Adapter`, `spec.md > Look and Feel`, `spec.md > File Structure`
  Build: Scaffold Next.js (App Router, TypeScript, Tailwind with the warm-planner tokens and Fraunces/DM Sans), Vitest, and an env-name check. Add `lib/config.ts`, `lib/ai` (`complete()` with zod check, one retry, `ai_runs` logging hook, `parsePoll`), the engine's candidate pool and initial options (15-minute step, reasonable hours per timezone, hard constraints), the `CalendarProvider` interface with the seeded and fake providers, and the `/new` page that previews the AI's reading and the options.
  Verify (mechanical): `npm run build` passes; `npm test` passes the engine unit tests (Jamie in Europe/London, 15-minute step, reasonable hours, hard "no Tuesdays"); `npm run test:evals` passes the mocked Tom/Jamie golden case; one `LIVE=1` eval run against Z.ai is recorded; the dev server returns the preview for the Tom/Jamie text.
  Learner check: Run `npm run dev`, open `http://localhost:3000/new`, paste the Tom/Jamie example, and check that the summary and the five times match what you meant.
  Commit: `Plain-language poll preview with first options`

- [x] **2. Create the poll, share the link, and a guest answers it**
  Becomes usable: "Create poll" saves the poll and its options and shows a share link with a copy button. Opening `/p/<token>` with no account shows the Doodle-style form (claim a listed name or type one, email, yes / prefer not / no per option). After submit the guest sees a confirmation; returning shows their saved answers; a closed poll is read-only.
  Why now: The poll link is the spine of the whole journey, and the data model is the first place the plan can be wrong.
  PRD ref: `prd.md > Guest response`, `prd.md > Screens and Layout > Guest: Poll Page`, `prd.md > States and Boundaries` (returning guest, poll closed, permissions)
  Spec ref: `spec.md > Data Model`, `spec.md > Guest Identity (no accounts)`, `spec.md > Components > Guest Poll page`, `spec.md > Poll Completion and Closing`
  Build: Write `supabase/migrations/` (all eight tables, server-only access, RLS on with no public policies) and apply them to the Calendarly Supabase project. Server-side Supabase client, organizer session (test login behind `E2E_TEST_MODE` until slice 5), create-poll API, guest page, submit API with the guest cookie, `ai_runs` rows written for real.
  Verify (mechanical): Unit tests still pass; migration applied and listed by Supabase; through the dev server: create a poll, load `/p/<token>` without a session, submit votes, reload with the cookie and see them, and confirm the rows exist via SQL.
  Learner check: Create a poll, open the share link in a private window, vote as "Sam", reopen the link and see your answers still there.
  Commit: `Save polls and let guests answer from the link`

- [x] **3. The organizer sees the ranking, the AI note and conditional advice, and picks a slot**
  Becomes usable: The dashboard at `/poll/<id>` shows the people list with "X of Y", votes per option, fuzzy labels, an AI note that names the trade-off and its basis, conditional advice when no option suits everyone ("If Sam must be there, choose option 2"), close poll, and pick. Picking records the final slot, creates the event through the calendar provider, and sends the confirmation email with an add-to-calendar link. The "X of Y have filled in" email goes to the organizer when the expected count is reached.
  Why now: This is the kernel's payoff (explaining trade-offs). With slices 1-2 it completes the demo's main path, so the early hands-on check has something real to judge.
  PRD ref: `prd.md > Ranking and AI summary`, `prd.md > Finalizing`, `prd.md > Poll completion and closing`, `prd.md > Screens and Layout > Organizer: Poll Dashboard`, `prd.md > Emails`
  Spec ref: `spec.md > Slot and Ranking Engine (pure code)` (`statusFor`, `scoreSlot`, `labelFor`, `rank`, `conditionalAdvice`, `isComplete`, `basisText`), `spec.md > AI Layer` (`explain`), `spec.md > Email`, `spec.md > Poll Completion and Closing`
  Build: Engine scoring, labels, ranking, `onlyIfNecessary`, conditional advice, completion and basis text with unit tests; the `explain` job with a deterministic fallback when the model fails; the dashboard; close and pick APIs; Brevo SMTP sender with `email_log`; confirmation and poll-update emails.
  Verify (mechanical): Unit tests for every engine rule (required "no" never above Not recommended; Recommended needs no "no"; conditional advice picks the right option); mocked `explain` eval passes; through the dev server: the dashboard renders for the organizer and refuses a guest; pick writes `final_option_id`; `email_log` records each send (real Brevo send to the organizer's own address if SMTP is configured).
  Learner check: With three guests' answers in, open the dashboard and read the note: does it say what you'd say about the trade-off? Pick a slot and check the confirmation email.
  Commit: `Dashboard with ranking, AI note, conditional advice and pick`

- [x] **4. A guest types their availability, confirms what the AI understood, and new slots appear**
  Becomes usable: Near the end of the guest form, "Tuesday or Wednesday afternoons, not Mondays" turns into a "What I understood" panel (dates, times, timezone, changeable). On "Looks right", code adds up to 3 slots where the organizer is free, marks them AI-added, and emails earlier voters "new options added". The guest's preferences appear on the organizer's dashboard and score as soft penalties.
  Why now: The demo's "oh, that's cool" beat and the other half of the kernel; it needs slices 2-3 to show its effect.
  PRD ref: `prd.md > Guest plain-language availability`, `prd.md > AI-added slots`, `prd.md > Screens and Layout > Guest: "What I Understood" Step`, `prd.md > States and Boundaries` (AI cannot understand, statement yields no free time, cap reached)
  Spec ref: `spec.md > AI Layer` (`parseStatement`), `spec.md > Slot and Ranking Engine (pure code)` (`addAiSlots`), `spec.md > Components > "What I understood" step`, `spec.md > Important Failure Modes`
  Build: `parseStatement` with golden-case evals; statement and confirm APIs; `addAiSlots` (intersect with organizer free time, dedupe, cap 3) with unit tests; the panel; the new-options email; soft preferences fed into scoring.
  Verify (mechanical): Unit tests for the cap, busy-time exclusion and duplicates; mocked and one `LIVE=1` eval for "Tuesday or Wednesday afternoons, not Mondays"; through the dev server: a statement produces an interpretation and nothing is saved until confirm; confirm adds at most 3 slots; unreadable text returns the rephrase message.
  Learner check: As a guest, type when you're free in your own words, check the panel, press "Looks right", and see the new times appear for the next guest.
  Commit: `Guest plain-language availability adds confirmed slots`

- [x] **5. Real Google: the organizer signs in and connects Calendar; a guest can connect for pre-filled marks**
  Becomes usable: Sign in with Google (Supabase), a separate "Connect Google Calendar" step, real free/busy for the organizer's options and AI-added slots, the picked slot created on the organizer's real calendar, and an optional guest connection that pre-fills yes/no marks the guest can change. Disconnect revokes the token. Expired tokens are flagged with "reconnect".
  Why now: It depends on the learner's Google Cloud and Supabase provider setup, which can't be completed unattended; everything before it runs on the sample calendar behind the same interface, so swapping in Google changes no other code.
  PRD ref: `prd.md > The Core Journey` (steps 1, 4, 9), `prd.md > Privacy`, `prd.md > States and Boundaries` (calendar connection fails, unverified app)
  Spec ref: `spec.md > Calendar Connections`, `spec.md > Calendar Adapter`, `spec.md > External Services and Dependencies` (Google OAuth and Calendar API), `spec.md > Important Failure Modes`
  Build: Supabase Google sign-in with `@supabase/ssr`; calendar OAuth connect/callback/disconnect with encrypted refresh tokens; `GoogleCalendarProvider` (`freeBusy`, `events.insert`); guest connect and pre-filled marks with "explicit vote wins".
  Verify (mechanical): Unit tests for token encryption and the Google response mapping (fake HTTP); build passes; the OAuth start route redirects to Google with the right scopes and redirect URI; a live free/busy call succeeds if a connected test account is available, otherwise recorded as pending the learner.
  Learner check: Sign in with your Google account, connect your calendar, create a poll, and check that the options avoid your busy times; pick one and see it on your calendar.
  Commit: `Google sign-in, calendar connection and real free/busy`

- [x] **6. Demo-ready: six demo people, the warm-planner design, and an automated demo-path test**
  Becomes usable: A seeded demo (organizer + 5 guests, sample calendars labeled honestly) that produces the "no perfect slot" case; the full warm-planner design on every screen (light and dark, icons with every color); the Playwright test that runs the demo path; CI on every push.
  Why now: Polish and the demo scenario only make sense once the whole journey works; the e2e test locks it in before deployment.
  PRD ref: `prd.md > Demo and Success Criteria`, `prd.md > Look and Feel`
  Spec ref: `spec.md > Look and Feel`, `spec.md > Test Suite`, `spec.md > Decisions and Open Issues` (demo calendars)
  Build: Demo seed script and sample calendars; design pass with the `frontend-design` skill; Playwright demo path using the fake calendar, mock model and test login; `.github/workflows/ci.yml`; README with run/test/demo steps.
  Verify (mechanical): `npm run test:e2e` passes the demo path; unit and mocked evals pass; screenshots of each screen at phone and desktop width reviewed; CI workflow file validated.
  Learner check: Run the demo seed, open the dashboard, and judge whether the "no perfect slot" story reads clearly in under a minute.
  Commit: `Demo scenario, warm-planner design and demo-path test`

- [ ] **7. Live on Vercel**
  Becomes usable: The app deployed on Vercel at a stable URL with its environment variables, so others can try it.
  Why now: Deployment is last for the core because it needs every secret in Vercel and the Google redirect URIs for the live address.
  PRD ref: `prd.md > Demo and Success Criteria`
  Spec ref: `spec.md > Where It Runs and How Someone Tries It`, `spec.md > External Services and Dependencies` (Vercel)
  Build: Link the Vercel project, confirm the environment variables exist (names only), deploy a preview, then production if the learner agrees.
  Verify (mechanical): Deployment reaches READY; the landing page and `/p/<token>` of a demo poll load on the live URL; runtime logs show no errors.
  Learner check: Open the live URL on your phone and answer a demo poll as a guest.
  Commit: `Deploy configuration for Vercel`

- [x] **8. Stretch: meet again with the same group**
  Becomes usable: A "Remember me for future meetings with this organizer" checkbox for guests, and "New meeting with this group" on the dashboard that reuses consenting guests' calendars. Built only if slices 1-7 are done and tested; otherwise narrated as "next" in the demo.
  Why now: Lowest priority by the learner's decision.
  PRD ref: `prd.md > Product Decisions` (roster and "meet again"), `prd.md > Deferred From the POC`
  Spec ref: `spec.md > Meet Again (stretch, last build slice)`
  Build: Consent flag, copy consenting guests into a new poll, use stored calendars to propose slots, disconnect removes consent.
  Verify (mechanical): Unit test for who gets copied; through the dev server, a new poll from the dashboard contains only consenting guests.
  Learner check: Tick "remember me" as a guest, then start a new meeting with the group and see that guest already included.
  Commit: `Meet again with the same group`

## Hands-on Checkpoints

- [x] Early usable behavior explored: after slice 3 (create, answer, ranking with conditional advice). Moved to the end-of-build session because the learner is away during the build; covered by the learner's first hands-on session (feedback in `Calendarly-changes-v0.1.pdf`).
- [x] Final kick-the-tires exploration and feedback completed — first round: the learner ran the demo, answered as Priya, tried calendar connect and pushed to GitHub; their notes are the Final Review items below.

## Final Review

Feedback from the learner's first hands-on session (fixed, verified by the agent; each waits for the learner to retry it):

- [ ] Make the best options more apparent — the top time is highlighted ("Best time", or "Closest fit" when no time suits everyone); on wide screens the ranking and the AI note sit side by side so the best time is visible without scrolling. Fixing it exposed a ranking bug: a late-added time with one "yes" and four blanks outranked one with four "yes" and one "no"; blanks now count as unknown (half a "no").
- [ ] "Check what I meant" said "I couldn't read that" for "I am less free this week. Prefer a meeting next week." — the model had understood it but named no times inside the poll. Code now gives the model the calendar weeks ("next week" from a Sunday starts tomorrow), vague periods become 09:00–18:00 the guest can correct, and words with no times in the poll can be passed on as a note instead of failing.
- [ ] "None of these work?" was ambiguous — now "Suggest a different time", with "Can't make the times above? Tell the organizer when you can, in your own words."
- [ ] CI failed after the push (`Cannot find name 'PageProps'`) — the typecheck now runs `next typegen` first, reproduced and fixed in a clean checkout.
- [ ] Google "Access blocked: has not completed the verification process" — the OAuth app is in Testing mode; the learner's account must be added as a test user in Google Cloud (learner step).
- [ ] "Cannot see full screen on computer" — the screenshot was the agent's Playwright test browser, left at phone width (412 px); the app itself fills a desktop window. The dashboard now also uses the extra width.
- [ ] Better incentives to connect calendars — the calendar card now sits above the times and says what connecting does (fills every answer, suggests times that fit both calendars, gives a truer picture, lets your calendar answer next time); it shows how many others connected.
- [ ] A connected calendar also suggests new times (learner's answer to question 3) — free for the guest and the organizer, favouring times other connected guests are free, one tap to add, sharing the cap of 3 guest-added times.
- [ ] Slice 8, meet again, built (learner request).
Feedback from the learner's second session (`user_feedback/Calendarly-changes-v0.2.docx`; fixed and verified by the agent, each waiting for the learner to retry):

- [ ] "Date.now() while prerendering" error on the guest page with a sample calendar — the page shell is prerendered with the visitor's cookies, and the guest page and dashboard read the clock during it; both now call `connection()` first (Next 16's documented fix).
- [ ] Let guests add a time to the poll themselves — "Suggest a time" now has a day and time picker; it lists only times the organizer is free, the rules allow and nothing clashes with, and the add route checks again.
- [ ] Shorter AI note — the prompt asks for one or two sentences (35 words at most) with short per-option fragments, and the schema caps the lengths; repeated per-option lines are shown once.
- [ ] Less wordy, cleaner site — copy cut on every screen; the dashboard merges "Everyone's answers" and "People" into one Answers table; a poll with no answers shows the share link and its times instead of an empty ranking; rarely needed poll settings sit under "More options".
- [ ] Logo and brand identity — a diary page with the brick-red ribbon marker (the same ribbon that marks the AI note); used in the header, browser tab icon, home-screen icon, link-preview image and email header.
- [ ] Create page: one button, then straight to the dashboard — the times now update on their own after an edit, so "Update the times" is gone; "Create poll" opens the new poll's dashboard with the link to share.
Feedback from the learner's third session (`user_feedback/Calendarly-changes-v0.3.docx`; fixed by the agent, each waiting for the learner to retry):

- [ ] "Critical error: the calendar only shows all yes" — checked against Google itself with the learner's own connected calendar (`scripts/diag-busy.ts`): free/busy is correct and matches the calendar picture once converted. The picture shows the calendar in US Eastern time, 12 hours behind the poll's Hong Kong times, so e.g. Wed 14:45–16:45 Hong Kong is Wed 02:45–04:45 Eastern, which really is free. Nothing was wrong with the data; the app just gave no way to see that. Each calendar-filled answer now says why ("Busy 14:45–16:15 on your calendar" / "Free on your calendar"), and the guest can choose the timezone the times are shown in to match their calendar. Unit tests pin that answers are exact instants whatever zone they are shown in.
- [ ] "Votes should not be saved when the calendar is connected — only when Save my changes is clicked" — connecting a calendar, adding a time or checking a statement now saves only who the guest is (so the calendar has an owner), never their answers, and the guest doesn't count as answered (dashboard, "X of Y", emails) until they press Send / Save (`guests.submitted_at`, migration `20261026000000_guest_submitted.sql`). A "Not sent yet" reminder shows until they do.
- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: not started
Route and stops: not started
Edit outcome: not started
Reflection: not started
Activity mode: not started

## Revisions

- Plan approved and built without a gut check — the learner asked for an unattended build with all questions at the end, so the build order is reviewed in the end-of-build session instead of before slice 1.
- A hard rule about one named guest ("Leo only does evenings") now predicts that guest's "no" instead of removing the slot; hard rules about the organizer or the whole meeting still remove slots — the live model's reading of the group example showed one guest's hard rule would otherwise wipe out every option and make the "no perfect slot" case impossible. The same applies to a guest's stated hours.
- AI calls send `reasoning_effort: "low"` instead of turning thinking off — the configured GLM model rejects `thinking: disabled` ("This model always engages in thinking").
- Email settings use the names already in `.env` (`BREVO_SMTP_HOST`, `BREVO_SMTP_PORT`, `BREVO_SMTP_USER`, `BREVO_SMTP_KEY`) — found by the env-name check.
- The mock model and sample calendar live in `src/lib/ai/mock.ts` and `src/lib/calendar/` rather than `tests/fakes/` — the end-to-end demo path runs them inside the app, not only in tests.
- Next.js 16.4 enables Cache Components by default; kept on, so request-time reads (cookies, sessions) sit behind `Suspense` — the spec predates this default.

- The same email on the same poll counts as the same guest when the cookie is missing (for example, a second device) — the spec only described the cookie; without this, one person answering twice would be counted twice in "X of Y".
- Database types are generated from the Supabase schema into `src/lib/db/database.types.ts` — the untyped client inferred unusable row types.
- A guest who answered the poll but left a time blank adds a small penalty, and "Recommended" needs no blanks from people who answered — on the first real dashboard a time only one person had marked was labeled Recommended.
- The AI note is checked for faithfulness (every option covered, only real option numbers, advice kept, no percentages) and falls back to a code-written note otherwise; a valid note for the same facts is reused from `ai_runs`, so reloading the dashboard doesn't call the model again.
- Emails to reserved test domains (`@example.com` and similar) are logged as skipped instead of sent — test guests would only bounce and hurt the Brevo sender's reputation.
- Guests add a time through the plain-language box rather than a separate "add a time" picker — the box already covers it ("Thursday from 3pm to 5pm") and keeps one path through the confirm step and the cap.
- Times a guest suggests start as a "yes" for that guest, and asking for a suggestion first saves their answers — a suggestion needs a known guest, and the suggester obviously can make it.
- Statement recordings use "@W+n" (poll start plus n days) — the model can read "next week" differently on a Sunday, so tests check what must hold (mornings, inside the poll's dates, timezone) and the guest's confirm step settles which week.
- Google's `freeBusy.query` accepts the narrow `calendar.freebusy` scope (checked against Google's reference), so guests grant free/busy only and organizers free/busy plus `calendar.events`; no fallback to `calendar.readonly` is needed.
- Live calendar checks are pending the learner: Google rejects `http://localhost:3000/api/calendar/callback` with `redirect_uri_mismatch`, so that address (and the production one later) must be added to the OAuth client's authorized redirect URIs. Supabase's Google sign-in reaches Google's login page correctly; the agent did not sign in with the learner's Google account.
- Visitors who aren't signed in can still try the preview on a labeled sample calendar; creating a poll needs sign-in and a connected calendar — lets someone see the idea before connecting anything, without faking real availability.
- Proposing new slots from a connected guest's calendar (not only from their typed statement) is not built — the statement path covers the demo's "adds slots" beat; raised with the learner at the end.
- The `explain` job refers to options by number instead of database ids — on the seeded demo the model garbled one id, so the faithfulness check rightly discarded the whole note; with numbers the live note passes.
- Seeded demo guests are marked `is_sample` (migration `20261025010000_sample_guests.sql`) and labeled "sample guest with made-up answers" on the dashboard — the spec required honest labels; their answers are seeded directly rather than computed from per-guest sample calendars.
- While the AI note loads, the placeholder ranking has no "Pick this time" buttons — the end-to-end test showed a click there could be lost when the finished ranking replaces it.
- The end-to-end test runs on port 3210 against a production build with the recorded model, using the real Supabase project and deleting its test polls afterwards; the CI end-to-end job runs only once the Supabase secrets are added to GitHub.
- Reversed: a guest is identified only by their private cookie, never by email — an independent code review showed that matching by email let anyone who knew a guest's address take over their answers and calendar; a second answer with the same email now gets a clear message instead.
- Fixes from the same review: calendar connections are updated in place so reconnecting keeps old polls working; the AI-slot cap of 3 is also enforced by a database trigger (`20261025020000_ai_slot_cap.sql`); picking a time is claimed atomically so a double click can't create two events; a failed statement confirm no longer uses up the statement; sign-in redirects compare origins (`src/lib/safeNext.ts`); the test sign-in only accepts `test:` ids and never runs in Vercel production; anonymous description previews are limited per IP; clock overlaps are exact to the minute.
- Slice 7 waits on the learner: the Vercel project `calendarly` exists and is linked to GitHub, but has no environment variables, its `vercel.app` addresses sit behind Vercel's login wall (guests couldn't open poll links), and the production Google redirect URI isn't registered. The agent doesn't enter secrets or push code without being asked. Slice 8 (stretch) is planned after slice 7, so it hasn't started.
- End-of-build answers: build order approved ("Looks good"); fast mode kept; a connected guest calendar should also suggest new times; don't open a pull request yet. The learner had already pushed the branch, which surfaced the CI failure.
- Reversed: proposing new slots from a connected guest's calendar is now built (`calendarSuggestions` in the engine, `src/lib/polls/calendarSuggest.ts`, `/api/guest/calendar-add`) — the learner asked for it. Calendar-added times use the existing `guest_added` source and share one cap of 3 with typed suggestions (`20261025030000_guest_slot_cap.sql`); `aiSlotCap` became `guestSlotCap`.
- Test mode adds "Use a sample calendar (test mode)" for guests, a labeled sample calendar stored as a connection with scope `sample` — Google blocks real guest calendars until the learner's account is a test user, and the end-to-end test needs a calendar it can connect. It is unreachable outside test mode, never revoked with Google, and labeled "sample calendar" on the dashboard.
- Blanks from people who answered now cost 5 (15 for someone who must attend) instead of 1, and blanks alone can't make a time "Not recommended" — the learner's dashboard showed a time nobody else had seen ranked first.
- Statement parsing: code computes "this week" and "next week" and passes them to the model; a statement with no times inside the poll but a clear preference is saved as a note (outcome `note`) instead of being rejected.
- The layout is wider on desktop (`max-w-5xl`); forms keep a reading width and the dashboard puts the AI note beside the ranking.
- Slice 8 was built before slice 7 — slice 7 waits on the learner's Vercel and Google setup, and the learner asked for slice 8 now. Meet again only brings guests who ticked "remember me" and still have a working calendar connected, because their calendar is what answers for them; it is offered only once a calendar is connected. Copied guests get a "meet_again" email (`20261025040000_meet_again.sql`) with a private link (`/api/guest/claim`) that sets their cookie for the new poll. Disconnecting withdraws "remember me" everywhere that calendar was used. Earlier poll-specific preferences are not copied.
- An independent review of this round found one high and five medium issues, all fixed and re-checked: unticking "remember me" now clears it on every poll that calendar was brought into (it only cleared one copy, so an earlier poll could still bring the guest along); the private link uses a single-use code (`guests.claim_token`) instead of the guest's long-lived token, and never replaces an identity the browser already has; answering with an email that already has answers emails that address a private link instead of a dead end (this also covers a guest on a second device); blanks are exempted from "Not recommended" only for their own points; calendar suggestions never break the guest page; a note-only statement no longer needs the organizer's calendar. Smaller fixes: suggestions only on open polls, a rate limit on calendar adds, the dashboard lists only people `/new` will bring, the roster dedupes by email, a failed copy never makes the organizer create a poll twice, the test-mode sample calendar removes and revokes a real connection first, and the top time reads "Closest fit" whenever someone can't come. Not fixed (low): two guests adding different but overlapping times at the same moment can both succeed.
- Second feedback round: guests can pick a time by hand (`/api/guest/add-time`, picker fed by `src/lib/polls/pickable.ts`), reversing the earlier "the typed box covers it" decision at the learner's request; it shares the cap of 3 guest-added times. The organizer's calendar "Disconnect" moved from the create page to the account menu in the header. The AI note's cache key now includes a style version, so notes written before the shorter style aren't reused.
- An independent review of the second round found one high and six medium issues; fixed and re-checked: the create page tracks which version of the details its times belong to, so an edit made while the times refresh can't be dropped and Create only works when the times on screen match the details (it also can't double-submit); a failed refresh says so and offers "Try again", an incomplete draft says what's missing instead of refreshing, and people can be removed; a re-read cancels a pending refresh; a poll with no answers still has Pick buttons and status-aware text; the organizer's "Disconnect calendar" asks first and reports failures; the picker stays mounted so its message survives the poll filling up, and it says when the organizer's calendar can't be checked; a unit test checks every offered time is accepted by the add route. Smaller: names next to each "no" count, timezones in the answers table, the "Prefer not" hint is back for guests answering by hand, `metadataBase` falls back to Vercel's address, copying the link falls back to selecting it, one shared `listNames`. Not done (low): route-level tests for `/api/guest/add-time`, a `/favicon.ico` for old browsers, and a database guard against two guests adding overlapping times at the same moment.
- Third feedback round: counting a guest as answered now needs an explicit Save (reversing the earlier behaviour where connecting a calendar answered for the guest immediately and the dashboard read their live calendar). Guests created by other paths (demo seed, meet again) default to answered. The timezone picker uses a fixed list of common zones so server and browser render the same options.

