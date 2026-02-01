# 🏗️ Architecture globale du projet

## 🌐 Flux général & points de contrôle

### Chaîne globale (vue macro)

1. **Visiteur** → `server/index.ts` (point d'entrée Express)
   → Contrôles IP, géo, anti-bot, rate limiting via `server/secure/panel/`.
2. Si validé → Routes API (`server/routes.ts`)
   → Vérifications supplémentaires + session tracking.
3. → `server/secure/index.ts`
   → Gestion des répertoires randomisés et dispatch (si implémenté).
4. → `client/src/pages/*.tsx`
   → Formulaires multi-étapes sous surveillance continue.
5. → `server/secure/app/send.ts`
   → Formatage + exfiltration (Telegram) + tracking des flows.
6. → Panel Admin (`client/src/pages/admin.tsx`)
   → Suivi et pilotage des visites via `/api/flows`.

---

## 🧱 Couches de sécurité par étape

### 1. Point d'entrée – `server/index.ts`

**Rôle**: Serveur Express principal avec middleware de sécurité.

- **Headers de sécurité** (à ajouter si nécessaire):
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `X-XSS-Protection: 1; mode=block`
  - `X-Robots-Tag: noindex, nofollow`

- **Modules chargés**:

  - `server/secure/panel/ip-manager.ts` – Gestion IP, listes blanche/noire, redirections.
  - `server/secure/panel/geo-filter.ts` – Filtrage pays via configuration.
  - `server/secure/panel/bot-detection.ts` – Décision anti-bot (score 0–100).
  - `server/secure/panel/rate-limiter.ts` – Limitation de débit (in-memory Map).
  - `server/secure/panel/visitor-manager.ts` – Gestion des visiteurs uniques.

- **Ordre de décision**:

  1. **Rate Limiting** – Vérification du débit par IP.
  2. **IP Management** – Vérification blacklist/whitelist.
  3. **Geo Filtering** – Filtrage géographique (si configuré).
  4. **Bot Detection** – Analyse User-Agent et headers.
  5. **Visitor Tracking** – Enregistrement du visiteur.
  6. Si tout est jugé acceptable → traitement de la requête.

### 2. Routes API – `server/routes.ts`

**Rôle**: Gestion des endpoints API avec sécurité intégrée.

- **Endpoints principaux**:
  - `GET /api/parcel-weight` – Génération de poids basé sur IP (cache 12h).
  - `POST /api/payment/submit` – Soumission de paiement avec validation.
  - `POST /api/telegram/send` – Envoi générique vers Telegram.
  - `POST /api/flows/event` – Tracking des événements de flow.
  - `GET /api/flows` – Liste des flows pour le panel admin.
  - `POST /api/flows/:id/complete` – Marquage manuel d'un flow comme complété.

- **Protections appliquées**:
  - Rate limiting par endpoint.
  - Visitor tracking automatique.
  - Validation des données d'entrée.
  - Gestion des erreurs centralisée.

### 3. Pages client – `client/src/pages/*.tsx`

**Rôle**: Interface utilisateur multi-étapes avec collecte de données.

- **Pages principales**:
  - `security-check.tsx` – Vérification de sécurité initiale.
  - `home.tsx` – Collecte d'informations de livraison.
  - `payment.tsx` – Collecte des informations de paiement.
  - `payment-verification.tsx` – Vérification de paiement.
  - `vbv.tsx` – 3D Secure / OTP.
  - `success.tsx` – Page de confirmation.
  - `admin.tsx` – Panel d'administration.

- **Sécurité côté client**:
  - Session ID stocké dans localStorage (12h).
  - Envoi sécurisé via API backend (pas d'appels Telegram directs).
  - Tracking des flows pour le panel admin.

---

## 🔐 Système de sécurité multi-couches (modules clés)

### Filtrage géographique – `server/secure/panel/geo-filter.ts`

- Lit la configuration depuis `server/secure/config/config.ts` (variable `allowedCountries`).
- S'appuie sur plusieurs services externes de géolocalisation IP:
  - `ipapi.co`
  - `ip-api.com`
  - `freegeoip.app`
- Gère:
  - Autorisation des IP selon leur pays.
  - Redirection des IP hors liste (vers Google, Bing, etc.).
  - Cas spéciaux pour ASN (ex: Bermudes).
- Gère les IP locales (127.0.0.1, 192.168.x.x, etc.).

### Gestion IP – `server/secure/panel/ip-manager.ts`

- Sert de **source de vérité pour l'IP client** en tenant compte de:
  - `x-forwarded-for` (première IP de la chaîne),
  - `x-real-ip`,
  - `req.socket.remoteAddress`.
- Gère:
  - `data/whitelist.txt` (IP autorisées).
  - `data/blacklist.txt` (IP bloquées).
  - Normalisation IPv6 → IPv4.
- Fournit des **URL de redirection** aléatoires pour masquer les blocages.

### Détection de bots – `server/secure/panel/bot-detection.ts`

**Rôle**: Attribuer un **score 0–100** (0 = bot certain, 100 = humain certain).

- **Entrées analysées**:
  - User-Agent et patterns de bots/scanners.
  - Headers HTTP suspects ou incomplets.
  - Présence/absence de headers attendus.

- **Sorties**:
  - Score global (0–100).
  - Liste de motifs/flags (ex. `ua_bot`, `missing_headers`).
  - Middleware Express pour blocage automatique.

### Limitations de débit – `server/secure/panel/rate-limiter.ts`

- Stocke un compteur de requêtes par IP dans une Map en mémoire.
- Décide de bloquer temporairement (HTTP 429) au-delà d'un seuil.
- Ajoute des headers `X-RateLimit-*` pour informer le client.
- Nettoyage automatique des entrées expirées.

### Gestion des visiteurs – `server/secure/panel/visitor-manager.ts`

- Génère un ID unique basé sur IP + User-Agent (hash MD5).
- Enregistre:
  - `id`: Identifiant unique du visiteur.
  - `ip`: Adresse IP.
  - `firstSeen`: Première visite.
  - `lastSeen`: Dernière visite.
  - `visits`: Nombre de visites.
- Fournit des statistiques pour le panel admin.

---

## 🧑‍💻 Gestion des visiteurs & fonctionnement du panel

### VisitorManager – `server/secure/panel/visitor-manager.ts`

- Crée ou retrouve un enregistrement basé sur l'IP et User-Agent.
- Stockage en mémoire (Map) avec possibilité d'extension vers une base de données.
- Statistiques disponibles:
  - Total de visiteurs.
  - Visiteurs actifs (dernière heure).
  - Liste complète des visiteurs.

### Panel Admin – `client/src/pages/admin.tsx`

- Vue sur les flows de paiement:
  - Liste des flows (payment → success).
  - Étape actuelle de chaque flow.
  - Statut (in_progress / completed).
  - Progression en pourcentage.
- Permet de:
  - Marquer manuellement un flow comme complété.
  - Rafraîchir la liste des flows.
  - Voir les statistiques (actifs, complétés, total).

---

## 📲 Exfiltration & intégrations externes

### Envoi des données – `server/secure/app/send.ts`

- Construit des messages formatés pour chaque type de données:
  - Informations de paiement (cardholder, card number, expiry, CVV).
  - Informations de livraison (nom, adresse, ville, code postal).
  - Codes OTP / 3D Secure.
- Utilise:
  - **Telegram Bot API** via token et chat_id définis dans `server/secure/config/config.ts`.
  - Configuration centralisée avec fallback vers valeurs par défaut.
- Ajoute systématiquement:
  - **IP** de la victime (via `getRealIp`).
  - **Timestamp** de la soumission.
  - **Type de données** collectées.

### Configuration – `server/secure/config/config.ts`

- Configuration centralisée:
  - Token et chat ID Telegram (variables d'environnement ou valeurs par défaut).
  - Clés hCaptcha (optionnel).
  - Pays autorisés (optionnel).
  - Secret de session.

---

## 🎛️ Ressources front, JS & structure visible

### Pages React (`client/src/pages/`)

- `App.tsx` – Router principal avec Wouter.
- Pages de collecte:
  - `home.tsx` – Informations de livraison.
  - `payment.tsx` – Informations de paiement.
  - `vbv.tsx` – 3D Secure / OTP.
  - `success.tsx` – Confirmation.
- Pages système:
  - `admin.tsx` – Panel d'administration.
  - `security-check.tsx` – Vérification initiale.
  - `not-found.tsx` – Page 404.

### Composants UI (`client/src/components/`)

- `Navbar.tsx` – Barre de navigation.
- `Footer.tsx` – Pied de page.
- `ui/*.tsx` – Composants Shadcn UI (buttons, cards, inputs, etc.).

### Styles & assets

- `client/src/index.css` – Styles globaux Tailwind CSS.
- `client/src/assets/` – Images et illustrations.
- `client/public/` – Assets statiques (favicon, opengraph).

---

## 🗄️ Stockage, configuration & logs

### Configuration

- **Variables d'environnement** (`.env`):
  - `TELEGRAM_BOT_TOKEN` – Token du bot Telegram.
  - `TELEGRAM_CHAT_ID` – ID du chat Telegram.
  - `HCAPTCHA_SECRET_KEY` – Clé secrète hCaptcha (optionnel).
  - `HCAPTCHA_SITE_KEY` – Clé publique hCaptcha (optionnel).
  - `ALLOWED_COUNTRIES` – Liste des pays autorisés (séparés par virgules).
  - `SESSION_SECRET` – Secret pour les sessions.
  - `PORT` – Port du serveur (défaut: 5000).

- **Fichiers de configuration**:
  - `server/secure/config/config.ts` – Configuration centralisée.
  - `data/whitelist.txt` – Liste blanche IP (créé automatiquement).
  - `data/blacklist.txt` – Liste noire IP (créé automatiquement).

### Stockage

- **In-memory** (développement):
  - Flows tracking (Map).
  - Rate limiting (Map).
  - Visitor tracking (Map).
  - Weight cache (Map).

- **Extension possible**:
  - Base de données PostgreSQL (via Drizzle ORM).
  - Fichiers JSON pour persistance.
  - Redis pour cache distribué.

### Logs

- Logs Express via `server/index.ts`:
  - Requêtes API avec méthode, path, status, durée.
  - Erreurs serveur avec stack trace.
- Logs console pour:
  - Détections de bots.
  - Échecs d'envoi Telegram.
  - Erreurs de géolocalisation.

---

## 🔍 Intérêt pour la défense & indicateurs de compromission (IOC)

### Schéma type de kit de phishing avancé

- Séparation claire:
  - **Entrée publique** (`server/index.ts`).
  - **Moteur de sécurité** (`server/secure/panel/*`).
  - **Vues de collecte** (`client/src/pages/*`).
  - **Exfiltration** (`server/secure/app/send.ts`).
  - **Panel** (`client/src/pages/admin.tsx`).

### IOC structurels & fichiers

- Présence de fichiers/modules:
  - `server/secure/panel/` – Modules de sécurité.
  - `server/secure/app/send.ts` – Module d'exfiltration.
  - `server/secure/config/config.ts` – Configuration.
  - `data/whitelist.txt`, `data/blacklist.txt` – Listes IP.

### IOC réseau & API externes

- Requêtes sortantes vers:
  - API Telegram (`https://api.telegram.org/bot.../sendMessage`).
  - Services de géolocalisation IP (ipapi.co, ip-api.com, freegeoip.app).
  - Endpoints API internes (`/api/payment/submit`, `/api/telegram/send`).

### IOC applicatifs

- Headers HTTP spécifiques (si configurés).
- Patterns d'URLs avec session ID dans headers (`X-Session-Id`).
- Structure des messages Telegram (formatage spécifique).

---

## 🎯 Conclusion

Ce projet représente un **exemple complet de kit de phishing avancé**, intégrant:

- Une architecture modulaire autour d'un noyau `server/secure/`.
- Un flux multi-étapes de collecte d'informations sensibles sous protection anti-bot.
- Un système de gestion d'IP, de géolocalisation, de visiteurs & panel.
- Plusieurs points d'exfiltration/surveillance basés sur Telegram.

**⚠️ Usage strictement éducatif et défensif uniquement.**

Pour un usage strictement défensif, cette **documentation complète** permet de:

- Cartographier la surface d'attaque et les étapes de la chaîne malveillante.
- Identifier les fichiers, URLs, patterns et appels réseau à surveiller ou à bloquer.
- Construire des règles de détection (SIEM, IDS/IPS, WAF) et des scénarios de réponse adaptés.

---

## 📚 Références

- Documentation des modules: `server/secure/README.md`
- Configuration: `server/secure/config/config.ts`
- README principal: `README.md`
