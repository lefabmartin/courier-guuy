// Service pour gérer la configuration Anti-Bot
// Stocke la configuration dans un fichier JSON

import fs from "fs/promises";
import path from "path";

const CONFIG_FILE = path.resolve(process.cwd(), "antibot-config.json");

export interface AntiBotConfig {
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
  updatedAt: string;
}

const DEFAULT_CONFIG: AntiBotConfig = {
  enabled: true,
  user_agent_check: true,
  header_check: true,
  timing_check: false,
  js_cookie_check: false,
  fingerprint_check: false,
  behavior_check: false,
  js_challenge_check: false,
  honeypot_check: false,
  datacenter_check: true,
  proxy_check: true,
  tor_check: true,
  vpn_check: true,
  hcaptcha_check: true,
  block_datacenter: true,
  block_datacenter_all_countries: true,
  block_proxy: false,
  block_tor: true,
  block_vpn: false,
  min_behavior_score: 50,
  min_fingerprint_score: 50,
  updatedAt: new Date().toISOString(),
};

/**
 * Charge la configuration Anti-Bot
 */
export async function getAntiBotConfig(): Promise<AntiBotConfig> {
  try {
    const content = await fs.readFile(CONFIG_FILE, "utf-8");
    const config: AntiBotConfig = JSON.parse(content);
    // Fusionner avec les valeurs par défaut pour les nouvelles propriétés
    return { ...DEFAULT_CONFIG, ...config };
  } catch {
    // Fichier n'existe pas, retourner la config par défaut
    return DEFAULT_CONFIG;
  }
}

/**
 * Sauvegarde la configuration Anti-Bot
 */
export async function setAntiBotConfig(config: Partial<AntiBotConfig>): Promise<void> {
  const currentConfig = await getAntiBotConfig();
  const newConfig: AntiBotConfig = {
    ...currentConfig,
    ...config,
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(CONFIG_FILE, JSON.stringify(newConfig, null, 2), "utf-8");
}
