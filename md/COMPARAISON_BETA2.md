# Comparaison : courier-guuy (actuel) vs beta2

## Vue d'ensemble

| Aspect | **courier-guuy** (projet actuel) | **beta2** |
|--------|-----------------------------------|-----------|
| **Backend** | Node.js + Express (TypeScript) | PHP 7+ (Apache) |
| **Frontend** | React + Vite + Tailwind + Shadcn UI | PHP (HTML/CSS/JS) + répertoires obfusqués |
| **Architecture** | API REST + SPA (single app) | Pages PHP + chemins randomisés (k7m9x2p, r4t8w1n, q3z6y9b) |
| **Scénario** | Clone "The Courier Guy" (tracking colis) | Clone type banque (HSBC, login/OTP/carte) |
| **Config** | Fichiers JSON + .env | Fichiers PHP (config.php) + JSON (panel) |
| **Admin** | OzyAdmin (React, /admin ou /ozyadmin) | OzyAdmin (PHP, k7m9x2p/panel/ozyadmin.php) |

---

## Architecture des dossiers

### courier-guuy

```
courier-guuy/
├── client/                 # Frontend React
│   └── src/pages/          # home, payment, vbv, ozyadmin, vbv-panel…
├── server/
│   ├── index.ts             # Point d'entrée Express + Vite (dev)
│   ├── routes.ts            # Toutes les API + intégration panel
│   ├── middleware/          # antibot, datacenter-blocker, security-headers, rate-limit
│   ├── secure/
│   │   ├── panel/           # Modules sécurité (TS)
│   │   │   ├── ip-manager, geo-filter, datacenter-detection,
│   │   │   ├── proxy-detection, bot-detection, botfuck-logger,
│   │   │   ├── honeypot, js-challenge, rate-limiter, etc.
│   │   └── app/send.ts      # Envoi Telegram
│   └── services/            # bin-checker, geo-filter-service, vbv-panel-service…
├── allowed-countries.json
├── antibot-config.json
├── whitelist.txt / blacklist.txt
├── botfuck.txt
├── datacenterblock.md
└── bot.md
```

### beta2

```
beta2/
├── index.php                # Point d'entrée, session, filtres (UA, datacenter, geo…)
├── do.php                   # Redirection après validation
├── k7m9x2p/                 # Répertoire “obfusqué”
│   ├── index.php
│   ├── .htaccess
│   ├── f9s4d7m/config.php   # Config Telegram
│   ├── j5h2c8v/send.php     # Envoi Telegram
│   ├── panel/               # Tous les modules sécurité + admin
│   │   ├── ozyadmin.php     # Panel admin (Telegram, Geo, Anti-Bot, IP, Logs, Docs)
│   │   ├── datacenter_detection.php, proxy_detection.php, bot_detection.php
│   │   ├── geo_filter.php, ip_manager.php, botfuck_logger.php
│   │   ├── hcaptcha.php, honeypot.php, js_challenge.php, proof_of_work.php
│   │   ├── behavior_analysis.php, mouse_dynamics.php, webgl_fingerprint.php
│   │   ├── datacenter_logs.txt, proxy_logs.txt, bot_logs.txt
│   │   └── allowed_countries.json, bot_detection_config.json
│   ├── q3z6y9b/             # Assets (CSS, img, JS: behavior, fingerprint…)
│   └── r4t8w1n/             # Pages “étapes” (f7k2m9x, h9c3y7b, ip_check.php…)
├── whitelist.txt
├── blacklist.txt
├── botfuck.txt
├── datacenterblock.md
└── bot.md
```

---

## Modules de sécurité

| Module | courier-guuy | beta2 |
|--------|--------------|--------|
| **IP (whitelist/blacklist)** | ✅ `ip-manager.ts` | ✅ `ip_manager.php` |
| **Geo (pays autorisés)** | ✅ `geo-filter` + filtre sur **toutes** les IP (redirection Google) | ✅ `geo_filter.php` |
| **Rate limiting** | ✅ `rate-limiter.ts` (désactivé en dev) | ✅ `rate_limiter.php` |
| **Datacenter** | ✅ `datacenter-detection.ts` + `datacenter-blocker.ts` | ✅ `datacenter_detection.php` |
| **Proxy / VPN / Tor** | ✅ `proxy-detection.ts` (intégré dans antibot) | ✅ `proxy_detection.php` + logs dédiés |
| **Anti-bot (UA, headers, score)** | ✅ `antibot-middleware.ts` (config JSON) | ✅ `bot_detection.php` (config JSON) |
| **Honeypot** | ✅ `honeypot.ts` (payment, routes) | ✅ `honeypot.php` |
| **Logs centralisés** | ✅ `botfuck-logger.ts` → botfuck.txt | ✅ `botfuck_logger.php` → botfuck.txt |
| **Headers sécurité** | ✅ `security-headers.ts` | ✅ Headers dans index.php |
| **hCaptcha** | ⚠️ Module présent, pas forcément utilisé partout | ✅ Intégré (adaptatif) |
| **Proof of Work** | ✅ Module présent | ✅ Utilisé |
| **JS Challenge** | ✅ Module présent (antibot) | ✅ Utilisé |
| **Mouse dynamics** | ✅ Module présent | ✅ Utilisé |
| **WebGL / Fingerprint** | ✅ Module présent | ✅ Utilisé |
| **Behavior analysis** | ✅ Module présent | ✅ Utilisé |
| **BIN carte** | ✅ `bin-checker.ts` (payment → Telegram) | ✅ Via API (config) |
| **Visitor / session** | ✅ visitId (client) + VBV panel (session carte) | ✅ Session PHP + visitor_manager |

En courier-guuy, la chaîne d’entrée (middleware) applique : whitelist → blacklist → **geo pour toutes les IP** → antibot (config) ; datacenter et proxy sont intégrés dans cette chaîne.

---

## Flux utilisateur et scénario

### courier-guuy (The Courier Guy)

1. `/` → Security check (type Cloudflare)
2. `/home` → Suivi colis + infos livraison
3. `/payment` → Carte (BIN vérifié, envoi Telegram + rappel session pour 3DS)
4. `/payment-verification` → Écran “vérification”
5. `/vbv` → 3D Secure / OTP (message Telegram formaté + rappel session)
6. `/success` → Confirmation

Données envoyées à Telegram : carte (avec BIN), puis OTP 3DS avec rappel carte depuis la session.

### beta2 (type banque / HSBC)

1. `index.php` → Filtres (UA, datacenter, blacklist, whitelist, geo)
2. `do.php` → Redirection
3. Pages dans `r4t8w1n/` : login, security key, OTP, infos perso, carte, etc.
4. Chaque page peut inclure `ip_check.php` (UA, datacenter, session, blacklist, whitelist, geo)

Scénario orienté “banque” (identité, OTP, carte) avec chemins obfusqués.

---

## Panel admin (OzyAdmin)

| Fonctionnalité | courier-guuy | beta2 |
|----------------|--------------|--------|
| **Auth** | Session cookie (API) | Session PHP (mot de passe en dur dans ozyadmin.php) |
| **Telegram** | Bot token + Chat IDs (API + formulaire) | Config lue/écrite dans config.php |
| **Pays autorisés (Geo)** | Liste + add/remove (API) | Liste + add/remove (ozyadmin) |
| **Anti-Bot** | Config JSON (antibot-config.json) via API | Config JSON (bot_detection_config.json) |
| **IP Lists** | Whitelist / Blacklist (fichiers + API) | Idem (fichiers + formulaire) |
| **Analyse IP** | Endpoint /api/ozyadmin/analyze (geo, datacenter, proxy) | Section “Analyse IP” dans ozyadmin |
| **Logs** | Onglet Logs (table parsée + stats by_country, by_reason) | Onglet Logs (botfuck + datacenter + proxy en table) |
| **Documentation** | Onglet Docs (datacenterblock.md, bot.md servis par API) | Fichiers .md à la racine (pas d’intégration dans le panel) |
| **Design** | Style “terminal” (noir, emerald, monospace) | HTML/CSS classique |
| **VBV / Suivi visiteurs** | Page vbv-panel (clients en attente OTP, redirect) | Dash/refresh dans panel (contexte différent) |

En courier-guuy, l’admin est une SPA (React) avec onglets Dashboard, Telegram, Geo, Anti-Bot, IP Lists, Analyze, Logs, **Docs**.

---

## Documentation intégrée

| Doc | courier-guuy | beta2 |
|-----|--------------|--------|
| **datacenterblock.md** | Servi par GET /api/ozyadmin/docs?doc=datacenterblock, affiché dans l’onglet Docs | Présent à la racine, non servi dans le panel |
| **bot.md** | Servi par GET /api/ozyadmin/docs?doc=bot, affiché dans l’onglet Docs | Présent à la racine, non servi dans le panel |

Courier-guuy intègre donc ces deux docs directement dans l’admin ; beta2 les a comme fichiers à part.

---

## Détection et blocage

| Règle | courier-guuy | beta2 |
|-------|--------------|--------|
| **Pays non autorisé** | Redirection vers Google (toutes les IP, sauf whitelist) | Redirection / blocage (geo_filter) |
| **Datacenter** | Blocage si activé (antibot-config) ; pays autorisés ou tous | Blocage si config (block_datacenter_all_countries) ; idem |
| **Proxy / VPN / Tor** | Pris en compte dans le score antibot (optionnel block) | Détection + logs dédiés (proxy_logs.txt) |
| **Scanner UA** | Blocage si User-Agent “scanner” (antibot) | Blocage immédiat (isKnownScanner) |
| **Honeypot** | Vérification sur payment submit | Vérification sur formulaires |
| **Logs** | botfuck.txt (format avec timestamp, IP, raison, action, details JSON) | botfuck.txt + datacenter_logs.txt + proxy_logs.txt |

---

## Déploiement et exécution

| | courier-guuy | beta2 |
|-|--------------|--------|
| **Runtime** | Node.js (tsx en dev, node dist en prod) | PHP (Apache/Nginx + PHP-FPM) |
| **Build** | `npm run build` (client + server) | Pas de build (fichiers PHP servis tels quels) |
| **Dev** | `npm run dev` (Express + Vite, un port) | Serveur PHP ou Apache sur un vhost |
| **Config** | .env, allowed-countries.json, antibot-config.json, whitelist/blacklist | config.php, panel/*.json, whitelist/blacklist |
| **Persistance** | Fichiers (logs, listes IP, config) + mémoire (VBV clients, etc.) | Fichiers (logs, JSON, listes) + sessions PHP |

---

## Synthèse

- **courier-guuy** : stack Node/React/TypeScript, un seul front (Courier Guy), API centralisées, middleware unique (antibot + geo pour toutes les IP + datacenter + proxy), admin avec onglet Docs (datacenterblock.md, bot.md), design admin “terminal”.
- **beta2** : stack PHP, scénario type banque, chemins obfusqués, plusieurs points d’entrée (index, do, ip_check dans les pages), logs séparés (bot, datacenter, proxy), docs .md présents mais pas intégrés au panel.

Les deux projets couvrent des besoins proches (filtrage geo, datacenter, proxy, anti-bot, honeypot, BIN, Telegram, OzyAdmin). La principale différence est l’architecture (SPA + API vs PHP multipage) et l’intégration de la doc (Docs dans l’admin en courier-guuy vs fichiers seuls en beta2).
