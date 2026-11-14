
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing from .env");
}

// Tests never touch the development data: under a test runner NODE_ENV must be "test", and NODE_ENV=test only ever connects to a
// *_test database (npm test makes a fresh motexa_test; scripts/test.mjs). Checked here so no test file can get around it.
const databaseName = (() => { try { return decodeURIComponent(new URL(connectionString).pathname.slice(1)); } catch { return ""; } })();
if (process.env.NODE_TEST_CONTEXT && process.env.NODE_ENV !== "test") throw new Error("Backend tests run only with `npm test` (NODE_ENV=test, the motexa_test database).");
if (process.env.NODE_ENV === "test" && !/_test$/.test(databaseName)) throw new Error(`NODE_ENV=test only connects to a *_test database, not "${databaseName}". Run \`npm test\`.`);
const adapter = new PrismaPg({ connectionString });

export const prisma = new PrismaClient({
  adapter,
});
