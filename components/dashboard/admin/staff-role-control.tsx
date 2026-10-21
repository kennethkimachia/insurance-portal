"use client";
import { useState, useTransition } from "react";
import { changeStaffRole } from "@/app/actions/admin/manage-agents";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
type StaffRole = "admin" | "head_agent" | "agent";
export function StaffRoleControl({ id, role, disabled }: { id: string; role: StaffRole; disabled: boolean }) {
  const [desired, setDesired] = useState(role);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const router = useRouter();
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      <select aria-label="Staff role" disabled={disabled || pending} value={desired} onChange={(event) => setDesired(event.target.value as StaffRole)} className="rounded-lg border bg-background px-2 text-sm">
        <option value="agent">Agent</option><option value="head_agent">Claims manager</option><option value="admin">Platform administrator</option>
      </select>
      <Button size="sm" variant="outline" disabled={disabled || pending || desired === role} onClick={() => startTransition(async () => {
        try { const result = await changeStaffRole(id, desired); setMessage(result.success ? "Clerk role updated." : result.error); router.refresh(); }
        catch { setMessage("Could not update the role. Please retry."); }
      })}>Apply role</Button>
    </div>
    {message && <p role="status" className="text-sm">{message}</p>}
  </div>;
}
