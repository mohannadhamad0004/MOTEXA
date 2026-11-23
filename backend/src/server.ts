import workshopRoutes from './routes/workshop.routes.js';
import {requestContext,unexpectedErrorHandler} from './middleware/request-observability.js';
import customerRoutes from './routes/customer.routes.js';
import serviceRequestRoutes from './routes/mechanic-service-requests.routes.js';
import mechanicWorkflowRoutes from './routes/mechanic-workflow.routes.js';
import mechanicRegistrationRoutes from './routes/mechanic-registration.routes.js';
import mechanicsRoutes from './routes/mechanics.routes.js';
import passwordResetRoutes from "./routes/password-reset.routes.js";
import adminInvitationRoutes from "./routes/admin-invitations.routes.js";
import authRoutes from "./routes/auth.routes.js";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import adminRoutes from "./routes/admin.routes.js";
import adminOtpRoutes from "./routes/admin-otp.routes.js";
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(requestContext());
app.use(cors());
app.use(express.json({limit:'8mb'}));

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "MOTEXA Backend is running successfully!",
  });
});
app.use("/api/auth", authRoutes);
app.use("/api/workshop",workshopRoutes);
app.use("/api/customer",customerRoutes);
app.use("/api/auth/mechanic",mechanicRegistrationRoutes);
app.use("/api/mechanics",mechanicsRoutes);
app.use("/api/service-requests",serviceRequestRoutes);
app.use("/api/mechanic-workflow",mechanicWorkflowRoutes);
app.use("/api/auth/password-reset", passwordResetRoutes);
app.use("/api/admin-management", adminRoutes);
app.use("/api/admin-invitations", adminInvitationRoutes);
app.use("/api/auth/admin", adminOtpRoutes);
app.use(unexpectedErrorHandler());
app.listen(PORT, () => {
  console.log(`MOTEXA Server running on http://localhost:${PORT}`);
});
