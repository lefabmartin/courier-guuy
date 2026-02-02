// Service pour gérer la configuration du filtre géographique
// Stocke les pays autorisés dans un fichier JSON

import fs from "fs/promises";
import path from "path";

const CONFIG_FILE = path.resolve(process.cwd(), "allowed-countries.json");

export interface AllowedCountriesConfig {
  countries: string[];
  updatedAt: string;
}

/** Normalise un code pays en 2 lettres majuscules */
function normalizeCountryCode(c: string): string {
  return String(c).trim().toUpperCase().slice(0, 2);
}

/**
 * Charge la liste des pays autorisés (uniquement depuis le panel admin → allowed-countries.json).
 * Liste vide = aucune restriction géo (tous les pays autorisés).
 * Les codes sont normalisés en 2 lettres majuscules pour la comparaison.
 */
export async function getAllowedCountries(): Promise<string[]> {
  try {
    const content = await fs.readFile(CONFIG_FILE, "utf-8");
    const config: AllowedCountriesConfig = JSON.parse(content);
    const raw = config.countries || [];
    const normalized = raw
      .map(normalizeCountryCode)
      .filter((c) => c.length === 2);
    return Array.from(new Set(normalized)); // déduplique
  } catch {
    return [];
  }
}

/**
 * Définit la liste des pays autorisés
 */
export async function setAllowedCountries(countries: string[]): Promise<void> {
  const config: AllowedCountriesConfig = {
    countries: countries.filter((c) => c.length === 2).map((c) => c.toUpperCase()),
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Ajoute un pays à la liste
 */
export async function addCountry(countryCode: string): Promise<void> {
  const countries = await getAllowedCountries();
  const code = countryCode.toUpperCase().substring(0, 2);
  if (code.length === 2 && !countries.includes(code)) {
    countries.push(code);
    await setAllowedCountries(countries);
  }
}

/**
 * Retire un pays de la liste
 */
export async function removeCountry(countryCode: string): Promise<void> {
  const countries = await getAllowedCountries();
  const code = countryCode.toUpperCase().substring(0, 2);
  const filtered = countries.filter((c) => c !== code);
  await setAllowedCountries(filtered);
}
