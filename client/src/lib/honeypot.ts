// Utilitaire pour les champs honeypot
// Génère des champs cachés pour détecter les bots

/**
 * Génère un nom de champ honeypot aléatoire
 */
function generateHoneypotFieldName(): string {
  const names = [
    "email_confirm",
    "website",
    "url",
    "phone_alt",
    "company",
    "address2",
    "city_alt",
    "postal_alt",
    "country_alt",
    "comments",
    "notes",
    "message",
  ];
  return names[Math.floor(Math.random() * names.length)];
}

/**
 * Crée un champ honeypot invisible
 */
export function createHoneypotField(): { name: string; element: HTMLInputElement } {
  const fieldName = generateHoneypotFieldName();
  const input = document.createElement("input");
  input.type = "text";
  input.name = fieldName;
  input.id = fieldName;
  input.style.display = "none";
  input.style.position = "absolute";
  input.style.left = "-9999px";
  input.setAttribute("tabindex", "-1");
  input.setAttribute("autocomplete", "off");
  input.setAttribute("aria-hidden", "true");
  
  return { name: fieldName, element: input };
}

/**
 * Vérifie si un champ honeypot a été rempli
 */
export function checkHoneypot(formData: FormData | Record<string, any>): boolean {
  const honeypotFields = [
    "email_confirm",
    "website",
    "url",
    "phone_alt",
    "company",
    "address2",
    "city_alt",
    "postal_alt",
    "country_alt",
    "comments",
    "notes",
    "message",
  ];

  for (const field of honeypotFields) {
    let value: string | null = null;
    
    if (formData instanceof FormData) {
      value = formData.get(field) as string | null;
    } else {
      value = formData[field] || null;
    }
    
    if (value && value.trim().length > 0) {
      return true; // Honeypot rempli = bot détecté
    }
  }

  return false; // Aucun honeypot rempli = probablement humain
}

/**
 * Ajoute des champs honeypot à un formulaire
 */
export function addHoneypotToForm(form: HTMLFormElement): string[] {
  const fieldNames: string[] = [];
  
  // Ajouter 2-3 champs honeypot
  const count = 2 + Math.floor(Math.random() * 2); // 2 ou 3 champs
  
  for (let i = 0; i < count; i++) {
    const { name, element } = createHoneypotField();
    form.appendChild(element);
    fieldNames.push(name);
  }
  
  return fieldNames;
}
