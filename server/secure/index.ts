// Gestion des répertoires randomisés et point d'entrée sécurisé

import type { Express } from "express";
import { randomBytes } from "crypto";

// Génère un nom de répertoire aléatoire (ex: f7k2m9x)
export function generateRandomDirName(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Stocke les répertoires actifs (en production, utiliser une DB)
const activeDirs = new Map<string, { createdAt: number; expiresAt: number }>();

/**
 * Crée un nouveau répertoire randomisé
 */
export function createRandomDir(ttl: number = 24 * 60 * 60 * 1000): string {
  const dirName = generateRandomDirName();
  const now = Date.now();

  activeDirs.set(dirName, {
    createdAt: now,
    expiresAt: now + ttl,
  });

  return dirName;
}

/**
 * Vérifie si un répertoire existe et est valide
 */
export function isValidDir(dirName: string): boolean {
  const dir = activeDirs.get(dirName);
  if (!dir) {
    return false;
  }

  // Vérifier l'expiration
  if (Date.now() > dir.expiresAt) {
    activeDirs.delete(dirName);
    return false;
  }

  return true;
}

/**
 * Nettoie les répertoires expirés
 */
export function cleanupExpiredDirs(): void {
  const now = Date.now();
  for (const [dirName, dir] of Array.from(activeDirs.entries())) {
    if (now > dir.expiresAt) {
      activeDirs.delete(dirName);
    }
  }
}

// Nettoyer toutes les heures
setInterval(cleanupExpiredDirs, 60 * 60 * 1000);

/**
 * Enregistre les routes sécurisées avec répertoires randomisés
 */
export function registerSecureRoutes(app: Express): void {
  // Les routes sécurisées seront enregistrées ici
  // Pour l'instant, c'est un placeholder
}
