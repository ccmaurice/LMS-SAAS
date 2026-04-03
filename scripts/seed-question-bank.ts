import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

const root = process.cwd();
loadEnv({ path: resolve(root, ".env") });
if (existsSync(resolve(root, ".env.local"))) {
  loadEnv({ path: resolve(root, ".env.local"), override: true });
}

import { prisma } from "../src/lib/db";
import { GLOBAL_QUESTION_BANK_SEED } from "../prisma/question-bank-seed-data";

async function main() {
  const n = await prisma.questionBankItem.count({ where: { organizationId: null } });
  if (n > 0) {
    console.info("Question bank already has", n, "global items; skipping.");
    return;
  }
  await prisma.questionBankItem.createMany({ data: GLOBAL_QUESTION_BANK_SEED });
  console.info("Seeded", GLOBAL_QUESTION_BANK_SEED.length, "global question bank items.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
