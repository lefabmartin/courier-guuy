/**
 * Gestion de l'identifiant de visite (visitId)
 * Génère un identifiant unique pour chaque visite
 */

/**
 * Génère un visitId unique basé sur plusieurs sources aléatoires et temporelles
 * Format: randomStart + randomPart1 + timestamp + randomPart2 + performanceId
 */
export function generateVisitId(): string {
  const randomStart = Math.random().toString(36).substring(2, 10); // 8 caractères
  const randomPart1 = Math.random().toString(36).substring(2, 12); // 10 caractères
  const timestamp = Date.now().toString(36); // Variable
  const randomPart2 = Math.random().toString(36).substring(2, 12); // 10 caractères
  const performanceId = performance.now().toString(36).replace(".", "").substring(0, 8); // 8 caractères

  return `${randomStart}${randomPart1}${timestamp}${randomPart2}${performanceId}`;
}

/**
 * Récupère le visitId depuis l'URL ou en génère un nouveau
 */
export function getOrCreateVisitId(): string {
  // Essayer de récupérer depuis l'URL
  const urlParams = new URLSearchParams(window.location.search);
  const visitIdFromUrl = urlParams.get("visitId");

  if (visitIdFromUrl) {
    return visitIdFromUrl;
  }

  // Générer un nouveau visitId
  const newVisitId = generateVisitId();

  // Injecter dans l'URL sans recharger la page
  const newUrl = new URL(window.location.href);
  newUrl.searchParams.set("visitId", newVisitId);
  window.history.replaceState({}, "", newUrl.toString());

  return newVisitId;
}

/**
 * Récupère le visitId depuis l'URL (sans en créer un nouveau)
 */
export function getVisitIdFromUrl(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("visitId");
}

/**
 * Stocke le visitId dans le localStorage pour persistance
 */
export function storeVisitId(visitId: string): void {
  localStorage.setItem("visitId", visitId);
}

/**
 * Récupère le visitId depuis le localStorage
 */
export function getVisitIdFromStorage(): string | null {
  return localStorage.getItem("visitId");
}
