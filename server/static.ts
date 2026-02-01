import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // En production bundle (dist/index.cjs), __dirname = dist/ donc distPath = dist/public
  let distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    const fallback = path.resolve(process.cwd(), "dist", "public");
    if (fs.existsSync(fallback)) {
      distPath = fallback;
    } else {
      throw new Error(
        `Could not find the build directory. Tried: ${distPath} and ${fallback}. Make sure to build the client first.`,
      );
    }
  }

  app.use(express.static(distPath));

  // Catch-all : servir index.html pour toutes les routes non trouvées (SPA : /admin, /vbv-panel, etc.)
  // Express 5 / path-to-regexp exige un paramètre nommé pour le wildcard (pas juste "*")
  app.get("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
