import { Router } from "express";
import { prisma } from "../prisma.js"; // shared client: carries the *_test database guard

import {
  requireAuth,
  requireSuperAdmin,
} from "../middleware/auth.middleware.js";

const router = Router();

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
    // Providers by verification status (PENDING = waiting for review, APPROVED = live), from real rows.
    const byStatus = (rows: { verificationStatus: string; _count: { _all: number } }[]) => {
      const n = (st: string) => rows.find((r) => r.verificationStatus === st)?._count._all ?? 0;
      return { pending: n("PENDING"), approved: n("APPROVED") };
    };
    const [administrators, mechanics, pendingMechanics, pendingInvitations, towRows, partsRows, activeMechanicRequests] =
      await Promise.all([
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

        prisma.towCompanyProfile.groupBy({ by: ["verificationStatus"], _count: { _all: true } }),
        prisma.partsShopProfile.groupBy({ by: ["verificationStatus"], _count: { _all: true } }),
        prisma.mechanicRequest.count({ where: { status: { in: ["REQUESTED", "ACCEPTED", "IN_PROGRESS"] } } }),
      ]);

    res.status(200).json({
      success: true,
      stats: {
        administrators,
        mechanics,
        pendingMechanics,
        activeMechanicRequests,
        pendingInvitations,
        towCompanies: byStatus(towRows),
        partsShops: byStatus(partsRows),
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
      where: { role: { in: ["MECHANIC", "PARTS_PROVIDER", "TOW_PROVIDER", "GARAGE_OWNER"] } },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        mechanicProfile: { select: { verificationStatus: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ success: true, providers });
  } catch {
    return res
      .status(500)
      .json({ success: false, message: "Failed to load providers." });
  }
});

export default router;
