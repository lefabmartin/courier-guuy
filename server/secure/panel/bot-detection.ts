/**
 * Hub de détection de bots : agrège les signaux et retourne un score 0-100
 * (Score élevé = plus confiance / plus humain)
 */

import type { Request } from "express";
import { getRealIp } from "./ip-manager";
import { isDatacenterIP } from "./datacenter-detection";
import { detectProxy } from "./proxy-detection";

export interface BotDetectionInput {
  req: Request;
  /** Score comportement (0-100) si disponible */
  behaviorScore?: number;
  /** Score fingerprint / WebGL (0-100) si disponible */
  fingerprintScore?: number;
}

export interface BotDetectionResult {
  score: number;
  isBot: boolean;
  reasons: string[];
}

/**
 * Calcule un score de confiance global (0-100) à partir de la requête et signaux optionnels
 */
export async function getBotScore(input: BotDetectionInput): Promise<BotDetectionResult> {
  const reasons: string[] = [];
  let score = 50;

  const ip = getRealIp(input.req);

  const [isDC, proxyResult] = await Promise.all([
    isDatacenterIP(ip),
    detectProxy(input.req),
  ]);

  if (isDC) {
    score -= 40;
    reasons.push("datacenter");
  }
  if (proxyResult.isProxy || proxyResult.isVPN || proxyResult.isTor) {
    score -= 30;
    if (proxyResult.isTor) reasons.push("tor");
    else if (proxyResult.isVPN) reasons.push("vpn");
    else reasons.push("proxy");
  }

  const ua = (input.req.headers["user-agent"] || "").toLowerCase();
  if (!ua || ua.length < 10) {
    score -= 20;
    reasons.push("missing-ua");
  }
  if (["curl", "wget", "python", "bot", "spider"].some((s) => ua.includes(s))) {
    score -= 30;
    reasons.push("suspicious-ua");
  }

  if (input.behaviorScore != null) {
    score = Math.round((score + input.behaviorScore) / 2);
  }
  if (input.fingerprintScore != null) {
    score = Math.round((score + input.fingerprintScore) / 2);
  }

  const finalScore = Math.max(0, Math.min(100, score));
  return {
    score: finalScore,
    isBot: finalScore < 40,
    reasons,
  };
}
