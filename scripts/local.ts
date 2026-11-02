import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { loadLocalEnvironment, projectRoot } from "./local-environment";

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { cwd: projectRoot, stdio: "inherit", env: process.env });
  if (result.error) throw new Error(`Could not start ${command}. Check that it is installed and available.`);
  if (result.status !== 0) throw new Error(`${command} failed (exit ${result.status ?? result.signal}).`);
}

function compose(args: string[]) {
  run("docker", ["compose", "--project-name", "insurance-portal-local", "--env-file", ".env.local", "-f", "compose.yaml", ...args]);
}

async function main() {
  const command = process.argv[2];
  if (!["setup", "up", "dev", "db:push", "check", "down"].includes(command)) {
    throw new Error("Use npm run local:setup, local:up, local:dev, local:db:push, local:check, or local:down.");
  }
  const local = loadLocalEnvironment(command === "setup");
  if (command === "setup" || command === "up") {
    compose(["up", "--detach", "--wait", "--wait-timeout", "120"]);
    if (command === "up") {
      // S3 checks go beyond the container liveness probe.
      const { checkLocalStorage } = await import("./local-check");
      await checkLocalStorage();
    }
  }
  if (command === "setup" || command === "db:push") {
    // Keep Drizzle's interactive review for potentially destructive local changes.
    run(process.execPath, [join(projectRoot, "node_modules/drizzle-kit/bin.cjs"), "push", "--config=drizzle.local.config.ts"]);
  }
  if (command === "setup" || command === "check") {
    const { checkLocalServices } = await import("./local-check");
    await checkLocalServices();
  }
  if (command === "setup") {
    console.log("Local services and schema are ready. Add Clerk development keys to .env.local, then run npm run local:dev.");
  }
  if (command === "dev") {
    if (!local.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_") || !local.CLERK_SECRET_KEY?.startsWith("sk_test_")) {
      throw new Error("Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (pk_test_...) and CLERK_SECRET_KEY (sk_test_...) from a Clerk development instance to .env.local. See docs/local-development.md.");
    }
    const url = new URL(local.NEXT_PUBLIC_APP_URL);
    Object.assign(process.env, { NODE_ENV: "development" });
    run(process.execPath, [join(projectRoot, "node_modules/next/dist/bin/next"), "dev", "--hostname", url.hostname, "--port", url.port || "80"]);
  }
  if (command === "down") compose(["down"]);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Local setup failed.");
  process.exitCode = 1;
});
