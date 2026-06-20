import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json({ limit: '10mb' }));

  // API Route - Record Google Login
  app.post("/api/record-login", (req, res) => {
    const { email, displayName, photoURL, coins, unlockedVehicles, upgrades, loginTime } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const logFilePath = path.join(process.cwd(), "user_logs.json");
    let logs = [];
    if (fs.existsSync(logFilePath)) {
      try {
        logs = JSON.parse(fs.readFileSync(logFilePath, "utf-8"));
      } catch (e) {
        logs = [];
      }
    }

    const existingIndex = logs.findIndex((item: any) => item.email.toLowerCase() === email.toLowerCase());
    const entry = {
      email,
      displayName: displayName || "Anonymous Rider",
      photoURL: photoURL || "",
      coins: coins || 0,
      unlockedVehicles: unlockedVehicles || [],
      upgrades: upgrades || {},
      loginTime: loginTime || new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      logs[existingIndex] = entry;
    } else {
      logs.push(entry);
    }

    try {
      fs.writeFileSync(logFilePath, JSON.stringify(logs, null, 2), "utf-8");
    } catch (e) {
      console.error("Failed to write user logs file", e);
    }

    return res.json({ success: true, updated: entry });
  });

  // API Route - Retrieve Developer Admin Logs
  app.get("/api/login-records", (req, res) => {
    const requesterEmail = req.query.email as string;
    
    if (!requesterEmail || requesterEmail.toLowerCase() !== "shashwatmishra7181@gmail.com") {
      return res.status(403).json({ error: "Access Denied: Only Shashwat Mishra (Shashwatmishra7181@gmail.com) has access to this data." });
    }

    const logFilePath = path.join(process.cwd(), "user_logs.json");
    let logs = [];
    if (fs.existsSync(logFilePath)) {
      try {
        logs = JSON.parse(fs.readFileSync(logFilePath, "utf-8"));
      } catch (e) {
        logs = [];
      }
    }
    return res.json({ success: true, logs });
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use('/src/assets/images', express.static(path.join(process.cwd(), 'src/assets/images')));
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Hill Climb Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start fullstack server:", error);
});
