"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Send, User } from "lucide-react";
import { useState } from "react";

interface TimelineEntry {
  id: string;
  author: string;
  role: "agent" | "system";
  content: string;
  createdAt: string;
}

interface ClaimTimelineProps {
  claimNumber: string;
  entries: TimelineEntry[];
  agentName?: string;
}

export function ClaimTimeline({
  claimNumber,
  entries: initialEntries,
  agentName = "You",
}: ClaimTimelineProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [message, setMessage] = useState("");

  function handlePost() {
    if (!message.trim()) return;

    const newEntry: TimelineEntry = {
      id: `note-${Date.now()}`,
      author: agentName,
      role: "agent",
      content: message.trim(),
      createdAt: new Date().toISOString(),
    };

    setEntries((prev) => [...prev, newEntry]);
    setMessage("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handlePost();
    }
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <MessageSquare className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Claim Timeline</CardTitle>
            <CardDescription>{claimNumber}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {/* Timeline entries */}
        <div className="flex-1 space-y-3 overflow-y-auto max-h-72 pr-1">
          {entries.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-center">
              <p className="text-sm text-muted-foreground">
                No updates yet. Add the first note below.
              </p>
            </div>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      entry.role === "agent" ? "bg-primary/10" : "bg-muted"
                    }`}
                  >
                    <User
                      className={`h-3.5 w-3.5 ${
                        entry.role === "agent"
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}
                    />
                  </div>
                  <div className="mt-1 w-px flex-1 bg-border" />
                </div>
                <div className="flex-1 pb-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {entry.author}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString("en-KE", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">
                    {entry.content}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Message input */}
        <div className="mt-4 flex gap-2 border-t pt-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type an update for the policyholder..."
            className="flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            rows={2}
          />
          <Button
            size="sm"
            className="self-end"
            disabled={!message.trim()}
            onClick={handlePost}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
