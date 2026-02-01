/**
 * Système de honeypot invisible pour détection de bots
 * Champs cachés dans les formulaires que seuls les bots remplissent
 */

import { randomBytes } from "crypto";

// Noms de champs honeypot (apparence légitime pour tromper les bots)
const FIELD_NAMES = [
  "website_url",
  "user_homepage",
  "contact_website",
  "company_url",
  "fax_number",
  "secondary_email",
  "phone_ext",
  "website",
  "url",
  "homepage",
];

export interface HoneypotField {
  name: string;
  id: string;
  style: string;
  html: string;
}

/**
 * Générer un champ honeypot HTML
 */
export function generateHoneypotField(fieldName?: string): HoneypotField {
  const name = fieldName || FIELD_NAMES[Math.floor(Math.random() * FIELD_NAMES.length)];
  const id = `hp_${randomBytes(4).toString("hex")}`;

  // Différentes techniques de masquage
  const styles = [
    "position:absolute;left:-9999px;top:-9999px;",
    "position:absolute;opacity:0;height:0;width:0;",
    "display:none;",
    "visibility:hidden;position:absolute;",
    "clip:rect(0,0,0,0);position:absolute;",
  ];

  const style = styles[Math.floor(Math.random() * styles.length)];

  // HTML avec plusieurs couches de protection
  const html = `<div style="${style}" aria-hidden="true">
    <label for="${id}" style="display:none;">Leave this field empty</label>
    <input type="text" 
           name="${name}" 
           id="${id}" 
           value="" 
           tabindex="-1" 
           autocomplete="off"
           placeholder="Do not fill this field">
</div>`;

  return {
    name,
    id,
    style,
    html,
  };
}

/**
 * Générer plusieurs champs honeypot
 */
export function generateHoneypotFields(count: number = 2): HoneypotField[] {
  const fields: HoneypotField[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < count && usedNames.size < FIELD_NAMES.length; i++) {
    let name: string;
    do {
      name = FIELD_NAMES[Math.floor(Math.random() * FIELD_NAMES.length)];
    } while (usedNames.has(name));

    usedNames.add(name);
    fields.push(generateHoneypotField(name));
  }

  return fields;
}

/**
 * Vérifier si un champ honeypot a été rempli
 */
export function checkHoneypot(
  formData: Record<string, any>,
  honeypotFields: HoneypotField[],
): {
  isBot: boolean;
  filledFields: string[];
} {
  const filledFields: string[] = [];

  for (const field of honeypotFields) {
    const value = formData[field.name];
    if (value && value.trim() !== "") {
      filledFields.push(field.name);
    }
  }

  return {
    isBot: filledFields.length > 0,
    filledFields,
  };
}

/**
 * Vérifier rapidement si des champs honeypot standards ont été remplis
 */
export function quickHoneypotCheck(formData: Record<string, any>): boolean {
  for (const fieldName of FIELD_NAMES) {
    const value = formData[fieldName];
    if (value && value.trim() !== "") {
      return true; // Bot détecté
    }
  }
  return false; // Pas de bot
}
