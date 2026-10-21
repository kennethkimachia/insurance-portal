"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { deleteMyClaim } from "@/app/actions/user/my-claims";
import { toast } from "sonner";

export function DeleteDraftButton({ claimId }: { claimId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function remove() {
    startTransition(async () => {
      try {
        const result = await deleteMyClaim(claimId);
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success("Unsubmitted draft deleted");
        router.refresh();
      } catch {
        toast.error("Could not delete this draft. Please retry.");
      }
    });
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={pending}>
          {pending ? "Deleting…" : "Delete draft"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this unsubmitted draft?</AlertDialogTitle>
          <AlertDialogDescription>
            Its saved answers will be removed. Submitted reports can only be
            withdrawn through a recorded request.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep draft</AlertDialogCancel>
          <AlertDialogAction onClick={remove}>Delete draft</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
