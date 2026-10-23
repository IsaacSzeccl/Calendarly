---
doc: scope
status: draft
---

# Calendarly

A standalone, calendar-aware poll for scheduling meetings with external parties. An AI reads the organizer's free-form constraints and explains the trade-offs between time slots.

*Updated from the learner's revised PRD brief of 2026-10-23, which overrides the earlier scope draft where they conflict. The "Family & Friends AI Scheduling Assistant" PRD in Claude Docs was rewritten to match.*

## The Unique Kernel
A hybrid poll that is calendar-aware. A guest with no account can just vote. A guest who connects Google Calendar gets matched on free/busy status. The organizer types constraints in plain language ("not Friday afternoons, Tom hates mornings, keep it under 90 minutes") and the AI turns them into ranking behavior and explains the trade-offs ("Option A has everyone but is at 8am; Option B works better but Sam can't make it"). Plain overlap is computed in code; the AI interprets requirements and explains. The poll advises, and the organizer picks.

Standalone, with no Teams integration. Microsoft Teams' Scheduling Assistant is the main competitor and is strongest for internal scheduling. Calendarly targets external parties, where email ping-pong and Doodle polls are the pain.

## Who It's For
A consultancy lead scheduling a workshop with about 6 people at a client company. Today they run email ping-pong or a Doodle poll. Internal meetings work the same way and get one line of mention only. Family and friends move to Later.

## The Core Loop
1. The organizer logs in, connects Google Calendar, and creates a poll. The initial options come from their free time.
2. They optionally type free-form constraints.
3. They share a link. Guests need no account.
4. Each guest either votes on the options (or adds a time they can do), or optionally connects Google Calendar so free/busy is matched against the options.
5. The AI may add up to 3 new slots when connected guests' availability shows better options. Earlier voters get a "new options added" email.
6. The organizer sees a ranking with plain-language explanations that say what they are based on ("based on 3 connected calendars and 2 votes") and picks the final slot directly. There is no auto-lock.
7. The event is created on the organizer's calendar, and guests get a confirmation email with a one-click "add to calendar" link.

## Inspiration & Identity
- Doodle (https://doodle.com): simple shareable polls that need no account.
- Microsoft Teams Scheduling Assistant: the main competitor, strongest for internal scheduling.
- Feel: extremely easy for beginners. Guests respond from a link without creating an account.

## Why This Matters to the Learner
They find scheduling with many people hard, and they see a product they could monetize and grow users for later. It is also a chance to use their saved Claude Code extensions and agentic workflows to speed up the build, and to learn more about web stacks and AI.

## What "Working" Looks Like
A demo video that tells the consultancy story, with a before-and-after: a real email ping-pong thread versus the same task in Calendarly.

Demo path: the organizer creates a poll and constraints, shares the link, one guest votes without logging in, one guest connects a calendar, the AI adds a slot, an earlier voter is notified, the organizer picks a slot, and the event and confirmation email go out.

The "oh, that's cool" beat is the AI adding a slot and explaining the trade-off.

Real Google test accounts are used wherever possible; any seeded or fake accounts are labeled honestly.

## The POC Boundary
- Google Calendar only.
- Organizer login, calendar connection, and poll creation with initial options from their free time.
- Free-form constraints parsed by the AI.
- A shareable link with guests who need no account: vote, add a time, or optionally connect Google Calendar.
- Ranking with plain-language explanations that state their basis.
- AI-added slots (at most 3 per poll) and the "new options added" email.
- The organizer picks the slot directly, the event is created on their calendar, and a confirmation email goes out with an add-to-calendar link.

## Open Decisions
- **Saved roster and "meet again":** this was the kernel in the earlier scope draft. The new flow is larger. Keep it in this build, or move it to Later? Not decided yet. Recommendation: move it to Later, since the new flow already covers guest voting without accounts, AI-added slots, and two kinds of email.
- **How many demo accounts are real Google accounts?** Not decided yet.
- **Earlier request form** (title, duration category, rough timeframe): not in the new brief. Does it still apply, or are duration and timeframe covered by free-form constraints?

## Later
- Outlook and Apple calendars.
- Groups of 50+.
- Monetization.
- Native mobile apps.
- Family-and-friends positioning.
- Saved roster and "meet again" (pending the decision above).

## Explicitly Cut
- **Teams integration:** the learner chose a standalone product so it can be monetized later.
- **Auto-lock voting:** the poll advises, and the organizer picks directly.
- **AI-generated alternative meeting lengths:** the AI may mention a different length in an explanation but doesn't generate slots of new lengths.
- **Other calendar providers:** each is its own OAuth setup and set of bugs.
