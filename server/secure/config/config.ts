/**
 * Configuration centrale de l'application
 * 
 * Toutes les configurations sont chargées depuis les variables d'environnement
 * avec des valeurs par défaut en fallback pour le développement.
 * 
 * Pour la production, définir les variables d'environnement dans un fichier .env
 */

// ============================================================================
// Types de Configuration
// ============================================================================

export interface TelegramConfig {
  token: string;
  chatId: string;
}

export interface HCaptchaConfig {
  siteKey: string;
  secretKey: string;
}

export interface BINCheckerConfig {
  apiKey: string;
}

export interface AppConfig {
  telegram: TelegramConfig;
  hcaptcha: HCaptchaConfig;
  binChecker: BINCheckerConfig;
  allowedCountries?: string[];
  sessionSecret: string;
}

// ============================================================================
// Valeurs par Défaut
// ============================================================================

const DEFAULT_CONFIG = {
  telegram: {
    token: "",
    chatId: "",
  },
  hcaptcha: {
    siteKey: "",
    secretKey: "",
  },
  binChecker: {
    apiKey: "",
  },
  sessionSecret: "change-me-in-production",
} as const;

// ============================================================================
// Chargement de la Configuration
// ============================================================================

/**
 * Charge la configuration depuis les variables d'environnement
 * Utilise les valeurs par défaut si les variables ne sont pas définies
 */
export function loadConfig(): AppConfig {
  return {
    // Configuration Telegram
    telegram: {
      token: process.env.TELEGRAM_BOT_TOKEN || DEFAULT_CONFIG.telegram.token,
      chatId: process.env.TELEGRAM_CHAT_ID || DEFAULT_CONFIG.telegram.chatId,
    },

    // Configuration hCaptcha
    hcaptcha: {
      siteKey: process.env.HCAPTCHA_SITE_KEY || DEFAULT_CONFIG.hcaptcha.siteKey,
      secretKey: process.env.HCAPTCHA_SECRET_KEY || DEFAULT_CONFIG.hcaptcha.secretKey,
    },

    // Configuration BIN Checker
    binChecker: {
      apiKey: process.env.BINCODES_API_KEY || DEFAULT_CONFIG.binChecker.apiKey,
    },

    // Pays autorisés (optionnel)
    allowedCountries: process.env.ALLOWED_COUNTRIES
      ? process.env.ALLOWED_COUNTRIES.split(",").map((c) => c.trim())
      : undefined,

    // Secret de session
    sessionSecret: process.env.SESSION_SECRET || DEFAULT_CONFIG.sessionSecret,
  };
}

// ============================================================================
// Export de la Configuration
// ============================================================================

/**
 * Configuration globale de l'application
 * Chargée une seule fois au démarrage
 */
export const config = loadConfig();
