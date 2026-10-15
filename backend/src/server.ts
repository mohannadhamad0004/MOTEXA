import adminInvitationRoutes from "./routes/admin-invitations.routes.js";
import authRoutes from "./routes/auth.routes.js";
import mechanicApplicationRoutes from "./routes/mechanic-applications.routes.js";
import mechanicReviewRoutes from "./routes/mechanic-review.routes.js";
import towRoutes from "./routes/tow.routes.js";
import partsRoutes from "./routes/parts.routes.js";
import filesRoutes from "./routes/files.routes.js";
import catalogRoutes from "./routes/catalog.routes.js";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import adminRoutes from "./routes/admin.routes.js";
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(cors());
// Mounted before the global JSON parser: it carries larger (base64 image) bodies with its own limit.
app.use("/api/mechanic-applications", mechanicApplicationRoutes);
// Tow and parts providers upload base64 images: these routers parse their own body (after auth), so they sit above the global parser too.
app.use("/api", towRoutes);
app.use("/api", partsRoutes);
app.use("/api/files", filesRoutes);
app.use("/api/catalog", catalogRoutes);
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
app.use("/api/mechanic-review", mechanicReviewRoutes);
app.listen(PORT, () => {
  console.log(`MOTEXA Server running on http://localhost:${PORT}`);
});
