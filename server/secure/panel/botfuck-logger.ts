// Logger pour les activités suspectes de bots (botfuck.txt)
// Similaire à botfuck_logger.php du projet beta

import fs from "fs/promises";
import path from "path";

const PROJECT_ROOT = process.cwd();
const BOTFUCK_FILE = path.join(PROJECT_ROOT, "botfuck.txt");

export interface BotFuckLogEntry {
  timestamp: string;
  ip: string;
  userAgent?: string;
  reason: string;
  score?: number;
  action: string; // "blocked", "flagged", "redirected", etc.
  details?: Record<string, unknown>;
}

/**
 * Initialise le fichier de logs si nécessaire
 */
async function ensureLogFile(): Promise<void> {
  try {
    // Vérifier si le fichier existe, sinon le créer
    try {
      await fs.access(BOTFUCK_FILE);
    } catch {
      // Fichier n'existe pas, le créer avec un en-tête
      await fs.writeFile(
        BOTFUCK_FILE,
        "# BotFuck Logger - Activités suspectes de bots\n" +
        "# Format: [TIMESTAMP] IP | User-Agent | Reason | Score | Action | Details\n" +
        "# ============================================\n\n",
        "utf-8"
      );
    }
  } catch (error) {
    console.error("[BotFuck Logger] Failed to initialize log file:", error);
  }
}

/**
 * Formate une entrée de log pour l'écriture
 */
function formatLogEntry(entry: BotFuckLogEntry): string {
  const timestamp = entry.timestamp || new Date().toISOString();
  const userAgent = entry.userAgent || "N/A";
  const score = entry.score !== undefined ? entry.score.toString() : "N/A";
  const details = entry.details 
    ? JSON.stringify(entry.details).replace(/\n/g, " ") 
    : "N/A";

  return `[${timestamp}] ${entry.ip} | ${userAgent} | ${entry.reason} | Score: ${score} | Action: ${entry.action} | Details: ${details}\n`;
}

/**
 * Enregistre une activité suspecte dans botfuck.txt
 */
export async function logBotActivity(
  ip: string,
  reason: string,
  action: string,
  options?: {
    userAgent?: string;
    score?: number;
    details?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await ensureLogFile();

    const entry: BotFuckLogEntry = {
      timestamp: new Date().toISOString(),
      ip,
      userAgent: options?.userAgent,
      reason,
      score: options?.score,
      action,
      details: options?.details,
    };

    const logLine = formatLogEntry(entry);
    await fs.appendFile(BOTFUCK_FILE, logLine, "utf-8");
  } catch (error) {
    console.error("[BotFuck Logger] Failed to log bot activity:", error);
  }
}

/**
 * Lit les dernières entrées du fichier de logs
 * @param limit Nombre maximum d'entrées à retourner (défaut: 100)
 */
export async function readBotLogs(limit: number = 100): Promise<string[]> {
  try {
    await ensureLogFile();
    const content = await fs.readFile(BOTFUCK_FILE, "utf-8");
    const lines = content
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("#"))
      .reverse() // Les plus récentes en premier
      .slice(0, limit);
    return lines;
  } catch (error) {
    console.error("[BotFuck Logger] Failed to read bot logs:", error);
    return [];
  }
}

/**
 * Vide le fichier de logs (utile pour le nettoyage)
 */
export async function clearBotLogs(): Promise<void> {
  try {
    await ensureLogFile();
    await fs.writeFile(
      BOTFUCK_FILE,
      "# BotFuck Logger - Activités suspectes de bots\n" +
      "# Format: [TIMESTAMP] IP | User-Agent | Reason | Score | Action | Details\n" +
      "# ============================================\n\n",
      "utf-8"
    );
  } catch (error) {
    console.error("[BotFuck Logger] Failed to clear bot logs:", error);
  }
}

/**
 * Compte le nombre d'entrées dans le fichier de logs
 */
export async function countBotLogs(): Promise<number> {
  try {
    await ensureLogFile();
    const content = await fs.readFile(BOTFUCK_FILE, "utf-8");
    const lines = content
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("#"));
    return lines.length;
  } catch (error) {
    console.error("[BotFuck Logger] Failed to count bot logs:", error);
    return 0;
  }
}

/** Entrée de log parsée pour affichage (style beta2) */
export interface ParsedLogEntry {
  timestamp: string;
  ip: string;
  country: string;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                countryCode: string; // ISO 3166-1 alpha-2 (2 lettres) pour la carte
  action: string;
  reason: string;
  ua: string;
  category: string;
}

/** Catégorie dérivée de la raison et de l'action pour un journal lisible */
function getCategoryFromReason(reason: string, action: string): string {
  const r = reason.toLowerCase();
  if (r.includes("country") || r.includes("geo") || r.includes("pays") || r.includes("not allowed")) return "Géo";
  if (r.includes("blacklist") || r.includes("black list")) return "Blacklist";
  if (r.includes("honeypot") || r.includes("honey pot")) return "Honeypot";
  if (r.includes("datacenter") || r.includes("data center")) return "Datacenter";
  if (r.includes("proxy") || r.includes("vpn") || r.includes("tor")) return "Proxy/VPN/Tor";
  if (r.includes("user-agent") || r.includes("user agent") || r.includes("suspicious") || r.includes("score")) return "Anti-bot";
  if (r.includes("fingerprint") || r.includes("js_challenge") || r.includes("behavior")) return "Anti-bot";
  if (r.includes("manual") || r.includes("ozyadmin")) return "Admin";
  if (action === "blocked") return "Blocage";
  if (action === "redirected") return "Redirection";
  return "Autre";
}

/**
 * Parse une ligne de log (format: [timestamp] ip | ua | reason | Score: x | Action: y | Details: json)
 */
export function parseLogLine(line: string): ParsedLogEntry | null {
  if (!line.trim() || line.startsWith("#")) return null;
  const parts = line.split(" | ");
  if (parts.length < 6) return null;
  const first = parts[0];
  const timestampMatch = first.match(/^\[([^\]]+)\]/);
  const timestamp = timestampMatch ? timestampMatch[1] : "";
  const ip = (timestampMatch ? first.slice(timestampMatch[0].length).trim() : first.trim()).split(/\s+/)[0] || "";
  const ua = parts[1] ?? "";
  const reason = parts.slice(2, -3).join(" | ").trim();
  const actionPart = parts[parts.length - 2] ?? "";
  const action = actionPart.replace(/^Action:\s*/i, "").trim() || "";
  const detailsPart = parts[parts.length - 1] ?? "";
  let country = "Inconnu";
  let countryCode = "";
  try {
    const detailsStr = detailsPart.replace(/^Details:\s*/i, "").trim();
    if (detailsStr !== "N/A" && detailsStr !== "{}") {
      const details = JSON.parse(detailsStr) as Record<string, unknown>;
      const code = (details.countryCode as string)?.trim();
      const name = (details.country as string)?.trim();
      if (code && code.length === 2 && code !== "??") {
        countryCode = code.toUpperCase();
        country = name && name !== "Unknown" ? name : countryCode;
      } else if (name && name !== "??" && name.toLowerCase() !== "unknown") {
        country = name;
        if (name.length === 2 && /^[A-Za-z]{2}$/.test(name)) countryCode = name.toUpperCase();
      }
    }
  } catch {
    // ignore
  }
  const category = getCategoryFromReason(reason, action);
  return { timestamp, ip, country, countryCode, action, reason, ua, category };
}

/**
 * Retourne les logs parsés et les stats (by_country, by_reason, by_category, by_action)
 */
export async function getBotLogsWithStats(limit: number = 50): Promise<{
  logs: ParsedLogEntry[];
  stats: {
    by_country: Record<string, number>;
    by_country_code: Record<string, number>;
    by_reason: Record<string, number>;
    by_category: Record<string, number>;
    by_action: Record<string, number>;
  };
}> {
  const rawLines = await readBotLogs(limit);
  const logs: ParsedLogEntry[] = [];
  const by_country: Record<string, number> = {};
  const by_country_code: Record<string, number> = {};
  const by_reason: Record<string, number> = {};
  const by_category: Record<string, number> = {};
  const by_action: Record<string, number> = {};
  for (const line of rawLines) {
    const parsed = parseLogLine(line);
    if (parsed) {
      logs.push(parsed);
      const c = parsed.country || "Inconnu";
      by_country[c] = (by_country[c] ?? 0) + 1;
      if (parsed.countryCode) {
        by_country_code[parsed.countryCode] = (by_country_code[parsed.countryCode] ?? 0) + 1;
      }
      const r = parsed.reason.slice(0, 80);
      by_reason[r] = (by_reason[r] ?? 0) + 1;
      by_category[parsed.category] = (by_category[parsed.category] ?? 0) + 1;
      by_action[parsed.action] = (by_action[parsed.action] ?? 0) + 1;
    }
  }
  const sortEntries = (obj: Record<string, number>, max = 10) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, max);
  return {
    logs,
    stats: {
      by_country: Object.fromEntries(sortEntries(by_country)),
      by_country_code: Object.fromEntries(sortEntries(by_country_code, 200)),
      by_reason: Object.fromEntries(sortEntries(by_reason)),
      by_category: Object.fromEntries(sortEntries(by_category, 15)),
      by_action: Object.fromEntries(sortEntries(by_action, 10)),
    },
  };
}

/**
 * Compte les entrées de log dont la date est aujourd'hui (UTC)
 */
export async function countBotLogsToday(): Promise<number> {
  try {
    await ensureLogFile();
    const content = await fs.readFile(BOTFUCK_FILE, "utf-8");
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const lines = content
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("#"));
    let count = 0;
    for (const line of lines) {
      const match = line.match(/^\[([^\]]+)\]/);
      if (match && match[1].startsWith(today)) count += 1;
    }
    return count;
  } catch {
    return 0;
  }
}
