/**
 * URL de base de l'API (même origine si vide).
 * Définir VITE_API_ORIGIN au build si le front est servi depuis un autre domaine que le backend.
 */

export function getApiBase(): string {
  const base =
    typeof import.meta.env !== "undefined" &&
    (import.meta.env as { VITE_API_ORIGIN?: string }).VITE_API_ORIGIN;
  return base ? String(base).replace(/\/$/, "") : "";
}

/** URL absolue pour un chemin API (ex. /api/telegram/send) */
export function apiUrl(path: string): string {
  const base = getApiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? base + p : p;
}
