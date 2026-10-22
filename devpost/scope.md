---
doc: scope
status: draft
---

# Calendarly

An AI scheduling assistant for one organizer who needs to find a time with many other people. The organizer asks in plain language, and the AI ranks the best slots from everyone's real calendars and explains why.

## The Unique Kernel
Ask the AI, don't poll the group. The organizer says what they need ("an hour with these people next week, afternoons"). The AI reads everyone's free/busy status and returns ranked slots with plain-language reasons, so nobody has to vote and check their calendar every time. Once people have joined, "meet again" is nearly one click, because the roster is already saved and slots are proposed automatically.

It is a standalone product, not a Teams add-on. Microsoft Teams' Scheduling Assistant is the main competitor, and Calendarly aims to be as powerful without the manual clicking. For SMEs the pain point is Doodle polls: slow, and repeated for every meeting.

## Who It's For
Someone who organizes meetings that involve many other people, such as a consultancy lead booking a client workshop or anyone opening a meeting or a talk. The learner chose not to pin down one persona.
Today they email people back and forth, run a Doodle poll, or post a poll in a messaging app like Instagram, and then chase the replies.

## The Core Loop
1. The organizer types a request to the AI.
2. They send a link. Each invitee logs in, registers, and connects their calendar.
3. The AI matches everyone's free/busy status and the organizer sees a ranking with reasons.
4. The organizer picks a slot directly (the recommended path), and the event is added to every member's calendar.
5. For the next meeting, the organizer chooses "meet again" with the same people, and slots are proposed automatically.

They come back because the second meeting costs almost nothing. The people are already registered and the AI already knows their availability. In the long term the organizer pushes frequent collaborators to connect their calendars.

## Inspiration & Identity
- Doodle (https://doodle.com): group polls. Calendarly keeps the simplicity but removes the repeated voting.
- Microsoft Teams Scheduling Assistant: the design reference and the main competitor. Calendarly aims for the same power with AI doing the work.
- Feel: extremely easy for beginners. Nobody should get stuck or feel put off. Easy to use is a selling point in its own right.

## Why This Matters to the Learner
They find it hard to schedule with many people, and they see this as a product they could monetize and grow users for later. It is also a chance to use their saved Claude Code extensions and agentic workflows to speed up the build, and to learn more about web stacks and AI (data analysis if it fits).

## What "Working" Looks Like
A short demo from the organizer's side that works end to end:
1. The organizer asks the AI for a meeting.
2. They send a link, and invitees log in and register.
3. The AI auto-matches everyone's calendars.
4. The organizer sees a ranking of slots with reasons and picks one.
5. The event is added to the real calendar automatically.
6. The organizer starts a new meeting with the same people, and the roster is already there with timeslots proposed automatically.

The "oh, that's cool" beat is step 6, where the second meeting is nearly effortless.

Demo setup: one real Google account. The other 5–6 invitee accounts are hosted fakes with seeded free/busy data, so the ranking runs on realistic calendars while the event write-back is shown on the real account.

## The POC Boundary
- Google Calendar only.
- Plain-language request from the organizer to the AI.
- A shareable invite link. Invitees log in, register, and connect a calendar.
- Free/busy matching and ranking with plain-language reasons. The ranking includes slots where most, but not all, people are free.
- The organizer picks the slot directly.
- Event write-back to the real calendar.
- A saved roster and "meet again" with automatic timeslot proposals.
- A simple, beginner-friendly interface.

## Later
- Group voting as an alternative to the organizer picking.
- Vote-only mode for people who don't connect a calendar (Doodle-style).
- Microsoft Outlook and Apple calendars.
- Email notifications.
- Monetization, and groups of 50+.

## Explicitly Cut
- **Teams integration:** the learner chose a standalone product so it can be monetized later.
- **Multiple calendar providers in the proof of concept:** each one is its own OAuth setup and set of bugs, which is too much for the time available.
- **Voting and vote-only mode:** the organizer picking directly is the recommended path and enough to prove the kernel.
- **Real calendars for the 5–6 fake invitees:** the demo uses seeded data, so only the real account shows live write-back.
