import { ChevronDown, MessageCircle, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export function Navbar() {
  return (
    <div className="w-full flex flex-col font-sans">
      {/* Top Bar */}
      <div className="bg-[#4d6b99] text-white text-xs font-bold text-center py-2 tracking-wide uppercase">
        Stay up to date with our latest news and alerts!
      </div>

      {/* Main Nav */}
      <nav className="border-b border-gray-100 py-4">
        <div className="container mx-auto px-4 md:px-8 flex items-center justify-between">
          {/* Logo Mimic */}
          <Link href="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="relative">
              <Truck className="h-8 w-8 text-brand-blue transform -scale-x-100" />
              <div className="absolute -bottom-1 -right-1 bg-brand-orange h-3 w-3 rounded-full border-2 border-white"></div>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-brand-blue font-black text-xl tracking-tighter uppercase">The Courier</span>
              <span className="text-brand-orange font-bold text-lg tracking-widest uppercase -mt-1 ml-auto">Guy</span>
            </div>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden lg:flex items-center gap-8 font-medium text-brand-blue text-[15px]">
            <a href="#" className="flex items-center gap-1 hover:text-brand-orange transition-colors">
              Shipping <ChevronDown className="h-4 w-4" />
            </a>
            <a href="#" className="flex items-center gap-1 hover:text-brand-orange transition-colors">
              Tracking <ChevronDown className="h-4 w-4" />
            </a>
            <a href="#" className="flex items-center gap-1 hover:text-brand-orange transition-colors">
              Support <ChevronDown className="h-4 w-4" />
            </a>
            <a href="#" className="flex items-center gap-1 hover:text-brand-orange transition-colors">
              Login <ChevronDown className="h-4 w-4" />
            </a>
          </div>
        </div>
      </nav>
    </div>
  );
}
