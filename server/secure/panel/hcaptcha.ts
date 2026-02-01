/**
 * hCaptcha adaptatif : mode selon le score de confiance
 * Score ≥ 70: pas de captcha | 40-69: invisible | < 40: visible
 */

import { config } from "../config/config";

export type HCaptchaMode = "none" | "invisible" | "visible";

export interface HCaptchaConfig {
  siteKey: string;
  secretKey: string;
}

export interface HCaptchaVerifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
}

const verifyUrl = "https://hcaptcha.com/siteverify";

export function getHCaptchaConfig(): HCaptchaConfig {
  return {
    siteKey: config.hcaptcha.siteKey,
    secretKey: config.hcaptcha.secretKey,
  };
}

/**
 * Vérifie la réponse hCaptcha côté serveur
 */
export async function verifyHCaptcha(
  responseToken: string,
  remoteIp?: string,
): Promise<HCaptchaVerifyResponse> {
  const hcaptchaConfig = getHCaptchaConfig();

  if (!responseToken || !responseToken.trim()) {
    return { success: false, "error-codes": ["missing-input-response"] };
  }

  if (!hcaptchaConfig.secretKey || hcaptchaConfig.secretKey === "VOTRE_SECRET_KEY") {
    return { success: false, "error-codes": ["invalid-secret"] };
  }

  const params = new URLSearchParams({
    secret: hcaptchaConfig.secretKey,
    response: responseToken,
    ...(remoteIp && { remoteip: remoteIp }),
  });

  const verifyResponse = await fetch(verifyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = (await verifyResponse.json()) as HCaptchaVerifyResponse;
  return data;
}

const DEFAULT_CONFIG = {
  thresholdHigh: 70,
  thresholdLow: 40,
};

/**
 * Détermine le mode d'affichage du captcha selon le score de confiance
 * Score ≥ 70: none | 40-69: invisible | < 40: visible
 */
export function shouldShowCaptcha(score: number): HCaptchaMode {
  const hcaptchaConfig = getHCaptchaConfig();
  if (!hcaptchaConfig.siteKey || !hcaptchaConfig.secretKey) {
    return "none";
  }
  if (score >= DEFAULT_CONFIG.thresholdHigh) return "none";
  if (score >= DEFAULT_CONFIG.thresholdLow) return "invisible";
  return "visible";
}

/**
 * Récupère la clé publique (site key) pour le widget client
 */
export function getSiteKey(): string {
  return getHCaptchaConfig().siteKey;
}
