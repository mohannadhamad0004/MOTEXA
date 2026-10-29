import { readFile } from "node:fs/promises";
import { prisma } from "../src/prisma.js";
const rows = JSON.parse(
  await readFile(
    new URL("../prisma/data/mechanic-questions.v3.ar.json", import.meta.url),
    "utf8",
  ),
);
try {
  let added = 0;
  for (const row of rows) {
    const result = await prisma.mechanicQuestion.createMany({
      data: [
        {
          ...row,
          active: false,
          reviewStatus: "DRAFT",
          createdById: "SYSTEM_DRAFT_IMPORT",
        },
      ],
      skipDuplicates: true,
    });
    added += result.count;
  }
  console.log(
    JSON.stringify({
      added,
      existing: rows.length - added,
      totalDraftSet: rows.length,
    }),
  );
} finally {
  await prisma.$disconnect();
}
