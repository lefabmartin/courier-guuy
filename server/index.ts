import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { securityHeadersMiddleware } from "./middleware/security-headers";
import { antibotMiddleware } from "./middleware/antibot-middleware";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Appliquer les headers de sécurité sur toutes les requêtes
app.use(securityHeadersMiddleware);

// Middleware Anti-Bot complet (inclut datacenter, proxy, tor, vpn, etc.)
app.use(antibotMiddleware);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

/**
 * Middleware de logging pour les requêtes API
 */
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, unknown> | undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson as Record<string, unknown>;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // IMPORTANT: Enregistrer les routes API AVANT Vite pour éviter l'interception
    await registerRoutes(httpServer, app);

    /**
     * Middleware de gestion des erreurs
     */
    app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error("Internal Server Error:", err);

      if (res.headersSent) {
        return next(err);
      }

      return res.status(status).json({
        error: "Internal Server Error",
        message: process.env.NODE_ENV === "production" ? "An error occurred" : message,
      });
    });

    /**
     * Configuration du serveur selon l'environnement
     * En production: servir les fichiers statiques
     * En développement: utiliser Vite avec HMR
     * NOTE: Les routes API sont déjà enregistrées ci-dessus
     */
    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }

    /**
     * Démarrage du serveur HTTP
     * Le port est défini par la variable d'environnement PORT (défaut: 3000)
     */
    const port = parseInt(process.env.PORT || "3000", 10);
    httpServer.listen(port, "0.0.0.0", () => {
      log(`Server listening on port ${port}`);
    });
  } catch (err) {
    console.error("[Startup Error]", err);
    process.exit(1);
  }
})();
