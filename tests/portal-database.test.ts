import assert from "node:assert/strict";
import test from "node:test";
import {
  portalDatabaseFailure,
  portalDatabaseMessages,
  portalTablesAvailability,
  readWhenPortalReady,
  type PortalDatabaseAvailability,
} from "../lib/portal-database-policy";

test("portal access requires all three cutover tables, including role operations", () => {
  assert.equal(portalTablesAvailability({ actors: true, enrollments: true, roleOperations: true }), "ready");
  for (const tables of [
    { actors: false, enrollments: false, roleOperations: false },
    { actors: false, enrollments: true, roleOperations: true },
    { actors: true, enrollments: false, roleOperations: true },
    { actors: true, enrollments: true, roleOperations: false },
  ]) assert.equal(portalTablesAvailability(tables), "setup-required");
  assert.equal(portalTablesAvailability(undefined), "unavailable");
});

test("wrapped missing-table and missing-column errors identify an incomplete cutover", () => {
  for (const code of ["42P01", "42703"]) {
    const driver = Object.assign(new Error("Internal PostgreSQL detail"), { code });
    const wrapped = new Error("Failed query with account parameters", { cause: new Error("Wrapper", { cause: driver }) });
    assert.equal(portalDatabaseFailure(wrapped), "setup-required");
  }
});

test("connection, credentials and permission errors are unavailable rather than a schema diagnosis", () => {
  for (const code of ["ECONNREFUSED", "ETIMEDOUT", "28P01", "42501", "42601"])
    assert.equal(portalDatabaseFailure({ cause: { code } }), "unavailable");
  assert.equal(portalDatabaseFailure(new Error("portal_actors does not exist")), "unavailable");
  const cyclic: { cause?: unknown } = {};
  cyclic.cause = cyclic;
  assert.equal(portalDatabaseFailure(cyclic), "unavailable");
});

test("an incomplete or unreachable database skips the actor query and exposes no actor", async () => {
  let reads = 0;
  for (const status of ["setup-required", "unavailable"] as const) {
    const result = await readWhenPortalReady(async () => status, async () => {
      reads++;
      return { id: "privileged-actor" };
    });
    assert.deepEqual(result, { status });
    assert.equal("data" in result, false);
  }
  assert.equal(reads, 0);
});

test("ready reads preserve enrolled and not-yet-connected account results", async () => {
  const actor = { id: "existing-uuid", clerkUserId: "user_existing" };
  assert.deepEqual(await readWhenPortalReady(async () => "ready", async () => actor), { status: "ready", data: actor });
  assert.deepEqual(await readWhenPortalReady(async () => "ready", async () => null), { status: "ready", data: null });
});

test("a partial schema failure after readiness remains blocked without returning SQL or account parameters", async () => {
  const secret = "postgresql://hidden:password@host/db";
  const result = await readWhenPortalReady(async () => "ready", async () => {
    throw new Error(`Failed query: select private columns. params: user_private ${secret}`, { cause: { code: "42703" } });
  });
  assert.deepEqual(result, { status: "setup-required" });
  if (result.status === "ready") assert.fail("An incomplete schema cannot return an actor");
  assert.doesNotMatch(JSON.stringify(result), /password|user_private|select|postgresql/);
  assert.doesNotMatch(portalDatabaseMessages[result.status], /password|user_private|select|postgresql/);
});

test("a readiness query failure is sanitized and cannot fall through to account lookup", async () => {
  let read = false;
  const result = await readWhenPortalReady(async () => { throw { cause: { code: "ETIMEDOUT" } }; }, async () => {
    read = true;
    return "account";
  });
  assert.deepEqual(result, { status: "unavailable" });
  assert.equal(read, false);
});

test("retry rechecks readiness instead of keeping a failed cutover state", async () => {
  let availability: PortalDatabaseAvailability = "setup-required";
  let reads = 0;
  const retry = () => readWhenPortalReady(async () => availability, async () => ++reads);
  assert.deepEqual(await retry(), { status: "setup-required" });
  availability = "ready";
  assert.deepEqual(await retry(), { status: "ready", data: 1 });
});
