# Handoff: from planning to `5-build`

State as of 2026-10-24. Branch: `claude/dreamy-edison-dhiusq`. Planning is complete; no application code exists yet.

## Where things stand
| Doc | Status |
|---|---|
| `devpost/scope.md` | approved |
| `devpost/prd.md` | approved |
| `devpost/spec.md` | approved |
| `devpost/checklist.md` | not created yet (`5-build` creates it) |
| `devpost/learner-profile.md` | git-ignored on purpose; copy it into the local checkout if it is missing. Run `5-build` from the project root so it can read it. |

HTML companions (`scope.html`, `prd.html`, `spec.html`) are generated from the Markdown, which is canonical. The learner's review format is HTML for planning documents; never create an HTML build checklist.

A longer PRD lives in Claude Docs: https://claude.ai/artifact/RSgq4P4hw7c9WK8J7xvcyQ. The build works from `prd.md` and `spec.md`; that document is background. It still lists email sign-in and Supabase-sent emails, which the spec drops.

## What is being built, in two lines
Calendarly: a standalone, calendar-aware poll. An organizer describes a meeting in plain language; guests (no account) vote yes / prefer not / no, optionally connect Google Calendar, and can type their availability in plain language. The AI explains trade-offs and gives conditional advice ("if Sam must be there, option 2"); the organizer picks.

**The rule that shapes everything:** code decides, the model interprets. Overlap, caps, "only the organizer's free time", ranking and conditional alternatives are deterministic code. The model does three jobs (`parsePoll`, `parseStatement`, `explain`) and its output must pass a zod schema first.

## Setup the learner does (not code)
1. Supabase project: URL, anon key, service-role key. Apply `supabase/migrations/` via the SQL editor, or connect a Supabase connector.
2. GitHub-linked Vercel project, with a stable production alias. Buy a custom domain through Vercel soon if the Google verification attempt is wanted (the `vercel.app` address cannot be verified).
3. Google Cloud: enable the Calendar API; OAuth consent screen External, Testing mode; web client; redirect URIs (Supabase's Google callback and `APP_URL/api/calendar/callback`); add the demo Google accounts as test users; use the same client in Supabase's Google provider.
4. Z.ai (GLM) API key and model ID; Brevo account, SMTP/API key and a verified sender.
5. Put values in `.env.local` (copy from `.env.example`) and in Vercel environment variables. Never commit secrets or paste them in chat.
6. GitHub Actions enabled on the repo.

Cloud sessions only: the environment's network policy blocked `api.z.ai`, `api.supabase.com`, `api.vercel.com` and `api.brevo.com` on 2026-10-23, and port 587 SMTP is unlikely to work there. Local sessions avoid this. In a cloud session, `localhost` cannot be opened by the learner and Google redirects must use the Vercel URL.

## Suggested build order (slices)
Put the end-to-end demo path first; the real Google calendar and real model arrive as early as possible.
0. Scaffold Next.js + TypeScript + Tailwind, Vitest, Playwright, GitHub Actions CI, `.env.example` check. Verify the unverified items below.
1. Engine (pure code) + unit tests: slots, constraints, status, rank, `addAiSlots` (cap 3), `conditionalAdvice`, `isComplete`, `basisText`.
2. AI layer + golden-case evals (Tom/Jamie example, "Tuesday or Wednesday afternoons, not Mondays"), mocked by default, `LIVE=1` for the real model. Open an `ai_runs` row with the learner here (their stated learning goal).
3. Calendar adapter (Google, sample, fake) + organizer sign-in and "Connect Google Calendar".
4. Organizer Create Poll + share link.
5. Guest page, "What I understood" step, AI-added slots, "new options added" email.
6. Dashboard (people, votes, preferences, "X of Y", ranking, conditional advice) + the organizer's "X of Y have filled in" email + close poll.
7. Pick a slot: Google event + confirmation email.
8. Design pass with the agreed look (warm "planner": off-white, serif headings, DM Sans-style body, green/amber/grey with icons), Playwright demo-path test, deploy.
9. Demo calendars for 6 accounts that produce a "no perfect slot" case; record the 1–3 minute demo.
10. Stretch, last priority: "meet again" with a "remember me" consent and disconnect. If unbuilt, narrate it as "next" and do not fake it.

## Verify early (all unverified)
- Current stable Next.js and the Node version it needs (the cloud sandbox had Node 22).
- Which scope Google's `freeBusy.query` accepts: `calendar.freebusy` or `calendar.readonly`? Reference pages disagree.
- Testing-mode Google refresh tokens: believed to expire after about 7 days. The learner will test this; record the demo in one sitting.
- Z.ai model ID, base URL (coding-plan keys differ), and whether a JSON mode exists. The design does not rely on one.
- Brevo sender verification and free-tier limits.
- Vercel function time limit (AI calls), and whether cron jobs fit the plan (only for the optional scheduled close-time email).

## Decisions to keep (do not reopen without the learner)
- Standalone product; no Teams integration; Google Calendar only.
- The organizer shares the link themselves; the app sends no invitation emails. Three emails only: confirmation and "new options added" (to guests), "X of Y have filled in" (to the organizer).
- Guests need no account; name and email required; a link token plus cookie identify them.
- Poll advises; the organizer picks; no auto-lock. AI-added slots: only where the organizer's calendar is free, at most 3 per poll (config value).
- Demo: 1–3 minutes, 6 people, a university group-project scenario; centerpiece is "no perfect slot" with conditional advice and a slot added from a guest's plain-language statement. Seeded accounts are labeled honestly. Nothing is claimed about 20-person groups.

## Proposed in the spec, awaiting explicit learner agreement
Google-only sign-in; server-only database access; no webhooks or background jobs; add-to-calendar link instead of writing to guests' calendars; 30-minute slot grid and 60-minute default; vote weights (yes 1.0, prefer not 0.5, no 0) with an explicit vote overriding a connected calendar; fonts Fraunces and DM Sans. The learner approved the spec as a whole, so treat these as accepted unless they object, and flag any that cause trouble.

## Learner's goals worth honoring in the build
Use their Claude Code extensions and agentic workflows (ask which); Vercel's MCP server and deploy plugin ([docs](https://vercel.com/docs/agent-resources/vercel-mcp)); Anthropic's `frontend-design` skill with `prd.md > Look and Feel` as the brief ([overview](https://claudelog.com/faqs/what-is-frontend-design-skill-in-claude-code/)); fully automated tests; understanding the AI architecture. Verify install commands against official docs before running them.

## Submission reminders
A short demo video and a public GitHub repository are required. A live URL is optional and does not replace either. Keep secrets out of the repo.
