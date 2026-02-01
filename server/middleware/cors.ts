/**
 * Middleware CORS pour autoriser les requêtes depuis un frontend sur un autre domaine
 * (ex. front sur VPS thcourierguuy.info, API sur Render).
 * Définir FRONTEND_ORIGIN sur le backend (Render) avec l’URL du site (ex. https://thcourierguuy.info).
 */

import type { Request, Response, NextFunction } from "express";

const allowedOrigin = process.env.FRONTEND_ORIGIN?.trim() || "";

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!allowedOrigin) {
    return next();
  }

  const origin = req.get("Origin");
  if (origin === allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Visit-Id, X-JS-Enabled, X-Fingerprint, X-JS-Challenge, X-Behavior-Score, X-Session-Id"
    );
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
}
