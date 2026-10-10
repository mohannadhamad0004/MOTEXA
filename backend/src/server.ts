import adminInvitationRoutes from "./routes/admin-invitations.routes.js";
import authRoutes from "./routes/auth.routes.js";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import adminRoutes from "./routes/admin.routes.js";
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "MOTEXA Backend is running successfully!",
  });
});
app.use("/api/auth", authRoutes);
app.use("/api/admin-management", adminRoutes);
app.use("/api/admin-invitations", adminInvitationRoutes);
app.listen(PORT, () => {
  console.log(`MOTEXA Server running on http://localhost:${PORT}`);
});
