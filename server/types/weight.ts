/**
 * Types pour la gestion du poids des colis
 */

export interface WeightCache {
  weight: number;
  timestamp: number;
}

export interface WeightResponse {
  weight: number;
}
