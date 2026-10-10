
import { Router } from "express";
import {
  requireAuth,
  requireSuperAdmin,
} from "../middleware/auth.middleware.js";

const router = Router();

// جميع المسارات هنا تتطلب تسجيل دخول Super Admin
router.use(requireAuth, requireSuperAdmin);


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

export default router;
