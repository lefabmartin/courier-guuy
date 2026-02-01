# Validation des cartes bancaires et des dates d'expiration

## Vue d'ensemble

Le formulaire de saisie des informations carte (étape Contact Info, `h9c3y7b.php`) valide côté client :

1. **Le numéro de carte** — algorithme de Luhn (checksum)
2. **La date d'expiration** — mois et année valides, **et la date ne doit pas être dans le passé**

Une carte avec une date d'expiration antérieure (ex. 01/2023 alors qu'on est en 2025) est rejetée.

---

## 1. Validation du numéro de carte (algorithme de Luhn)

### Principe

L'algorithme de Luhn (ou « modulo 10 ») est une formule utilisée par les cartes bancaires (Visa, Mastercard, etc.) pour détecter les erreurs de saisie. Il ne valide pas qu'une carte existe ou est valide, mais qu'elle respecte la structure mathématique attendue.

### Règles

| Critère | Valeur |
|---------|--------|
| Longueur | 12 à 19 chiffres |
| Caractères | Uniquement des chiffres (espaces et tirets acceptés puis ignorés) |

### Algorithme (étape par étape)

1. **Nettoyer** — retirer tout caractère non numérique
2. **Parcourir** les chiffres de droite à gauche
3. Pour chaque position :
   - **Position paire** (2e en partant de la droite, 4e, 6e, etc.) : doubler le chiffre
     - Si le résultat > 9 → soustraire 9
   - **Position impaire** : garder le chiffre tel quel
4. **Additionner** tous les chiffres
5. **Valider** : la somme doit être un **multiple de 10** (`sum % 10 === 0`)

### Exemple (carte de test Visa : 4532015112830366)

```
Chiffres : 4 5 3 2 0 1 5 1 1 2 8 3 0 3 6 6
           ↓   ↓   ↓   ↓   ↓   ↓   ↓   ↓
Doublés :  8   6   0   2   2   4   0   6  (×2, -9 si > 9)

Calcul : 4+10+3+4+0+2+5+2+1+4+8+6+0+6+6+12 = 73
         (5×2=10→1, 2×2=4, 1×2=2, 2×2=4, 3×2=6, 6×2=12→3)
```

Pour une carte Visa valide selon Luhn : la somme doit être divisible par 10.

### Implémentation (JavaScript)

```javascript
function validateCardNumber(cardNumber) {
    const digits = cardNumber.replace(/\D/g, '');
    
    if (digits.length < 12 || digits.length > 19) {
        return false;
    }
    
    let sum = 0;
    let isEven = false;
    
    for (let i = digits.length - 1; i >= 0; i--) {
        let digit = parseInt(digits[i], 10);
        
        if (isEven) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        
        sum += digit;
        isEven = !isEven;
    }
    
    return sum % 10 === 0;
}
```

---

## 2. Validation de la date d'expiration

### Structure des champs

- **Mois** : 1 ou 2 chiffres (1–12 ou 01–12)
- **Année** : 4 chiffres (format YYYY, ex. 2027)

### Validation du mois (`validateMonth`)

| Règle | Valeur |
|-------|--------|
| Format | 1–12 ou 01–09 (normalisé en 2 chiffres) |
| Valeur | Entre 1 et 12 |

### Validation de l'année (`validateYear`)

| Règle | Valeur |
|-------|--------|
| Format | Exactement 4 chiffres |
| Plage | 2020 à 2100 |

### Validation « pas dans le passé » (`validateExpiryDate`)

**Objectif :** rejeter toute date d'expiration antérieure à la date actuelle.

```javascript
function validateExpiryDate(month, year) {
    // 1. Normaliser le mois (1 → 01)
    const normalizedMonth = month.length === 1 ? '0' + month : month;
    const monthNum = parseInt(normalizedMonth, 10);
    const yearNum = parseInt(year, 10);
    
    // 2. Vérifier mois valide (1-12)
    if (monthNum < 1 || monthNum > 12) return false;
    
    // 3. Obtenir la date actuelle
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;  // 0-11 → 1-12
    
    // 4. Rejeter si année passée
    if (yearNum < currentYear) return false;
    
    // 5. Rejeter si même année mais mois déjà passé
    if (yearNum === currentYear && monthNum < currentMonth) return false;
    
    return true;
}
```

### Exemples (date du jour : février 2025)

| Mois | Année | Résultat | Raison |
|------|-------|----------|--------|
| 12 | 2024 | ❌ Invalide | Année passée |
| 01 | 2025 | ❌ Invalide | Mois déjà passé (janvier < février) |
| 02 | 2025 | ✅ Valide | Mois en cours |
| 03 | 2025 | ✅ Valide | Mois futur |
| 01 | 2026 | ✅ Valide | Année future |

### Logique combinée

La date n'est valide que si :
1. Le mois est entre 01 et 12
2. L'année est entre 2020 et 2100
3. La date (mois/année) **n'est pas** antérieure à aujourd'hui

Si la date est dans le passé, **les deux champs** (mois et année) sont marqués invalides pour indiquer que la carte est considérée comme expirée.

---

## 3. Autres validations (CVV)

| Champ | Règle |
|-------|-------|
| CVV | Exactement 3 chiffres |

---

## 4. Comportement dans l'interface

- **Validation en temps réel** — à chaque saisie (`input`) et à la sortie du champ (`blur`)
- **Bouton Submit** — désactivé tant que tous les champs ne sont pas valides
- **Style visuel** — classe `invalid` (bordure rouge) sur les champs invalides
- **Ordre des contrôles** :
  1. Longueur et format (mois, année, carte)
  2. Luhn pour le numéro de carte
  3. `validateExpiryDate` pour s'assurer que la date n'est pas passée

---

## 5. Fichier source

**Localisation :** `secure/views/h9c3y7b.php`

Les fonctions JavaScript sont définies dans un bloc `<script>` et sont exécutées côté client (navigateur).

---

## 6. Résumé

| Élément | Méthode | Règle principale |
|---------|---------|------------------|
| Numéro de carte | Algorithme de Luhn | 12–19 chiffres, somme % 10 = 0 |
| Mois | `validateMonth` | 01–12 |
| Année | `validateYear` | 2020–2100, 4 chiffres |
| Date non expirée | `validateExpiryDate` | `(année > année actuelle)` OU `(année = année actuelle ET mois ≥ mois actuel)` |
| CVV | Regex | 3 chiffres exactement |

Une carte avec une date d'expiration antérieure (ex. 06/2023 en 2025) est systématiquement rejetée et le formulaire ne peut pas être soumis.
