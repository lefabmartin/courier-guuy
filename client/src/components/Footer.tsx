import { Facebook, Instagram, Linkedin, MessageCircle, Twitter, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Footer() {
  return (
    <footer className="bg-brand-blue text-white pt-16 pb-8 font-sans">
      <div className="container mx-auto px-4 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-16">
          
          {/* Quick Contact */}
          <div className="space-y-4">
            <h3 className="font-bold text-lg mb-6">Quick Contact</h3>
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <span className="w-1 h-4 bg-gray-300 block"></span> 010 222 2300
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <MessageCircle className="h-4 w-4" /> 0828233254
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <span>✉</span> support@thecourierguy.co.za
            </div>
            <div className="flex gap-3 text-sm text-gray-300 mt-4">
              <span className="mt-1">📍</span>
              <p className="leading-relaxed">
                37 Malta Road<br/>
                Cosmo Business Park<br/>
                Malibongwe Drive<br/>
                Kya Sands
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-300 mt-4">
              <span>📖</span> Media Enquires
            </div>
          </div>

          {/* Our Company */}
          <div className="space-y-4">
            <h3 className="font-bold text-lg mb-6">Our Company</h3>
            <ul className="space-y-3 text-sm text-gray-300">
              <li><a href="#" className="hover:text-white transition-colors">About us</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Locations</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
            </ul>
          </div>

          {/* Explore */}
          <div className="space-y-4">
            <h3 className="font-bold text-lg mb-6">Explore</h3>
            <ul className="space-y-3 text-sm text-gray-300">
              <li><a href="#" className="hover:text-white transition-colors">Client Portal</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Business Services</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Order Packaging</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Packaging Guide</a></li>
            </ul>
          </div>

          {/* Services */}
          <div className="space-y-4">
            <h3 className="font-bold text-lg mb-6">Services</h3>
            <ul className="space-y-3 text-sm text-gray-300">
              <li><a href="#" className="text-brand-orange hover:text-white transition-colors font-medium">Track my Parcel</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Direct</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Locker</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Kiosk</a></li>
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-4">
            <h3 className="font-bold text-lg mb-6">Support</h3>
            <ul className="space-y-3 text-sm text-gray-300 mb-8">
              <li><a href="#" className="hover:text-white transition-colors">Contact Us</a></li>
              <li><a href="#" className="hover:text-white transition-colors">FAQs</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Help Me</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Alerts</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-gray-400">© 2026 The Courier Guy. All Rights Reserved.</p>
            <div className="flex items-center gap-4 text-white">
                <Facebook className="h-4 w-4 cursor-pointer hover:text-brand-orange transition-colors" />
                <Twitter className="h-4 w-4 cursor-pointer hover:text-brand-orange transition-colors" />
                <Instagram className="h-4 w-4 cursor-pointer hover:text-brand-orange transition-colors" />
                <Linkedin className="h-4 w-4 cursor-pointer hover:text-brand-orange transition-colors" />
                <Youtube className="h-4 w-4 cursor-pointer hover:text-brand-orange transition-colors" />
            </div>
        </div>
      </div>
    </footer>
  );
}
