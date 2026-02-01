/**
 * Détection Tor/VPN/Proxy
 * Identification des connexions anonymisées
 * Basé sur le projet beta PHP
 */

import type { Request } from "express";
import { getRealIp } from "./ip-manager";

interface ProxyDetectionResult {
  isProxy: boolean;
  isVPN: boolean;
  isTor: boolean;
  type?: "proxy" | "vpn" | "tor" | "datacenter";
  confidence: number; // 0-100
  details?: string;
}

// Headers suspects indiquant un proxy
const PROXY_HEADERS = [
  "via",
  "x-forwarded-for",
  "forwarded-for",
  "x-forwarded",
  "forwarded",
  "client-ip",
  "forwarded-for-ip",
  "x-cluster-client-ip",
  "x-real-ip",
  "proxy-connection",
  "x-proxy-id",
];

// Organisations VPN connues (liste partielle)
const KNOWN_VPN_ORGANIZATIONS = [
  "nordvpn",
  "expressvpn",
  "surfshark",
  "cyberghost",
  "private internet access",
  "purevpn",
  "ipvanish",
  "vyprvpn",
  "tunnelbear",
  "windscribe",
  "protonvpn",
  "mullvad",
  "hidemyass",
  "hotspot shield",
];

// ASN connus pour les datacenters
const DATACENTER_ASNS = [
  "AS13335", // Cloudflare
  "AS15169", // Google
  "AS16509", // Amazon
  "AS8075", // Microsoft
  "AS32934", // Facebook
];

/**
 * Détecte si une requête provient d'un proxy/VPN/Tor
 */
export function detectProxy(req: Request): ProxyDetectionResult {
  const ip = getRealIp(req) || "";
  const result: ProxyDetectionResult = {
    isProxy: false,
    isVPN: false,
    isTor: false,
    confidence: 0,
  };

  // 1. Vérifier les headers suspects
  let proxyHeadersFound = 0;
  for (const header of PROXY_HEADERS) {
    if (req.headers[header] || req.headers[header.toUpperCase()]) {
      proxyHeadersFound++;
    }
  }

  if (proxyHeadersFound > 0) {
    result.isProxy = true;
    result.type = "proxy";
    result.confidence = Math.min(proxyHeadersFound * 15, 90);
    result.details = `Proxy headers detected: ${proxyHeadersFound}`;
  }

  // 2. Vérifier X-Forwarded-For (peut indiquer un proxy)
  const forwardedFor = req.headers["x-forwarded-for"] as string | undefined;
  if (forwardedFor && forwardedFor !== ip) {
    result.isProxy = true;
    result.confidence = Math.max(result.confidence, 70);
    result.details = `X-Forwarded-For mismatch: ${forwardedFor} vs ${ip}`;
  }

  // 3. Vérifier User-Agent suspect
  const userAgent = req.headers["user-agent"]?.toLowerCase() || "";
  if (
    userAgent.includes("tor") ||
    userAgent.includes("proxy") ||
    userAgent.includes("vpn")
  ) {
    result.isProxy = true;
    result.confidence = Math.max(result.confidence, 60);
  }

  // 4. Détection Tor (via liste d'exit nodes - simplifié)
  // En production, utiliser une API ou une liste mise à jour
  // Note: Pour l'instant désactivé, à implémenter avec une vraie API
  // if (await isTorExitNode(ip)) {
  //   result.isTor = true;
  //   result.type = "tor";
  //   result.confidence = 95;
  //   result.details = "Tor exit node detected";
  // }

  // 5. Détection VPN (via API externe - à implémenter)
  // Pour l'instant, vérification basique via headers
  if (result.isProxy && !result.isTor) {
    // Vérifier si c'est probablement un VPN
    const hostname = req.get("host") || "";
    if (KNOWN_VPN_ORGANIZATIONS.some((vpn) => hostname.toLowerCase().includes(vpn))) {
      result.isVPN = true;
      result.type = "vpn";
      result.confidence = Math.max(result.confidence, 80);
    }
  }

  return result;
}

/**
 * Vérifie si une IP est un exit node Tor
 * Note: En production, utiliser une API ou une liste mise à jour
 */
async function isTorExitNode(ip: string): Promise<boolean> {
  // Simplification: en production, utiliser une API comme:
  // - https://check.torproject.org/api/exit-addresses
  // - https://www.dan.me.uk/torlist/
  
  // Pour l'instant, retourner false (à implémenter avec une vraie API)
  return false;
}

/**
 * Middleware Express pour détecter les proxies
 */
export function proxyDetectionMiddleware(
  req: Request,
  res: Response,
  next: () => void,
): void {
  const detection = detectProxy(req);

  // Ajouter les informations de détection à la requête
  (req as Request & { proxyDetection: ProxyDetectionResult }).proxyDetection =
    detection;

  // En développement, logger la détection
  if (process.env.NODE_ENV === "development" && detection.isProxy) {
    console.log(
      `[PROXY DETECTION] IP: ${getRealIp(req)}, Type: ${detection.type}, Confidence: ${detection.confidence}%`,
    );
  }

  next();
}
