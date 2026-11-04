import { S3Client, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { storageConfiguration } from "./storage-policy";
let storage: {
    s3: S3Client;
    bucket: string;
} | undefined;
/** Lazy initialization: missing storage variables must not prevent claim reporting. */
export function getClaimStorage() {
    if (!storage) {
        const { bucket, ...config } = storageConfiguration(process.env);
        storage = { s3: new S3Client({ ...config, maxAttempts: 3 }), bucket };
    }
    return storage;
}
/** Short-lived private downloads; a signature alone does not prove object existence. */
export async function getFileUrl(key: string, expiresIn = 300, response?: {
    contentType?: string;
    contentDisposition?: string;
}) {
    if (!key || !Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 3600)
        throw new Error("Invalid document download request.");
    const { s3, bucket } = getClaimStorage();
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return getSignedUrl(s3, new GetObjectCommand({
        Bucket: bucket, Key: key,
        ResponseContentType: response?.contentType,
        ResponseContentDisposition: response?.contentDisposition,
    }), { expiresIn });
}
export async function deleteFile(key: string) {
    const { s3, bucket } = getClaimStorage();
    return s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
/** Server-side original bytes for authorized claim packages; never exposed as a URL. */
export async function* streamClaimFile(key: string, signal: AbortSignal) {
    const { s3, bucket } = getClaimStorage();
    const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }), { abortSignal: signal });
    if (!result.Body) throw new Error("Document unavailable. Retry the export.");
    const reader = result.Body.transformToWebStream().getReader();
    try {
        while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            yield chunk.value;
        }
    } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
    }
}
export function buildClaimFileKey(orgId: string, claimId: string, originalFilename: string) {
    const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
    if (!uuid.test(orgId) || !uuid.test(claimId))
        throw new Error("Invalid claim storage reference.");
    const ext = path.extname(originalFilename).toLowerCase();
    if (!/^\.[a-z0-9]{1,8}$/.test(ext))
        throw new Error("Invalid evidence filename.");
    return `${orgId}/claims/${claimId}/${randomUUID()}${ext}`;
}
