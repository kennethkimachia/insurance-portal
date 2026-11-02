"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { publishClaimUpdate } from "@/app/actions/agent/claim-updates";
import { UPDATE_KINDS, RESPONSIBLE_PARTIES, type ClaimUpdate } from "@/lib/claim-communication";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReportField, ReportSelect } from "./report-fields";
const empty = { kind: "general", visibility: "public", title: "", message: "", nextAction: "", responsibleParty: "agent", waitingReason: "", nextUpdateAt: "", appointmentAt: "", appointmentLocation: "", contactDetails: "" } satisfies ClaimUpdate;
export function ClaimUpdateComposer({ claimId, disabled = false }: {
    claimId: string;
    disabled?: boolean;
}) {
    const [form, setForm] = useState<ClaimUpdate>(empty);
    const [requestId, setRequestId] = useState(() => crypto.randomUUID());
    const edit = (key: keyof ClaimUpdate, value: string) => { setForm((p) => ({ ...p, [key]: value })); setRequestId(crypto.randomUUID()); };
    const [error, setError] = useState("");
    const [pending, startTransition] = useTransition();
    const router = useRouter();
    const field = (key: keyof ClaimUpdate, label: string, multiline = false, type = "text") => <ReportField id={`update-${key}`} label={label} value={form[key]} multiline={multiline} type={type} maxLength={key === "message" ? 4000 : key === "title" ? 160 : key === "nextAction" || key === "waitingReason" ? 1000 : 500} onChange={(v) => edit(key, v)}/>;
    const select = (key: "kind" | "visibility" | "responsibleParty", label: string, values: Record<string, string>) => <ReportSelect id={`update-${key}`} label={label} value={form[key]} options={Object.entries(values)} onChange={(v) => edit(key, v)}/>;
    return <Card id="publish-update">
    <CardHeader><CardTitle>Communicate progress</CardTitle><CardDescription>Explain the work, who acts next, any delay, and when you will update the policyholder. This does not change the claim stage.</CardDescription></CardHeader>
    <CardContent><form onSubmit={(e) => {
            e.preventDefault();
            if (disabled || pending)
                return;
            startTransition(async () => {
                setError("");
                try {
                    const result = await publishClaimUpdate(claimId, { ...form,
                        nextUpdateAt: form.nextUpdateAt ? `${form.nextUpdateAt}:00+03:00` : "",
                        appointmentAt: form.appointmentAt ? `${form.appointmentAt}:00+03:00` : "",
                    }, requestId);
                    if (!result.success) {
                        setError(result.error);
                        return;
                    }
                    setForm(empty);
                    setRequestId(crypto.randomUUID());
                    router.refresh();
                }
                catch {
                    setError("Update could not be saved. Your text is still here; please retry.");
                }
            });
        }}><fieldset disabled={disabled || pending} className="space-y-4">
      {select("visibility", "Who can read this update?", { public: "Policyholder and staff", internal: "Staff only" })}
      <p className="rounded-lg border p-3 text-sm">{form.visibility === "public" ? "Publishing makes all fields below visible to the policyholder and adds an in-portal notification." : "Internal update: only authorized staff can read it. The policyholder receives no notification."}</p>
      {select("kind", "Update type", UPDATE_KINDS)}
      {field("title", "Short title")}{field("message", "What has happened? Explain in plain language.", true)}
      {select("responsibleParty", "Who acts next?", RESPONSIBLE_PARTIES)}
      {field("nextAction", "Next action / what the policyholder should expect", true)}
      {field("waitingReason", "Waiting reason, blocker or delay explanation", true)}
      {field("nextUpdateAt", "Next update expected (Nairobi time; required for public updates)", false, "datetime-local")}
      <details><summary className="cursor-pointer text-sm font-medium">Add an arranged appointment or contact details</summary><div className="mt-3 space-y-4">
        {field("appointmentAt", "Appointment time (Nairobi)", false, "datetime-local")}
        {field("appointmentLocation", "Appointment location / joining instructions")}
        {field("contactDetails", "Relevant contact details (share only what is needed)")}
      </div></details>
      <p className="text-xs text-muted-foreground">Use Information requests for evidence that needs a tracked reply. Use manager outcome controls for approval, rejection and settlement. Dates are expected updates, not guaranteed claim completion.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit">{pending ? "Saving…" : form.visibility === "public" ? "Publish policyholder update" : "Save internal update"}</Button>
    </fieldset></form></CardContent>
  </Card>;
}
