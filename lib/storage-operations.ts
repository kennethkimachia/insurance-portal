import { createHash } from "node:crypto";
import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
type StorageSender = {
    send(command: PutObjectCommand | HeadObjectCommand): Promise<{
        ContentLength?: number;
        Metadata?: Record<string, string>;
    }>;
};
/** Keep the reservation on any uncertain result; the same key/content can be retried. */
export async function putVerifiedEvidence(sender: StorageSender, input: {
    bucket: string;
    key: string;
    bytes: Uint8Array;
    contentType: string;
    sha256: string;
}) {
    if (createHash("sha256").update(input.bytes).digest("hex") !== input.sha256)
        throw new Error("Evidence checksum changed before upload. Retry the original file.");
    await sender.send(new PutObjectCommand({
        Bucket: input.bucket, Key: input.key, Body: input.bytes,
        ContentLength: input.bytes.byteLength, ContentType: input.contentType,
        ContentMD5: createHash("md5").update(input.bytes).digest("base64"),
        Metadata: { sha256: input.sha256 },
    }));
    const stored = await sender.send(new HeadObjectCommand({ Bucket: input.bucket, Key: input.key }));
    if (stored.ContentLength !== input.bytes.byteLength || stored.Metadata?.sha256 !== input.sha256)
        throw new Error("Storage verification did not finish. Your report is saved; retry the same file.");
}
