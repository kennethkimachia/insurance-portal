"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Send } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addClaimNote } from "@/app/actions/agent/manage-claims";
import type { Role } from "@/lib/permissions";

export interface TimelineEntry {
  id: string;
  author: string;
  role: string;
  content: string;
  createdAt: string;
  visibility?: string;
}
interface ClaimTimelineProps {
  claimNumber: string;
  entries: TimelineEntry[];
  agentName?: string;
  claimId?: string;
  role?: Role;
  readOnly?: boolean;
}

export function ClaimTimeline({
  claimNumber,
  entries: initialEntries,
  claimId,
  role = "agent",
  readOnly = false,
}: ClaimTimelineProps) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [message, setMessage] = useState("");
  const [visibility, setVisibility] = useState<"public" | "internal">("public");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function post() {
    if (!claimId || !message.trim()) return;
    startTransition(async () => {
      try {
        const result = await addClaimNote(claimId, message, visibility);
        if (!result.success || !result.note) {
          setError(result.error ?? "Unable to post your message");
          return;
        }
        setEntries((previous) => [...previous, result.note]);
        setMessage("");
        setError(null);
        router.refresh();
      } catch {
        setError("Unable to post your message. Please try again.");
      }
    });
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Claim history and messages</CardTitle>
        <CardDescription>{claimNumber}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-h-96 space-y-4 overflow-y-auto" aria-live="polite">
          {entries.length === 0 ? (
            <p className="portal-empty">
              No updates yet.
            </p>
          ) : (
            entries.map((entry) => (
              <article key={entry.id} className="border-l-2 border-border pl-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{entry.author}</span>
                  {entry.visibility === "internal" && (
                    <span className="rounded bg-muted px-2 py-0.5 text-xs">
                      Staff only
                    </span>
                  )}
                  <time
                    dateTime={entry.createdAt}
                    className="text-xs text-muted-foreground"
                  >
                    {new Date(entry.createdAt).toLocaleString("en-KE", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                  {entry.content}
                </p>
              </article>
            ))
          )}
        </div>
        {claimId && !readOnly && (
          <div className="space-y-3 border-t pt-4">
            {role !== "user" && (
              <>
                <label
                  htmlFor={`visibility-${claimId}`}
                  className="text-sm font-medium"
                >
                  Message audience
                </label>
                <Select
                  value={visibility}
                  onValueChange={(value) =>
                    setVisibility(value as "public" | "internal")
                  }
                  disabled={pending}
                >
                  <SelectTrigger id={`visibility-${claimId}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">
                      Policyholder and staff
                    </SelectItem>
                    <SelectItem value="internal">Staff only</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
            <label
              htmlFor={`message-${claimId}`}
              className="block text-sm font-medium"
            >
              {visibility === "internal" ? "Internal note" : "Message"}
            </label>
            <Textarea
              id={`message-${claimId}`}
              value={message}
              maxLength={4000}
              rows={3}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={
                visibility === "internal"
                  ? "Add a note for staff."
                  : "Write an update or reply."
              }
            />
            <Button
              disabled={pending || message.trim().length < 2}
              onClick={post}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Post {visibility === "internal" ? "internal note" : "message"}
            </Button>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
