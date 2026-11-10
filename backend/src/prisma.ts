
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing from .env");
}

// Test runs use an isolated, freshly copied schema; production workers never see their queued provider fixtures.
const testSchema = process.env.MOTEXA_TEST_SCHEMA;
if (testSchema && (process.env.NODE_ENV !== "test" || !/^motexa_test3d_[a-f0-9]{16}$/.test(testSchema))) throw new Error("Invalid isolated test schema.");
const adapter = new PrismaPg({
  connectionString,
  ...(testSchema ? { options: `-c search_path=${testSchema},public` } : {}),
}, testSchema ? { schema: testSchema } : undefined);

export const prisma = new PrismaClient({
  adapter,
});
