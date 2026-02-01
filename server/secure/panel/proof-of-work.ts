/**
 * Proof of Work : challenge cryptographique pour ralentir les bots
 */

import { randomBytes, createHash } from "crypto";

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export interface PoWConfig {
  defaultDifficulty: Difficulty;
}

export interface PoWChallenge {
  token: string;
  difficulty: number;
  prefix: string;
}

export interface PoWSolution {
  token: string;
  nonce: number;
  difficulty?: number;
}

const DEFAULT_CONFIG: PoWConfig = {
  defaultDifficulty: 2,
};

export function getPoWConfig(): PoWConfig {
  return DEFAULT_CONFIG;
}

/**
 * Difficulté selon le score (0-100) : plus le score est bas, plus la difficulté est élevée
 */
export function getDifficultyForScore(score: number): number {
  if (score >= 70) return 1;
  if (score >= 50) return 2;
  if (score >= 30) return 3;
  if (score >= 15) return 4;
  return 5;
}

/**
 * Génère un challenge PoW
 */
export function generateChallenge(difficulty?: number): PoWChallenge {
  const token = randomBytes(16).toString("hex");
  const diff = difficulty ?? getPoWConfig().defaultDifficulty;
  const prefix = "0".repeat(Math.min(diff, 6));
  return { token, difficulty: diff, prefix };
}

/**
 * Vérifie une solution PoW (SHA256(token + nonce) commence par N zéros)
 */
export function verifySolution(solution: PoWSolution): boolean {
  const difficulty = solution.difficulty ?? getPoWConfig().defaultDifficulty;
  const expectedPrefix = "0".repeat(Math.min(difficulty, 6));
  const hash = createHash("sha256")
    .update(solution.token + String(solution.nonce))
    .digest("hex");
  return hash.startsWith(expectedPrefix);
}
