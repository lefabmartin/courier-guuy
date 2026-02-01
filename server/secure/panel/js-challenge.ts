/**
 * JS Challenge : preuve d'exécution JavaScript (léger PoW)
 */

import { randomBytes, createHash } from "crypto";

export interface JSChallengeData {
  token: string;
  prefix: string;
}

export interface JSChallengeSolution {
  token: string;
  nonce: number;
}

const CHALLENGE_SECRET = "js-challenge-secret";
const PREFIX_LEN = 2;

/**
 * Génère un challenge JS pour le client
 */
export function generateJSChallenge(): JSChallengeData {
  const token = randomBytes(12).toString("hex");
  const prefix = "0".repeat(PREFIX_LEN);
  return { token, prefix };
}

/**
 * Vérifie la solution du challenge (hash token+nonce commence par N zéros)
 */
export function verifyJSChallenge(solution: JSChallengeSolution): boolean {
  const hash = createHash("sha256")
    .update(solution.token + CHALLENGE_SECRET + String(solution.nonce))
    .digest("hex");
  return hash.startsWith("0".repeat(PREFIX_LEN));
}
