import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { db, dbConfigured } from "@/lib/db/client";

export type EmailKind = "confirmation" | "new_options" | "poll_update" | "meet_again" | "private_link";

export type Email = { kind: EmailKind; to: string; pollId: string; subject: string; text: string; html: string };

let transport: Transporter | null = null;

function smtp(): Transporter | null {
  const { BREVO_SMTP_HOST, BREVO_SMTP_PORT, BREVO_SMTP_USER, BREVO_SMTP_KEY } = process.env;
  if (!BREVO_SMTP_HOST || !BREVO_SMTP_USER || !BREVO_SMTP_KEY || !process.env.EMAIL_FROM) return null;
  if (!transport) {
    const port = Number(BREVO_SMTP_PORT || 587);
    transport = nodemailer.createTransport({
      host: BREVO_SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: BREVO_SMTP_USER, pass: BREVO_SMTP_KEY },
    });
  }
  return transport;
}

/** Addresses on reserved test domains are never sent to (they would only bounce). */
export function isTestAddress(to: string): boolean {
  return /@(example\.(com|org|net)|[^@]+\.(test|example|invalid))$/i.test(to);
}

/**
 * Send one email through Brevo and record the outcome in `email_log`.
 * Never throws: a failed send is visible on the dashboard but never blocks the page.
 */
export async function sendEmail(email: Email): Promise<"sent" | "failed" | "skipped"> {
  let result: "sent" | "failed" | "skipped" = "skipped";
  let error: string | null = null;
  const transporter = smtp();
  if (!transporter) {
    error = "email is not configured";
  } else if (isTestAddress(email.to)) {
    error = "test address";
  } else {
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: email.to,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
      result = "sent";
    } catch (e) {
      result = "failed";
      error = e instanceof Error ? e.message.slice(0, 300) : String(e);
    }
  }
  if (dbConfigured()) {
    const { error: logError } = await db().from("email_log").insert({
      kind: email.kind,
      to_address: email.to,
      poll_id: email.pollId,
      result,
      error,
    });
    if (logError) console.error("email_log insert failed:", logError.message);
  }
  return result;
}
