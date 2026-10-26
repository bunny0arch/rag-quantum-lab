import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic } from "./static";
import { subscribeToProgress } from "../rag/service";

export async function createApp(options: { serveClient?: boolean } = {}) {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/platform/config.js", (_req, res) => {
    res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript());
  });
  app.get("/api/rag/progress", (req, res) => {
    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
    if (workspaceId.length < 8 || workspaceId.length > 80) {
      res.status(400).json({ error: "A valid workspaceId is required." });
      return;
    }
    res.status(200).set({
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "Content-Type": "text/event-stream",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
    res.write(`event: ready\ndata: ${JSON.stringify({ workspaceId })}\n\n`);
    const unsubscribe = subscribeToProgress(workspaceId, event => {
      res.write(`event: progress\ndata: ${JSON.stringify(event)}\n\n`);
    });
    const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 15000);
    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // Development uses Vite. Vercel mounts the API separately and serves the
  // Vite output from its static layer, so it must not mount a second client.
  if (process.env.NODE_ENV === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else if (options.serveClient !== false) {
    serveStatic(app);
  }

  return { app, server };
}

export async function startServer() {
  const { app, server } = await createApp();

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  server.on("error", error => { console.error("Server failed:", error.message); process.exit(1); });
  server.listen(port, "0.0.0.0", () => console.log(`Server listening on port ${port}`));
}

if (!process.env.VERCEL) {
  startServer().catch(error => { console.error(error); process.exit(1); });
}
