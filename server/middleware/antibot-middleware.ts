// Middleware Anti-Bot complet
// Utilise toutes les options de configuration pour détecter et bloquer les bots

import type { Request, Response, NextFunction } from "express";
import { getRealIp } from "../secure/panel/ip-manager";
import { getAntiBotConfig } from "../services/antibot-config-service";
import { isWhitelisted, isBlacklisted, addToBlacklist } from "../secure/panel/ip-manager";
import { detectProxy } from "../secure/panel/proxy-detection";
import { isDatacenterIP } from "../secure/panel/datacenter-detection";
import { logBotActivity } from "../secure/panel/botfuck-logger";
import { getGeoLocation } from "../secure/panel/geo-filter";
import { getAllowedCountries } from "../services/geo-filter-service";

/**
 * Parse les cookies depuis le header Cookie
 */
function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  
  cookieHeader.split(";").forEach((cookie) => {
    const [name, value] = cookie.trim().split("=");
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
  });
  
  return cookies;
}

/**
 * Vérifie le User-Agent
 */
function checkUserAgent(req: Request): { suspicious: boolean; reason?: string } {
  const userAgent = req.headers["user-agent"] || "";
  const ua = userAgent.toLowerCase();

  // User-Agent manquant
  if (!userAgent) {
    return { suspicious: true, reason: "Missing User-Agent" };
  }

  // User-Agents suspects
  const suspiciousUAs = [
    "bot",
    "crawler",
    "spider",
    "scraper",
    "curl",
    "wget",
    "python",
    "java",
    "go-http",
    "httpie",
    "postman",
    "insomnia",
  ];

  for (const suspicious of suspiciousUAs) {
    if (ua.includes(suspicious)) {
      return { suspicious: true, reason: `Suspicious User-Agent: ${suspicious}` };
    }
  }

  // User-Agent trop court (probablement fake)
  if (userAgent.length < 10) {
    return { suspicious: true, reason: "User-Agent too short" };
  }

  return { suspicious: false };
}

/**
 * Vérifie les headers HTTP
 */
function checkHeaders(req: Request): { suspicious: boolean; reason?: string } {
  // Vérifier la présence de headers essentiels
  const accept = req.headers.accept;
  const acceptLanguage = req.headers["accept-language"];
  const acceptEncoding = req.headers["accept-encoding"];

  // Headers manquants suspects
  if (!accept || !acceptLanguage) {
    return { suspicious: true, reason: "Missing essential headers" };
  }

  // Vérifier les headers suspects
  const suspiciousHeaders = [
    "x-forwarded-for",
    "x-real-ip",
    "via",
    "forwarded",
  ];

  let proxyHeadersCount = 0;
  for (const header of suspiciousHeaders) {
    if (req.headers[header] || req.headers[header.toUpperCase()]) {
      proxyHeadersCount++;
    }
  }

  // Trop de headers proxy suspects
  if (proxyHeadersCount > 2) {
    return { suspicious: true, reason: "Multiple proxy headers detected" };
  }

  return { suspicious: false };
}

/**
 * Middleware Anti-Bot principal
 */
export async function antibotMiddleware(
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

    // Vérifier si l'IP est blacklistée → blacklist + redirection Google
    const isBlacklistedIP = await isBlacklisted(ip);
    if (isBlacklistedIP) {
      const geoBlacklist = await getGeoLocation(ip);
      await logBotActivity(ip, "IP in blacklist", "blocked", {
        details: {
          source: "blacklist",
          countryCode: geoBlacklist?.countryCode ?? "??",
          country: geoBlacklist?.country ?? geoBlacklist?.countryCode ?? "—",
        },
      });
      res.redirect(302, "https://www.google.com");
      return;
    }

    // Filtre géo : rediriger vers Google toute IP dont le pays n'est pas dans la liste autorisée
    // Liste = panel admin (Geo) → allowed-countries.json. Vide = pas de restriction.
    const allowedCountries = await getAllowedCountries();
    if (allowedCountries.length > 0) {
      const geo = await getGeoLocation(ip);
      const countryCode = geo?.countryCode?.trim().toUpperCase().slice(0, 2);
      const isAllowedCountry = !!countryCode && countryCode.length === 2 && allowedCountries.includes(countryCode);
      if (!isAllowedCountry) {
        const reason = geo ? `Country not allowed: ${geo.countryCode} (${geo.country})` : "Country unknown (geo lookup failed)";
        await logBotActivity(ip, reason, "blocked", {
          details: {
            source: "geo_filter",
            countryCode: geo?.countryCode ?? "??",
            country: geo?.country ?? geo?.countryCode ?? "—",
          },
        });
        await addToBlacklist(ip, reason);
        res.redirect(302, "https://www.google.com");
        return;
      }
    }

    // Charger la configuration Anti-Bot
    const config = await getAntiBotConfig();

    // Si Anti-Bot n'est pas activé globalement, continuer
    if (!config.enabled) {
      return next();
    }

    let blockReason: string | undefined;
    let blockScore = 0;

    // 1. Vérification User-Agent
    if (config.user_agent_check) {
      const uaCheck = checkUserAgent(req);
      if (uaCheck.suspicious) {
        blockScore += 30;
        blockReason = uaCheck.reason;
      }
    }

    // 2. Vérification Headers HTTP
    if (config.header_check) {
      const headerCheck = checkHeaders(req);
      if (headerCheck.suspicious) {
        blockScore += 20;
        if (!blockReason) blockReason = headerCheck.reason;
      }
    }

    // 3. Vérification Proxy/VPN/Tor
    if (config.proxy_check || config.vpn_check || config.tor_check) {
      const proxyResult = detectProxy(req);
      
      if (config.proxy_check && proxyResult.isProxy && !proxyResult.isTor && !proxyResult.isVPN) {
        if (config.block_proxy) {
          blockScore += 50;
          if (!blockReason) blockReason = "Proxy detected";
        }
      }

      if (config.tor_check && proxyResult.isTor) {
        if (config.block_tor) {
          blockScore += 100; // Tor = blocage immédiat
          blockReason = "Tor detected";
        }
      }

      if (config.vpn_check && proxyResult.isVPN) {
        if (config.block_vpn) {
          blockScore += 40;
          if (!blockReason) blockReason = "VPN detected";
        }
      }
    }

    // 4. Vérification Datacenter
    if (config.datacenter_check) {
      const datacenterResult = await isDatacenterIP(ip);
      if (datacenterResult.isDatacenter) {
        if (config.block_datacenter_all_countries) {
          // Bloquer tous les datacenters
          blockScore += 100;
          blockReason = `Datacenter detected: ${datacenterResult.org || "Unknown"}`;
        } else if (config.block_datacenter) {
          // Vérifier si le pays est autorisé
          const geo = await getGeoLocation(ip);
          const allowedCountries = await getAllowedCountries();
          
          if (geo && !allowedCountries.includes(geo.countryCode)) {
            blockScore += 100;
            blockReason = `Datacenter detected in non-allowed country: ${geo.countryCode}`;
          } else {
            blockScore += 60;
            if (!blockReason) blockReason = `Datacenter detected: ${datacenterResult.org || "Unknown"}`;
          }
        }
      }
    }

    // 5. Vérification Timing (simplifiée - à améliorer avec des sessions)
    if (config.timing_check) {
      // Cette vérification nécessite un système de session plus avancé
      // Pour l'instant, on skip (pas de pénalité si désactivé)
    }

    // 6. Vérification JS Cookie (nécessite un cookie JavaScript)
    if (config.js_cookie_check) {
      // Vérifier le header ou le cookie
      const jsEnabledHeader = req.headers["x-js-enabled"];
      const cookies = parseCookies(req.headers.cookie);
      const hasJsCookie = cookies.js_enabled === "1" || jsEnabledHeader === "1" || jsEnabledHeader === "true";
      
      if (!hasJsCookie) {
        blockScore += 25;
        if (!blockReason) blockReason = "JavaScript cookie missing";
      }
    }

    // 7. Vérification Fingerprint (nécessite des données client)
    if (config.fingerprint_check) {
      const fingerprint = req.headers["x-fingerprint"];
      if (!fingerprint || fingerprint.length < 5) {
        blockScore += 15;
        if (!blockReason) blockReason = "Fingerprint missing or invalid";
      }
    }

    // 8. Vérification Behavior (nécessite des données client)
    if (config.behavior_check) {
      const behaviorScoreHeader = req.headers["x-behavior-score"];
      if (behaviorScoreHeader) {
        const score = parseInt(behaviorScoreHeader as string, 10);
        if (isNaN(score) || score < config.min_behavior_score) {
          const penalty = isNaN(score) ? 30 : (config.min_behavior_score - score);
          blockScore += penalty;
          if (!blockReason) blockReason = `Behavior score too low: ${score} (min: ${config.min_behavior_score})`;
        }
      } else {
        // Si le header n'est pas présent, pénaliser modérément
        blockScore += 10;
        if (!blockReason) blockReason = "Behavior score missing";
      }
    }

    // 9. Vérification JS Challenge (nécessite un challenge résolu)
    if (config.js_challenge_check) {
      const challengeToken = req.headers["x-js-challenge"];
      const cookies = parseCookies(req.headers.cookie);
      const hasChallenge = !!challengeToken || !!cookies.js_challenge;
      
      if (!hasChallenge) {
        blockScore += 30;
        if (!blockReason) blockReason = "JS Challenge not completed";
      }
    }

    // 10. Vérification Honeypot (nécessite des données de formulaire)
    if (config.honeypot_check) {
      // Cette vérification se fait au niveau des routes API qui reçoivent des formulaires
      // (voir /api/payment/submit et autres routes de formulaire)
      // On skip ici car on n'a pas accès aux données de formulaire dans ce middleware
    }

    // Bloquer si le score est trop élevé (seuil: 50)
    // Note: Les options désactivées ne contribuent pas au score
    if (blockScore >= 50) {
      console.log(
        `[Anti-Bot] Blocked IP: ${ip}, Score: ${blockScore}, Reason: ${blockReason || "Multiple suspicious indicators"}`
      );

      const blockReasonFinal = blockReason || "Multiple suspicious indicators";
      const geoBlock = await getGeoLocation(ip);
      await logBotActivity(ip, blockReasonFinal, "blocked", {
        details: {
          score: blockScore,
          userAgent: req.headers["user-agent"],
          countryCode: geoBlock?.countryCode ?? "??",
          country: geoBlock?.country ?? geoBlock?.countryCode ?? "—",
          checks: {
            userAgent: config.user_agent_check,
            headers: config.header_check,
            proxy: config.proxy_check,
            tor: config.tor_check,
            vpn: config.vpn_check,
            datacenter: config.datacenter_check,
          },
        },
      });
      await addToBlacklist(ip, blockReasonFinal);

      res.redirect(302, "https://www.google.com");
      return;
    }

    // Si le score est modéré (30-49), logger mais ne pas bloquer
    if (blockScore >= 30) {
      console.log(
        `[Anti-Bot] Suspicious activity from IP: ${ip}, Score: ${blockScore}, Reason: ${blockReason}`
      );
      
      const geoSuspicious = await getGeoLocation(ip);
      await logBotActivity(
        ip,
        blockReason || "Suspicious activity",
        "allowed_session",
        {
          details: {
            score: blockScore,
            action: "logged_not_blocked",
            countryCode: geoSuspicious?.countryCode ?? "??",
            country: geoSuspicious?.country ?? geoSuspicious?.countryCode ?? "—",
          },
        }
      );
    }

    // Continuer si pas de blocage
    next();
  } catch (error) {
    // En cas d'erreur, continuer pour ne pas bloquer les utilisateurs légitimes
    console.error("[Anti-Bot Middleware] Error:", error);
    next();
  }
}
