/** Explicit reviewed UUID mappings only. Default is a preview; --apply writes Clerk metadata, never PostgreSQL. */
import { readFileSync, writeFileSync, mkdtempSync, unlinkSync, rmdirSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

const app = "app_3KGUiNX8cvVS15Py8pI6ehhR6YC";
const manifestSchema = z.array(z.object({
  actorId: z.string().uuid(), clerkUserId: z.string().regex(/^user_[a-zA-Z0-9]+$/),
  portalRole: z.enum(["admin", "head_agent", "agent", "user"]),
}).strict()).min(1);
const manifestPath = process.argv[2];
if (!manifestPath || manifestPath.startsWith("--")) throw new Error("Usage: npx tsx scripts/clerk-link-actors.ts <reviewed-manifest.json> [--apply]");
if (process.argv.slice(3).some((flag) => flag !== "--apply")) throw new Error("Unknown option. This tool targets the linked DEVELOPMENT instance only.");
const manifest = manifestSchema.parse(JSON.parse(readFileSync(manifestPath, "utf8").replace(/^\uFEFF/, "")));
if (new Set(manifest.map((row) => row.actorId)).size !== manifest.length || new Set(manifest.map((row) => row.clerkUserId)).size !== manifest.length)
  throw new Error("Duplicate UUID or Clerk user ID. Review the manifest.");

function cli(args: string[]) {
  // Windows .cmd shims require cmd.exe. JSON is always supplied through --file.
  if (process.platform === "win32") {
    const quoted = args.map((arg) => {
      if (/[\r\n&|<>^%!"`$]/.test(arg)) throw new Error("Unsupported CLI argument.");
      return '"' + arg + '"';
    });
    const result = spawnSync("cmd.exe", ["/d", "/s", "/c", `clerk.cmd ${quoted.join(" ")}`], {
      windowsVerbatimArguments: true, windowsHide: true, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    });
    if (result.error || result.status !== 0) throw new Error("Clerk CLI call failed. Check CLI login, application access, and request configuration.");
    return result.stdout;
  }
  return execFileSync("clerk", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

// Validate every mapping before any mutation; never select ownership using email.
for (const row of manifest) {
  const result = JSON.parse(cli(["users", "list", "--app", app, "--instance", "dev", "--user-id", row.clerkUserId, "--json"]));
  const user = result.data?.find((entry: { id: string }) => entry.id === row.clerkUserId);
  const primary = user?.email_addresses?.find((entry: { id: string }) => entry.id === user.primary_email_address_id);
  if (!user || user.banned || primary?.verification?.status !== "verified") throw new Error(`Account ${row.clerkUserId} must exist, be active, and have a verified primary email.`);
  if (user.private_metadata?.portalActorId && user.private_metadata.portalActorId !== row.actorId)
    throw new Error(`Account ${row.clerkUserId} is already linked to a different UUID.`);
}
if (!process.argv.includes("--apply")) {
  console.log(JSON.stringify({ app, instance: "dev", previewOnly: true, mappings: manifest }, null, 2));
} else {
  // Explicit mapping is reviewed by the operator. Metadata endpoint merges other keys.
  for (const row of manifest) {
    const body = JSON.stringify({ public_metadata: { portalRole: row.portalRole }, private_metadata: { portalActorId: row.actorId } });
    const temp = mkdtempSync(join(tmpdir(), "portal-clerk-metadata-"));
    const payload = join(temp, "metadata.json");
    let user;
    try {
      writeFileSync(payload, body, "utf8");
      user = JSON.parse(cli(["api", `/users/${row.clerkUserId}/metadata`, "-X", "PATCH", "--file", payload, "--app", app, "--instance", "dev", "--yes"]));
    } finally { unlinkSync(payload); rmdirSync(temp); }
    if (user.public_metadata?.portalRole !== row.portalRole || user.private_metadata?.portalActorId !== row.actorId) throw new Error(`Metadata confirmation failed for ${row.clerkUserId}. Review completed rows before retrying.`);
    console.log(`Linked ${row.clerkUserId} to ${row.actorId} with role ${row.portalRole}.`);
  }
}
