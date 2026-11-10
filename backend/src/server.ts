import managedVehicleCatalogRoutes from "./routes/vehicle-catalog.routes.js";
import { prisma } from "./prisma.js";
import vehicle3DRoutes from "./routes/vehicle3d.routes.js";
import accessory3DRoutes from "./routes/accessory3d.routes.js";
import vehicleModelRoutes from "./routes/vehicle3d-management.routes.js";
import {isPublic3DAsset} from "./services/vehicle3d-public-assets.js";
import providerPortalRoutes from "./routes/provider-portal.routes.js";
import { startVehicle3DWorker } from "./services/vehicle3d-generation.js";
import mechanicRegistrationRoutes from './routes/mechanic-registration.routes.js';
import mechanicsRoutes from './routes/mechanics.routes.js';
import passwordResetRoutes from "./routes/password-reset.routes.js";
import adminInvitationRoutes from "./routes/admin-invitations.routes.js";
import authRoutes from "./routes/auth.routes.js";
import mechanicApplicationRoutes from "./routes/mechanic-applications.routes.js";
import mechanicReviewRoutes from "./routes/mechanic-review.routes.js";
import towRoutes from "./routes/tow.routes.js";
import partsRoutes from "./routes/parts.routes.js";
import partsOrderRoutes from "./routes/parts-orders.routes.js";
import towDriverRoutes from "./routes/tow-drivers.routes.js";
import filesRoutes from "./routes/files.routes.js";
import catalogRoutes from "./routes/catalog.routes.js";
import partInquiryRoutes from "./routes/part-inquiries.routes.js";
import towRequestRoutes from "./routes/tow-requests.routes.js";
import towJobExtrasRoutes from "./routes/tow-job-extras.routes.js";
import { startOfferSweeper } from "./services/tow-offers.js";
import catalogMechanicRoutes from "./routes/catalog-mechanics.routes.js";
import mechanicRequestRoutes from "./routes/mechanic-requests.routes.js";
import providerRegistrationRoutes from "./routes/provider-registration.routes.js";
import providerSignupRoutes from "./routes/provider-signup.routes.js";
import providerOnboardingRoutes, { notificationsRouter } from "./routes/provider-onboarding.routes.js";
import { partsReviewRouter, towReviewRouter } from "./routes/provider-review.routes.js";
import express from "express";
import { fileURLToPath } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import adminRoutes from "./routes/admin.routes.js";
import adminOtpRoutes from "./routes/admin-otp.routes.js";
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(cors());
app.use("/api", providerPortalRoutes);
app.use("/api",managedVehicleCatalogRoutes);
app.use("/api",vehicleModelRoutes);
app.use("/api", (req, res, next) => /^\/(catalog\/(vehicle-3d-submissions|3d-models)|admin\/parts\/vehicle-3d-submissions)(\/|$)/.test(req.path) ? vehicle3DRoutes(req, res, next) : next());
// Feature 2: shop accessories in 3D (guards per route; photo bodies have their own limit)
app.use("/api", (req, res, next) => /accessory-3d|accessory-zones|\/admin\/parts\/(part-maps|auto-fits)(\/|$)/.test(req.path) ? accessory3DRoutes(req, res, next) : next());
// Public 3D car models (backend/public/3d, optimised GLBs; no customer data). Long cache: a new model gets a new file name.
app.use("/api/3d", async (req, res, next) => {
  try {
    if (!await isPublic3DAsset(req.path.slice(1))) { res.status(404).end(); return; }
    res.setHeader("Cache-Control","public, max-age=0, must-revalidate");
    next();
  } catch { res.status(503).end(); }
}, express.static(fileURLToPath(new URL("../public/3d", import.meta.url)), { fallthrough: false,cacheControl:false }));
app.use("/api/cars", express.static(fileURLToPath(new URL("../public/cars", import.meta.url)), { maxAge: "30d", fallthrough: false })); // generation photos (CC, credited)
// Mounted before the global JSON parser: it carries larger (base64 image) bodies with its own limit.
app.use("/api/mechanic-applications", mechanicApplicationRoutes);
// Tow and parts providers upload base64 images: these routers parse their own body (after auth), so they sit above the global parser too.
app.use("/api", towRoutes);
app.use("/api", towDriverRoutes); // tow drivers, assignment, live jobs
app.use("/api", partsOrderRoutes); // parts orders (customer, shop owner, parts admins)
app.use("/api", partsRoutes);
app.use("/api/files", filesRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/catalog", catalogMechanicRoutes);
// Request routes parse their own (small) JSON bodies after authentication.
app.use("/api", partInquiryRoutes);
app.use("/api", towRequestRoutes);
app.use("/api", towJobExtrasRoutes); // chat, review, report of a tow job
app.use("/api", mechanicRequestRoutes);
// Provider onboarding (documents arrive as base64, so these routers parse their own body after authentication)
app.use("/api/provider", providerOnboardingRoutes);
app.use("/api/notifications", notificationsRouter);
app.use("/api/admin/providers/tow", towReviewRouter);
app.use("/api/admin/providers/parts", partsReviewRouter);
// Tow signup carries base64 files: it parses its own (larger) body after its rate limit
app.use("/api/auth/provider", providerSignupRoutes);
app.use(express.json({limit:'8mb'}));

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "MOTEXA Backend is running successfully!",
  });
});
app.use("/api/auth", authRoutes);
app.use("/api/auth/mechanic",mechanicRegistrationRoutes);
app.use("/api/auth/provider", providerRegistrationRoutes);
app.use("/api/mechanics",mechanicsRoutes);
app.use("/api/auth/password-reset", passwordResetRoutes);
app.use("/api/admin-management", adminRoutes);
app.use("/api/admin-invitations", adminInvitationRoutes);
app.use("/api/mechanic-review", mechanicReviewRoutes);
app.use("/api/auth/admin", adminOtpRoutes);
app.use((err:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{const status=(err as {status?:number}).status;res.status(status===413?413:status===400?400:500).json({success:false,message:status===413?"Document is too large (maximum 5 MB).":status===400?"Invalid request body.":"An unexpected server error occurred."});});
app.listen(PORT, () => {
  console.log(`MOTEXA Server running on http://localhost:${PORT}`);
});

startOfferSweeper(); // tow offers nobody answered in time
void startVehicle3DWorker().catch(() => console.error("Vehicle 3D worker startup failed; check migrations and storage."));
