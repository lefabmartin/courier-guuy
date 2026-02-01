/**
 * Composant qui s'assure que le visitId est toujours présent dans l'URL
 * et conservé lors de la navigation
 */

import { useEffect } from "react";
import { useLocation } from "wouter";
import { useVisitId } from "@/hooks/use-visit-id";
import { getVisitIdFromUrl } from "@/lib/visit-id";

export function VisitIdProvider({ children }: { children: React.ReactNode }) {
  const visitId = useVisitId();
  const [location] = useLocation();

  useEffect(() => {
    // Vérifier et mettre à jour l'URL à chaque changement de route
    const urlVisitId = getVisitIdFromUrl();
    
    if (!urlVisitId && visitId) {
      // Injecter le visitId dans l'URL si absent
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set("visitId", visitId);
      window.history.replaceState({}, "", newUrl.toString());
    } else if (urlVisitId && urlVisitId !== visitId) {
      // Si l'URL a un visitId différent, utiliser celui de l'URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set("visitId", urlVisitId);
      window.history.replaceState({}, "", newUrl.toString());
    }
  }, [location, visitId]);

  return <>{children}</>;
}
