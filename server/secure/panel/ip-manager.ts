// Gestion des IP : whitelist, blacklist, récupération de l'IP réelle

import type { Request } from "express";
import fs from "fs/promises";
import path from "path";

export interface BlacklistEntry {
  ip: string;
  comment?: string;
}

export interface IPLists {
  whitelist: string[];
  blacklist: BlacklistEntry[];
}

const PROJECT_ROOT = process.cwd();
const WHITELIST_FILE = path.join(PROJECT_ROOT, "whitelist.txt");
const BLACKLIST_FILE = path.join(PROJECT_ROOT, "blacklist.txt");

/**
 * Récupère l'IP réelle du client en tenant compte des proxies/CDN
 */
export function getRealIp(req: Request): string {
  const forwardedFor = req.headers["x-forwarded-for"] as string;
  const realIp = req.headers["x-real-ip"] as string;
  const remoteAddress = req.socket.remoteAddress;

  // Prendre la première IP de x-forwarded-for (la plus proche du client)
  if (forwardedFor) {
    const ips = forwardedFor.split(",").map((ip) => ip.trim());
    return ips[0] || "unknown";
  }

  if (realIp) {
    return realIp;
  }

  if (remoteAddress) {
    // Normaliser IPv6 localhost
    if (remoteAddress === "::1" || remoteAddress === "::ffff:127.0.0.1") {
      return "127.0.0.1";
    }
    // Enlever le préfixe IPv6 si présent
    if (remoteAddress.startsWith("::ffff:")) {
      return remoteAddress.substring(7);
    }
    return remoteAddress;
  }

  return "unknown";
}

/**
 * Charge la whitelist depuis le fichier
 */
export async function loadWhitelist(): Promise<string[]> {
  try {
    const content = await fs.readFile(WHITELIST_FILE, "utf-8");
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
  } catch {
    return [];
  }
}

/**
 * Charge la blacklist depuis le fichier
 */
export async function loadBlacklist(): Promise<BlacklistEntry[]> {
  try {
    const content = await fs.readFile(BLACKLIST_FILE, "utf-8");
    const entries: BlacklistEntry[] = [];
    
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      
      // Format: IP # comment
      const parts = trimmed.split("#", 2);
      const ip = parts[0].trim();
      const comment = parts[1]?.trim() || "";
      
      // Valider l'IP
      if (ip && /^[\d.]+$/.test(ip)) {
        entries.push({ ip, comment: comment || undefined });
      }
    }
    
    return entries.reverse(); // Most recent first
  } catch {
    return [];
  }
}

/**
 * Vérifie si une IP est dans la whitelist
 */
export async function isWhitelisted(ip: string): Promise<boolean> {
  const whitelist = await loadWhitelist();
  return whitelist.includes(ip);
}

/**
 * Vérifie si une IP est dans la blacklist
 */
export async function isBlacklisted(ip: string): Promise<boolean> {
  const blacklist = await loadBlacklist();
  return blacklist.some((entry) => entry.ip === ip);
}

/**
 * Ajoute une IP à la blacklist
 */
export async function addToBlacklist(ip: string, reason?: string): Promise<void> {
  const blacklist = await loadBlacklist();
  if (!blacklist.some((entry) => entry.ip === ip)) {
    const line = reason ? `${ip} # ${reason}` : ip;
    await fs.appendFile(BLACKLIST_FILE, line + "\n", "utf-8");
  }
}

/**
 * Retire une IP de la blacklist
 */
export async function removeFromBlacklist(ip: string): Promise<void> {
  const blacklist = await loadBlacklist();
  const filtered = blacklist.filter((entry) => entry.ip !== ip);
  if (filtered.length !== blacklist.length) {
    const content = filtered.map((entry) => 
      entry.comment ? `${entry.ip} # ${entry.comment}` : entry.ip
    ).join("\n") + "\n";
    await fs.writeFile(BLACKLIST_FILE, content, "utf-8");
  }
}

/**
 * Ajoute une IP à la whitelist
 */
export async function addToWhitelist(ip: string): Promise<void> {
  const whitelist = await loadWhitelist();
  if (!whitelist.includes(ip)) {
    whitelist.push(ip);
    await fs.writeFile(WHITELIST_FILE, whitelist.join("\n") + "\n", "utf-8");
  }
}

/**
 * Retire une IP de la whitelist
 */
export async function removeFromWhitelist(ip: string): Promise<void> {
  const whitelist = await loadWhitelist();
  const filtered = whitelist.filter((listIp) => listIp !== ip);
  if (filtered.length !== whitelist.length) {
    await fs.writeFile(WHITELIST_FILE, filtered.join("\n") + "\n", "utf-8");
  }
}

/**
 * Charge les deux listes (whitelist et blacklist)
 */
export async function loadIPLists(): Promise<IPLists> {
  return {
    whitelist: await loadWhitelist(),
    blacklist: await loadBlacklist(),
  };
}

/**
 * Génère une URL de redirection aléatoire (pour les IP bloquées)
 */
export function getRandomRedirectUrl(): string {
  const urls = [
    "https://www.google.com",
    "https://www.bing.com",
    "https://www.yahoo.com",
  ];
  return urls[Math.floor(Math.random() * urls.length)];
}
