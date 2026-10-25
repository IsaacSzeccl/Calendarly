# Calendarly

A calendar-aware group poll. The organizer describes a meeting in plain language; guests answer from a link with no account, can connect Google Calendar, or say when they're free in their own words. An AI explains the trade-offs between times ("If Leo must be there, choose option 4; otherwise option 1 works for 4 of 5"), and the organizer picks.

**Code decides, the model interprets.** Free time, slot candidates, the cap of 3 AI-added slots, ranking and conditional advice are plain, tested code (`src/lib/engine`). The model (GLM via Z.ai) does three jobs only: read the organizer's description (`parsePoll`), read a guest's availability (`parseStatement`), and write the note (`explain`). Every answer must pass a schema first, and every call is logged in the `ai_runs` table.

## Run it

Requires Node 22 and the services in `.env` (Supabase, Z.ai, Google OAuth, Brevo).

```bash
npm install
npm run check:env     # lists which settings are present (never prints values)
npm run dev           # http://localhost:3000
```

Without signing in you can try the description step on a sample calendar. To sign in with Google and connect your calendar, the Google OAuth client needs these authorized redirect URIs:

- `http://localhost:3000/api/calendar/callback` (and the same path on the deployed domain)
- `https://<your-project>.supabase.co/auth/v1/callback` (Supabase sign-in)

To try everything without Google, start with `E2E_TEST_MODE=1 npm run dev` and use the "Test sign-in" link. It signs you in as a test organizer with a sample calendar. Never set `E2E_TEST_MODE` in production.

## Tests

```bash
npm test                # engine unit tests (slots, timezones, ranking, cap, advice)
npm run test:evals      # AI golden cases against recorded answers
LIVE=1 npm run test:evals   # the same cases against the real model
npm run test:e2e        # the demo path in a browser (needs Supabase settings)
```

The end-to-end test builds the app, runs it with the recorded model and sample calendar, creates a poll as a test organizer, answers as two guests (one in plain language), picks a time, and then deletes what it created.

## The demo

```bash
npm run demo:seed                    # demo poll owned by the test organizer (view with E2E_TEST_MODE=1)
npm run demo:seed -- you@gmail.com   # owned by you, after you've signed in once
```

This seeds a six-person group project for next week in which no time suits everyone. Sam must attend. Sam, Leo, Mei and Jordan are **sample guests with made-up answers**, and the app labels them that way. Priya is left unanswered so she can answer live, in plain language, during the recording.

## Layout

```
src/lib/engine     slots, constraints, ranking, conditional advice (pure, tested)
src/lib/ai         complete(), schemas, parsePoll, parseStatement, explain, mock model
src/lib/calendar   CalendarProvider: Google, sample calendars, in-memory fake
src/lib/db         Supabase server client and queries (server only)
src/lib/email      Brevo SMTP sender and the three emails
src/app            pages: /new, /p/[token] (guest), /poll/[id] (dashboard), API routes
supabase/migrations  table definitions
devpost/           planning documents (scope, PRD, spec, build checklist)
```
