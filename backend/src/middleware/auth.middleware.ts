
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
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

    if (
      typeof payload === "string" ||
      typeof payload.sub !== "string"
    ) {
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
      },
    });

    if (!user || user.status !== "ACTIVE") {
      res.status(403).json({
        success: false,
        message: "Account is not active.",
      });
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
  next: NextFunction
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
