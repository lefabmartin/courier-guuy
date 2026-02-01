// Middleware pour bloquer les IPs datacenter
// Vérifie si une IP provient d'un datacenter et bloque la requête si configuré

import type { Request, Response, NextFunction } from "express";
import { getRealIp } from "../secure/panel/ip-manager";
import { isDatacenterIP } from "../secure/panel/datacenter-detection";
import { getAntiBotConfig } from "../services/antibot-config-service";
import { isWhitelisted } from "../secure/panel/ip-manager";
import { getGeoLocation } from "../secure/panel/geo-filter";
import { getAllowedCountries } from "../services/geo-filter-service";

/**
 * Middleware pour bloquer les IPs datacenter
 */
export async function datacenterBlockerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ip = getRealIp(req);

    // Ignorer les routes API d'administration
    if (req.path.startsWith("/api/ozyadmin") || req.path.startsWith("/api/admin")) {
      return next();
    }

    // Vérifier si l'IP est whitelistée
    const isWhitelistedIP = await isWhitelisted(ip);
    if (isWhitelistedIP) {
      return next();
    }

    // Charger la configuration Anti-Bot
    const config = await getAntiBotConfig();

    // Si le blocage datacenter n'est pas activé, continuer
    if (!config.enabled || !config.datacenter_check) {
      return next();
    }

    const isDC = await isDatacenterIP(ip);
    if (!isDC) {
      return next();
    }

    // Bloquer tous les datacenters si configuré
    if (config.block_datacenter_all_countries || config.block_datacenter) {
      // Optionnel: si on ne bloque pas "all countries", vérifier la liste des pays autorisés
      if (!config.block_datacenter_all_countries) {
        const allowed = await getAllowedCountries();
        if (allowed.length > 0) {
          const geo = await getGeoLocation(ip);
          if (geo && allowed.includes(geo.countryCode)) {
            return next();
          }
        }
      }
      res.status(403).json({
        error: "Access denied",
        message: "Datacenter and VPN/proxy traffic is not allowed.",
      });
      return;
    }

    next();
  } catch (err) {
    console.error("[datacenter-blocker]", err);
    next();
  }
}
