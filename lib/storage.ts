import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  endpoint: process.env.B2_ENDPOINT!,
  region: process.env.B2_REGION!,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID!,
    secretAccessKey: process.env.B2_APP_KEY!,
  },
});

const BUCKET = process.env.B2_BUCKET_NAME!;

/**
 * Generate a presigned URL for uploading a file directly from the client.
 * The client will PUT the file to this URL.
 */
export async function getUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3, command, { expiresIn });
}

/**
 * Generate a presigned URL for downloading / viewing a file.
 */
export async function getFileUrl(key: string, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  return getSignedUrl(s3, command, { expiresIn });
}

/**
 * Delete a file from the bucket.
 */
export async function deleteFile(key: string) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  return s3.send(command);
}

import { randomUUID } from "crypto";
import path from "path";

/**
 * Build a storage key for claim attachments.
 * Format: {orgId}/claims/{claimId}/{uuid}.{ext}
 */
export function buildClaimFileKey(
  orgId: string,
  claimId: string,
  originalFilename: string
) {
  const ext = path.extname(originalFilename) || "";
  return `${orgId}/claims/${claimId}/${randomUUID()}${ext}`;
}

export { s3, BUCKET };
