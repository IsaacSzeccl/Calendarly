"use client";

import { useState } from "react";

/** The organizer's "stop reading my calendar": removes the token and revokes it with Google. */
export function DisconnectCalendar() {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className={`underline underline-offset-4 hover:text-ink ${failed ? "text-danger" : ""}`}
      onClick={async () => {
        // Open polls need the calendar to offer and check times, and to add the final event.
        if (!confirm("Disconnect your calendar? Open polls can't check your free time or add the event until you reconnect.")) return;
        setBusy(true);
        const res = await fetch("/api/calendar/disconnect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ for: "organizer" }),
        }).catch(() => null);
        if (res?.ok) return location.reload();
        setBusy(false);
        setFailed(true);
      }}
    >
      {busy ? "Disconnecting…" : failed ? "Disconnect failed, try again" : "Disconnect calendar"}
    </button>
  );
}
