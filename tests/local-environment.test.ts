import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { validateLocalEnvironment } from "../scripts/local-environment";

const defaults = parse(readFileSync(new URL("../.env.local.example", import.meta.url)));

test("checked-in local defaults work without cloud credentials", () => {
  const values = validateLocalEnvironment(defaults);
  assert.equal(values.LOCAL_POSTGRES_PORT, "5433");
  assert.equal(values.B2_FORCE_PATH_STYLE, "true");
});

test("local schema commands reject cloud and unrelated local databases", () => {
  for (const DATABASE_URL of [
    "postgresql://user:secret@project.neon.tech/production?sslmode=require",
    "postgresql://portal:portal_local_password@127.0.0.1:5433/another_database",
    "postgresql://portal:portal_local_password@127.0.0.1:5432/insurance_portal",
    `${defaults.DATABASE_URL}?host=remote.example.test`,
    "",
  ]) {
    assert.throws(() => validateLocalEnvironment({ ...defaults, DATABASE_URL }), /Compose DATABASE_URL/);
  }
});

test("port overrides must match the application URLs", () => {
  assert.throws(() => validateLocalEnvironment({ ...defaults, LOCAL_POSTGRES_PORT: "5544" }), /Compose DATABASE_URL/);
  assert.throws(() => validateLocalEnvironment({ ...defaults, LOCAL_S3_PORT: "9000" }), /B2_ENDPOINT/);
  const values = validateLocalEnvironment({
    ...defaults,
    LOCAL_POSTGRES_PORT: "5544",
    DATABASE_URL: defaults.DATABASE_URL.replace(":5433/", ":5544/"),
    LOCAL_S3_PORT: "9000",
    B2_ENDPOINT: "http://127.0.0.1:9000",
  });
  assert.equal(values.LOCAL_S3_PORT, "9000");
  for (const LOCAL_POSTGRES_PORT of ["0", "65536", "5433; echo unsafe", "-1"]) {
    assert.throws(() => validateLocalEnvironment({ ...defaults, LOCAL_POSTGRES_PORT }), /between 1 and 65535/);
  }
});

test("local commands reject cloud storage and nonlocal app URLs", () => {
  const invalidSettings: Record<string, string>[] = [
    { B2_ENDPOINT: "https://s3.us-west-004.backblazeb2.com" },
    { B2_FORCE_PATH_STYLE: "false" },
    { B2_APP_KEY: "" },
    { NEXT_PUBLIC_APP_URL: "https://portal.example.test" },
    { NEXT_PUBLIC_APP_URL: "invalid" },
  ];
  for (const overrides of invalidSettings) {
    assert.throws(() => validateLocalEnvironment({ ...defaults, ...overrides }));
  }
});
