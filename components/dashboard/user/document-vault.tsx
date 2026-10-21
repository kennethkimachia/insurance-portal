"use client";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FolderOpen } from "lucide-react";

interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  category?: string;
  uploadState?: string;
  uploadError?: string | null;
  scanState?: string;
  reviewStatus?: string;
  reviewNote?: string | null;
}
export function DocumentVault({
  documents,
  claimId,
  staff = false,
  demo = false,
}: {
  documents: Document[];
  claimId: string;
  staff?: boolean;
  demo?: boolean;
}) {
  const received = documents.filter(
    (doc) => !doc.uploadState || doc.uploadState === "ready",
  ).length;
  return (
    <Card id="documents">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="size-5 text-primary" />
          Documents
        </CardTitle>
        <CardDescription>
          {received} file{received === 1 ? "" : "s"} received. Files remain
          private and wait for manual inspection.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No documents yet. Your incident report is still received.
          </p>
        ) : (
          documents.map((doc) => {
            const ready = !doc.uploadState || doc.uploadState === "ready";
            const canDownload =
              ready &&
              (doc.scanState === "clean" ||
                (staff && doc.scanState !== "rejected"));
            const label =
              doc.reviewStatus === "waived"
                ? "Waived with a recorded reason"
                : !ready
                  ? doc.uploadState === "failed"
                    ? "Upload failed: select the file again below"
                    : "Upload in progress"
                  : doc.reviewStatus === "accepted"
                    ? "Accepted after manual inspection"
                    : doc.reviewStatus === "needs_replacement"
                      ? "Replacement needed"
                      : "Awaiting manual inspection";
            return (
              <div
                key={doc.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-muted/15 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="break-all text-sm font-medium">{doc.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {doc.category?.replaceAll("_", " ")} ·{" "}
                    {(doc.size / (1024 * 1024)).toFixed(1)} MB ·{" "}
                    {new Date(doc.uploadedAt).toLocaleDateString("en-KE", {
                      timeZone: "Africa/Nairobi",
                    })}
                  </p>
                  <Badge className="mt-2 whitespace-normal" variant="secondary">
                    {label}
                  </Badge>
                  {doc.reviewNote && (
                    <p className="mt-2 text-sm">{doc.reviewNote}</p>
                  )}
                  {doc.uploadState === "failed" &&
                    doc.reviewStatus !== "waived" && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {doc.uploadError ||
                          "Your report is saved. Select the same file in its category to retry, or ask your agent about an alternative."}
                      </p>
                    )}
                </div>
                {!demo && canDownload ? (
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={`/api/claims/${claimId}/attachments/${doc.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download />
                      {staff && doc.scanState !== "clean"
                        ? "Download for inspection"
                        : "Download"}
                    </Link>
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" disabled>
                    <Download />
                    {demo
                      ? "Demo document"
                      : !ready
                        ? "File unavailable"
                        : "Review pending"}
                  </Button>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
