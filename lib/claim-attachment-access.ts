import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { claimAttachments, claims, policies } from '@/db/schema';
import { canAccessOrganization } from '@/lib/organization-access';
import type { SessionUser } from '@/lib/session';

export class ClaimAttachmentAccessError extends Error {
  constructor(
    message: string,
    public readonly status: 403 | 404 | 500,
  ) {
    super(message);
  }
}

export async function getAuthorizedClaimAttachment(
  session: SessionUser,
  claimId: string,
  attachmentId: string,
) {
  const [attachment] = await db
    .select({
      storageKey: claimAttachments.storageKey,
      originalFilename: claimAttachments.originalFilename,
      contentType: claimAttachments.contentType,
      organizationId: claims.organizationId,
      assignedAgentId: claims.assignedAgentId,
      policyholderId: policies.userId,
    })
    .from(claimAttachments)
    .innerJoin(claims, eq(claims.id, claimAttachments.claimId))
    .innerJoin(policies, eq(policies.id, claims.policyId))
    .where(
      and(
        eq(claimAttachments.id, attachmentId),
        eq(claimAttachments.claimId, claimId),
      ),
    )
    .limit(1);

  if (!attachment) {
    throw new ClaimAttachmentAccessError('Attachment not found', 404);
  }

  const isPolicyholder =
    session.role === 'user' && attachment.policyholderId === session.id;
  const isAssignedAgent =
    session.role === 'agent' &&
    attachment.assignedAgentId === session.id &&
    (await canAccessOrganization(session, attachment.organizationId));
  const isOrganizationManager =
    (session.role === 'head_agent' || session.role === 'admin') &&
    (await canAccessOrganization(session, attachment.organizationId));

  if (!isPolicyholder && !isAssignedAgent && !isOrganizationManager) {
    throw new ClaimAttachmentAccessError('Forbidden', 403);
  }

  const expectedKeyPrefix =
    attachment.organizationId + '/claims/' + claimId + '/';
  if (!attachment.storageKey.startsWith(expectedKeyPrefix)) {
    console.error('Attachment storage key does not match its claim', {
      claimId,
      attachmentId,
    });
    throw new ClaimAttachmentAccessError('Attachment unavailable', 500);
  }

  return attachment;
}
