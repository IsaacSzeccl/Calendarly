import { DateTime } from "luxon";
import { slotLabel } from "@/lib/format";

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function wrap(title: string, paragraphs: string[], link?: { href: string; label: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#faf7f0;padding:24px;font-family:Georgia,serif;color:#2a2420">
<div style="max-width:520px;margin:0 auto">
<h1 style="font-size:22px;font-weight:600;margin:0 0 16px">${escape(title)}</h1>
${paragraphs.map((p) => `<p style="font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;margin:0 0 12px">${escape(p)}</p>`).join("\n")}
${link ? `<p style="margin:20px 0"><a href="${escape(link.href)}" style="background:#a8452b;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px;font-family:Helvetica,Arial,sans-serif;font-weight:600;display:inline-block">${escape(link.label)}</a></p>` : ""}
<p style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6e655c;margin-top:24px">Sent by Calendarly.</p>
</div></body></html>`;
}

const gcalStamp = (ms: number) => DateTime.fromMillis(ms, { zone: "utc" }).toFormat("yyyyMMdd'T'HHmmss'Z'");

/** A one-click "add to Google Calendar" link that works without connecting anything. */
export function addToCalendarUrl(e: { title: string; start: number; end: number; details?: string }): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${gcalStamp(e.start)}/${gcalStamp(e.end)}`,
    details: e.details ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function confirmationEmail(i: {
  guestName: string;
  guestZone: string;
  title: string;
  organizerName: string;
  start: number;
  end: number;
}) {
  const when = slotLabel(i.start, i.end, i.guestZone);
  const href = addToCalendarUrl({ title: i.title, start: i.start, end: i.end, details: `Organized by ${i.organizerName}` });
  const lines = [`Hi ${i.guestName},`, `${i.organizerName} picked a time for "${i.title}": ${when} (${i.guestZone}).`];
  return {
    subject: `${i.title}: ${when}`,
    text: `${lines.join("\n\n")}\n\nAdd it to your calendar: ${href}\n`,
    html: wrap(`It's set: ${when}`, lines, { href, label: "Add to my calendar" }),
  };
}

export function pollUpdateEmail(i: { title: string; countText: string; reason: "complete" | "closed"; dashboardUrl: string }) {
  const headline =
    i.reason === "complete" ? `${i.countText} have filled in` : `Your poll has closed: ${i.countText} responded`;
  const lines = [
    i.reason === "complete"
      ? `Everyone you expected has answered "${i.title}".`
      : `"${i.title}" is closed to new answers.`,
    "Open the dashboard to see the ranking, the trade-offs and pick a time.",
  ];
  return {
    subject: `${i.title}: ${headline}`,
    text: `${lines.join("\n\n")}\n\n${i.dashboardUrl}\n`,
    html: wrap(headline, lines, { href: i.dashboardUrl, label: "See the ranking" }),
  };
}

export function newOptionsEmail(i: {
  guestName: string;
  title: string;
  slots: { start: number; end: number }[];
  guestZone: string;
  pollUrl: string;
}) {
  const times = i.slots.map((s) => slotLabel(s.start, s.end, i.guestZone));
  const lines = [
    `Hi ${i.guestName},`,
    `New times were added to "${i.title}": ${times.join("; ")} (${i.guestZone}).`,
    "If you'd like, mark whether they work for you.",
  ];
  return {
    subject: `New times for ${i.title}`,
    text: `${lines.join("\n\n")}\n\n${i.pollUrl}\n`,
    html: wrap("New times were added", lines, { href: i.pollUrl, label: "Mark the new times" }),
  };
}

export function meetAgainEmail(i: { guestName: string; organizerName: string; title: string; link: string }) {
  const headline = `${i.organizerName} is meeting the group again`;
  const lines = [
    `Hi ${i.guestName},`,
    `${i.organizerName} started a new poll, "${i.title}", with the same group. You asked to be remembered, so your calendar has already answered for you.`,
    "Open your link to see or change your answers. To stop being included, untick \"remember me\" or disconnect your calendar there.",
  ];
  return {
    subject: `${i.title}: your calendar answered for you`,
    text: `${lines.join("\n\n")}\n\n${i.link}\n`,
    html: wrap(headline, lines, { href: i.link, label: "See my answers" }),
  };
}

export function privateLinkEmail(i: { guestName: string; title: string; link: string }) {
  const lines = [
    `Hi ${i.guestName},`,
    `Someone opened "${i.title}" and tried to answer with this email address, which already has answers on the poll.`,
    "If that was you, open your private link to see or change your answers on this device. If it wasn't, you can ignore this email: nothing was changed.",
  ];
  return {
    subject: `${i.title}: your private link`,
    text: `${lines.join("\n\n")}\n\n${i.link}\n`,
    html: wrap("Your private link", lines, { href: i.link, label: "See my answers" }),
  };
}
