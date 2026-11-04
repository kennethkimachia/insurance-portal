"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, CheckCircle2, Circle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { addProgressStep, uncompleteProgressStep, recordProgressResult } from "@/app/actions/agent/progress-steps";
import { WORK_RESULTS, latestWorkResult, type WorkEvent, type WorkResult } from "@/lib/claim-casework";
import { RESPONSIBLE_PARTIES } from "@/lib/claim-communication";
import type { Role } from "@/lib/permissions";

interface ProgressStep {
  id: string; claimId: string; stepOrder: number; label: string;
  description: string | null; isCompleted: boolean; completedAt: string | null;
  completedBy: string | null; createdAt: string; isSystem?: boolean;
}
type Evidence = { id: string; name: string; uploadState: string; scanState: string };
const date = (value: string) => new Date(value).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" });

export function ProgressEditor({ claimId, claimNumber, initialSteps, events = [], documents = [], role = "agent", readOnly = false, onReviewDecision }: {
  claimId: string; claimNumber: string; initialSteps: ProgressStep[]; events?: WorkEvent[];
  documents?: Evidence[]; role?: Role; readOnly?: boolean; onReviewDecision?: () => void;
}) {
  const canEdit = !readOnly && role !== "user";
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState("agent");
  const [expectedAt, setExpectedAt] = useState("");
  const [activityId, setActivityId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const open = initialSteps.filter((step) => !step.isCompleted);
  const completed = initialSteps.filter((step) => step.isCompleted);
  const cards = (steps: ProgressStep[]) => steps.map((step) => <WorkItem key={step.id} step={step} events={events} documents={documents} canEdit={canEdit} onReviewDecision={onReviewDecision} />);
  return <Card id="claim-progress" className="scroll-mt-36">
    <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>Current work & next actions</CardTitle><CardDescription className="mt-2">{open.length} open · {completed.length} closed. {canEdit ? "Record what has happened and what happens next. Each result updates the policyholder and keeps its follow-up linked." : "Work, results and next actions recorded by your claims team."}</CardDescription></div>{canEdit && <Button variant="outline" onClick={() => setAdding(!adding)}><Plus />Record claim activity</Button>}</div></CardHeader>
    <CardContent className="space-y-5">
      {adding && canEdit && <form className="space-y-4 rounded-xl border bg-muted/20 p-5" onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          setError("");
          try {
            const result = await addProgressStep(claimId, title, description, { responsibleParty: owner, followUpAt: `${expectedAt}:00+03:00` }, activityId);
            if (!result.success) { setError(result.error); return; }
            setTitle(""); setDescription(""); setExpectedAt(""); setActivityId(crypto.randomUUID()); setAdding(false); router.refresh();
          } catch { setError("Work could not be saved. Your entries are still here; please retry."); }
        });
      }}><fieldset disabled={pending} className="space-y-4">
        <Label htmlFor={`work-title-${claimId}`}>Next action to track</Label><Input id={`work-title-${claimId}`} value={title} onChange={(event) => { setTitle(event.target.value); setActivityId(crypto.randomUUID()); }} required minLength={3} maxLength={100} />
        <Label htmlFor={`work-description-${claimId}`}>What has happened? Update for the policyholder</Label><Textarea id={`work-description-${claimId}`} value={description} onChange={(event) => { setDescription(event.target.value); setActivityId(crypto.randomUUID()); }} required minLength={10} maxLength={2000} rows={3} />
        <Label htmlFor={`work-owner-${claimId}`}>Who acts next?</Label><select id={`work-owner-${claimId}`} className="w-full rounded-md border bg-background p-2 text-sm" value={owner} onChange={(event) => { setOwner(event.target.value); setActivityId(crypto.randomUUID()); }}>{Object.entries(RESPONSIBLE_PARTIES).filter(([value]) => value !== "none").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <Label htmlFor={`work-expected-${claimId}`}>When should the policyholder expect an update? (Nairobi time)</Label><Input id={`work-expected-${claimId}`} type="datetime-local" required value={expectedAt} onChange={(event) => { setExpectedAt(event.target.value); setActivityId(crypto.randomUUID()); }} />
        <p className="text-sm text-muted-foreground">This work and its instructions are visible to the policyholder. Record confidential discussion as an internal note.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit">{pending ? "Saving…" : "Save activity and next action"}</Button>
      </fieldset></form>}
      {open.length ? cards(open) : <p className="text-sm text-muted-foreground">No work is currently outstanding on {claimNumber}.</p>}
      {completed.length > 0 && <details><summary className="cursor-pointer text-sm font-medium text-primary">Closed work and recorded results ({completed.length})</summary><div className="mt-4 space-y-4">{cards(completed)}</div></details>}
    </CardContent>
  </Card>;
}

function WorkItem({ step, events, documents, canEdit, onReviewDecision }: {
  step: ProgressStep; events: WorkEvent[]; documents: Evidence[]; canEdit: boolean; onReviewDecision?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  const [renderTime] = useState(() => Date.now());
  const result = latestWorkResult(step.id, events);
  const plan = events.find((event) => event.type === "task_result" && event.metadata.followUpStepId === step.id || event.type === "task_created" && event.metadata.stepId === step.id);
  const due = typeof plan?.metadata.followUpAt === "string" ? plan.metadata.followUpAt : null;
  const owner = plan?.metadata.responsibleParty as keyof typeof RESPONSIBLE_PARTIES | undefined;
  const recommendation = result && ["recommend_approval", "recommend_rejection"].includes(result.result);
  return <article id={`work-${step.id}`} className="space-y-4 rounded-xl border p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 gap-3">{step.isCompleted ? <CheckCircle2 className="mt-1 size-5 shrink-0 text-muted-foreground" /> : <Circle className="mt-1 size-5 shrink-0 text-primary" />}<div><h3 className="break-words text-base font-semibold">{step.label}</h3>{step.description && <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{step.description}</p>}</div></div><Badge variant="secondary">{step.isCompleted ? result ? WORK_RESULTS[result.result] : "Completed · no result recorded" : "Open"}</Badge></div>
    {due && !step.isCompleted && <p className="text-sm">Next action: {owner && RESPONSIBLE_PARTIES[owner] || "Claims team"} · Expected {date(due)}{Date.parse(due) < renderTime ? " · Follow-up overdue" : ""}</p>}
    {result && <div className="space-y-2 rounded-lg bg-muted/30 p-4"><p className="text-xs text-muted-foreground">{step.isCompleted ? "Recorded result" : "Previous result"} · {date(result.createdAt)}</p><p className="whitespace-pre-wrap text-base leading-7">{result.summary}</p>{result.assessedAmount && <p className="text-sm"><strong>Assessed cost: KES {Number(result.assessedAmount).toLocaleString("en-KE", { minimumFractionDigits: 2 })}</strong><span className="mt-1 block">Source: {result.assessmentBasis}</span></p>}{result.followUpStepId && <p className="text-sm">Follow-up created: {result.followUpTitle} · {date(result.followUpAt)}</p>}{recommendation && <p className="text-sm">This is a recommendation. The claims manager records the final decision for the claim.</p>}</div>}
    {canEdit && <div className="flex flex-wrap gap-2">{!step.isCompleted ? <Button size="sm" variant="outline" onClick={() => setEditing(!editing)}>Record result / follow-up</Button> : <Button size="sm" variant="ghost" disabled={pending} onClick={() => startTransition(async () => {
      try { const response = await uncompleteProgressStep(step.id); if (!response.success) setError(response.error); else router.refresh(); }
      catch { setError("Could not reopen the work. Please retry."); }
    })}>Reopen work</Button>}{recommendation && step.isCompleted && onReviewDecision && <Button size="sm" variant="outline" onClick={onReviewDecision}>Review claim decision</Button>}</div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {editing && canEdit && !step.isCompleted && <WorkResultForm stepId={step.id} documents={documents} onSaved={() => { setEditing(false); router.refresh(); }} />}
  </article>;
}

function WorkResultForm({ stepId, documents, onSaved }: { stepId: string; documents: Evidence[]; onSaved: () => void }) {
  const [form, setForm] = useState<WorkResult>({ result: "completed", summary: "", followUpTitle: "", responsibleParty: "agent", followUpAt: "", assessedAmount: "", assessmentBasis: "", assessmentAttachmentId: "" });
  const [includeCost, setIncludeCost] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const edit = (key: keyof WorkResult, value: string) => { setForm((current) => ({ ...current, [key]: value })); setRequestId(crypto.randomUUID()); };
  const prefix = `result-${stepId}`;
  return <form className="space-y-4 rounded-xl border bg-muted/20 p-5" onSubmit={(event) => {
    event.preventDefault();
    startTransition(async () => {
      setError("");
      try {
        const response = await recordProgressResult(stepId, { ...form, followUpTitle: form.result === "follow_up" ? form.followUpTitle : "", followUpAt: form.result === "follow_up" && form.followUpAt ? `${form.followUpAt}:00+03:00` : "", assessedAmount: includeCost && form.result !== "cancelled" ? form.assessedAmount : "", assessmentBasis: includeCost && form.result !== "cancelled" ? form.assessmentBasis : "", assessmentAttachmentId: includeCost && form.result !== "cancelled" ? form.assessmentAttachmentId : "" }, requestId);
        if (!response.success) setError(response.error); else onSaved();
      } catch { setError("Could not save the result. Your entries remain here; retry to save the same result."); }
    });
  }}><fieldset disabled={pending} className="space-y-4">
    <Label htmlFor={`${prefix}-type`}>What was the result?</Label><select id={`${prefix}-type`} className="w-full rounded-md border bg-background p-2 text-sm" value={form.result} onChange={(event) => edit("result", event.target.value)}>{Object.entries(WORK_RESULTS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
    <Label htmlFor={`${prefix}-summary`}>Explain the result and what it means for the claim</Label><Textarea id={`${prefix}-summary`} value={form.summary} onChange={(event) => edit("summary", event.target.value)} required minLength={10} maxLength={4000} rows={4} />
    {form.result === "follow_up" && <div className="space-y-4 rounded-lg border p-4"><Label htmlFor={`${prefix}-next`}>What needs to happen next?</Label><Input id={`${prefix}-next`} value={form.followUpTitle} onChange={(event) => edit("followUpTitle", event.target.value)} required minLength={3} maxLength={100} /><Label htmlFor={`${prefix}-owner`}>Who is responsible?</Label><select id={`${prefix}-owner`} className="w-full rounded-md border bg-background p-2 text-sm" value={form.responsibleParty} onChange={(event) => edit("responsibleParty", event.target.value)}>{Object.entries(RESPONSIBLE_PARTIES).filter(([value]) => value !== "none").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><Label htmlFor={`${prefix}-due`}>Expected follow-up (Nairobi time)</Label><Input id={`${prefix}-due`} type="datetime-local" value={form.followUpAt} onChange={(event) => edit("followUpAt", event.target.value)} required /><p className="text-sm text-muted-foreground">Saving closes this work item and creates the linked follow-up in one action.</p></div>}
    {form.result !== "cancelled" && <div className="space-y-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeCost} onChange={(event) => { setIncludeCost(event.target.checked); setRequestId(crypto.randomUUID()); }} />This result includes an assessed cost or quotation</label>{includeCost && <div className="space-y-4 rounded-lg border p-4"><Label htmlFor={`${prefix}-cost`}>Assessed cost (KES)</Label><Input id={`${prefix}-cost`} inputMode="decimal" value={form.assessedAmount} onChange={(event) => edit("assessedAmount", event.target.value)} required maxLength={16} /><Label htmlFor={`${prefix}-basis`}>Source of this figure / assessment reference</Label><Textarea id={`${prefix}-basis`} value={form.assessmentBasis} onChange={(event) => edit("assessmentBasis", event.target.value)} required minLength={10} maxLength={1000} /><Label htmlFor={`${prefix}-document`}>Related assessment or quotation document (optional)</Label><select id={`${prefix}-document`} className="w-full rounded-md border bg-background p-2 text-sm" value={form.assessmentAttachmentId} onChange={(event) => edit("assessmentAttachmentId", event.target.value)}><option value="">Source described above</option>{documents.filter((doc) => doc.uploadState === "ready" && doc.scanState !== "rejected").map((doc) => <option key={doc.id} value={doc.id}>{doc.name}</option>)}</select></div>}</div>}
    <p className="text-sm text-muted-foreground">The result, explanation and follow-up are visible to the policyholder and create one notification. A recommendation does not reject or approve the claim.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit">{pending ? <><Loader2 className="size-4 animate-spin" />Saving…</> : "Save result and update claim history"}</Button>
  </fieldset></form>;
}
