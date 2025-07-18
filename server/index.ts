// server/index.ts
import "dotenv/config"; // Carrega .env o mais cedo possível

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

// (1) Diagnóstico inicial das variáveis (sem expor chave privada)
const requiredEnv = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
];
const missing = requiredEnv.filter((k) => !process.env[k]);
if (missing.length) {
  console.warn("[startup] Variáveis Firebase ausentes:", missing.join(", "));
} else {
  log(
    `[startup] Firebase vars OK (project: ${process.env.FIREBASE_PROJECT_ID})`,
  );
}

// (2) Cria app Express
const app = express();
app.set("trust proxy", 1); // Replit / proxies

// (3) CORS opcional (ajuste ALLOWED_ORIGINS no .env se quiser restringir)
import cors from "cors";
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (allowedOrigins.length) {
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    }),
  );
} else {
  // CORS permissivo em desenvolvimento
  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// (4) Logging de /api
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: any;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args: any[]) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let line = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        try {
          const snippet = JSON.stringify(capturedJsonResponse);
          if (snippet.length < 140) line += ` :: ${snippet}`;
        } catch {
          /* ignore */
        }
      }
      log(line);
    }
  });

  next();
});

// (5) Healthcheck simple
app.get("/healthz", (_req, res) => {
  res.json({
    status: "ok",
    env: process.env.NODE_ENV || "undefined",
    project: process.env.FIREBASE_PROJECT_ID || null,
    time: new Date().toISOString(),
  });
});

// (6) Inicialização async para poder aguardar Vite/rotas
(async () => {
  // Registra rotas de API
  const server = await registerRoutes(app);

  // (7) Error handler (depois das rotas)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    // Log detalhado no servidor
    console.error("[error]", status, message, err.stack);
    res.status(status).json({ message });
  });

  // (8) Decide se usa Vite (dev) ou serve estático (prod)
  const nodeEnv = process.env.NODE_ENV || "development";
  const isDev = nodeEnv === "development";

  if (isDev) {
    log("[startup] Modo desenvolvimento (Vite middleware)");
    await setupVite(app, server);
  } else {
    log("[startup] Modo produção (servindo build estático)");
    serveStatic(app);
  }

  // (9) Porta e listener
  const port = parseInt(process.env.PORT || "5000", 10);
  const listenOptions: Parameters<typeof server.listen>[0] = {
    port,
    host: "0.0.0.0",
    ...(process.platform !== "win32" ? { reusePort: true } : {}),
  };

  server.listen(listenOptions, () => {
    log(`serving on port ${port}`);
  });
})().catch((e) => {
  console.error("[fatal] Falha ao iniciar servidor:", e);
  process.exit(1);
});

// (10) Captura erros não tratados
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});
