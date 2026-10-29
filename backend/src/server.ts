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

app.use(cors());
app.use(express.json({limit:'8mb'}));

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "MOTEXA Backend is running successfully!",
  });
});
app.use("/api/auth", authRoutes);
app.use("/api/auth/mechanic",mechanicRegistrationRoutes);
app.use("/api/mechanics",mechanicsRoutes);
app.use("/api/mechanic-workflow",mechanicWorkflowRoutes);
app.use("/api/auth/password-reset", passwordResetRoutes);
app.use("/api/admin-management", adminRoutes);
app.use("/api/admin-invitations", adminInvitationRoutes);
app.use("/api/auth/admin", adminOtpRoutes);
app.use((err:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{const status=(err as {status?:number}).status;res.status(status===413?413:status===400?400:500).json({success:false,message:status===413?"Document is too large (maximum 5 MB).":status===400?"Invalid request body.":"An unexpected server error occurred."});});
app.listen(PORT, () => {
  console.log(`MOTEXA Server running on http://localhost:${PORT}`);
});
