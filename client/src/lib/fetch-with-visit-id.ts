/**
 * Wrapper pour fetch qui inclut automatiquement le visitId
 */

import { getOrCreateVisitId, getVisitIdFromUrl, getVisitIdFromStorage } from "@/lib/visit-id";
import { getApiBase } from "@/lib/api-base";

let globalVisitId: string | null = null;

function getGlobalVisitId(): string {
  if (globalVisitId) {
    return globalVisitId;
  }

  // Essayer depuis l'URL
  const fromUrl = getVisitIdFromUrl();
  if (fromUrl) {
    globalVisitId = fromUrl;
    return fromUrl;
  }

  // Essayer depuis le localStorage
  const fromStorage = getVisitIdFromStorage();
  if (fromStorage) {
    globalVisitId = fromStorage;
    return fromStorage;
  }

  // Générer un nouveau visitId
  const newVisitId = getOrCreateVisitId();
  globalVisitId = newVisitId;
  return newVisitId;
}

interface FetchOptions extends RequestInit {
  visitId?: string;
}

/**
 * Version améliorée de fetch qui inclut automatiquement le visitId
 */
export async function fetchWithVisitId(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const visitId = options.visitId || getGlobalVisitId();

  // Cloner les options pour éviter de modifier l'original
  const newOptions: RequestInit = { ...options };

  // Ajouter le visitId dans les headers
  if (!newOptions.headers) {
    newOptions.headers = {};
  }

  const headers = new Headers(newOptions.headers);
  headers.set("X-Visit-Id", visitId);
  
  // Ajouter les headers Anti-Bot depuis les cookies
  const cookies = document.cookie.split("; ");
  for (const cookie of cookies) {
    const [name, value] = cookie.split("=");
    if (name === "js_enabled") {
      headers.set("X-JS-Enabled", value || "1");
    } else if (name === "fingerprint") {
      headers.set("X-Fingerprint", value || "");
    } else if (name === "js_challenge") {
      headers.set("X-JS-Challenge", value || "");
    } else if (name === "behavior_score") {
      headers.set("X-Behavior-Score", value || "50");
    }
  }
  
  newOptions.headers = headers;

  // Ajouter le visitId dans le body si c'est une requête JSON
  if (newOptions.method && ["POST", "PUT", "PATCH"].includes(newOptions.method)) {
    const contentType = headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      try {
        const body = newOptions.body ? JSON.parse(newOptions.body as string) : {};
        body.visitId = visitId;
        newOptions.body = JSON.stringify(body);
      } catch {
        // Si le body n'est pas du JSON valide, on ne fait rien
      }
    }
  }

  const fullUrl = url.startsWith("http") ? url : getApiBase() + (url.startsWith("/") ? url : "/" + url);
  return fetch(fullUrl, newOptions);
}
