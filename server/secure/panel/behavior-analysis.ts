/**
 * Analyse comportementale des visiteurs (souris, clics, scroll, timing)
 */

export interface BehaviorData {
  mouseMovements?: Array<{ x: number; y: number; t: number }>;
  clicks?: Array<{ x: number; y: number; t: number }>;
  scrollEvents?: Array<{ y: number; t: number }>;
  timeOnPage?: number;
}

export interface BehaviorAnalysisResult {
  score: number;
  isHuman: boolean;
  details?: string;
}

/**
 * Analyse le comportement et retourne un score de confiance (0-100)
 */
export function analyzeBehavior(data: BehaviorData): BehaviorAnalysisResult {
  let score = 50;

  if (data.mouseMovements && data.mouseMovements.length >= 5) {
    score = Math.min(100, score + 15);
  }
  if (data.clicks && data.clicks.length >= 1) {
    score = Math.min(100, score + 10);
  }
  if (data.scrollEvents && data.scrollEvents.length >= 1) {
    score = Math.min(100, score + 10);
  }
  if (data.timeOnPage && data.timeOnPage >= 2000) {
    score = Math.min(100, score + 15);
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    isHuman: score >= 40,
  };
}
