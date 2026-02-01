// Filtrage géographique basé sur l'IP

import type { Request } from "express";
import { getRealIp } from "./ip-manager";
import { config } from "../config/config";

interface GeoLocation {
  country: string;
  countryCode: string;
  city?: string;
  region?: string;
}

/**
 * Récupère la géolocalisation d'une IP via plusieurs services
 */
export async function getGeoLocation(ip: string): Promise<GeoLocation | null> {
  // Liste des services de géolocalisation (fallback). ip-api.com : HTTP puis HTTPS en cas d'échec.
  const services = [
    `https://ipapi.co/${ip}/json/`,
    `http://ip-api.com/json/${ip}`,
    `https://ip-api.com/json/${ip}`,
    `https://freegeoip.app/json/${ip}`,
  ];

  for (const serviceUrl of services) {
    try {
      const response = await fetch(serviceUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      });

      if (response.ok) {
        const data = await response.json();

        // Format ipapi.co
        if (data.country_code) {
          return {
            country: data.country_name || "",
            countryCode: data.country_code,
            city: data.city,
            region: data.region,
          };
        }

        // Format ip-api.com
        if (data.countryCode) {
          return {
            country: data.country || "",
            countryCode: data.countryCode,
            city: data.city,
            region: data.regionName,
          };
        }

        // Format freegeoip
        if (data.country_code) {
          return {
            country: data.country_name || "",
            countryCode: data.country_code,
            city: data.city,
            region: data.region_name,
          };
        }
      }
    } catch (error) {
      // Continue avec le service suivant
      console.error(`Geo service failed: ${serviceUrl}`, error);
    }
  }

  return null;
}

/**
 * Vérifie si le pays est autorisé
 */
export async function isCountryAllowed(
  req: Request,
): Promise<{ allowed: boolean; country?: string; countryCode?: string }> {
  const ip = getRealIp(req);

  // Si aucune restriction géographique n'est configurée, autoriser
  if (!config.allowedCountries || config.allowedCountries.length === 0) {
    return { allowed: true };
  }

  const geo = await getGeoLocation(ip);
  if (!geo) {
    // Si on ne peut pas déterminer la localisation, autoriser par défaut
    return { allowed: true };
  }

  const isAllowed = config.allowedCountries.includes(geo.countryCode);

  return {
    allowed: isAllowed,
    country: geo.country,
    countryCode: geo.countryCode,
  };
}

/**
 * Gestion spéciale pour certains ASN (ex: Bermudes)
 */
export async function checkSpecialASN(ip: string): Promise<boolean> {
  // Implémentation pour vérifier l'ASN si nécessaire
  // Pour l'instant, retourner false
  return false;
}
