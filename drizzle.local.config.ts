import { defineConfig } from "drizzle-kit";
import { loadLocalEnvironment } from "./scripts/local-environment";

const local = loadLocalEnvironment();

// Isolated from the manually reviewed migrations for existing cloud databases.
export default defineConfig({
  schema: "./db/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: { url: local.DATABASE_URL },
});
