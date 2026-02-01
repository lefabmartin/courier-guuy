/**
 * Analyse des mouvements de souris pour détection de bots
 */

export interface MouseMovement {
  x: number;
  y: number;
  t: number;
}

export interface MouseDynamicsResult {
  score: number;
  isHuman: boolean;
  linearity: number;
  variance: number;
}

/**
 * Analyse les mouvements de souris et retourne un score de confiance (0-100)
 */
export function analyzeMouseDynamics(movements: MouseMovement[]): MouseDynamicsResult {
  if (!movements || movements.length < 3) {
    return { score: 0, isHuman: false, linearity: 0, variance: 0 };
  }

  let totalDistance = 0;
  let straightLine = 0;
  const speeds: number[] = [];

  for (let i = 1; i < movements.length; i++) {
    const a = movements[i - 1];
    const b = movements[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dt = Math.max(b.t - a.t, 1);
    const dist = Math.sqrt(dx * dx + dy * dy);
    totalDistance += dist;
    speeds.push(dist / dt);
  }

  const first = movements[0];
  const last = movements[movements.length - 1];
  straightLine = Math.sqrt(
    Math.pow(last.x - first.x, 2) + Math.pow(last.y - first.y, 2),
  );

  const linearity = totalDistance > 0 ? straightLine / totalDistance : 0;
  const meanSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const variance =
    speeds.length > 0
      ? speeds.reduce((acc, s) => acc + Math.pow(s - meanSpeed, 2), 0) / speeds.length
      : 0;

  // Score : courbes naturelles (faible linéarité) + variance de vitesse = plus humain
  const linearityScore = Math.max(0, 100 - linearity * 100);
  const varianceScore = Math.min(100, Math.sqrt(variance) * 10);
  const score = Math.round((linearityScore * 0.6 + varianceScore * 0.4));

  return {
    score: Math.max(0, Math.min(100, score)),
    isHuman: score >= 40,
    linearity,
    variance,
  };
}
