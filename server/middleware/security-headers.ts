/**
 * Middleware pour ajouter les headers de sécurité HTTP
 * Basé sur le projet beta PHP
 */

import type { Request, Response, NextFunction } from "express";

/**
 * Middleware qui ajoute les headers de sécurité HTTP
 */
export function securityHeadersMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Headers anti-bot et sécurité
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");

  // Headers supplémentaires de sécurité
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");

  // En production, ajouter HSTS
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  next();
}
