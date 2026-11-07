// DEV ONLY: puts the throw-away copy (scripts/a3d-clone.ts) back to the stuck draft: width 630, installed car unset, DRAFT. npx tsx scripts/a3d-reset.ts <productId>
import { prisma } from "../src/prisma.js";
const productId = process.argv[2]!;
await prisma.productAccessory3D.updateMany({ where: { productId }, data: { status: "DRAFT", widthMm: 630, installedGenerationId: null, submittedAt: null, installedApprovedAt: null } });
await prisma.$disconnect();
