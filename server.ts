import express from "express";
import { createServer as createViteServer } from "vite";
import authRoutes from "./src/routes/auth.js";
import userRoutes from "./src/routes/users.js";
import customerRoutes from "./src/routes/customers.js";
import customerOpsRoutes from "./src/routes/customerOps.js";
import columnRoutes from "./src/routes/columns.js";
import auditRoutes from "./src/routes/audit.js";
import searchRoutes from "./src/routes/search.js";
import timelineRoutes from "./src/routes/timeline.js";
import kpiRoutes from "./src/routes/kpi.js";
import internalReportsRoutes from "./src/routes/internalReports.js";
import smsRoutes from "./src/routes/sms.js";
import settingsRoutes from "./src/routes/settings.js";
import backupRoutes from "./src/routes/backup.js";
import blockedIpsRoutes from "./src/routes/blockedIps.js";
import { startScheduler } from "./src/scheduler.js";
import { initSchema } from "./src/db.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  try {
    await initSchema();
  } catch (error: any) {
    console.error(`
====================================================================
🚨 DATABASE CONNECTION ERROR 🚨
====================================================================
It looks like the application cannot connect to PostgreSQL.

The error is: ${error.message}

HOW TO FIX:
1. Ensure PostgreSQL is installed and running on your computer.
2. Open your '.env' file in the root of the project.
3. Set the correct DATABASE_URL with your local postgres password.
   Format: DATABASE_URL="postgres://postgres:YOUR_PASSWORD@localhost:5432/internal-system"
4. If you don't have a '.env' file, create one and add the DATABASE_URL.

The application cannot start without a working database connection.
====================================================================
`);
    process.exit(1);
  }

  startScheduler();

  app.set('trust proxy', 1);

  app.use(express.json());

  // Register Routes
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/customers", customerRoutes);
  app.use("/api/customers/timeline", timelineRoutes);
  app.use("/api", customerOpsRoutes); // For import/export/summary which are mixed
  app.use("/api/columns", columnRoutes);
  app.use("/api/audit-logs", auditRoutes);
  app.use("/api/search", searchRoutes);
  app.use("/api/kpi", kpiRoutes);
  app.use("/api/internal_reports", internalReportsRoutes);
  app.use("/api/sms", smsRoutes);
  app.use("/api/settings", settingsRoutes);
  app.use("/api/backup", backupRoutes);
  app.use("/api/blocked-ips", blockedIpsRoutes);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
