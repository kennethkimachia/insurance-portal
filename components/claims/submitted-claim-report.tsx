import { claimReportSections, reportEntries, reportFieldLabel, reportValue } from "@/lib/claim-report";

function Answer({ field, value }: { field: string; value: unknown }) {
  if (Array.isArray(value)) {
    if (!value.length) return <p className="text-base text-muted-foreground">None reported at submission</p>;
    return <div className="space-y-4">{value.map((item, index) => (
      <div key={index} className="rounded-lg border bg-background p-5">
        <p className="mb-4 text-sm font-semibold text-primary">{field === "thirdParties" ? "Third party" : "Item"} {index + 1}</p>
        {item && typeof item === "object" ? <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {reportEntries(item).map(([key, entry]) => <div key={key} className="min-w-0"><dt className="mb-1 text-sm text-muted-foreground">{reportFieldLabel(key)}</dt><dd className="whitespace-pre-wrap break-words text-base leading-7"><Answer field={key} value={entry} /></dd></div>)}
        </dl> : <p>{reportValue(field, item)}</p>}
      </div>
    ))}</div>;
  }
  if (value && typeof value === "object") return <dl className="space-y-3">{reportEntries(value as Record<string, unknown>).map(([key, entry]) => <div key={key}><dt className="text-sm text-muted-foreground">{reportFieldLabel(key)}</dt><dd><Answer field={key} value={entry} /></dd></div>)}</dl>;
  return <span className={value === "" || value == null ? "text-muted-foreground" : undefined}>{reportValue(field, value)}</span>;
}

export function SubmittedClaimReport({ report, source }: {
  report: Record<string, unknown> | null;
  source: "original" | "saved" | "legacy" | "unavailable";
}) {
  if (!report) return <div className="rounded-xl border p-6"><h2 className="text-xl font-semibold">Submitted report unavailable</h2><p className="mt-2 text-base leading-7 text-muted-foreground">No saved answers were found for this older claim. Review the attached claim form or request a copy before making an assessment.</p></div>;
  return <div id="original-report" className="space-y-6 scroll-mt-24">
    <div><h2 className="text-xl font-semibold">Submitted claim form</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{source === "original" ? "Original answers as submitted. Corrections and amendments are recorded separately in Activity." : source === "legacy" ? "Recovered from the stored claim details. An original form snapshot was not preserved for this older claim." : "Saved form answers. An original submission snapshot was not preserved for this claim."}</p></div>
    {claimReportSections(report).map((section) => <section key={section.title} className="overflow-hidden rounded-xl border bg-card">
      <h3 className="border-b bg-muted/35 px-6 py-4 text-base font-semibold">{section.title}</h3>
      <dl className="grid gap-x-10 gap-y-6 p-6 md:grid-cols-2">
        {section.fields.map(({ key, label, value }) => <div key={key} className={`min-w-0 ${Array.isArray(value) || ["description", "damageSummary", "entryMethod", "premisesDamage", "witnesses", "thirdPartyInjuries"].includes(key) ? "md:col-span-2" : ""}`}>
          <dt className="mb-1.5 text-sm text-muted-foreground">{label}</dt>
          <dd className="whitespace-pre-wrap break-words text-base font-medium leading-7"><Answer field={key} value={value} /></dd>
        </div>)}
      </dl>
    </section>)}
  </div>;
}
