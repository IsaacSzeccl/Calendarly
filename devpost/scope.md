---
doc: scope
status: approved
---

# Calendarly

A standalone, calendar-aware poll for scheduling meetings with external parties. An AI reads the organizer's free-form constraints and explains the trade-offs between time slots.

*Updated from the learner's revised PRD brief of 2026-10-23, which overrides the earlier scope draft where they conflict. The "Family & Friends AI Scheduling Assistant" PRD in Claude Docs was rewritten to match.*

## The Unique Kernel
A hybrid poll that is calendar-aware. A guest with no account can just vote. A guest who connects Google Calendar gets matched on free/busy status. The organizer types constraints in plain language ("not Friday afternoons, Tom hates mornings, keep it under 90 minutes") and the AI turns them into ranking behavior and explains the trade-offs ("Option A has everyone but is at 8am; Option B works better but Sam can't make it"). Plain overlap is computed in code; the AI interprets requirements and explains. The poll advises, and the organizer picks.

Standalone, with no Teams integration. Microsoft Teams' Scheduling Assistant is the main competitor and is strongest for internal scheduling. Calendarly targets external parties, where email ping-pong and Doodle polls are the pain.

## Who It's For
**The coaching story.** In a student coach program, the main coach had to arrange a meeting with a group of student coaches. We used Doodle, WhatsApp votes, and Google Calendar scheduling, and people kept asking for more timeslots "because of this, because of that".

**The demo scenario** is a university but work-like one: a student organizing a group project meeting with a bunch of other students *(assumption: chosen because it resonates with most viewers; the coaching story stays as the origin of the idea)*. **Second example:** friends and group scheduling (group projects, society members, friend gatherings), usually 7–8 people.

The organizer is anyone who coordinates a group: a coach, a society organizer, a project lead, or someone planning a gathering. Guests are the group's members. "External parties" stays as the broad positioning. Today these organizers juggle Doodle, group-chat votes, and calendar checks.

## The Core Loop
1. The organizer logs in, connects Google Calendar, and creates a poll in plain language (including who is required and how many people to expect, and optionally when the poll closes). The initial options come from their free time.
2. They optionally type free-form constraints in plain language: their own constraints plus those of the group (for example "Tom only does evenings because of work, and the coach can't do Tuesdays"). Poll details can also be entered in plain language, and the AI helps fill them in.
3. They share the link themselves, in whatever channel they use (WhatsApp, email, a chat). The app sends no invitation emails. Guests need no account.
4. Each guest gives an email address and can vote on the options (or add a time they can do), state their availability in plain language (for example "Tuesday or Wednesday afternoons, not Mondays"), or optionally connect Google Calendar so free/busy is matched against the options, with their marks pre-filled for them to change. Guests can also describe their preferences so the organizer sees them.
5. Before slots are added from a guest's statement, the guest sees what the AI understood (dates, times, their timezone) and confirms or corrects it.
6. The AI may add up to 3 new slots (cap under review) from connected guests' availability or from a guest's confirmed statement, so this works for guests who never connect a calendar. It only adds slots the organizer's connected calendar shows as free. Earlier voters get a "new options added" email.
7. The organizer is emailed when everyone expected has filled in (for example "6 of 6 have filled in") or when the poll closes.
8. The organizer sees a ranking with plain-language explanations that say what they are based on ("based on 2 connected calendars, 2 votes, and 1 stated availability"). When no option suits everyone, the AI gives conditional advice ("if Sam must be there, choose option 2; otherwise option 1"). The organizer picks the final slot directly. There is no auto-lock.
9. The event is created on the organizer's calendar, and guests get a confirmation email with a one-click "add to calendar" link.

## Inspiration & Identity
- Doodle (https://doodle.com): simple shareable polls that need no account.
- Microsoft Teams Scheduling Assistant: the main competitor, strongest for internal scheduling.
- Feel: extremely easy for beginners. Guests respond from a link without creating an account.

## Why This Matters to the Learner
They find scheduling with many people hard, and they see a product they could monetize and grow users for later. It is also a chance to use their saved Claude Code extensions and agentic workflows to speed up the build, and to learn more about web stacks and AI.

## What "Working" Looks Like
The pitch tells the coaching story at the demo's size: a coach and 5 student coaches, 6 people *(assumption)*. The demo video includes a before-and-after: a group-chat and poll back-and-forth versus the same task in Calendarly *(assumption)*.

The centerpiece is the "no perfect slot" case: the AI explains the trade-off with conditional advice and adds slots from a guest's plain-language statement.

The demo video is 1–3 minutes.

Demo path: the organizer describes a group project meeting for 6 students (including who is required), shares the link, one guest votes without logging in, one guest connects a calendar and sees their marks pre-filled, one guest describes a preference and states availability in plain language and confirms what the AI understood, the AI adds slots where the organizer's calendar is free, an earlier voter is notified, the organizer receives the "6 of 6 have filled in" email, sees the ranking with conditional advice, picks a slot, and the event and confirmation email go out. Last priority: "meet again" with the same group.

The "oh, that's cool" beat is the AI adding slots from a plain-language statement and explaining the trade-off.

The demo uses 6 accounts (the organizer and 5 guests) *(assumption)*, real Google test accounts wherever possible, with calendars designed to produce a "no perfect slot" case. Any seeded or fake accounts are labeled honestly. The pitch story and the demo are the same size, and nothing is claimed about larger groups.

## The POC Boundary
- Google Calendar only.
- Organizer login, calendar connection, and poll creation with initial options from their free time.
- Free-form constraints parsed by the AI (the organizer's own plus the group's), including who is required and how many people to expect, with an optional close time for the poll.
- A shareable link with guests who need no account (they give an email address): vote, add a time, state availability in plain language, or optionally connect Google Calendar.
- Guest plain-language availability: the AI turns the statement into concrete slots, shows the guest what it understood (dates, times, timezone) for confirmation or correction, and adds only slots the organizer's connected calendar shows as free.
- Pre-filled marks for guests who connect a calendar, and guest preferences visible to the organizer.
- Ranking with plain-language explanations that state their basis (connected calendars, votes, and stated availability), plus conditional advice when no option suits everyone.
- The organizer's "X of Y have filled in" email.
- AI-added slots (at most 3 per poll for now), from connected calendars or guest statements, and the "new options added" email.
- The organizer picks the slot directly, the event is created on their calendar, and a confirmation email goes out with an add-to-calendar link.

## Open Items
- **Demo calendars:** design the 6 demo accounts' calendars to produce a "no perfect slot" case. This is to be done with Claude, and each account is real or seeded as needed.
- **Relative phrases and timezone:** how are phrases like "next week" and the guest's timezone confirmed? The guest confirms or corrects what the AI understood; the mechanism is not decided.
- **AI-added slot cap:** keep 3, raise it, or apply it per source (calendar vs. guest statement)? It stays at 3 until decided.
- **Google verification:** the learner will try to get the app verified. Review can take days to weeks and generally needs a public domain, a privacy policy, and a demo video of the consent flow, so it may not finish before the deadline. The fallback is testing mode with listed test users.

Decided: the saved roster and "meet again" are a stretch goal (last build slice, lowest priority in the demo) and need a "remember me" choice for guests, and the earlier request form is replaced by free-form constraints with AI-assisted plain-language entry.

## Stretch Goal (last priority)
- Saved roster and "meet again": guests who opt in are remembered, and the organizer can open a new meeting with the same group using their calendars again. If it is not built, it is narrated as "next" and not faked.

## Later
- Outlook and Apple calendars.
- Groups of 20 and larger (including 50+). The proof of concept is designed for 4–8 guests *(assumption)* and demoed with 6 people (the organizer and 5 guests).
- Invitation emails sent by the app. The organizer shares the link themselves.
- Monetization.
- Native mobile apps.

## Explicitly Cut
- **Teams integration:** the learner chose a standalone product so it can be monetized later.
- **Auto-lock voting:** the poll advises, and the organizer picks directly.
- **AI-generated alternative meeting lengths:** the AI may mention a different length in an explanation but doesn't generate slots of new lengths.
- **Other calendar providers:** each is its own OAuth setup and set of bugs.
