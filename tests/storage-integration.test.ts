import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { storageConfiguration, StorageConfigurationError } from "../lib/storage-policy";
import { putVerifiedEvidence } from "../lib/storage-operations";
import { buildClaimFileKey } from "../lib/storage";

const env = { B2_ENDPOINT: "https://s3.us-west-004.backblazeb2.com", B2_REGION: "us-west-004", B2_KEY_ID: "synthetic-key", B2_APP_KEY: "synthetic-secret", B2_BUCKET_NAME: "private-test-evidence" };
const bytes = Buffer.from("%PDF-1.7 synthetic evidence");
const input = { bucket: env.B2_BUCKET_NAME, key: "insurer/claims/claim/file.pdf", bytes, contentType: "application/pdf", sha256: createHash("sha256").update(bytes).digest("hex") };

test("Backblaze configuration requires all five variables and matching HTTPS endpoint/region", () => {
  const config = storageConfiguration(env);
  assert.equal(config.region, "us-west-004");
  assert.equal(config.endpoint, env.B2_ENDPOINT);
  assert.equal(config.requestChecksumCalculation, "WHEN_REQUIRED");
  assert.equal(config.responseChecksumValidation, "WHEN_REQUIRED");
  for (const key of Object.keys(env)) assert.throws(() => storageConfiguration({ ...env, [key]: "" }), StorageConfigurationError);
  for (const changes of [
    { B2_REGION: "eu-central-003" }, { B2_ENDPOINT: "http://s3.us-west-004.backblazeb2.com" },
    { B2_ENDPOINT: "https://s3.us-west-004.backblazeb2.com/bucket" },
    { B2_ENDPOINT: "https://key:secret@s3.us-west-004.backblazeb2.com" },
    { B2_ENDPOINT: "https://other.example.test" }, { B2_BUCKET_NAME: "" }, { B2_FORCE_PATH_STYLE: "yes" },
  ]) assert.throws(() => storageConfiguration({ ...env, ...changes }), StorageConfigurationError);
  assert.doesNotMatch(new StorageConfigurationError().message, /synthetic-secret|synthetic-key/);
});

test("local S3 remains explicit while importing storage without credentials is safe", () => {
  const config = storageConfiguration({ ...env, B2_ENDPOINT: "http://127.0.0.1:8333", B2_REGION: "us-east-1", B2_FORCE_PATH_STYLE: "true" });
  assert.equal(config.forcePathStyle, true);
  const org = crypto.randomUUID(), claim = crypto.randomUUID();
  const key = buildClaimFileKey(org, claim, "private-name.PDF");
  assert.match(key, new RegExp(`^${org}/claims/${claim}/[a-f0-9-]+\\.pdf$`));
  assert.equal(key.includes("private-name"), false);
  assert.throws(() => buildClaimFileKey("../outside", claim, "file.pdf"));
  assert.throws(() => buildClaimFileKey(org, claim, "file"));
});

test("evidence upload uses S3 PutObject, MD5, SHA-256 metadata, then verifies HeadObject", async () => {
  const calls: (PutObjectCommand | HeadObjectCommand)[] = [];
  await putVerifiedEvidence({ async send(command) {
    calls.push(command);
    if (command instanceof HeadObjectCommand) return { ContentLength: bytes.length, Metadata: { sha256: input.sha256 } };
    return {};
  } }, input);
  assert.equal(calls.length, 2);
  assert.ok(calls[0] instanceof PutObjectCommand);
  assert.ok(calls[1] instanceof HeadObjectCommand);
  const put = calls[0].input;
  assert.equal(put.Bucket, input.bucket);
  assert.equal(put.Key, input.key);
  assert.equal(put.ContentType, input.contentType);
  assert.equal(put.ContentLength, bytes.length);
  assert.equal(put.ContentMD5, createHash("md5").update(bytes).digest("base64"));
  assert.deepEqual(put.Metadata, { sha256: input.sha256 });
  assert.equal("ACL" in put, false);
  assert.equal("Tagging" in put, false);
});

test("a failed put, missing object, wrong size or wrong digest cannot confirm upload", async () => {
  for (const outcome of ["put-fails", "head-fails", "size-mismatch", "hash-mismatch"]) {
    await assert.rejects(putVerifiedEvidence({ async send(command) {
      if (command instanceof PutObjectCommand) { if (outcome === "put-fails") throw new Error("put failed"); return {}; }
      if (outcome === "head-fails") throw new Error("object unavailable");
      return { ContentLength: outcome === "size-mismatch" ? 0 : bytes.length, Metadata: { sha256: outcome === "hash-mismatch" ? "wrong" : input.sha256 } };
    } }, input));
  }
  let calls = 0;
  await assert.rejects(putVerifiedEvidence({ async send() { calls++; return {}; } }, { ...input, sha256: "wrong" }), /checksum/);
  assert.equal(calls, 0);
});
