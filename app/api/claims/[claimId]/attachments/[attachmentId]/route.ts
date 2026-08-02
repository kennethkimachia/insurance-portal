import { NextRequest, NextResponse } from 'next/server';
import {
  ClaimAttachmentAccessError,
  getAuthorizedClaimAttachment,
} from '@/lib/claim-attachment-access';
import { getSessionUser } from '@/lib/session';
import { getFileUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{
    claimId: string;
    attachmentId: string;
  }>;
}

function inlineContentDisposition(filename: string) {
  const quote = String.fromCharCode(34);
  const apostrophe = String.fromCharCode(39);
  const fallbackFilename = filename
    .replace(/[\r\n]/g, '_')
    .replaceAll(quote, '_');
  const encodedFilename = encodeURIComponent(filename).replace(
    /[!'()*]/g,
    (character) =>
      '%' + character.charCodeAt(0).toString(16).toUpperCase(),
  );

  return (
    'inline; filename=' +
    quote +
    fallbackFilename +
    quote +
    '; filename*=UTF-8' +
    apostrophe +
    apostrophe +
    encodedFilename
  );
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { claimId, attachmentId } = await context.params;

  try {
    const attachment = await getAuthorizedClaimAttachment(
      session,
      claimId,
      attachmentId,
    );
    const fileUrl = await getFileUrl(attachment.storageKey, 5 * 60, {
      contentType: attachment.contentType,
      contentDisposition: inlineContentDisposition(attachment.originalFilename),
    });
    const response = NextResponse.redirect(fileUrl, 307);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch (error) {
    if (error instanceof ClaimAttachmentAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error('Could not create attachment view URL', {
      claimId,
      attachmentId,
      error,
    });
    return NextResponse.json({ error: 'Attachment unavailable' }, { status: 500 });
  }
}
