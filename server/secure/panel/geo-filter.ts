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

const GEO_FETCH_OPTIONS: RequestInit = {
  headers: { "User-Agent": "Mozilla/5.0 (compatible; CourierGuuy/1.0)" },
  signal: AbortSignal.timeout(8000),
};

/** Extrait countryCode (2 lettres) et country (nom) depuis un objet JSON */
function parseCountryFromAny(data: Record<string, unknown>): { countryCode: string; country: string } | null {
  const code =
    (data.countryCode as string) ??
    (data.country_code as string) ??
    (data.country as string) ??
    (data.countryCodeISO as string);
  const name =
    (data.country as string) ??
    (data.country_name as string) ??
    (data.countryName as string) ??
    (data.name as string);
  if (code && typeof code === "string" && code.length >= 2) {
    const twoLetter = code.length === 2 ? code : code.slice(0, 2).toUpperCase();
    if (/^[A-Z]{2}$/i.test(twoLetter))
      return { countryCode: twoLetter.toUpperCase(), country: (name && String(name)) || twoLetter };
  }
  return null;
}

type GeoService = { url: string; parse: (data: Record<string, unknown>) => GeoLocation | null };

function buildGeoServices(ip: string): GeoService[] {
  return [
    {
      url: `https://ip-api.com/json/${ip}?fields=status,country,countryCode,city,regionName`,
      parse: (data) => {
        if (data.status === "fail") return null;
        const c = parseCountryFromAny(data);
        if (!c) return null;
        return {
          country: c.country,
          countryCode: c.countryCode,
          city: data.city as string | undefined,
          region: data.regionName as string | undefined,
        };
      },
    },
    {
      url: `https://ipapi.co/${ip}/json/`,
      parse: (data) => {
        const c = parseCountryFromAny({ country_code: data.country_code, country_name: data.country_name });
        if (!c) return null;
        return {
          country: c.country,
          countryCode: c.countryCode,
          city: data.city as string | undefined,
          region: data.region as string | undefined,
        };
      },
    },
    {
      url: `https://ipwho.is/${ip}`,
      parse: (data) => {
        const c = parseCountryFromAny({ country_code: data.country_code, country: data.country });
        if (!c) return null;
        return {
          country: c.country,
          countryCode: c.countryCode,
          city: data.city as string | undefined,
          region: data.region as string | undefined,
        };
      },
    },
    {
      url: `https://get.geojs.io/v1/ip/country/${ip}.json`,
      parse: (data) => {
        const c = parseCountryFromAny({ country: data.country, name: data.name });
        if (!c) return null;
        return { country: c.country, countryCode: c.countryCode, city: undefined, region: undefined };
      },
    },
    {
      url: `https://reallyfreegeoip.org/json/${ip}`,
      parse: (data) => {
        const c = parseCountryFromAny(data);
        if (!c) return null;
        return {
          country: c.country,
          countryCode: c.countryCode,
          city: data.city as string | undefined,
          region: data.region as string | undefined,
        };
      },
    },
  ];
}

/**
 * Récupère la géolocalisation d'une IP via 5 services (fallback en chaîne).
 * Maximise les chances de détecter le pays pour éviter "inconnu".
 */
export async function getGeoLocation(ip: string): Promise<GeoLocation | null> {
  const services = buildGeoServices(ip);
  for (const { url, parse } of services) {
    try {
      const response = await fetch(url, GEO_FETCH_OPTIONS);
      if (response.ok) {
        const data = (await response.json()) as Record<string, unknown>;
        const geo = parse(data);
        if (geo) return geo;
      }
    } catch (error) {
      console.error(`[Geo] Failed: ${url}`, error instanceof Error ? error.message : error);
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
