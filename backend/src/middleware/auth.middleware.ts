import { isCurrentSession } from "../services/session-version.service.js";

import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    const token = authorization.slice(7);
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error("JWT_SECRET is missing.");
    }

    let payload: jwt.JwtPayload | string;

    try {
      payload = jwt.verify(token, secret, {
        algorithms: ["HS256"],
      });
    } catch {
      res.status(401).json({
        success: false,
        message: "Invalid or expired token.",
      });
      return;
    }

    if (typeof payload === "string" || typeof payload.sub !== "string") {
      res.status(401).json({
        success: false,
        message: "Invalid token payload.",
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        status: true,
        sessionVersion: true,
      },
    });

    if (!user || user.status !== "ACTIVE") {
      res.status(403).json({
        success: false,
        message: "Account is not active.",
      });
      return;
    }

    if (!isCurrentSession(payload, user.sessionVersion)) {
      res
        .status(401)
        .json({ success: false, message: "Session expired. Sign in again." });
      return;
    }

    // نخزن المستخدم الذي تم التحقق منه داخل الطلب
    res.locals.authUser = user;

    next();
  } catch (error) {
    console.error("Authentication middleware error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
}

export function requireSuperAdmin(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  const user = res.locals.authUser;

  if (!user || user.role !== "SUPER_ADMIN") {
    res.status(403).json({
      success: false,
      message: "Super Admin access required.",
    });
    return;
  }

  next();
}

/** Mechanic review access: SUPER_ADMIN, or ADMIN holding MANAGE_MECHANICS. Use after requireAuth. */
export async function requireMechanicsAdmin(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = res.locals.authUser as { id: string; role: string } | undefined;
    let allowed = user?.role === "SUPER_ADMIN";

    if (!allowed && user?.role === "ADMIN") {
      allowed = !!(await prisma.adminPermission.findUnique({
        where: {
          adminId_permission: {
            adminId: user.id,
            permission: "MANAGE_MECHANICS",
          },
        },
      }));
    }

    if (!allowed) {
      res.status(403).json({
        success: false,
        message: "Mechanics administration access required.",
      });
      return;
    }

    next();
  } catch (error) {
    console.error("Mechanics admin check error:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
}

/** Tow administration access: SUPER_ADMIN, or ADMIN holding MANAGE_TOWING. Use after requireAuth. */
export async function requireTowAdmin(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = res.locals.authUser as { id: string; role: string } | undefined;
    let allowed = user?.role === "SUPER_ADMIN";

    if (!allowed && user?.role === "ADMIN") {
      allowed = !!(await prisma.adminPermission.findUnique({
        where: {
          adminId_permission: {
            adminId: user.id,
            permission: "MANAGE_TOWING",
          },
        },
      }));
    }

    if (!allowed) {
      res.status(403).json({
        success: false,
        message: "Tow administration access required.",
      });
      return;
    }

    next();
  } catch (error) {
    console.error("Tow admin check error:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
}

/** Tow company access: role TOW_PROVIDER (requireAuth already guarantees an ACTIVE account). */
export function requireTowProvider(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  const user = res.locals.authUser;

  if (!user || user.role !== "TOW_PROVIDER" || user.status !== "ACTIVE") {
    res.status(403).json({
      success: false,
      message: "Tow company access required.",
    });
    return;
  }

  next();
}

/** Parts administration access: SUPER_ADMIN, or ADMIN holding MANAGE_SPARE_PARTS. Use after requireAuth. */
export async function requirePartsAdmin(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = res.locals.authUser as { id: string; role: string } | undefined;
    let allowed = user?.role === "SUPER_ADMIN";

    if (!allowed && user?.role === "ADMIN") {
      allowed = !!(await prisma.adminPermission.findUnique({
        where: {
          adminId_permission: {
            adminId: user.id,
            permission: "MANAGE_SPARE_PARTS",
          },
        },
      }));
    }

    if (!allowed) {
      res.status(403).json({
        success: false,
        message: "Parts administration access required.",
      });
      return;
    }

    next();
  } catch (error) {
    console.error("Parts admin check error:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
}

/** Parts shop access: role PARTS_PROVIDER (requireAuth already guarantees an ACTIVE account). */
export function requirePartsProvider(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  const user = res.locals.authUser;

  if (!user || user.role !== "PARTS_PROVIDER" || user.status !== "ACTIVE") {
    res.status(403).json({
      success: false,
      message: "Parts shop access required.",
    });
    return;
  }

  next();
}

/** Customer access: role CUSTOMER (requireAuth already guarantees an ACTIVE account). */
export function requireCustomer(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  const user = res.locals.authUser;

  if (!user || user.role !== "CUSTOMER") {
    res.status(403).json({
      success: false,
      message: "Customer access required.",
    });
    return;
  }

  next();
}
