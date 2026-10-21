export interface DraftSaveResult {
  success: boolean;
  claimId?: string;
  claimNumber?: string;
  savedAt?: string | Date;
  error?: string;
}

/** Serializes first saves so every subsequent save uses the original persisted ID. */
export class ClaimDraftSaveQueue<T> {
  private tail: Promise<unknown> = Promise.resolve();
  private lastSerialized: string | null = null;
  private lastResult: DraftSaveResult | null = null;
  private stopped = false;
  readonly claimId: string;

  constructor(
    private readonly persist: (
      form: T,
      claimId: string,
    ) => Promise<DraftSaveResult>,
    initialClaimId?: string,
    initialForm?: T,
  ) {
    this.claimId = initialClaimId ?? crypto.randomUUID();
    if (initialClaimId && initialForm)
      this.lastSerialized = JSON.stringify(initialForm);
  }

  save(form: T): Promise<DraftSaveResult> {
    const serialized = JSON.stringify(form);
    const task = this.tail.then(async () => {
      if (this.stopped)
        return (
          this.lastResult || {
            success: false,
            error: "This report has already been submitted",
          }
        );
      if (serialized === this.lastSerialized && this.lastResult)
        return this.lastResult;
      let result: DraftSaveResult;
      try {
        result = await this.persist(form, this.claimId);
      } catch (error) {
        result = {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Draft could not be saved. Your entries are still on this page.",
        };
      }
      if (result.success && result.claimId === this.claimId) {
        this.lastSerialized = serialized;
        this.lastResult = result;
      }
      return result.success && result.claimId !== this.claimId
        ? {
            success: false,
            error: "The saved draft reference did not match. Please retry.",
          }
        : result;
    });
    this.tail = task.catch(() => undefined);
    return task;
  }

  stop() {
    this.stopped = true;
  }
}
