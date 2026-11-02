"use server";
import { db } from "@/db";
import { claimEvents, claimNotifications, claims } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { requireClaimAccess, lockClaimForMutation } from "@/lib/claim-access";
import { claimUpdateSchema, validateUpdateTiming, claimUpdateReplayMatches } from "@/lib/claim-communication";
import { closedClaimStatuses } from "@/lib/claim-workflow";
import { actionError } from "@/lib/action-errors";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
export async function publishClaimUpdate(claimId: string, input: unknown, requestId: string) {
    try {
        const actor = await requireSession();
        const claim = await requireClaimAccess(actor, claimId, "manage");
        const parsed = claimUpdateSchema.safeParse(input);
        if (!parsed.success)
            return { success: false as const, error: parsed.error.issues[0].message };
        const data = parsed.data;
        const eventId = z.string().uuid().parse(requestId);
        await db.transaction(async (tx) => {
            const fresh = await lockClaimForMutation(tx, actor, claimId, claim.version);
            const [existing] = await tx.select().from(claimEvents).where(eq(claimEvents.id, eventId));
            if (existing) {
                if (!claimUpdateReplayMatches(existing, claimId, actor.id, data))
                    throw new Error("This update reference was already used. Refresh the claim before publishing another update.");
                return;
            }
            if (fresh.status === "draft" || closedClaimStatuses.includes(fresh.status))
                throw new Error("Publish updates on open submitted claims. Reopen a closed claim through the manager workflow first.");
            const timing = validateUpdateTiming(data);
            if (timing)
                throw new Error(timing);
            await tx.insert(claimEvents).values({ id: eventId, claimId, actorId: actor.id, type: "progress_update", visibility: data.visibility,
                content: `${data.title}\n${data.message}`, metadata: data });
            await tx.update(claims).set({ version: sql `${claims.version} + 1` }).where(eq(claims.id, claimId));
            if (data.visibility === "public")
                await tx.insert(claimNotifications).values({
                    claimId, userId: claim.policyholderId, type: "progress_update", message: `New update on ${claim.claimNumber}: ${data.title}`,
                });
        });
        revalidatePath(`/claims/${claimId}`);
        revalidatePath("/dashboard", "layout");
        revalidatePath("/claims");
        return { success: true as const };
    }
    catch (error) {
        return { success: false as const, error: actionError(error, "Could not publish this update. Retry after refreshing the claim.") };
    }
}
