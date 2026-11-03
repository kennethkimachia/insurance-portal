import assert from "node:assert/strict";
import test from "node:test";
import { dashboardRedirect } from "../lib/dashboard-redirect";
import type { Role } from "../lib/permissions";

test("dashboard entry points return an HTTP redirect for each effective role", () => {
  const destinations: Record<Role, string> = {
    user: "/dashboard/user",
    agent: "/dashboard/agent",
    head_agent: "/dashboard/head-agent",
    admin: "/dashboard/admin",
  };
  for (const entry of ["/", "/dashboard"]) {
    for (const role of Object.keys(destinations) as Role[]) {
      const response = dashboardRedirect(`http://localhost:3000${entry}`, role);
      assert.equal(response.status, 307);
      assert.equal(response.headers.get("location"), `http://localhost:3000${destinations[role]}`);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.equal(response.body, null);
    }
  }
});

test("an unenrolled or signed-out session goes through account continuation", () => {
  const response = dashboardRedirect("https://portal.example.test/dashboard");
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "https://portal.example.test/auth/continue");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("role changes are routed afresh without forwarding query parameters", () => {
  const url = "http://localhost:3000/dashboard?next=https://other.example.test&_rsc=old";
  for (const role of ["user", "agent", "head_agent", "admin", "user"] as const) {
    const response = dashboardRedirect(url, role);
    const location = new URL(response.headers.get("location")!);
    assert.equal(location.origin, "http://localhost:3000");
    assert.equal(location.pathname, `/dashboard/${role === "head_agent" ? "head-agent" : role}`);
    assert.equal(location.search, "");
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  }
});
