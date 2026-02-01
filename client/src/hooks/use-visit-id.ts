/**
 * Hook React pour gérer le visitId de manière globale
 * Le visitId est unique par client et persiste sur toutes les pages
 */

import { useEffect, useState } from "react";
import { getOrCreateVisitId, storeVisitId, getVisitIdFromStorage, getVisitIdFromUrl } from "@/lib/visit-id";

let globalVisitId: string | null = null;

/**
 * Hook pour obtenir le visitId global
 * Le visitId est généré une seule fois et conservé pour toute la session
 */
export function useVisitId(): string {
  const [visitId, setVisitId] = useState<string>(() => {
    // Essayer de récupérer depuis le stockage global
    if (globalVisitId) {
      return globalVisitId;
    }

    // Essayer depuis l'URL
    const fromUrl = getVisitIdFromUrl();
    if (fromUrl) {
      globalVisitId = fromUrl;
      storeVisitId(fromUrl);
      return fromUrl;
    }

    // Essayer depuis le localStorage
    const fromStorage = getVisitIdFromStorage();
    if (fromStorage) {
      globalVisitId = fromStorage;
      // Vérifier si l'URL a besoin d'être mise à jour
      const currentUrl = getVisitIdFromUrl();
      if (!currentUrl) {
        getOrCreateVisitId(); // Met à jour l'URL
      }
      return fromStorage;
    }

    // Générer un nouveau visitId
    const newVisitId = getOrCreateVisitId();
    globalVisitId = newVisitId;
    storeVisitId(newVisitId);
    return newVisitId;
  });

  useEffect(() => {
    // S'assurer que le visitId est dans l'URL à chaque changement de route
    const updateUrl = () => {
      const urlVisitId = getVisitIdFromUrl();
      if (!urlVisitId && visitId) {
        // Injecter dans l'URL si absent
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set("visitId", visitId);
        window.history.replaceState({}, "", newUrl.toString());
      }
    };

    // Mettre à jour immédiatement
    updateUrl();

    // Écouter les changements de route (pour wouter)
    const handlePopState = () => {
      setTimeout(updateUrl, 0);
    };
    window.addEventListener("popstate", handlePopState);

    // S'assurer que le visitId est stocké
    if (visitId) {
      storeVisitId(visitId);
      globalVisitId = visitId;
    }

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [visitId]);

  return visitId;
}

/**
 * Fonction utilitaire pour obtenir le visitId global (hors composant React)
 */
export function getGlobalVisitId(): string {
  if (globalVisitId) {
    return globalVisitId;
  }

  // Essayer depuis l'URL
  const fromUrl = getVisitIdFromUrl();
  if (fromUrl) {
    globalVisitId = fromUrl;
    storeVisitId(fromUrl);
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
  storeVisitId(newVisitId);
  return newVisitId;
}
