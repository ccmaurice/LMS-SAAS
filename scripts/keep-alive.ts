import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import path from "node:path";

// Load .env and .env.local variables
const envLocalPath = path.resolve(process.cwd(), ".env.local");
const envPath = path.resolve(process.cwd(), ".env");

const localEnv = dotenv.config({ path: envLocalPath });
dotenvExpand.expand(localEnv);

const mainEnv = dotenv.config({ path: envPath });
dotenvExpand.expand(mainEnv);

import { prisma } from "../src/lib/db";

async function main() {
  console.log("=== DB Keep-Alive Ping Started ===");
  const start = Date.now();
  try {
    // Run a lightweight query to ensure Supabase database activity
    const result = await prisma.$queryRaw`SELECT 1 as ping`;
    console.log("Ping query result:", result);
    console.log(`Connection successful. Duration: ${Date.now() - start}ms`);
  } catch (error) {
    console.error("Error pinging the database:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
  console.log("=== DB Keep-Alive Ping Finished ===");
}

void main();
