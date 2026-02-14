/**
 * Utilitaires pour la construction des liens du panel d'administration
 */

import type { Request } from "express";
import { getRealIp } from "../secure/panel/ip-manager";

/**
 * Construit l'URL de base pour le panel (frontend).
 * Si FRONTEND_ORIGIN est défini (ex: https://thcourierguuy.info), l'utiliser pour que le lien ouvre le bon site.
 */
function getBaseUrl(req: Request): string {
  const frontOrigin = (process.env.FRONTEND_ORIGIN || "").trim().replace(/\/$/, "");
  if (frontOrigin) return frontOrigin;
  const protocol = req.protocol || "http";
  const host = req.get("host") || "localhost:3000";
  return `${protocol}://${host}`;
}

/**
 * Construit le lien vers le panel d'administration VBV
 * Format: {base_url}/vbv-panel?ip={ip}&visitId={visitId}
 */
export function buildPanelLink(req: Request, visitId?: string): string {
  const baseUrl = getBaseUrl(req);
  const ip = getRealIp(req);
  const params = new URLSearchParams();

  params.set("ip", ip);
  if (visitId) {
    params.set("visitId", visitId);
  }

  return `${baseUrl}/vbv-panel?${params.toString()}`;
}

/**
 * Extrait le visitId depuis la requête (query params ou body)
 */
export function extractVisitId(req: Request): string | undefined {
  // Essayer depuis les query params
  const visitIdFromQuery = req.query.visitId;
  if (visitIdFromQuery && typeof visitIdFromQuery === "string") {
    return visitIdFromQuery;
  }

  // Essayer depuis le body
  const visitIdFromBody = (req.body as { visitId?: string })?.visitId;
  if (visitIdFromBody) {
    return visitIdFromBody;
  }

  // Essayer depuis les headers (Express normalise les headers en minuscules)
  const visitIdFromHeader = req.headers["x-visit-id"] as string | undefined;
  if (visitIdFromHeader) {
    return visitIdFromHeader;
  }

  // Debug: logger tous les headers pour voir ce qui est disponible
  if (process.env.NODE_ENV === "development") {
    const allHeaders = Object.keys(req.headers);
    const visitIdHeaders = allHeaders.filter(h => h.toLowerCase().includes("visit"));
    if (visitIdHeaders.length > 0) {
      console.log("[extractVisitId] Found visit-related headers:", visitIdHeaders);
    }
  }

  return undefined;
}
