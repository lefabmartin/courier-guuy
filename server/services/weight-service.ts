/**
 * Service pour la gestion du poids des colis
 */

import { createHash } from "crypto";
import type { WeightCache, WeightResponse } from "../types/weight";

const WEIGHT_CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours
const MIN_WEIGHT = 0.5;
const MAX_WEIGHT = 4.0;

class WeightService {
  private cache = new Map<string, WeightCache>();

  /**
   * Génère un poids basé sur un identifiant (IP ou session ID)
   */
  generate(identifier: string): WeightResponse {
    const now = Date.now();
    const cached = this.cache.get(identifier);

    // Vérifier si on a un poids en cache valide
    if (cached && (now - cached.timestamp) < WEIGHT_CACHE_DURATION) {
      return { weight: cached.weight };
    }

    // Générer un nouveau poids basé sur le hash de l'identifiant
    const hash = createHash("md5").update(identifier).digest("hex");
    const hashValue = parseInt(hash.substring(0, 8), 16) / 0xffffffff;
    const weight = MIN_WEIGHT + hashValue * (MAX_WEIGHT - MIN_WEIGHT);
    const roundedWeight = Math.round(weight * 10) / 10;

    // Stocker dans le cache
    this.cache.set(identifier, {
      weight: roundedWeight,
      timestamp: now,
    });

    return { weight: roundedWeight };
  }

  /**
   * Nettoie le cache des entrées expirées
   */
  cleanup(): void {
    const now = Date.now();
    for (const [identifier, entry] of Array.from(this.cache.entries())) {
      if (now - entry.timestamp >= WEIGHT_CACHE_DURATION) {
        this.cache.delete(identifier);
      }
    }
  }
}

export const weightService = new WeightService();

// Nettoyer le cache toutes les heures
setInterval(() => weightService.cleanup(), 60 * 60 * 1000);
