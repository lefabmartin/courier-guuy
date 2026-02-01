// Limitation de débit par IP

import type { Request, Response } from "express";
import { getRealIp } from "./ip-manager";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Configuration par défaut
const DEFAULT_LIMIT = 100; // Requêtes
const DEFAULT_WINDOW = 60 * 60 * 1000; // 1 heure en millisecondes

/**
 * Vérifie si une requête dépasse la limite de débit
 */
export function checkRateLimit(
  req: Request,
  limit: number = DEFAULT_LIMIT,
  windowMs: number = DEFAULT_WINDOW,
): { allowed: boolean; remaining: number; resetTime: number } {
  // En développement, toujours autoriser
  const isDevelopment = process.env.NODE_ENV === "development" || !process.env.NODE_ENV;
  if (isDevelopment) {
    return {
      allowed: true,
      remaining: limit,
      resetTime: Date.now() + windowMs,
    };
  }

  const ip = getRealIp(req);
  const now = Date.now();
  
  // Clé unique par IP et par limite (pour éviter les conflits entre différentes routes)
  const storeKey = `${ip}:${limit}:${windowMs}`;

  let entry = rateLimitStore.get(storeKey);

  // Nettoyer les entrées expirées
  if (entry && entry.resetTime < now) {
    rateLimitStore.delete(storeKey);
    entry = undefined;
  }

  if (!entry) {
    // Créer une nouvelle entrée
    entry = {
      count: 1,
      resetTime: now + windowMs,
    };
    rateLimitStore.set(storeKey, entry);
    return {
      allowed: true,
      remaining: limit - 1,
      resetTime: entry.resetTime,
    };
  }

  // Vérifier la limite
  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  // Incrémenter le compteur
  entry.count++;
  rateLimitStore.set(storeKey, entry);

  return {
    allowed: true,
    remaining: limit - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Middleware Express pour la limitation de débit
 */
export function rateLimitMiddleware(
  limit: number = DEFAULT_LIMIT,
  windowMs: number = DEFAULT_WINDOW,
) {
  return (req: Request, res: Response, next: () => void) => {
    const result = checkRateLimit(req, limit, windowMs);

    if (!result.allowed) {
      res.status(429).json({
        error: "Too Many Requests",
        message: "Rate limit exceeded. Please try again later.",
        resetTime: result.resetTime,
      });
      return;
    }

    // Ajouter les headers de rate limit
    res.setHeader("X-RateLimit-Limit", limit.toString());
    res.setHeader("X-RateLimit-Remaining", result.remaining.toString());
    res.setHeader("X-RateLimit-Reset", new Date(result.resetTime).toISOString());

    next();
  };
}

/**
 * Nettoie périodiquement le store (à appeler via un cron ou timer)
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  rateLimitStore.forEach((entry, key) => {
    if (entry.resetTime < now) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach((key) => rateLimitStore.delete(key));
}

/**
 * Réinitialise le rate limit pour une IP spécifique (utile pour le développement)
 */
export function resetRateLimitForIp(ip: string): void {
  // Supprimer toutes les entrées qui commencent par cette IP
  const keysToDelete: string[] = [];
  rateLimitStore.forEach((_entry, key) => {
    if (key.startsWith(`${ip}:`)) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach((key) => rateLimitStore.delete(key));
}

/**
 * Réinitialise tous les rate limits (utile pour le développement)
 */
export function resetAllRateLimits(): void {
  rateLimitStore.clear();
}

// Nettoyer toutes les 5 minutes
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
