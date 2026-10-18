import { Router } from "express";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

import {
  requireAuth,
  requireSuperAdmin,
} from "../middleware/auth.middleware.js";

const router = Router();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// All routes require Super Admin authentication
router.use(requireAuth, requireSuperAdmin);

// Existing route
router.get("/", (_req, res) => {
  const user = res.locals.authUser;

  res.status(200).json({
    success: true,
    message: "Super Admin access granted.",
    user: {
      id: user.id,
      role: user.role,
    },
  });
});

// Real dashboard statistics from PostgreSQL
router.get("/dashboard", async (_req, res) => {
  try {
    const [
      administrators,
      mechanics,
      pendingMechanics,
      pendingInvitations,
    ] = await Promise.all([
      prisma.user.count({
        where: { role: "ADMIN", status: "ACTIVE" },
      }),

      prisma.user.count({
        where: { role: "MECHANIC" },
      }),

      prisma.mechanicProfile.count({
        where: { verificationStatus: "PENDING" },
      }),

      prisma.adminInvitation.count({
        where: { status: "PENDING" },
      }),
    ]);

    res.status(200).json({
      success: true,
      stats: {
        administrators,
        mechanics,
        pendingMechanics,
        pendingInvitations,
      },
    });
  } catch (error) {
    console.error("Dashboard statistics error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load dashboard statistics.",
    });
  }
});

// Read-only provider directory; existing Super Admin guards apply.
router.get("/providers", async (_req, res) => {
  try {
    const providers = await prisma.user.findMany({
      where: {role: {in: ["MECHANIC", "PARTS_PROVIDER", "TOW_PROVIDER"]}},
      select: {id:true, fullName:true, email:true, role:true, status:true,
        mechanicProfile: {select: {verificationStatus:true}}},
      orderBy: {createdAt:"desc"},
    });
    return res.json({success:true,providers});
  } catch {
    return res.status(500).json({success:false,message:"Failed to load providers."});
  }
});

export default router;