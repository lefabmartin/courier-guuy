/**
 * Middleware pour appliquer le rate limiting de manière cohérente
 */

import type { Request, Response, NextFunction } from "express";
import { checkRateLimit } from "../secure/panel/rate-limiter";
import { trackVisitor } from "../secure/panel/visitor-manager";

interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

/**
 * Middleware qui applique le rate limiting et le visitor tracking
 */
export function rateLimitMiddleware(options: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Track visitor
    trackVisitor(req);

    // En développement, bypasser complètement le rate limit
    const isDevelopment = process.env.NODE_ENV === "development" || !process.env.NODE_ENV;
    
    if (isDevelopment) {
      // Log pour déboguer
      console.log(`[DEV] Rate limit bypassed for ${req.method} ${req.path}`);
      res.setHeader("X-RateLimit-Limit", options.limit.toString());
      res.setHeader("X-RateLimit-Remaining", options.limit.toString());
      res.setHeader("X-RateLimit-Reset", new Date(Date.now() + options.windowMs).toISOString());
      return next();
    }

    // Check rate limit (production uniquement)
    const result = checkRateLimit(req, options.limit, options.windowMs);
    
    if (!result.allowed) {
      console.log(`[RATE LIMIT] Blocked ${req.method} ${req.path} from IP: ${req.socket.remoteAddress}`);
      return res.status(429).json({
        error: "Too Many Requests",
        message: "Rate limit exceeded",
        resetTime: result.resetTime,
      });
    }

    // Add rate limit headers
    res.setHeader("X-RateLimit-Limit", options.limit.toString());
    res.setHeader("X-RateLimit-Remaining", result.remaining.toString());
    res.setHeader("X-RateLimit-Reset", new Date(result.resetTime).toISOString());

    next();
  };
}
