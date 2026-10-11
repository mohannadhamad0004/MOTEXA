import express from "express";
import cors from "cors";
import helmet from "helmet";
import { checkDatabase, pool, usingMemoryDatabase } from "./db/connection.js";
import { logisticsRouter } from "./modules/logistics/logistics.routes.js";
import { marketplaceRouter } from "./modules/marketplace/marketplace.routes.js";
import { mechanicsRouter } from "./modules/mechanics/mechanics.routes.js";

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

// Module routers (modules/*/*.routes.js) get mounted here once implemented.
app.use("/api", marketplaceRouter);
app.use("/api", mechanicsRouter);
app.use("/api", logisticsRouter);

app.get("/api/health", async (_req, res) => {
  res.json({
    status: "ok",
    database: (await checkDatabase()) ? "connected" : "not connected",
    databaseType: usingMemoryDatabase ? "in-memory (mock data)" : "postgresql",
  });
});

// Errors thrown by any route (Express 5 passes rejected promises here). Details stay in the log.
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

app.listen(port, () => {
  console.log(`MOTEXA API listening on http://localhost:${port}`);
  if (usingMemoryDatabase) {
    console.log("No DATABASE_URL: using an in-memory database with the mock data (resets on restart).");
    // Create it now, so the first request doesn't wait for it
    pool.query("SELECT 1", []).then(
      () => console.log("In-memory database ready."),
      (error) => console.error("In-memory database failed to start:", error),
    );
  }
});
