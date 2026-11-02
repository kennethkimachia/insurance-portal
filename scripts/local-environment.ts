import { constants, copyFileSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";

export const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const localFile = new URL("../.env.local", import.meta.url);

function port(value: string | undefined, fallback: string, name: string) {
  const result = value || fallback;
  if (!/^\d+$/.test(result) || Number(result) < 1 || Number(result) > 65535) {
    throw new Error(`${name} must be a port between 1 and 65535.`);
  }
  return String(Number(result));
}

/** Local commands only accept this Compose stack, never a cloud connection. */
export function validateLocalEnvironment(values: Record<string, string>): Record<string, string> {
  const postgresPort = port(values.LOCAL_POSTGRES_PORT, "5433", "LOCAL_POSTGRES_PORT");
  const storagePort = port(values.LOCAL_S3_PORT, "8333", "LOCAL_S3_PORT");
  const databaseUrl = `postgresql://portal:portal_local_password@127.0.0.1:${postgresPort}/insurance_portal`;
  if (values.DATABASE_URL !== databaseUrl) {
    throw new Error("Local commands require the Compose DATABASE_URL from .env.local.example (matching LOCAL_POSTGRES_PORT). Cloud databases are refused.");
  }
  if (values.B2_ENDPOINT !== `http://127.0.0.1:${storagePort}` || values.B2_FORCE_PATH_STYLE !== "true") {
    throw new Error("Local commands require B2_ENDPOINT=http://127.0.0.1:LOCAL_S3_PORT and B2_FORCE_PATH_STYLE=true.");
  }
  for (const key of ["B2_REGION", "B2_KEY_ID", "B2_APP_KEY", "B2_BUCKET_NAME"]) {
    if (!values[key]?.trim()) throw new Error(`Set ${key} in .env.local.`);
  }
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(values.B2_BUCKET_NAME)) {
    throw new Error("B2_BUCKET_NAME must be a valid S3 bucket name.");
  }
  let appUrl: URL;
  try {
    appUrl = new URL(values.NEXT_PUBLIC_APP_URL);
  } catch {
    throw new Error("Set NEXT_PUBLIC_APP_URL to the local Next.js URL.");
  }
  if (appUrl.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(appUrl.hostname) || appUrl.username || appUrl.password) {
    throw new Error("NEXT_PUBLIC_APP_URL must be an HTTP localhost or 127.0.0.1 URL.");
  }
  return { ...values, LOCAL_POSTGRES_PORT: postgresPort, LOCAL_S3_PORT: storagePort };
}

export function loadLocalEnvironment(create = false) {
  if (create && !existsSync(localFile)) {
    copyFileSync(new URL("../.env.local.example", import.meta.url), localFile, constants.COPYFILE_EXCL);
    console.log("Created .env.local with local testing defaults. Existing .env was preserved.");
  }
  if (!existsSync(localFile)) throw new Error("Run npm run local:setup to create .env.local first.");
  // Parse this file explicitly: neither shell nor .env cloud credentials win.
  const values = validateLocalEnvironment(parse(readFileSync(localFile)));
  Object.assign(process.env, values);
  return values;
}
