"use client";
import { useState, useTransition } from "react";
import { retryPortalRoleUpdate, cancelPortalRoleUpdate } from "@/app/actions/invitations";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { reinstateCancelledRoleAccount } from "@/app/actions/admin/manage-agents";
import { Input } from "@/components/ui/input";

export function RoleUpdateControls({ id, administrator = false, cancelledActorId }: { id: string; administrator?: boolean; cancelledActorId?: string }) {
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function run(cancel: boolean) {
    startTransition(async () => {
      try {
        const result = await (cancel ? cancelPortalRoleUpdate(id) : retryPortalRoleUpdate(id));
        setMessage(result.success ? cancel ? "Update cancelled. Account is suspended until its role is reviewed and access reinstated." : "Access update completed." : result.error);
        router.refresh();
      } catch { setMessage("Could not finish this update. Please retry."); }
    });
  }
  return <div className="space-y-2">
    {message && <p role="status" className="text-sm">{message}</p>}
    {cancelledActorId ? <form className="flex flex-wrap gap-2" onSubmit={(event) => {
      event.preventDefault();
      startTransition(async () => {
        try { const result = await reinstateCancelledRoleAccount(cancelledActorId, reason); setMessage(result.success ? "Account reinstated. Sign in again; un-enrolled accounts need a new invitation." : result.error); router.refresh(); }
        catch { setMessage("Could not reinstate the account. Please retry."); }
      });
    }}>
      <Input aria-label="Role review reason" value={reason} onChange={(event) => setReason(event.target.value)} minLength={5} maxLength={500} required placeholder="Record your review of the restored role" />
      <Button size="sm" variant="outline" disabled={pending || reason.trim().length < 5}>Reinstate reviewed account</Button>
    </form> : <div className="flex flex-wrap gap-2">
      <Button disabled={pending} onClick={() => run(false)} size="sm">{pending ? "Updating…" : "Retry access update"}</Button>
      {administrator && <Button disabled={pending} onClick={() => run(true)} size="sm" variant="outline">Cancel and suspend account</Button>}
    </div>}
  </div>;
}
