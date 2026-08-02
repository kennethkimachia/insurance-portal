'use client';

import Image from 'next/image';
import { ExternalLink, FileText, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ClaimAttachmentCardProps {
  claimId: string;
  attachment: {
    id: string;
    originalFilename: string;
    contentType: string;
    sizeBytes: number;
  };
}

export function ClaimAttachmentCard({
  claimId,
  attachment,
}: ClaimAttachmentCardProps) {
  const viewUrl =
    '/api/claims/' +
    encodeURIComponent(claimId) +
    '/attachments/' +
    encodeURIComponent(attachment.id);
  const isImage = attachment.contentType.startsWith('image/');
  const isVideo = attachment.contentType.startsWith('video/');
  const actionLabel = isImage
    ? 'View image'
    : isVideo
      ? 'View video'
      : 'View document';

  return (
    <div className='overflow-hidden rounded-lg border bg-background/70'>
      {isImage && (
        <a
          href={viewUrl}
          target='_blank'
          rel='noreferrer'
          className='relative block aspect-video overflow-hidden border-b bg-muted/40'
          aria-label={'View ' + attachment.originalFilename}
        >
          <Image
            src={viewUrl}
            alt={'Preview of ' + attachment.originalFilename}
            fill
            unoptimized
            className='object-contain transition-transform hover:scale-[1.02]'
            sizes='(min-width: 640px) 50vw, 100vw'
          />
        </a>
      )}
      <div className='flex items-start gap-3 p-3'>
        <div className='rounded-md bg-primary/10 p-2 text-primary'>
          {isImage ? (
            <ImageIcon className='h-4 w-4' />
          ) : (
            <FileText className='h-4 w-4' />
          )}
        </div>
        <div className='min-w-0 flex-1'>
          <p className='break-words text-sm font-medium text-foreground'>
            {attachment.originalFilename}
          </p>
          <p className='mt-1 text-xs text-muted-foreground'>
            {attachment.contentType} -{' '}
            {Math.max(1, Math.round(attachment.sizeBytes / 1024))} KB
          </p>
          <Button asChild variant='outline' size='sm' className='mt-3'>
            <a href={viewUrl} target='_blank' rel='noreferrer'>
              <ExternalLink data-icon='inline-start' />
              {actionLabel}
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
