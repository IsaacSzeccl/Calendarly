---
doc: prd
status: approved
---

# Calendarly — Product Requirements

A standalone, calendar-aware poll for anyone who coordinates a group (a coach, a society organizer, a project lead, or someone planning a gathering) and has to find a time that works for other people. An AI interprets constraints and plain-language availability and explains the trade-offs between time slots. "External parties" remains the broad positioning: scheduling with people outside your own calendar.
Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`. The fuller requirement list lives in the Claude Docs PRD "Calendarly — AI Scheduling Assistant for External Meetings — PRD" (https://claude.ai/artifact/RSgq4P4hw7c9WK8J7xvcyQ). This file is the build-facing version of it, and `scope.md` wins on any conflict about what is in the proof of concept.

## The Story
**The coaching story (leads the pitch).** In a student coach program, the main coach had to arrange a meeting with a group of student coaches. The pitch and the demo use the same size: a coach and 5 student coaches, 6 people *(assumption)*. We used Doodle, WhatsApp votes, and Google Calendar scheduling, and people kept asking for more timeslots "because of this, because of that".

**The second example** is friends and group scheduling: group projects, society members, and friend gatherings, usually 7–8 people.

The **organizer** is anyone who coordinates a group. The **guests** are the group's members.

## The Core Journey
Source: `scope.md > The Core Loop`, `scope.md > What "Working" Looks Like`.

1. **Organizer arrives.** They log in and connect Google Calendar (a separate consent step from logging in).
2. **Organizer creates a poll in plain language.** They type something like: "I want to meet with Tom and Jamie this week about our upcoming collaboration. Best to be afternoon meetings. Tom does not like meetings at night. My office hours are 9-5pm. Jamie works in the BST timezone 9-6pm." The same box takes constraints from the group, for example "Tom only does evenings because of work, and the coach can't do Tuesdays." The AI fills in the poll details and constraints, and the organizer checks them. The initial options come from the organizer's free time.
3. **Organizer shares the link themselves,** in whatever channel they use (WhatsApp, email, a chat). The app does not send invitation emails. Optionally, they name who will be in the meeting. Guests need no account.
4. **A guest fills in the poll form,** Doodle-style: they give a name and email, mark each option **yes / prefer not / no**, and can optionally connect Google Calendar. Near the end of the form is a plain-language box, for example "Tuesday or Wednesday afternoons, not Mondays".
5. **The guest confirms what the AI understood.** If they used the plain-language box, they see the dates, times, and their timezone the AI understood and confirm or correct them. Only then are slots added.
6. **The AI adds slots** from connected calendars or confirmed statements, only where the organizer's calendar shows free. Earlier voters get a "new options added" email.
7. **The organizer opens the poll dashboard.** They see who has responded and who connected a calendar, each person's votes per time slot, and an AI-written summary of which option is best and which are not, with the basis stated.
8. **The organizer picks the final slot** directly. The event is created on their calendar, and guests get a confirmation email with a one-click "add to calendar" link.

Success is the demo path: the "no perfect slot" case where the AI explains the trade-off and adds slots from a guest's plain-language statement (`scope.md > What "Working" Looks Like`). See Demo and Success Criteria below.

## Screens and Layout
Source: `scope.md > The POC Boundary`. Responsive web app; the guest page must work well on a phone.

### Organizer: Create Poll
One plain-language box, and below it the poll as the AI understood it (title, dates, constraints, the people named, working hours and timezones) for the organizer to edit. Optional: the people who will be in the meeting. A "Create poll" action produces the share link, with a copy button, for the organizer to send in their own channel.

### Organizer: Poll Dashboard
- A **people list:** each invited or responding person by name, with a mark showing whether they have connected a calendar.
- A **votes view:** time slots against people, showing each person's yes / prefer not / no (and which slots the AI added).
- An **AI summary** at the top: which meeting is best, which is not, and why, ending with the basis ("based on 2 connected calendars, 2 votes, and 1 stated availability").
- A **ranking** of options, each with its plain-language explanation.
- A **pick this slot** action on each option.

### Guest: Poll Page (opened from the link)
A Doodle-style form, top to bottom: the meeting title and context; name (pick one of the names the organizer listed, or type your own) and email; the option list, each with yes / prefer not / no; an optional "connect Google Calendar" action; the plain-language box near the end with a short example; a submit action. After submit, a confirmation of what they sent.

### Guest: "What I understood" Step
Shown after the plain-language box is used and before anything is added: the dates, times, and the guest's timezone as the AI read them, with "Looks right" and a way to correct them.

### Emails
Confirmation (with add-to-calendar link) and "new options added" (with a one-click link back to the poll). These are the only emails the app sends. A guest's email address is used for these two only; the app sends no invitation emails.

## Look and Feel
Source: learner direction (`scope.md > Inspiration & Identity`: "extremely easy for beginners"; "do not make it generic").
- **Direction (agreed):** a warm "planner" feel instead of generic SaaS: off-white paper-like background, a characterful serif for headings with a plain sans for body text, and availability shown in green / amber / grey **with icons**, so color is never the only signal.
- **The AI summary** reads like a short note from a colleague, not a chat bubble.
- **Easy for beginners:** a short list of selectable times rather than a full calendar grid; visible confirmation after every choice; plain wording; empty states that tell a first-time organizer what to do next.
- **References:** Doodle for the guest form; Microsoft Teams' Scheduling Assistant is the competitor, not a style reference.
- **Not chosen yet:** exact fonts, hex colors, and which design skills to use. `4-spec` will settle these, starting from the research done in this conversation (Anthropic's `frontend-design` skill with this section as its design brief, plus a screenshot-review loop).

## Features and Behavior

### Poll creation in plain language
Source: `scope.md > The Core Loop` step 1–2.
- As an organizer, I want to describe the meeting in plain language, so I don't fill in a form.
  - [ ] Typing the Tom/Jamie example produces a poll with: the people named, afternoon preference, 9–5 office hours, Tom avoiding nights, and Jamie's availability in BST (9–6).
  - [ ] The organizer can see and edit what the AI understood before creating the poll.
  - [ ] Constraints that came from the group ("Tom only does evenings because of work, and the coach can't do Tuesdays") are accepted in the same way as the organizer's own.
  - [ ] The initial options are times when the organizer's connected calendar is free.

### Guest response
Source: `scope.md > The POC Boundary`.
- As a guest, I want to respond from a link without making an account.
  - [ ] Opening the link shows the form without any login.
  - [ ] I must give a name and an email address to submit.
  - [ ] Each option can be marked yes, prefer not, or no.
  - [ ] After submitting, I see a confirmation, and the organizer's dashboard shows my votes.
  - [ ] If the organizer listed names, I can pick mine ("claim" it) or type a different one.

### Guest plain-language availability
Source: `scope.md > The Core Loop` step 4–6.
- As a guest, I want to say when I'm available in my own words, so I can suggest times that aren't listed.
  - [ ] A statement such as "Tuesday or Wednesday afternoons, not Mondays" or "I'm more available next week" is turned into concrete slots.
  - [ ] Before anything is added, I see the dates, times, and my timezone as the AI understood them, and I can confirm or correct them.
  - [ ] Only slots that the organizer's connected calendar shows as free are added.
  - [ ] This works when I have not connected a calendar.

### AI-added slots
- [ ] AI-added slots appear in the poll without the organizer doing anything, and later guests can vote on them.
- [ ] No more than 3 AI-added slots per poll (the cap is a config value; it is an open question whether it changes).
- [ ] Earlier voters receive a "new options added" email with a one-click link, for slots from calendars and from guest statements.

### Ranking and AI summary
Source: `scope.md > The Unique Kernel`.
- As an organizer, I want to know which time is best and why.
  - [ ] Every option has a plain-language explanation that states its basis, for example "based on 2 connected calendars, 2 votes, and 1 stated availability".
  - [ ] The summary says which option is best and which are not, and names the trade-off (for example "Option A has everyone but is at 8am; Option B works better but Sam can't make it").
  - [ ] The ranking only advises. Nothing is chosen until the organizer picks.
  - [ ] The AI may mention a different meeting length in its text but never creates slots of a different length.

### Finalizing
- [ ] After the organizer picks a slot, the event appears on their Google Calendar.
- [ ] Guests receive a confirmation email with a one-click "add to calendar" link.

### Privacy
- [ ] Only free/busy status is read from any connected calendar, never titles or details.
- [ ] Disconnecting a calendar immediately revokes access.

## States and Boundaries
States marked *(assumption)* were not stated by the learner. They are the obvious behavior, labeled so they can be corrected at review.

- **First use (organizer)** *(assumption)*: before any poll exists, the screen shows one prompt to describe the meeting, not an empty table.
- **Poll with no responses yet** *(assumption)*: the dashboard shows the share link with a copy button and the list of named people as "waiting", not an empty votes table.
- **Organizer has no free time in the window** *(assumption)*: the organizer is told no options could be made and is asked to widen the dates or hours.
- **AI cannot understand a statement** *(assumption)*: it says so in plain words, gives an example of a statement it can read ("Tuesday or Wednesday afternoons, not Mondays"), and asks the guest to rephrase. Nothing is added.
- **Returning guest** *(assumption)*: opening the same link again shows their saved votes and stated availability, which they can change until the organizer picks a slot. After the organizer picks, they see the final time.
- **Guest without a calendar:** can vote and use the plain-language box; contributes votes and stated availability only.
- **No perfect slot:** the AI says so explicitly, shows the options where the most people are available, explains the trade-off, and can add slots from a guest's statement. This is the demo's centerpiece.
- **AI misreads a statement:** the guest sees the interpretation first and can correct it, and nothing is added until they confirm.
- **Statement yields no free time** *(assumption)*: if the organizer's calendar has no matching free slot, the guest is told that nothing could be added.
- **Calendar connection fails or is down:** that person is flagged on the dashboard and the ranking continues from everyone else.
- **Cap reached** *(assumption)*: no more AI-added slots appear after 3; the guest is told their statement was received.
- **Persistence** *(assumption)*: a poll, its options, votes, and statements persist after the organizer finalizes; nothing is deleted automatically.
- **Unverified app:** until Google verifies the app, an unverified-app warning appears and only listed test users can connect.
- **Permissions:** only the organizer can see the dashboard and pick a slot. Guests see the form and their own response.

## Product Decisions
- **Standalone, no Teams integration** — so it can be monetized later (`scope.md > Explicitly Cut`).
- **The organizer picks the slot; the poll advises** — recommended by the learner; no auto-lock.
- **Guests need no account** — lowers friction for group members. They give name and email, which are used for the "new options added" and confirmation emails only.
- **The organizer shares the link themselves** in whatever channel they use (WhatsApp, email, a chat); the app sends no invitation emails — the learner's answer. Invitation emails move to Deferred.
- **Doodle-style guest form with yes / prefer not / no** — chosen by the learner for simplicity.
- **The plain-language box sits near the end of the guest form** — so they can add new options after voting.
- **People are identified by name; the organizer may list who is in the meeting so guests can claim a name** — the learner's answer.
- **Plain language is how the organizer creates the poll** — the learner's example included people, preferences, office hours, and a timezone.
- **Only slots the organizer's calendar shows as free** can be added.
- **A guest confirms what the AI understood** before slots are added.
- **Cap of 3 AI-added slots** kept until decided.
- **Google Calendar only; 6 demo accounts (the organizer and 5 guests)** *(assumption)* with calendars designed to produce a "no perfect slot" case. Seeded accounts are labeled honestly.
- **The pitch tells the coaching story at the demo's size: a coach and 5 student coaches, 6 people** *(assumption)*. The product is not claimed to be tested on larger groups.
- **Design target: 4–8 guests for the proof of concept** *(assumption)*.
- **"yes / prefer not / no" is one mark per option, and the ranking weighs "prefer not" below "yes" and above "no"** *(assumption)*. The exact weighting is for `4-spec`.
- **The roster and "meet again" go to Later.**
- **Warm "planner" look and feel** — agreed by the learner.

## Demo and Success Criteria
- **The pitch** leads with the coaching story: the main coach arranging a meeting with a group of student coaches over Doodle, WhatsApp votes, and Google Calendar scheduling, with people asking for more timeslots "because of this, because of that". The friends-and-group example (7–8 people) is the second example. The story is told at the demo's size: a coach and 5 student coaches, 6 people *(assumption)*.
- **The demo** uses 6 accounts (the organizer and 5 guests) *(assumption)* whose calendars are designed to produce a "no perfect slot" case. Real Google test accounts are used wherever possible; seeded accounts are labeled honestly. The pitch story and the demo are the same size, and nothing is claimed about larger groups.
- **Before-and-after video** *(assumption)*: a back-and-forth in a group chat and poll (Doodle and WhatsApp votes), versus the same task in Calendarly.
- **Demo path:** the organizer describes the meeting with constraints from the group (for example "Tom only does evenings because of work, and the coach can't do Tuesdays"), shares the link themselves, one guest votes without logging in, one guest connects a calendar, one guest states availability in plain language and confirms what the AI understood, the AI adds slots where the organizer's calendar is free, an earlier voter is notified, the organizer picks a slot, and the event and confirmation email go out.
- **Centerpiece:** the "no perfect slot" case, where the AI explains the trade-off and adds slots from a guest's plain-language statement.

## What We're Building
Everything the proof of concept must do:
- Organizer login, Google Calendar connection, and plain-language poll creation.
- The shareable link and the Doodle-style guest form (name, email, yes / prefer not / no).
- Optional guest calendar connection.
- Guest plain-language availability with the "what I understood" confirmation.
- AI-added slots (cap 3), limited to the organizer's free time.
- The organizer dashboard: people and calendar status, votes per slot, AI summary, ranking with explanations.
- Organizer picks; the event is created; the confirmation email goes out.
- The "new options added" email.
- The "no perfect slot" demo case, and the before-and-after video.

## Deferred From the POC
- **Saved roster and "meet again":** the earlier kernel; the new flow is already larger.
- **Outlook and Apple calendars:** each is its own setup and set of bugs.
- **Auto-lock voting:** the poll advises instead.
- **Groups of 20 and larger (including 50+):** the proof of concept is designed for 4–8 guests *(assumption)*.
- **Monetization and accounts for guests.**
- **Native mobile apps:** responsive web only.
- **Invitation emails sent by the app:** the organizer shares the link in their own channel instead.

## Possible Later Enhancements
- Repeat meetings with a saved roster, so the second meeting is nearly one click.
- Preference learning across polls, and conversational back-and-forth with guests.
- Location- and travel-aware suggestions.
- Outlook and Apple calendars.

## Non-Goals
- No Teams integration (standalone product).
- The AI will not generate slots of a different length (it may only mention one).
- The app will not read event titles or details from any calendar.
- No auto-lock: the app never books a time without the organizer picking it.

## Open Questions
- **Group size check (can wait for `5-build`):** the proof of concept is designed for 4–8 guests and demoed with 6 people (the organizer and 5 guests). The ranking and dashboard need a check at 20 people (the size of the original coaching meeting) before claiming the product handles that size.
- **Assumptions to confirm at review:** one mark per option with "prefer not" weighed between "yes" and "no"; the states marked *(assumption)* above; the 4–8 guest design target; the wording of the before-and-after video.
- **Relative phrases and timezone (can wait for `4-spec`):** how "next week" and the guest's timezone are anchored and confirmed.
- **AI-added slot cap (can wait):** keep 3, raise it, or apply it per source (calendar vs. statement). Stays at 3 until decided.
- **Demo calendars (can wait for `5-build`):** design the 6 accounts' calendars to produce the "no perfect slot" case, and decide which accounts are real Google accounts and which are seeded.
- **Google verification (can wait):** applying may not finish before the deadline; the fallback is testing mode with listed test users.
- **Scope vs. time:** this flow is larger than the 2–4 hours suggested for the course. Build order should put the end-to-end demo path first.
