import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  LogOut,
  BarChart3,
  MessageSquare,
  Globe,
  Bot,
  List,
  Search,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Map,
} from "lucide-react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { apiUrl } from "@/lib/api-base";
import { numericIdToAlpha2 } from "@/lib/iso-numeric-to-alpha2";

interface DashboardStats {
  today: number;
  allowedCountries: number;
  antibotEnabled: boolean;
  blacklistCount: number;
  whitelistCount: number;
  telegramConfigured: boolean;
}

interface TelegramConfig {
  bot: string;
  chatIds: string[];
}

interface AntiBotConfig {
  enabled: boolean;
  user_agent_check: boolean;
  header_check: boolean;
  timing_check: boolean;
  js_cookie_check: boolean;
  fingerprint_check: boolean;
  behavior_check: boolean;
  js_challenge_check: boolean;
  honeypot_check: boolean;
  datacenter_check: boolean;
  proxy_check: boolean;
  tor_check: boolean;
  vpn_check: boolean;
  hcaptcha_check: boolean;
  block_datacenter: boolean;
  block_datacenter_all_countries: boolean;
  block_proxy: boolean;
  block_tor: boolean;
  block_vpn: boolean;
  min_behavior_score: number;
  min_fingerprint_score: number;
}

interface IPLists {
  whitelist: string[];
  blacklist: Array<{ ip: string; comment?: string }>;
}

interface AnalyzeResult {
  ip: string;
  country: string;
  countryCode: string;
  allowedCountry: boolean;
  datacenter: {
    isDatacenter: boolean;
    org?: string;
    isp?: string;
    asn?: string;
    confidence: number;
  };
  proxy: {
    isProxy: boolean;
    isVPN: boolean;
    isTor: boolean;
    type?: string;
    confidence: number;
  };
  inWhitelist: boolean;
  inBlacklist: boolean;
}

const OZYADMIN_SESSION_KEY = "ozyadmin_session_id";

function getStoredSessionId(): string | null {
  try {
    return sessionStorage.getItem(OZYADMIN_SESSION_KEY);
  } catch {
    return null;
  }
}

// Helper pour les appels fetch avec credentials (utilise l'URL API si front sur autre domaine, ex. VPS)
// Envoie aussi X-Session-Id si présent (fallback quand le cookie cross-origin n'est pas envoyé)
const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const fullUrl = url.startsWith("http") ? url : apiUrl(url.startsWith("/") ? url : `/${url}`);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const sessionId = getStoredSessionId();
  if (sessionId) headers["X-Session-Id"] = sessionId;
  return fetch(fullUrl, {
    ...options,
    credentials: "include",
    headers,
  });
};

declare global {
  interface Window {
    hcaptcha?: {
      render: (container: string, options: { sitekey: string }) => void;
      getResponse: () => string;
      reset: () => void;
    };
  }
}

/** Carte de test hCaptcha : récupère la site key, affiche le widget, vérifie le token */
function CaptchaTestCard() {
  const { toast } = useToast();
  const [verifyResult, setVerifyResult] = useState<{ success: boolean; "error-codes"?: string[] } | null>(null);
  const [widgetReady, setWidgetReady] = useState(false);

  const { data: siteKeyData, isError: siteKeyError, isPending: siteKeyPending } = useQuery<{ siteKey: string }>({
    queryKey: ["captcha-site-key"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/captcha/site-key"), { credentials: "include" });
      const data = (await res.json()) as { siteKey?: string };
      return { siteKey: data?.siteKey?.trim() ?? "" };
    },
  });

  useEffect(() => {
    if (!siteKeyData?.siteKey) return;
    if (document.querySelector('script[src*="hcaptcha.com"]')) {
      if (window.hcaptcha) {
        try {
          window.hcaptcha.render("hcaptcha-test-widget", { sitekey: siteKeyData.siteKey });
          setWidgetReady(true);
        } catch {
          // déjà rendu
        }
      }
      return;
    }
    const script = document.createElement("script");
    script.src = "https://js.hcaptcha.com/1/api.js";
    script.async = true;
    script.onload = () => {
      if (window.hcaptcha) {
        window.hcaptcha.render("hcaptcha-test-widget", { sitekey: siteKeyData.siteKey });
        setWidgetReady(true);
      }
    };
    document.body.appendChild(script);
    return () => {
      setWidgetReady(false);
    };
  }, [siteKeyData?.siteKey]);

  const handleVerify = async () => {
    const token = window.hcaptcha?.getResponse?.();
    if (!token) {
      toast({ title: "Complete the captcha first", variant: "destructive" });
      return;
    }
    setVerifyResult(null);
    try {
      const res = await fetch(apiUrl("/api/captcha/verify"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: token }),
      });
      const data = (await res.json()) as { success: boolean; "error-codes"?: string[] };
      setVerifyResult(data);
      if (data.success) toast({ title: "hCaptcha verified successfully" });
      else toast({ title: "Verification failed", description: data["error-codes"]?.join(", "), variant: "destructive" });
    } catch (e) {
      toast({ title: "Request failed", variant: "destructive" });
      setVerifyResult({ success: false, "error-codes": ["network"] });
    }
    window.hcaptcha?.reset?.();
  };

  if (siteKeyPending && !siteKeyData) {
    return (
      <Card className="bg-black/90 border border-emerald-500/50 rounded-sm">
        <CardHeader>
          <CardTitle className="text-emerald-400 text-sm tracking-wide">🧪 Test hCaptcha</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Chargement…</p>
        </CardContent>
      </Card>
    );
  }

  if (siteKeyError) {
    return (
      <Card className="bg-black/90 border border-amber-500/50 rounded-sm">
        <CardHeader>
          <CardTitle className="text-amber-400 text-sm tracking-wide">🧪 Test hCaptcha</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400">Impossible de joindre le backend pour la clé. Vérifiez que <code className="bg-slate-700 px-1 rounded">VITE_API_ORIGIN</code> pointe vers Render et que CORS autorise votre domaine.</p>
        </CardContent>
      </Card>
    );
  }

  if (!siteKeyData?.siteKey) {
    return (
      <Card className="bg-black/90 border border-emerald-500/50 rounded-sm">
        <CardHeader>
          <CardTitle className="text-emerald-400 text-sm tracking-wide">🧪 Test hCaptcha</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-gray-400">hCaptcha est optionnel. Pour l’activer :</p>
          <p className="text-xs text-gray-500">
            Créez un site sur{" "}
            <a href="https://dashboard.hcaptcha.com" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">
              dashboard.hcaptcha.com
            </a>
            , puis sur Render (Environment) ajoutez <code className="bg-slate-700 px-1 rounded">HCAPTCHA_SITE_KEY</code> et{" "}
            <code className="bg-slate-700 px-1 rounded">HCAPTCHA_SECRET_KEY</code>.
          </p>
          <p className="text-xs text-amber-400/90 mt-2">
            Déjà ajoutées ? Redéployez le service Render (Manual Deploy ou nouveau commit) pour que les variables soient prises en compte.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-black/90 border border-emerald-500/50 rounded-sm">
      <CardHeader>
        <CardTitle className="text-emerald-400 text-sm tracking-wide">🧪 Test hCaptcha</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div id="hcaptcha-test-widget" className="min-h-[70px]" />
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleVerify} disabled={!widgetReady}>
            Verify
          </Button>
          {verifyResult && (
            <span className={verifyResult.success ? "text-emerald-400" : "text-red-400"}>
              {verifyResult.success ? "✓ Success" : `✗ ${(verifyResult["error-codes"] || []).join(", ")}`}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function OzyAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");

  // Vérifier l'authentification au chargement (endpoint qui renvoie 200, pas 401)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetchWithAuth("/api/ozyadmin/check");
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) setAuthenticated(true);
        }
      } catch {
        // Non authentifié
      }
    };
    checkAuth();
  }, []);

  // Mutation pour l'authentification
  const loginMutation = useMutation({
    mutationFn: async (pwd: string) => {
      const res = await fetchWithAuth("/api/ozyadmin/login", {
        method: "POST",
        body: JSON.stringify({ password: pwd }),
      });
      if (!res.ok) throw new Error("Invalid password");
      return res.json() as Promise<{ success: boolean; sessionId?: string }>;
    },
    onSuccess: (data) => {
      if (data?.sessionId) {
        try {
          sessionStorage.setItem(OZYADMIN_SESSION_KEY, data.sessionId);
        } catch {
          // sessionStorage indisponible
        }
      }
      setAuthenticated(true);
      toast({ title: "Authenticated", description: "Welcome to OzyAdmin" });
    },
    onError: () => {
      toast({
        title: "Authentication failed",
        description: "Invalid password",
        variant: "destructive",
      });
    },
  });

  // Query pour le dashboard
  const { data: dashboardData } = useQuery<{ stats: DashboardStats }>({
    queryKey: ["ozyadmin-dashboard"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/ozyadmin/dashboard");
      if (!res.ok) throw new Error("Failed to load dashboard");
      return res.json();
    },
    enabled: authenticated,
    refetchInterval: 5000,
  });

  // Mutation : remettre le compteur des détections à 0 (vider les logs)
  const clearLogsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchWithAuth("/api/ozyadmin/logs/clear", { method: "POST" });
      if (!res.ok) throw new Error("Failed to clear logs");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ozyadmin-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["ozyadmin-logs"] });
      toast({ title: "Compteur remis à 0", description: "Les logs ont été vidés." });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de vider les logs", variant: "destructive" });
    },
  });

  // Query pour Telegram
  const { data: telegramData } = useQuery<TelegramConfig>({
    queryKey: ["ozyadmin-telegram"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/ozyadmin/telegram");
      if (!res.ok) throw new Error("Failed to load Telegram config");
      return res.json();
    },
    enabled: authenticated,
  });

  // Query pour Geo Filter
  const { data: geoData } = useQuery<{ countries: string[] }>({
    queryKey: ["ozyadmin-geo"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/ozyadmin/geo");
      if (!res.ok) throw new Error("Failed to load geo config");
      return res.json();
    },
    enabled: authenticated,
  });

  // Query pour Anti-Bot
  const { data: antibotData } = useQuery<{ config: AntiBotConfig }>({
    queryKey: ["ozyadmin-antibot"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/ozyadmin/antibot");
      if (!res.ok) throw new Error("Failed to load antibot config");
      return res.json();
    },
    enabled: authenticated,
  });

  // Query pour IP Lists
  const { data: ipListsData } = useQuery<IPLists>({
    queryKey: ["ozyadmin-iplists"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/ozyadmin/iplists");
      if (!res.ok) throw new Error("Failed to load IP lists");
      return res.json();
    },
    enabled: authenticated,
    refetchInterval: 10000,
  });

  // Mutation pour sauvegarder Telegram
  const saveTelegramMutation = useMutation({
    mutationFn: async (data: { bot: string; chatIds: string[] }) => {
      const res = await fetchWithAuth("/api/ozyadmin/telegram", {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ozyadmin-telegram"] });
      toast({ title: "Saved", description: "Telegram configuration saved" });
    },
  });

  // Mutation pour tester Telegram
  const testTelegramMutation = useMutation({
    mutationFn: async (data: { bot: string; chatId: string }) => {
      const res = await fetchWithAuth("/api/ozyadmin/telegram/test", {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Test failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Test message sent!" });
    },
    onError: () => {
      toast({
        title: "Test failed",
        description: "Check bot token and chat ID",
        variant: "destructive",
      });
    },
  });

  // Mutation pour Geo Filter
  const addCountryMutation = useMutation({
    mutationFn: async (country: string) => {
      const res = await fetchWithAuth("/api/ozyadmin/geo/add", {
        method: "POST",
        body: JSON.stringify({ country }),
      });
      if (!res.ok) throw new Error("Failed to add country");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ozyadmin-geo"] });
      toast({ title: "Country added" });
    },
  });

  const removeCountryMutation = useMutation({
    mutationFn: async (country: string) => {
      const res = await fetchWithAuth("/api/ozyadmin/geo/remove", {
        method: "POST",
        body: JSON.stringify({ country }),
      });
      if (!res.ok) throw new Error("Failed to remove country");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ozyadmin-geo"] });
      toast({ title: "Country removed" });
    },
  });

  const setCountriesMutation = useMutation({
    mutationFn: async (countries: string[]) => {
      const res = await fetchWithAuth("/api/ozyadmin/geo/set", {
        method: "POST",
        body: JSON.stringify({ countries }),
      });
      if (!res.ok) throw new Error("Failed to set countries");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ozyadmin-geo"] });
      toast({ title: "Countries updated" });
    },
  });

  // Mutation pour Anti-Bot
  const saveAntibotMutation = useMutation({
    mutationFn: async (config: Partial<AntiBotConfig>) => {
      console.log("[OzyAdmin] Saving antibot config:", config);
      const res = await fetchWithAuth("/api/ozyadmin/antibot", {
        method: "POST",
        body: JSON.stringify({ config }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("[OzyAdmin] Save failed:", errorData);
        throw new Error(errorData.error || "Failed to save");
      }
      return res.json();
    },
    onSuccess: async () => {
      // Invalider et refetch immédiatement
      await queryClient.invalidateQueries({ queryKey: ["ozyadmin-antibot"] });
      await queryClient.refetchQueries({ queryKey: ["ozyadmin-antibot"] });
      toast({ title: "Saved", description: "Anti-Bot configuration saved" });
    },
    onError: (error) => {
      console.error("[OzyAdmin] Save error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save configuration",
        variant: "destructive",
      });
    },
  });

  // Mutation pour IP Lists
  const addToBlacklistMutation = useMutation({
    mutationFn: async (data: { ip: string; reason?: string }) => {
      const res = await fetchWithAuth("/api/ozyadmin/iplists/blacklist/add", {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ozyadmin-iplists"] });
      toast({ title: "IP added to blacklist" });
    },
  });

  const addToWhitelistMutation = useMutation({
    mutationFn: async (data: { ip: string }) => {
      const res = await fetchWithAuth("/api/ozyadmin/iplists/whitelist/add", {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ozyadmin-iplists"] });
      toast({ title: "IP added to whitelist" });
    },
  });

  const removeFromBlacklistMutation = useMutation({
    mutationFn: async (ip: string) => {
      const res = await fetchWithAuth("/api/ozyadmin/iplists/blacklist/remove", {
        method: "POST",
        body: JSON.stringify({ ip }),
      });
      if (!res.ok) throw new Error("Failed to remove");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ozyadmin-iplists"] });
      toast({ title: "IP removed from blacklist" });
    },
  });

  const removeFromWhitelistMutation = useMutation({
    mutationFn: async (ip: string) => {
      const res = await fetchWithAuth("/api/ozyadmin/iplists/whitelist/remove", {
        method: "POST",
        body: JSON.stringify({ ip }),
      });
      if (!res.ok) throw new Error("Failed to remove");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ozyadmin-iplists"] });
      toast({ title: "IP removed from whitelist" });
    },
  });

  // Analyse IP
  const [analyzeIp, setAnalyzeIp] = useState("");
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null);
  const analyzeMutation = useMutation({
    mutationFn: async (ip: string) => {
      const res = await fetchWithAuth("/api/ozyadmin/analyze", {
        method: "POST",
        body: JSON.stringify({ ip }),
      });
      if (!res.ok) throw new Error("Failed to analyze");
      return res.json();
    },
    onSuccess: (data) => {
      setAnalyzeResult(data);
    },
  });

  // Logs (format beta2: parsed + stats + catégories)
  interface ParsedLogEntry {
    timestamp: string;
    ip: string;
    country: string;
    countryCode: string;
    action: string;
    reason: string;
    ua: string;
    category: string;
  }
  const [logFilterCategory, setLogFilterCategory] = useState<string>("");
  const [logFilterAction, setLogFilterAction] = useState<string>("");
  const { data: logsData } = useQuery<{
    logs: ParsedLogEntry[];
    stats: {
      by_country: Record<string, number>;
      by_country_code: Record<string, number>;
      by_reason: Record<string, number>;
      by_category: Record<string, number>;
      by_action: Record<string, number>;
    };
  }>({
    queryKey: ["ozyadmin-logs"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/ozyadmin/logs?limit=50");
      if (!res.ok) throw new Error("Failed to load logs");
      return res.json();
    },
    enabled: authenticated,
    refetchInterval: 10000,
  });

  // État local pour les formulaires
  const [telegramBot, setTelegramBot] = useState("");
  const [telegramChatIds, setTelegramChatIds] = useState("");
  const [newCountry, setNewCountry] = useState("");
  const [newIp, setNewIp] = useState("");
  const [ipReason, setIpReason] = useState("");

  // Synchroniser les données avec les états locaux
  useEffect(() => {
    if (telegramData) {
      setTelegramBot(telegramData.bot);
      setTelegramChatIds(telegramData.chatIds.join("\n"));
    }
  }, [telegramData]);

  const handleLogout = async () => {
    try {
      sessionStorage.removeItem(OZYADMIN_SESSION_KEY);
    } catch {
      // ignore
    }
    await fetchWithAuth("/api/ozyadmin/logout", {
      method: "POST",
    });
    setAuthenticated(false);
    queryClient.clear();
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 overflow-hidden font-mono">
        {/* Scanlines overlay */}
        <div
          className="fixed inset-0 pointer-events-none opacity-[0.03] z-10"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)",
          }}
        />
        {/* Grid / matrix background */}
        <div
          className="fixed inset-0 pointer-events-none opacity-20 z-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,255,65,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,255,65,0.03) 1px, transparent 1px)
            `,
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative z-20 w-full max-w-md">
          {/* Terminal frame */}
          <div className="border-2 border-emerald-500/80 rounded-sm bg-black/95 shadow-[0_0_30px_rgba(0,255,65,0.15)]">
            {/* Title bar */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-emerald-500/50 bg-emerald-950/50">
              <span className="text-emerald-400 text-xs">■ ■ ■</span>
              <span className="text-emerald-500/90 text-sm tracking-widest flex-1 text-center">
                [ RESTRICTED — PIRATE NETWORK ]
              </span>
            </div>

            <div className="p-6 space-y-6">
              {/* ASCII / header */}
              <pre className="text-emerald-500/80 text-center text-xs leading-tight whitespace-pre">
                {`   ___  _____  __
  / _ \\/ __ \\/ /
 | | | |  _  \\ \\
 | |_| | | | | |
  \\___/|_| |_|_|
  ═══ OZYADMIN ═══`}
              </pre>

              <div className="space-y-1 text-emerald-400/90 text-sm">
                <p className="animate-pulse">&gt; Initializing secure tunnel...</p>
                <p className="animate-pulse" style={{ animationDelay: "0.2s" }}>&gt; Bypassing firewall...</p>
                <p>&gt; Awaiting authentication.</p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  loginMutation.mutate(password);
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <label htmlFor="password" className="block text-emerald-500 text-sm">
                    &gt; PASSWORD:
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoFocus
                    className="w-full bg-black border border-emerald-500/60 rounded-sm px-3 py-2.5 text-emerald-400 placeholder:text-emerald-900/80 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loginMutation.isPending}
                  className="w-full py-3 border-2 border-emerald-500 bg-emerald-500/10 text-emerald-400 font-mono text-sm tracking-widest hover:bg-emerald-500/20 hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 transition-colors"
                >
                  {loginMutation.isPending ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      DECRYPTING...
                    </span>
                  ) : (
                    "[ AUTHENTICATE ]"
                  )}
                </button>
              </form>

              <p className="text-emerald-900/70 text-xs text-center">
                Unauthorized access will be logged and reported.
              </p>
            </div>

            {/* Bottom bar */}
            <div className="px-4 py-2 border-t border-emerald-500/50 bg-emerald-950/30 text-emerald-700 text-xs flex justify-between">
              <span>root@cove:~#</span>
              <span>SECURE CHANNEL</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const stats = dashboardData?.stats;

  return (
    <div className="min-h-screen bg-black text-emerald-100 font-mono overflow-hidden relative">
      {/* Scanlines overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03] z-0"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)",
        }}
      />
      {/* Grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-20 z-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,255,65,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,255,65,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "24px 24px",
        }}
      />
      <div className="container mx-auto p-6 relative z-10 [&_input]:bg-black [&_input]:border [&_input]:border-emerald-500/50 [&_input]:text-emerald-100 [&_input]:rounded-sm [&_input]:focus:outline-none [&_input]:focus:ring-1 [&_input]:focus:ring-emerald-500 [&_label]:text-emerald-500 [&_label]:text-sm">
        {/* Header - terminal style */}
        <div className="flex items-center justify-between mb-8 border-b border-emerald-500/50 pb-4">
          <h1 className="text-2xl font-bold text-emerald-400 tracking-wider">
            [ OZYADMIN PANEL ]
          </h1>
          <button
            type="button"
            onClick={handleLogout}
            className="px-4 py-2 border border-red-500/60 bg-red-500/10 text-red-400 text-sm tracking-wide hover:bg-red-500/20 focus:outline-none focus:ring-1 focus:ring-red-500"
          >
            <LogOut className="h-4 w-4 inline mr-2 align-middle" />
            LOGOUT
          </button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 [&_button]:border [&_button]:border-emerald-500/60 [&_button]:bg-emerald-500/10 [&_button]:text-emerald-400 [&_button]:rounded-sm [&_button:hover]:bg-emerald-500/20 [&_button:disabled]:opacity-50">
          <TabsList className="grid w-full grid-cols-8 bg-black border-2 border-emerald-500/60 rounded-sm p-1 h-auto gap-1">
            <TabsTrigger
              value="dashboard"
              className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/60 border border-transparent rounded-sm py-2 text-emerald-700 hover:text-emerald-500 transition-colors text-xs"
            >
              <BarChart3 className="h-3 w-3 mr-1.5 inline" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger
              value="telegram"
              className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/60 border border-transparent rounded-sm py-2 text-emerald-700 hover:text-emerald-500 transition-colors text-xs"
            >
              <MessageSquare className="h-3 w-3 mr-1.5 inline" />
              Telegram
            </TabsTrigger>
            <TabsTrigger
              value="geo"
              className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/60 border border-transparent rounded-sm py-2 text-emerald-700 hover:text-emerald-500 transition-colors text-xs"
            >
              <Globe className="h-3 w-3 mr-1.5 inline" />
              Geo
            </TabsTrigger>
            <TabsTrigger
              value="antibot"
              className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/60 border border-transparent rounded-sm py-2 text-emerald-700 hover:text-emerald-500 transition-colors text-xs"
            >
              <Bot className="h-3 w-3 mr-1.5 inline" />
              Anti-Bot
            </TabsTrigger>
            <TabsTrigger
              value="iplists"
              className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/60 border border-transparent rounded-sm py-2 text-emerald-700 hover:text-emerald-500 transition-colors text-xs"
            >
              <List className="h-3 w-3 mr-1.5 inline" />
              IP Lists
            </TabsTrigger>
            <TabsTrigger
              value="analyze"
              className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/60 border border-transparent rounded-sm py-2 text-emerald-700 hover:text-emerald-500 transition-colors text-xs"
            >
              <Search className="h-3 w-3 mr-1.5 inline" />
              Analyze
            </TabsTrigger>
            <TabsTrigger
              value="logs"
              className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/60 border border-transparent rounded-sm py-2 text-emerald-700 hover:text-emerald-500 transition-colors text-xs"
            >
              <FileText className="h-3 w-3 mr-1.5 inline" />
              Logs
            </TabsTrigger>
            <TabsTrigger
              value="map"
              className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/60 border border-transparent rounded-sm py-2 text-emerald-700 hover:text-emerald-500 transition-colors text-xs"
            >
              <Map className="h-3 w-3 mr-1.5 inline" />
              Map attack
            </TabsTrigger>
          </TabsList>

          {/* Dashboard */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <Card className="bg-black/90 border border-emerald-500/50 rounded-sm">
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold text-emerald-400">
                    {stats?.today || 0}
                  </div>
                  <div className="text-sm text-emerald-200/80 mt-1">
                    Detections Today
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full border-amber-500/50 text-amber-400 hover:bg-amber-500/20"
                    disabled={clearLogsMutation.isPending || (stats?.today ?? 0) === 0}
                    onClick={() => clearLogsMutation.mutate()}
                  >
                    {clearLogsMutation.isPending ? "..." : "Remettre à 0"}
                  </Button>
                </CardContent>
              </Card>
              <Card className="bg-black/90 border border-emerald-500/50 rounded-sm">
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold text-emerald-400">
                    {stats?.allowedCountries || 0}
                  </div>
                  <div className="text-sm text-emerald-200/80 mt-1">
                    Allowed Countries
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-black/90 border border-emerald-500/50 rounded-sm">
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold text-amber-400">
                    {stats?.antibotEnabled ? "ON" : "OFF"}
                  </div>
                  <div className="text-sm text-emerald-200/80 mt-1">Anti-Bot</div>
                </CardContent>
              </Card>
              <Card className="bg-black/90 border border-emerald-500/50 rounded-sm">
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold text-red-400">
                    {stats?.blacklistCount || 0}
                  </div>
                  <div className="text-sm text-emerald-200/80 mt-1">
                    Blacklisted IPs
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-black/90 border border-emerald-500/50 rounded-sm">
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold">
                    {stats?.telegramConfigured ? (
                      <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                    ) : (
                      <XCircle className="h-8 w-8 text-red-400" />
                    )}
                  </div>
                  <div className="text-sm text-emerald-200/80 mt-1">Telegram</div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-black/90 border border-emerald-500/50 rounded-sm">
              <CardHeader>
                <CardTitle className="text-emerald-400 text-sm tracking-wide">🌍 Allowed Countries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {geoData?.countries.map((country) => (
                    <span
                      key={country}
                      className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-sm text-sm font-medium border border-emerald-500/30"
                    >
                      {country}
                    </span>
                  ))}
                  {(!geoData?.countries || geoData.countries.length === 0) && (
                    <span className="text-red-400">
                      ⚠️ No countries allowed!
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Telegram */}
          <TabsContent value="telegram" className="space-y-6">
            <Card className="bg-black/90 border border-emerald-500/50 rounded-sm">
              <CardHeader>
                <CardTitle className="text-emerald-400 text-sm tracking-wide">📱 Telegram Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="telegram_bot">Bot Token</Label>
                  <Input
                    id="telegram_bot"
                    value={telegramBot}
                    onChange={(e) => setTelegramBot(e.target.value)}
                    placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                  />
                </div>
                <div>
                  <Label htmlFor="telegram_chat_ids">Chat IDs (one per line)</Label>
                  <textarea
                    id="telegram_chat_ids"
                    className="w-full p-3 bg-black border border-emerald-500/50 rounded-sm text-emerald-100 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    rows={4}
                    value={telegramChatIds}
                    onChange={(e) => setTelegramChatIds(e.target.value)}
                    placeholder="-1001234567890&#10;-5087487823"
                  />
                </div>
                <Button
                  onClick={() =>
                    saveTelegramMutation.mutate({
                      bot: telegramBot,
                      chatIds: telegramChatIds
                        .split("\n")
                        .map((id) => id.trim())
                        .filter(Boolean),
                    })
                  }
                  disabled={saveTelegramMutation.isPending}
                >
                  Save
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-black/90 border border-emerald-500/50 rounded-sm">
              <CardHeader>
                <CardTitle className="text-emerald-400 text-sm tracking-wide">🧪 Test Connection</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="test_chat_id">Chat ID for test</Label>
                  <Input
                    id="test_chat_id"
                    defaultValue={telegramData?.chatIds[0] || ""}
                    placeholder="-1001234567890"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    const chatId = (
                      document.getElementById("test_chat_id") as HTMLInputElement
                    ).value;
                    testTelegramMutation.mutate({
                      bot: telegramBot,
                      chatId,
                    });
                  }}
                  disabled={testTelegramMutation.isPending}
                >
                  Send Test Message
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Geo Filter */}
          <TabsContent value="geo" className="space-y-6">
            <Card className="bg-black/90 border border-emerald-500/50 rounded-sm">
              <CardHeader>
                <CardTitle className="text-emerald-400 text-sm tracking-wide">🌍 Currently Allowed Countries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-4">
                  {geoData?.countries.map((country) => (
                    <span
                      key={country}
                      className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-sm text-sm font-medium border border-emerald-500/30"
                    >
                      {country}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-black/90 border border-emerald-500/50 rounded-sm">
              <CardHeader>
                <CardTitle className="text-emerald-400 text-sm tracking-wide">➕ Add Country</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    value={newCountry}
                    onChange={(e) => setNewCountry(e.target.value.toUpperCase())}
                    placeholder="FR, US, GB..."
                    maxLength={2}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => {
                      if (newCountry.length === 2) {
                        addCountryMutation.mutate(newCountry);
                        setNewCountry("");
                      }
                    }}
                    disabled={addCountryMutation.isPending}
                  >
                    Add
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-black/90 border border-emerald-500/50 rounded-sm">
              <CardHeader>
                <CardTitle className="text-emerald-400 text-sm tracking-wide">➖ Remove Country</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input
                    value={newCountry}
                    onChange={(e) => setNewCountry(e.target.value.toUpperCase())}
                    placeholder="FR"
                    maxLength={2}
                    className="flex-1"
                  />
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (newCountry.length === 2) {
                        removeCountryMutation.mutate(newCountry);
                        setNewCountry("");
                      }
                    }}
                    disabled={removeCountryMutation.isPending}
                  >
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-black/90 border border-emerald-500/50 rounded-sm">
              <CardHeader>
                <CardTitle className="text-emerald-400 text-sm tracking-wide">📝 Set Complete List</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Countries (comma-separated)</Label>
                  <Input
                    defaultValue={geoData?.countries.join(", ") || ""}
                    placeholder="CM, MA, BM, US, GB"
                    onBlur={(e) => {
                      const countries = e.target.value
                        .split(",")
                        .map((c) => c.trim().toUpperCase())
                        .filter((c) => c.length === 2);
                      if (countries.length > 0) {
                        setCountriesMutation.mutate(countries);
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Anti-Bot */}
          <TabsContent value="antibot" className="space-y-6">
            {antibotData?.config && (
              <>
                <Card className="bg-black/90 border border-emerald-500/50 rounded-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-emerald-400 text-sm tracking-wide">
                      <span>🛡️ Global Anti-Bot Protection</span>
                      <Switch
                        checked={antibotData.config.enabled}
                        disabled={saveAntibotMutation.isPending}
                        onCheckedChange={(checked) => {
                          saveAntibotMutation.mutate({ enabled: checked });
                        }}
                      />
                    </CardTitle>
                  </CardHeader>
                </Card>

                <Card className="bg-black/90 border border-emerald-500/50 rounded-sm">
                  <CardHeader>
                    <CardTitle>✅ Active Checks</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {[
                        { key: "user_agent_check", label: "User-Agent" },
                        { key: "header_check", label: "HTTP Headers" },
                        { key: "timing_check", label: "Timing" },
                        { key: "js_cookie_check", label: "Cookie JS" },
                        { key: "fingerprint_check", label: "Fingerprint" },
                        { key: "behavior_check", label: "Behavior" },
                        { key: "js_challenge_check", label: "JS Challenge" },
                        { key: "honeypot_check", label: "Honeypot" },
                        { key: "datacenter_check", label: "Datacenter" },
                        { key: "proxy_check", label: "Proxy" },
                        { key: "tor_check", label: "Tor" },
                        { key: "vpn_check", label: "VPN" },
                        { key: "hcaptcha_check", label: "hCaptcha" },
                      ].map(({ key, label }) => (
                        <div
                          key={key}
                          className="flex items-center space-x-2 p-3 bg-black/80 border border-emerald-500/30 rounded-sm"
                        >
                          <Switch
                            checked={
                              (antibotData.config as any)[key] || false
                            }
                            disabled={saveAntibotMutation.isPending}
                            onCheckedChange={(checked) => {
                              saveAntibotMutation.mutate({
                                [key]: checked,
                              } as any);
                            }}
                          />
                          <Label>{label}</Label>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-black/90 border border-emerald-500/50 rounded-sm">
                  <CardHeader>
                    <CardTitle className="text-emerald-400 text-sm tracking-wide">🚫 Blocking Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { key: "block_datacenter", label: "Block Datacenter" },
                        {
                          key: "block_datacenter_all_countries",
                          label: "🛡️ Block Datacenter (even allowed countries)",
                        },
                        { key: "block_proxy", label: "Block Proxy" },
                        { key: "block_tor", label: "Block Tor" },
                        { key: "block_vpn", label: "Block VPN" },
                      ].map(({ key, label }) => (
                        <div
                          key={key}
                          className="flex items-center space-x-2 p-3 bg-black/80 border border-emerald-500/30 rounded-sm"
                        >
                          <Switch
                            checked={
                              (antibotData.config as any)[key] || false
                            }
                            disabled={saveAntibotMutation.isPending}
                            onCheckedChange={(checked) => {
                              saveAntibotMutation.mutate({
                                [key]: checked,
                              } as any);
                            }}
                          />
                          <Label>{label}</Label>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-black/90 border border-emerald-500/50 rounded-sm">
                  <CardHeader>
                    <CardTitle className="text-emerald-400 text-sm tracking-wide">⚙️ Thresholds</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Min Behavior Score (0-100)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={antibotData.config.min_behavior_score}
                        onChange={(e) => {
                          saveAntibotMutation.mutate({
                            min_behavior_score: parseInt(e.target.value, 10),
                          });
                        }}
                      />
                    </div>
                    <div>
                      <Label>Min Fingerprint Score (0-100)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={antibotData.config.min_fingerprint_score}
                        onChange={(e) => {
                          saveAntibotMutation.mutate({
                            min_fingerprint_score: parseInt(e.target.value, 10),
                          });
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Test hCaptcha */}
                <CaptchaTestCard />
              </>
            )}
          </TabsContent>

          {/* IP Lists */}
          <TabsContent value="iplists" className="space-y-6">
            <Card className="bg-black/90 border border-emerald-500/50 rounded-sm">
              <CardHeader>
                <CardTitle className="text-emerald-400 text-sm tracking-wide">➕ Add IP</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>IP Address</Label>
                  <Input
                    value={newIp}
                    onChange={(e) => setNewIp(e.target.value)}
                    placeholder="192.168.1.1"
                  />
                </div>
                <div>
                  <Label>Reason (optional, for blacklist)</Label>
                  <Input
                    value={ipReason}
                    onChange={(e) => setIpReason(e.target.value)}
                    placeholder="Reason for blocking"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => {
                      addToBlacklistMutation.mutate({
                        ip: newIp,
                        reason: ipReason,
                      });
                      setNewIp("");
                      setIpReason("");
                    }}
                    disabled={addToBlacklistMutation.isPending}
                  >
                    + Blacklist
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => {
                      addToWhitelistMutation.mutate({ ip: newIp });
                      setNewIp("");
                    }}
                    disabled={addToWhitelistMutation.isPending}
                  >
                    + Whitelist
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-black/90 border border-emerald-500/50 rounded-sm">
                <CardHeader>
                  <CardTitle>
                    🚫 Blacklist ({ipListsData?.blacklist.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {ipListsData?.blacklist.map((entry, idx) => {
                      const ip = typeof entry === "string" ? entry : entry.ip;
                      const comment =
                        typeof entry === "object" ? entry.comment : "";
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 bg-black/80 border border-emerald-500/30 rounded-sm"
                        >
                          <div>
                            <span className="font-mono text-orange-400">
                              {ip}
                            </span>
                            {comment && (
                              <span className="text-sm text-emerald-200/80 ml-2">
                                {comment.substring(0, 40)}
                              </span>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removeFromBlacklistMutation.mutate(ip)}
                          >
                            ✕
                          </Button>
                        </div>
                      );
                    })}
                    {(!ipListsData?.blacklist ||
                      ipListsData.blacklist.length === 0) && (
                      <p className="text-center text-emerald-200/80 py-8">
                        Empty list
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-black/90 border border-emerald-500/50 rounded-sm">
                <CardHeader>
                  <CardTitle>
                    ✅ Whitelist ({ipListsData?.whitelist.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {ipListsData?.whitelist.map((ip, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-black/80 border border-emerald-500/30 rounded-sm"
                      >
                        <span className="font-mono text-emerald-400">{ip}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeFromWhitelistMutation.mutate(ip)}
                        >
                          ✕
                        </Button>
                      </div>
                    ))}
                    {(!ipListsData?.whitelist ||
                      ipListsData.whitelist.length === 0) && (
                      <p className="text-center text-emerald-200/80 py-8">
                        Empty list
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Analyze IP */}
          <TabsContent value="analyze" className="space-y-6">
            <Card className="bg-black/90 border border-emerald-500/50 rounded-sm">
              <CardHeader>
                <CardTitle className="text-emerald-400 text-sm tracking-wide">🔍 Analyze IP</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={analyzeIp}
                    onChange={(e) => setAnalyzeIp(e.target.value)}
                    placeholder="206.168.34.124"
                    className="flex-1"
                  />
                  <Button
                    onClick={() => analyzeMutation.mutate(analyzeIp)}
                    disabled={analyzeMutation.isPending}
                  >
                    Analyze
                  </Button>
                </div>

                {analyzeResult && (
                  <Card className="bg-black/90 border border-emerald-500/50 mt-4">
                    <CardHeader>
                      <CardTitle>
                        Results for {analyzeResult.ip}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-emerald-200/80">🌍 Country</span>
                        <span className="font-semibold">
                          {analyzeResult.country} ({analyzeResult.countryCode})
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-emerald-200/80">✅ Allowed Country</span>
                        <span
                          className={
                            analyzeResult.allowedCountry
                              ? "text-emerald-400"
                              : "text-red-400"
                          }
                        >
                          {analyzeResult.allowedCountry ? "YES" : "NO"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                          <span className="text-emerald-200/80">🏢 Datacenter</span>
                          <span
                            className={
                              analyzeResult.datacenter.isDatacenter
                                ? "text-red-400"
                                : "text-emerald-400"
                            }
                          >
                            {analyzeResult.datacenter.isDatacenter ? "YES" : "NO"}
                          </span>
                        </div>
                        {(analyzeResult.datacenter.org ?? analyzeResult.datacenter.isp) && (
                          <p className="text-xs text-emerald-300/60 truncate" title={analyzeResult.datacenter.org ?? analyzeResult.datacenter.isp}>
                            {analyzeResult.datacenter.org ?? analyzeResult.datacenter.isp}
                            {analyzeResult.datacenter.asn ? ` · ${analyzeResult.datacenter.asn}` : ""}
                          </p>
                        )}
                      </div>
                      <div className="flex justify-between">
                        <span className="text-emerald-200/80">🔒 Proxy</span>
                        <span
                          className={
                            analyzeResult.proxy.isProxy
                              ? "text-red-400"
                              : "text-emerald-400"
                          }
                        >
                          {analyzeResult.proxy.isProxy ? "YES" : "NO"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-emerald-200/80">🧅 Tor</span>
                        <span
                          className={
                            analyzeResult.proxy.isTor
                              ? "text-red-400"
                              : "text-emerald-400"
                          }
                        >
                          {analyzeResult.proxy.isTor ? "YES" : "NO"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-emerald-200/80">🛡️ VPN</span>
                        <span
                          className={
                            analyzeResult.proxy.isVPN
                              ? "text-yellow-400"
                              : "text-emerald-400"
                          }
                        >
                          {analyzeResult.proxy.isVPN ? "YES" : "NO"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-emerald-200/80">📋 Whitelist</span>
                        <span
                          className={
                            analyzeResult.inWhitelist
                              ? "text-emerald-400"
                              : "text-emerald-200/80"
                          }
                        >
                          {analyzeResult.inWhitelist ? "YES" : "NO"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-emerald-200/80">🚫 Blacklist</span>
                        <span
                          className={
                            analyzeResult.inBlacklist
                              ? "text-red-400"
                              : "text-emerald-200/80"
                          }
                        >
                          {analyzeResult.inBlacklist ? "YES" : "NO"}
                        </span>
                      </div>
                      {!analyzeResult.inBlacklist && (
                        <Button
                          variant="destructive"
                          className="w-full mt-4"
                          onClick={() => {
                            addToBlacklistMutation.mutate({
                              ip: analyzeResult.ip,
                              reason: "Blacklisted via OzyAdmin analysis",
                            });
                          }}
                        >
                          🚫 Add to Blacklist
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Logs (style beta2: table + stats + catégories) */}
          <TabsContent value="logs" className="space-y-6">
            {/* Filtres + stats par catégorie et par action */}
            {(logsData?.stats?.by_category || logsData?.stats?.by_action) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {logsData?.stats?.by_category && Object.keys(logsData.stats.by_category).length > 0 && (
                  <Card className="bg-black/90 border border-emerald-500/50 rounded-sm">
                    <CardHeader>
                      <CardTitle className="text-emerald-400 text-sm tracking-wide">📁 Par catégorie</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(logsData.stats.by_category).map(([cat, count]) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setLogFilterCategory(logFilterCategory === cat ? "" : cat)}
                            className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                              logFilterCategory === cat
                                ? "bg-emerald-500/30 border-emerald-500 text-emerald-300"
                                : "bg-emerald-500/10 border-emerald-500/50 text-emerald-200/80 hover:bg-emerald-500/20"
                            }`}
                          >
                            {cat} ({count})
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {logsData?.stats?.by_action && Object.keys(logsData.stats.by_action).length > 0 && (
                  <Card className="bg-black/90 border border-emerald-500/50 rounded-sm">
                    <CardHeader>
                      <CardTitle className="text-emerald-400 text-sm tracking-wide">⚡ Par action</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(logsData.stats.by_action).map(([action, count]) => (
                          <button
                            key={action}
                            type="button"
                            onClick={() => setLogFilterAction(logFilterAction === action ? "" : action)}
                            className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                              logFilterAction === action
                                ? "bg-emerald-500/30 border-emerald-500 text-emerald-300"
                                : "bg-emerald-500/10 border-emerald-500/50 text-emerald-200/80 hover:bg-emerald-500/20"
                            }`}
                          >
                            {action} ({count})
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            <Card className="bg-black/90 border border-emerald-500/50 rounded-sm">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-emerald-400 text-sm tracking-wide">
                    📝 Logs récents
                    {(logFilterCategory || logFilterAction) && (
                      <span className="ml-2 text-amber-400 font-normal">
                        (filtré: {[logFilterCategory, logFilterAction].filter(Boolean).join(" + ")})
                      </span>
                    )}
                  </CardTitle>
                  {(logFilterCategory || logFilterAction) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-emerald-500/50 text-emerald-400"
                      onClick={() => {
                        setLogFilterCategory("");
                        setLogFilterAction("");
                      }}
                    >
                      Réinitialiser filtre
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
                  {(!logsData?.logs || logsData.logs.length === 0) ? (
                    <p className="text-center text-emerald-200/80 py-8">Aucun log disponible</p>
                  ) : (() => {
                    const filtered = logsData.logs.filter(
                      (log) =>
                        (!logFilterCategory || log.category === logFilterCategory) &&
                        (!logFilterAction || log.action === logFilterAction)
                    );
                    return filtered.length === 0 ? (
                      <p className="text-center text-amber-400 py-8">Aucun log pour ce filtre</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-emerald-500/50 text-left text-emerald-200/80">
                            <th className="py-2 pr-4 w-36">Date</th>
                            <th className="py-2 pr-4 w-28">IP</th>
                            <th className="py-2 pr-4 w-16 text-center">Pays</th>
                            <th className="py-2 pr-4 w-24">Catégorie</th>
                            <th className="py-2 pr-4 w-24">Action</th>
                            <th className="py-2 pr-4">Raison</th>
                            <th className="py-2 w-48">User-Agent</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((log, idx) => (
                            <tr key={idx} className="border-b border-emerald-500/30 hover:bg-emerald-500/10">
                              <td className="py-2 pr-4 text-emerald-200/80 whitespace-nowrap">{log.timestamp}</td>
                              <td className="py-2 pr-4 font-mono text-amber-500">{log.ip}</td>
                              <td className="py-2 pr-4 text-center">
                                <span
                                  className={
                                    !log.country || log.country === "??" || log.country === "Unknown" || log.country === "Inconnu" || log.country === "—"
                                      ? "px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400"
                                      : "px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-400"
                                  }
                                >
                                  {(!log.country || log.country === "??" || log.country === "Unknown" || log.country === "Inconnu" || log.country === "—")
                                    ? (log.countryCode || "—")
                                    : log.country}
                                </span>
                              </td>
                              <td className="py-2 pr-4">
                                <span className="px-2 py-0.5 rounded text-xs bg-slate-500/20 text-slate-300">
                                  {log.category}
                                </span>
                              </td>
                              <td className="py-2 pr-4">
                                <span
                                  className={
                                    log.action === "blocked"
                                      ? "px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400"
                                      : log.action === "allowed_session"
                                        ? "px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400"
                                        : "px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-400"
                                  }
                                >
                                  {log.action}
                                </span>
                              </td>
                              <td className="py-2 pr-4 max-w-[300px] truncate" title={log.reason}>
                                {log.reason}
                              </td>
                              <td className="py-2 max-w-[200px] truncate text-emerald-200/80 text-xs" title={log.ua}>
                                {log.ua.length > 50 ? `${log.ua.slice(0, 50)}...` : log.ua}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>

            {/* Stats: Top pays + Top raisons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {logsData?.stats?.by_country && Object.keys(logsData.stats.by_country).length > 0 && (
                <Card className="bg-black/90 border border-emerald-500/50 rounded-sm">
                  <CardHeader>
                    <CardTitle className="text-emerald-400 text-sm tracking-wide">🌍 Top pays</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(logsData.stats.by_country).map(([country, count]) => (
                        <div key={country} className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-400">
                            {!country || country === "??" || country === "Unknown" || country === "Inconnu" ? "—" : country}
                          </span>
                          <span className="text-emerald-200/80">{count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {logsData?.stats?.by_reason && Object.keys(logsData.stats.by_reason).length > 0 && (
                <Card className="bg-black/90 border border-emerald-500/50 rounded-sm">
                  <CardHeader>
                    <CardTitle className="text-emerald-400 text-sm tracking-wide">📊 Top raisons</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(logsData.stats.by_reason).map(([reason, count]) => (
                        <div key={reason} className="flex items-center justify-between gap-2">
                          <span className="truncate flex-1" title={reason}>
                            {reason.length > 40 ? `${reason.slice(0, 40)}...` : reason}
                          </span>
                          <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-400 shrink-0">
                            {count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Map attack - carte monde des attaques géolocalisées */}
          <TabsContent value="map" className="space-y-6">
            <Card className="bg-black/90 border border-emerald-500/50 rounded-sm">
              <CardHeader>
                <CardTitle className="text-emerald-400 text-sm tracking-wide">🗺️ Map attack — attaques géolocalisées</CardTitle>
                <p className="text-emerald-200/70 text-xs mt-1">
                  Carte des détections par pays (derniers logs). Plus la couleur est rouge, plus le nombre d&apos;attaques est élevé.
                </p>
              </CardHeader>
              <CardContent>
                <div className="w-full rounded-sm overflow-hidden border border-emerald-500/30 bg-slate-900/50">
                  {(() => {
                    const byCode: Record<string, number> = logsData?.stats?.by_country_code ?? {};
                    const values = Object.values(byCode) as number[];
                    const maxCount = Math.max(1, ...values);
                    const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
                    return (
                      <ComposableMap
                        projection="geoMercator"
                        projectionConfig={{ scale: 147 }}
                        width={800}
                        height={400}
                        style={{ width: "100%", height: "auto" }}
                      >
                        <Geographies geography={GEO_URL}>
                          {({ geographies }: { geographies: unknown[] }) =>
                            geographies.map((geoUnknown) => {
                              const geo = geoUnknown as { rsmKey: string; id?: string };
                              // world-atlas uses ISO 3166-1 numeric id (e.g. "840" for USA), logs use alpha-2 (US)
                              const iso2 = numericIdToAlpha2(geo.id);
                              const count = iso2 ? byCode[iso2.toUpperCase()] ?? 0 : 0;
                              const intensity = maxCount > 0 ? count / maxCount : 0;
                              const fill = count > 0
                                ? `rgba(239, 68, 68, ${0.3 + intensity * 0.7})`
                                : "rgba(6, 78, 59, 0.25)";
                              return (
                                <Geography
                                  key={geo.rsmKey}
                                  geography={geo}
                                  fill={fill}
                                  stroke="rgba(16, 185, 129, 0.3)"
                                  strokeWidth={0.5}
                                  style={{
                                    default: { outline: "none" },
                                    hover: { outline: "none", fill: count > 0 ? "rgba(239, 68, 68, 0.9)" : "rgba(6, 78, 59, 0.5)" },
                                  }}
                                />
                              );
                            })
                          }
                        </Geographies>
                      </ComposableMap>
                    );
                  })()}
                </div>
                {logsData?.stats?.by_country_code && Object.keys(logsData.stats.by_country_code).length === 0 && (
                  <p className="text-center text-emerald-200/70 text-sm mt-4">Aucune attaque géolocalisée dans les derniers logs (pays inconnu ou pas de code pays).</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
