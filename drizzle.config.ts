import { config } from "dotenv";

// Vercel writes local credentials to .env.local; fall back to .env for CI.
config({ path: [".env.local", ".env"] });
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "",
  },
  strict: true,
  verbose: true,
});
