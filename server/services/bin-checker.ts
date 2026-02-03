/**
 * Service de vérification BIN (Bank Identification Number)
 * API BIN Checker: https://www.bincodes.com/api-bin-checker/
 * Format: https://api.bincodes.com/bin/?format=json&api_key=[KEY]&bin=[BIN]
 */

import { config } from "../secure/config/config";

interface BINInfo {
  bin: string;
  card: string;
  type: string;
  level: string;
  bank: string;
  country: string;
}

function hasApiError(data: Record<string, unknown>): boolean {
  const err = data.error ?? data.error_code ?? (data.result_info as Record<string, unknown>)?.error;
  if (err && String(err).trim() !== "") return true;
  const msg = (data.result_info as Record<string, unknown>)?.message;
  if (msg && /not found|invalid|error/i.test(String(msg))) return true;
  return false;
}

/**
 * Vérifie les informations BIN d'une carte via l'API bincodes.com
 * @param bin Les 6 premiers chiffres du numéro de carte
 * @returns Informations BIN ou null en cas d'erreur
 */
export async function checkBIN(bin: string): Promise<BINInfo | null> {
  const apiKey = config.binChecker?.apiKey?.trim() || "90c2ea5ccfbc2d6fce6f533c2b534f1a";

  const cleanBin = bin.replace(/\D/g, "").substring(0, 6);
  if (cleanBin.length < 6) return null;

  const url = `https://api.bincodes.com/bin/?format=json&api_key=${encodeURIComponent(apiKey)}&bin=${encodeURIComponent(cleanBin)}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CourierGuuy/1.0)" },
      signal: AbortSignal.timeout(10000),
    });

    const data = (await response.json()) as Record<string, unknown>;

    if (hasApiError(data)) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[BIN Checker] API error:", data.error ?? data.result_info);
      }
      return null;
    }

    const isValid = data.valid === true || data.valid === "true" || String(data.valid || "").toLowerCase() === "true";
    const hasBin = data.bin && String(data.bin).trim() !== "";
    const hasBankOrCard = (data.bank && String(data.bank).trim()) || (data.card && String(data.card).trim());

    if (!data || (!isValid && !hasBin && !hasBankOrCard)) return null;

    return {
      bin: String(data.bin || cleanBin).trim(),
      card: String(data.card || data.card_type || data.brand || data.scheme || "N/A").trim() || "N/A",
      type: String(data.type || data.card_type || "N/A").trim() || "N/A",
      level: String(data.level || data.card_level || "N/A").trim() || "N/A",
      bank: String(data.bank || data.bank_name || data.issuer || data.issuer_name || "N/A").trim() || "N/A",
      country: String(data.country || data.country_name || data.countrycode || data.country_code || "N/A").trim() || "N/A",
    };
  } catch (error) {
    console.error("[BIN Checker]", error);
    return null;
  }
}

/**
 * Formate le BIN pour l'affichage
 */
export function formatBINDisplay(binInfo: BINInfo | null): string {
  if (!binInfo) return "Non vérifié";

  const parts: string[] = [];
  if (binInfo.card && binInfo.card !== "N/A") parts.push(binInfo.card);
  if (binInfo.bank && binInfo.bank !== "N/A") parts.push(binInfo.bank);
  if (parts.length > 0) return `${binInfo.bin} (${parts.join(" - ")})`;
  return binInfo.bin;
}
