"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="quiet"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }}
    >
      {copied ? "Link copied" : "Copy the poll link"}
    </Button>
  );
}

export function RefreshButton() {
  const router = useRouter();
  return (
    <Button variant="quiet" onClick={() => router.refresh()}>
      Refresh
    </Button>
  );
}

function usePost(url: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function post(body?: object) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "That didn't work. Try again.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return { post, busy, error };
}

export function ClosePollButton({ pollId }: { pollId: string }) {
  const { post, busy, error } = usePost(`/api/polls/${pollId}/close`);
  return (
    <span className="inline-flex flex-col gap-1">
      <Button variant="quiet" onClick={() => post()} disabled={busy}>
        {busy ? "Closing…" : "Close the poll now"}
      </Button>
      {error && <span role="alert" className="text-sm text-danger">{error}</span>}
    </span>
  );
}

export function PickButton({ pollId, optionId, number }: { pollId: string; optionId: string; number: number }) {
  const { post, busy, error } = usePost(`/api/polls/${pollId}/finalize`);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button variant="quiet" onClick={() => post({ optionId })} disabled={busy} aria-label={`Pick option ${number}`}>
        {busy ? "Picking…" : "Pick this time"}
      </Button>
      {error && <span role="alert" className="text-sm text-danger">{error}</span>}
    </span>
  );
}
