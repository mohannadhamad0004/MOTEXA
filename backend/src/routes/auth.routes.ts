
import { Router } from "express";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const validPassword = await argon2.verify(
      user.passwordHash,
      password
    );

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "This account is not active.",
      });
    }

    const secret = process.env.JWT_SECRET;

    if (!secret || secret.length < 32) {
      throw new Error("JWT_SECRET is missing or too short.");
    }

    const token = jwt.sign(
      { role: user.role },
      secret,
      {
        subject: user.id,
        expiresIn: "15m",
        algorithm: "HS256",
      }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      accessToken: token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});
router.get("/me", async (req, res) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
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
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token.",
      });
    }

    if (
      typeof payload === "string" ||
      typeof payload.sub !== "string"
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        adminPermissions: {
          select: {
            permission: true,
          },
        },
      },
    });

    if (!user || user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Account is not active.",
      });
    }

    if (
      user.role !== "SUPER_ADMIN" &&
      user.role !== "ADMIN"
    ) {
      return res.status(403).json({
        success: false,
        message: "Administrator access required.",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Session verification error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});
export default router;
