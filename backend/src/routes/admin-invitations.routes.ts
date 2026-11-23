import { Router } from "express";
import { randomBytes, createHash } from "node:crypto";
import { prisma } from "../prisma.js";

import { sendAdminInvitationEmail } from "../services/email.service.js";

import {
  requireAuth,
  requireSuperAdmin,
} from "../middleware/auth.middleware.js";

const router = Router();

router.use(requireAuth, requireSuperAdmin);

router.post("/", async (req, res) => {
  try {
    const { email, permission } = req.body ?? {};
    const fullName = req.body?.fullName;

    if (typeof fullName !== "string" || !fullName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Administrator full name is required.",
      });
    }

    if (
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof permission !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid email and permissions are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const allowedPermissions = [
      "MANAGE_MECHANICS",
      "MANAGE_SPARE_PARTS",
      "MANAGE_TOWING",
    ];

    if (!allowedPermissions.includes(permission)) {
      return res.status(400).json({
        success: false,
        message: "Invalid administrator permission.",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const existingInvitation = await prisma.adminInvitation.findFirst({
      where: {
        email: normalizedEmail,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      return res.status(409).json({
        success: false,
        message: "An active invitation already exists.",
      });
    }

    const activationBaseUrl=process.env.ADMIN_ACTIVATION_URL;
    if(!activationBaseUrl)return res.status(500).json({success:false,message:"Admin activation URL is not configured."});
    const token = randomBytes(32).toString("hex");

    const tokenHash = createHash("sha256").update(token).digest("hex");

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const invitation=await prisma.$transaction(async tx=>{
      const created=await tx.adminInvitation.create({data:{email:normalizedEmail,fullName:fullName.trim(),tokenHash,expiresAt,permission,invitedById:res.locals.authUser.id}});
      await tx.auditLog.create({data:{actorId:res.locals.authUser.id,action:"ADMIN_INVITATION_CREATED",targetId:created.id,details:{fullName:created.fullName,permission:created.permission}}});
      return created;
    });

    const activationLink = `${activationBaseUrl}?token=${encodeURIComponent(token)}`;

    const expoGoEmailBase =
      process.env.NODE_ENV !== "production"
        ? process.env.EXPO_GO_ACTIVATION_URL
        : undefined;

    try {
      await sendAdminInvitationEmail({
        to: invitation.email,
        fullName: invitation.fullName,
        permission: invitation.permission,
        activationLink,
        expoGoActivationLink: expoGoEmailBase
          ? `${expoGoEmailBase}?token=${encodeURIComponent(token)}`
          : undefined,
      });
    } catch (emailError) {
      console.error("Invitation email error:", emailError);

      await prisma.$transaction(async tx=>{
        await tx.adminInvitation.delete({where:{id:invitation.id}});
        await tx.auditLog.create({data:{actorId:res.locals.authUser.id,action:"ADMIN_INVITATION_DELIVERY_FAILED",targetId:invitation.id,details:{fullName:invitation.fullName,permission:invitation.permission}}});
      });

      return res.status(502).json({
        success: false,
        message: "Invitation email could not be sent. Please try again.",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Administrator invitation created and email sent.",
      invitation: {
        id: invitation.id,
        email: invitation.email,
        fullName: invitation.fullName,
        status: invitation.status,
        permission: invitation.permission,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error) {
    console.error("Create invitation error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});
router.get("/", async (_req, res) => {
  try {
    const [users, invitations] = await Promise.all([
      prisma.user.findMany({
        where: { role: "ADMIN" },
        select: {
          id: true,
          fullName: true,
          email: true,
          status: true,
          adminPermissions: {
            select: { permission: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),

      prisma.adminInvitation.findMany({
        where: { status: "PENDING" },
        select: {
          id: true,
          fullName: true,
          email: true,
          permission: true,
          status: true,
          expiresAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return res.status(200).json({
      success: true,
      admins: users,
      invitations,
    });
  } catch (error) {
    console.error("List administrators error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load administrators.",
    });
  }
});
router.patch("/:id/revoke", async (req, res) => {
  try {
    const invitationId = req.params.id;

    if (typeof invitationId !== "string") {
      return res.status(400).json({
        success: false,
        message: "Invalid invitation ID.",
      });
    }

    const result=await prisma.$transaction(async tx=>{
      const invitation=await tx.adminInvitation.findUnique({where:{id:invitationId},select:{fullName:true,permission:true}});
      const updated=await tx.adminInvitation.updateMany({where:{id:invitationId,status:"PENDING"},data:{status:"REVOKED"}});
      if(updated.count>0)await tx.auditLog.create({data:{actorId:res.locals.authUser.id,action:"ADMIN_INVITATION_REVOKED",targetId:invitationId,details:{fullName:invitation?.fullName??"",permission:invitation?.permission??""}}});
      return updated;
    });

    if (result.count === 0) {
      return res.status(404).json({
        success: false,
        message: "Pending invitation not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Invitation revoked successfully.",
    });
  } catch (error) {
    console.error("Revoke invitation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to revoke invitation.",
    });
  }
});
router.patch("/:id/status", async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body ?? {};

    if (typeof id !== "string" || !["ACTIVE", "SUSPENDED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid administrator ID or status.",
      });
    }

    const result=await prisma.$transaction(async tx=>{
      const account=await tx.user.findUnique({where:{id},select:{fullName:true}});
      const updated=await tx.user.updateMany({where:{id,role:"ADMIN",status:status==="ACTIVE"?"SUSPENDED":"ACTIVE"},data:{status,sessionVersion:{increment:1}}});
      if(updated.count>0)await tx.auditLog.create({data:{actorId:res.locals.authUser.id,action:status==="SUSPENDED"?"ADMIN_ACCOUNT_SUSPENDED":"ADMIN_ACCOUNT_REACTIVATED",targetId:id,details:{fullName:account?.fullName??"",status}}});
      return updated;
    });

    if (result.count === 0) {
      return res.status(409).json({
        success: false,
        message: "Administrator not found or status already updated.",
      });
    }

    return res.json({
      success: true,
      message: `Administrator status changed to ${status}.`,
    });
  } catch (error) {
    console.error("Update admin status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update administrator status.",
    });
  }
});
export default router;
