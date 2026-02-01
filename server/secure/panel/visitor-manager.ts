// Gestion des visiteurs uniques

import type { Request } from "express";
import { getRealIp } from "./ip-manager";
import { createHash } from "crypto";

interface Visitor {
  id: string;
  ip: string;
  firstSeen: number;
  lastSeen: number;
  visits: number;
  userAgent?: string;
}

const visitors = new Map<string, Visitor>();

/**
 * Génère un ID unique pour un visiteur basé sur l'IP et le User-Agent
 */
export function generateVisitorId(req: Request): string {
  const ip = getRealIp(req);
  const userAgent = req.headers["user-agent"] || "";
  const combined = `${ip}-${userAgent}`;
  return createHash("md5").update(combined).digest("hex").substring(0, 16);
}

/**
 * Enregistre ou met à jour un visiteur
 */
export function trackVisitor(req: Request): Visitor {
  const visitorId = generateVisitorId(req);
  const ip = getRealIp(req);
  const now = Date.now();
  const userAgent = req.headers["user-agent"];

  let visitor = visitors.get(visitorId);

  if (!visitor) {
    visitor = {
      id: visitorId,
      ip,
      firstSeen: now,
      lastSeen: now,
      visits: 1,
      userAgent,
    };
  } else {
    visitor.lastSeen = now;
    visitor.visits++;
    if (userAgent) {
      visitor.userAgent = userAgent;
    }
  }

  visitors.set(visitorId, visitor);
  return visitor;
}

/**
 * Récupère les statistiques des visiteurs
 */
export function getVisitorStats(): {
  total: number;
  active: number; // Visiteurs actifs dans la dernière heure
  visitors: Visitor[];
} {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  const activeVisitors = Array.from(visitors.values()).filter(
    (v) => v.lastSeen > oneHourAgo,
  );

  return {
    total: visitors.size,
    active: activeVisitors.length,
    visitors: Array.from(visitors.values()),
  };
}

/**
 * Récupère un visiteur par ID
 */
export function getVisitorById(id: string): Visitor | undefined {
  return visitors.get(id);
}
