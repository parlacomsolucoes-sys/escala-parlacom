// server/index.ts
import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

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
    `[startup] Firebase vars OK (project: ${process.env.FIREBASE_PROJECT_ID})`
  );
}

const app = express();
app.set("trust proxy", 1);

// ===== CORS ROBUSTO =====
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ||
  "https://escala.parlacomsolucoes.com.br,http://localhost:5173,http://localhost:3000"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // mobile/native/postman
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("Origin not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
  ],
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // preflight

// ===== Body parsers =====
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ===== Logging simples para /api =====
app.use((req, res, next) => {
  const start = Date.now();
  let jsonOut: any;
  const orig = res.json;
  res.json = function (body, ...rest: any[]) {
    jsonOut = body;
    return orig.apply(res, [body, ...rest]);
  };
  res.on("finish", () => {
    if (req.path.startsWith("/api")) {
      const ms = Date.now() - start;
      let line = `${req.method} ${req.path} ${res.statusCode} ${ms}ms`;
      if (jsonOut) {
        try {
          const s = JSON.stringify(jsonOut);
          if (s.length < 160) line += ` :: ${s}`;
        } catch {}
      }
      log(line);
    }
  });
  next();
});

// Health
app.get("/healthz", (_req, res) => {
  res.json({
    status: "ok",
    env: process.env.NODE_ENV || "undefined",
    project: process.env.FIREBASE_PROJECT_ID || null,
    time: new Date().toISOString(),
  });
});

(async () => {
  const server = await registerRoutes(app);

  // Error handler (precisa vir depois das rotas)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    console.error("[error]", status, err.message, err.stack);
    // Important: ainda devolver cabeçalhos CORS (já que middleware cors foi global)
    res.status(status).json({
      message: err.message || "Internal Server Error",
      code: err.code || "INTERNAL_ERROR",
    });
  });

  const isDev = (process.env.NODE_ENV || "development") === "development";
  if (isDev) {
    log("[startup] Modo desenvolvimento (Vite middleware)");
    await setupVite(app, server);
  } else {
    log("[startup] Modo produção (servindo build estático)");
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({ port, host: "0.0.0.0" }, () => {
    log(`serving on port ${port}`);
  });
})().catch((e) => {
  console.error("[fatal] Falha ao iniciar servidor:", e);
  process.exit(1);
});

process.on("unhandledRejection", (r) =>
  console.error("[unhandledRejection]", r)
);
process.on("uncaughtException", (e) => console.error("[uncaughtException]", e));
