import type { Metadata } from "next";
import { CreatePoll } from "./CreatePoll";

export const metadata: Metadata = { title: "New poll · Calendarly" };

export default function NewPollPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-4xl">Find a time</h1>
        <p className="max-w-prose text-pencil">
          Describe the meeting the way you'd tell a friend. I'll turn it into a poll and suggest times
          when you're free.
        </p>
      </div>
      <CreatePoll />
    </div>
  );
}
