/**
 * Service de vérification BIN (Bank Identification Number)
 * Vérifie les informations de la carte via l'API bincodes.com
 * Basé sur le projet beta PHP
 */

import { config } from "../secure/config/config";

interface BINInfo {
  bin: string;
  card: string; // Type de carte (Visa, Mastercard, etc.)
  type: string; // Type (Credit, Debit, etc.)
  level: string; // Niveau (Classic, Gold, Platinum, etc.)
  bank: string; // Nom de la banque
  country: string; // Pays
}

interface BINResponse {
  success: boolean;
  data?: BINInfo;
  error?: string;
}

/**
 * Vérifie les informations BIN d'une carte
 * @param bin Les 6 premiers chiffres du numéro de carte
 * @returns Informations BIN ou null en cas d'erreur
 */
export async function checkBIN(bin: string): Promise<BINInfo | null> {
  const apiKey = config.binChecker?.apiKey || "90c2ea5ccfbc2d6fce6f533c2b534f1a";
  
  // Nettoyer le BIN (garder uniquement les chiffres)
  const cleanBin = bin.replace(/\D/g, "").substring(0, 6);
  
  if (cleanBin.length < 6) {
    return null;
  }

  const url = `https://api.bincodes.com/bin/?format=json&api_key=${encodeURIComponent(apiKey)}&bin=${encodeURIComponent(cleanBin)}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      signal: AbortSignal.timeout(10000), // Timeout de 10 secondes
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // Vérifier s'il y a une erreur dans la réponse
    if (data && data.error && data.error !== "") {
      return null;
    }

    // Si la réponse contient des données valides
    // L'API peut retourner valid comme booléen true ou chaîne "true"
    const isValid = data.valid === true || data.valid === "true" || String(data.valid).toLowerCase() === "true";
    if (
      data &&
      (isValid || (data.bin && data.bin !== ""))
    ) {
      return {
        bin: data.bin || cleanBin,
        card:
          data.card ||
          data.card_type ||
          data.brand ||
          data.scheme ||
          "N/A",
        type: data.type || data.card_type || "N/A",
        level: data.level || data.card_level || "N/A",
        bank:
          data.bank ||
          data.bank_name ||
          data.issuer ||
          data.issuer_name ||
          "N/A",
        country:
          data.country ||
          data.country_name ||
          data.country_code ||
          "N/A",
      };
    }

    return null;
  } catch (error) {
    console.error("BIN Checker error:", error);
    return null;
  }
}

/**
 * Formate le BIN pour l'affichage
 */
export function formatBINDisplay(binInfo: BINInfo | null): string {
  if (!binInfo) {
    return "Non vérifié";
  }

  if (binInfo.card !== "N/A" && binInfo.bank !== "N/A") {
    return `${binInfo.bin} (${binInfo.card} - ${binInfo.bank})`;
  }

  return binInfo.bin;
}
