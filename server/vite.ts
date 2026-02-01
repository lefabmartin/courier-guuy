import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  // Middleware Vite - doit être enregistré AVANT le catch-all
  // Les routes API sont déjà enregistrées dans registerRoutes() AVANT setupVite()
  app.use((req, res, next) => {
    // Utiliser req.path qui est normalisé par Express (sans query string)
    const reqPath = req.path || "";
    
    // Ignorer explicitement les routes API - elles sont gérées par registerRoutes
    if (reqPath.startsWith("/api")) {
      return next();
    }
    
    // Toutes les autres routes (y compris /@, /src/, etc.) sont gérées par vite.middlewares
    return vite.middlewares(req, res, next);
  });

  // Catch-all pour servir index.html - DOIT être après vite.middlewares
  // Ne s'exécute que si Vite n'a pas déjà répondu
  app.use(async (req, res, next) => {
    // Si la réponse a déjà été envoyée par Vite, ne rien faire
    if (res.headersSent) {
      return next();
    }

    const url = req.originalUrl || req.url || "";
    const reqPath = req.path || "";

    // Ignorer les routes API et les routes Vite - elles sont déjà gérées
    if (reqPath.startsWith("/api") || 
        reqPath.startsWith("/vite-hmr") || 
        reqPath.startsWith("/@") ||
        reqPath.startsWith("/src/") ||
        reqPath.startsWith("/node_modules/") ||
        reqPath.startsWith("/@fs/")) {
      return next();
    }

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
