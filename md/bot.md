# Rapport d'Intégration - Détection et Blocage des Bots

## 📋 Vue d'ensemble

Le système de détection et blocage des bots est un système multi-couches sophistiqué qui combine **11 mécanismes de détection différents** pour identifier et bloquer les bots, scanners, crawlers et autres entités automatisées. Le système utilise une approche en cascade avec des vérifications rapides en premier, suivies d'analyses plus approfondies.

**Fichier principal :** `k7m9x2p/panel/bot_detection.php`  
**Classe :** `BotDetection`

---

## 🏗️ Architecture

### Structure du système

Le système est organisé en **couches de protection** appliquées dans un ordre de priorité optimisé :

```
1. Scanner User-Agent (blocage immédiat ~0.1ms)
2. Datacenter Detection
3. Blacklist (récidivistes)
4. Whitelist (utilisateurs autorisés)
5. Geo-filter (pays autorisés)
6. Analyse complète multi-critères
7. hCaptcha adaptatif
8. Proof of Work (si nécessaire)
```

### Modules intégrés

Le système charge et utilise plusieurs modules spécialisés :

- `fingerprint.php` - Détection par empreinte navigateur
- `behavior_analysis.php` - Analyse comportementale
- `js_challenge.php` - Challenge JavaScript
- `honeypot.php` - Pièges invisibles
- `datacenter_detection.php` - Détection datacenter
- `proxy_detection.php` - Détection proxy/Tor/VPN
- `hcaptcha.php` - Intégration hCaptcha

---

## 🔍 Mécanismes de Détection

### 1. Détection User-Agent (Priorité 0 - Blocage Immédiat)

**Méthode :** `BotDetection::isKnownScanner()`

**Performance :** ~0.1ms (sans appel API)

**Patterns détectés :**

#### Scanners de Sécurité (Blocage Immédiat)
- **Censys, Shodan, ZGrab** - Scanners de ports/vulnérabilités
- **Nmap, Masscan** - Scanners réseau
- **Nuclei, Nikto, SQLMap** - Scanners de vulnérabilités
- **Dirbuster, Gobuster, Dirb** - Scanners de répertoires
- **WPScan, Acunetix, Nessus** - Scanners spécialisés
- **Burp Suite, OWASP ZAP** - Outils de test de pénétration
- **Et 40+ autres scanners...**

#### Bots Génériques
- **Crawlers :** bot, crawler, spider, scraper
- **Outils :** curl, wget, python, java, go-http
- **Frameworks :** scrapy, beautifulsoup, selenium, phantomjs
- **Moteurs de recherche :** googlebot, bingbot, yandexbot
- **Réseaux sociaux :** facebookbot, twitterbot, linkedinbot
- **SEO :** semrushbot, ahrefsbot, mj12bot
- **Et 30+ autres patterns...**

**Action :** Blocage immédiat + ajout à la blacklist + redirection

### 2. Détection Datacenter

**Méthode :** `DatacenterDetection::isDatacenterIP()`

**Détails :** Voir rapport `datacenterblock.md`

**Action :** Blocage si `block_datacenter_all_countries` est activé

### 3. Vérification des Headers HTTP

**Méthode :** `BotDetection::checkHeaders()`

**Headers requis :**
- `HTTP_ACCEPT`
- `HTTP_ACCEPT_LANGUAGE`
- `HTTP_ACCEPT_ENCODING`

**Détection :** Si 2+ headers manquants → Suspicion

**Pénalité score :** -20 points

### 4. Analyse du Timing

**Méthode :** `BotDetection::checkTiming()`

**Détection :** Requêtes trop rapides (< 0.5 secondes entre requêtes)

**Pénalité score :** -15 points

**Protection :** Délai aléatoire ajouté (500-2000ms) pour éviter les timing attacks

### 5. Vérification Cookie JavaScript

**Méthode :** `BotDetection::checkJSCookie()`

**Détection :** Absence du cookie `js_enabled` (défini par JavaScript côté client)

**Pénalité score :** -10 points

**Note :** Ne bloque pas directement, mais réduit le score de confiance

### 6. Détection Honeypot

**Méthode :** `HoneypotDetection::check()`

**Principe :** Champs cachés dans les formulaires que seuls les bots remplissent

**Champs honeypot :**
- `website_url`, `user_homepage`, `contact_website`
- `company_url`, `fax_number`, `secondary_email`
- `phone_ext`, `website`, `url`, `homepage`

**Techniques de masquage :**
- Position absolue hors écran
- Opacité 0
- Display none
- Visibility hidden
- Clip rect

**Pénalité score :** -50 points (très élevée)

**Action :** Blocage si détecté

### 7. Analyse Comportementale

**Méthode :** `BehaviorAnalysis::getScore()`

**Critères analysés :**
- Mouvements de souris
- Vitesse de frappe
- Patterns de navigation
- Temps de réponse
- Interactions utilisateur

**Score minimum :** 50 (configurable via `min_behavior_score`)

**Pénalité score :** Variable selon le score

### 8. Fingerprint Navigateur

**Méthode :** `Fingerprint::getScore()`

**Critères analysés :**
- User-Agent
- Headers HTTP
- Résolution écran
- Timezone
- Langues
- Plugins
- Canvas fingerprint
- WebGL fingerprint
- Fonts disponibles

**Score minimum :** 50 (configurable via `min_fingerprint_score`)

**Pénalité score :** Variable selon le score

### 9. Challenge JavaScript

**Méthode :** `JSChallenge::hasPassed()`

**Détection :** Vérifie si le challenge JavaScript a été résolu

**Pénalité score :** -15 points si requis mais non passé

### 10. Détection Proxy/Tor/VPN

**Méthode :** `ProxyDetection::checkAll()`

**Types détectés :**
- Proxy
- Tor
- VPN (peut être autorisé selon config)

**Pénalités score :**
- Tor : -30 points
- Proxy : -20 points
- VPN : -10 points

**Action :** Blocage selon configuration (`block_proxy`, `block_tor`, `block_vpn`)

### 11. hCaptcha Adaptatif

**Méthode :** `HCaptcha::shouldShowCaptcha()`

**Modes :**
- **MODE_NONE** : Score >= 70 (pas de captcha)
- **MODE_INVISIBLE** : Score 50-69 (captcha invisible)
- **MODE_NORMAL** : Score 30-49 (captcha normal)
- **MODE_STRICT** : Score < 30 (captcha strict)

**Vérification :** `HCaptcha::verify()` après soumission

**Action :** Blocage si requis mais non vérifié

---

## 🎯 Système de Score Global

### Calcul du Score

Le système calcule un **score de confiance** (0-100) basé sur tous les critères :

```php
Score initial : 100

- User-Agent Scanner : -80 points
- User-Agent Bot : -40 points
- Headers manquants : -20 points
- Timing suspect : -15 points
- Cookie JS manquant : -10 points
- Honeypot déclenché : -50 points
- Datacenter : -25 points
- Tor : -30 points
- Proxy : -20 points
- VPN : -10 points
- Comportement faible : Variable
- Fingerprint faible : Variable
- JS Challenge manquant : -15 points
```

**Score final :** `max(0, min(100, score))`

### Décisions basées sur le score

- **Score >= 70 :** Accès direct autorisé (pas de captcha)
- **Score 50-69 :** hCaptcha invisible requis
- **Score 30-49 :** hCaptcha normal requis
- **Score < 30 :** hCaptcha strict requis
- **Score < 50 OU flags critiques :** Blocage immédiat

---

## 🚨 Actions de Blocage

### Ordre de Priorité des Vérifications

```
0. Scanner User-Agent → Blocage immédiat (~0.1ms)
1. Datacenter → Blocage si configuré
2. Blacklist → Blocage des récidivistes
3. Whitelist → Vérification utilisateurs autorisés
4. Geo-filter → Blocage pays non autorisés
5. Analyse complète → Score global
6. hCaptcha → Si score faible
7. Proof of Work → Si score très faible
```

### Types de Blocage

#### 1. Blocage Immédiat (Scanner UA)

```php
// index.php ligne 104-111
$scannerCheck = BotDetection::isKnownScanner();
if ($scannerCheck['isScanner']) {
    BotFuckLogger::log($ip, 'Scanner UA blocked', 'redirected', '/');
    $ipManager->addToBlacklist($ip, "Scanner blocked");
    $redirectUrl = $ipManager->getRandomRedirectUrl();
    header("Location: " . $redirectUrl);
    exit;
}
```

**Action :**
- Logging immédiat
- Ajout à la blacklist
- Redirection vers URL aléatoire (honeypot)

#### 2. Blocage par Score (Bot Détecté)

```php
// index.php ligne 252-263
if ($botResults['overall']['isBot']) {
    $botReasons = implode(', ', $botResults['overall']['flags']);
    BotFuckLogger::logBotDetected($ip, $botReasons);
    $ipManager->addToBlacklist($ip, "Bot detected - $botReasons");
    header('X-Robots-Tag: noindex, nofollow');
    header("Location: https://www.google.com", true, 301);
    exit;
}
```

**Action :**
- Logging avec détails
- Ajout à la blacklist
- Redirection vers Google
- Header `X-Robots-Tag: noindex, nofollow`

#### 3. Blocage par hCaptcha

Si hCaptcha requis mais non vérifié :

```php
if ($results['hcaptcha']['required'] && !$results['hcaptcha']['verified']) {
    $isBot = true;
    $reasons[] = 'hCaptcha: non vérifié';
}
```

**Action :** Blocage avec raison "hCaptcha non vérifié"

#### 4. Blocage par Honeypot

```php
if ($results['honeypot']['isBot']) {
    $isBot = true;
    $reasons[] = 'Honeypot: ' . $results['honeypot']['reason'];
}
```

**Action :** Blocage immédiat (score -50)

---

## 📊 Logging et Monitoring

### Système de Logging Centralisé

**Classe :** `BotFuckLogger`

**Fichier de log :** `botfuck.txt` (racine)

**Format des logs :**
```
[2024-01-15 14:30:25] | IP: 192.168.1.1 | COUNTRY: US | PATH: / | ACTION: redirected | REASON: Bot detected - scanner, headers | UA: curl/7.68.0
```

**Informations enregistrées :**
- Timestamp
- Adresse IP
- Code pays
- Chemin demandé
- Action effectuée (redirected, blocked, allowed)
- Raison du blocage
- User-Agent

### Méthodes de Logging

#### `BotFuckLogger::log()`
Log générique avec toutes les informations

#### `BotFuckLogger::logBotDetected()`
Log spécifique pour bots détectés + ajout automatique à la blacklist

#### `BotFuckLogger::logGeoBlocked()`
Log pour blocages géographiques

#### `BotFuckLogger::logBlacklisted()`
Log pour IPs déjà blacklistées

#### `BotFuckLogger::logBotTrap()`
Log pour déclenchements de bot-trap

#### `BotFuckLogger::logRateLimited()`
Log pour dépassements de rate limit

### Statistiques

**Méthode :** `BotFuckLogger::getStats()`

**Retourne :**
- Total de bots bloqués
- Bots bloqués aujourd'hui
- Top 10 par raison
- Top 10 par IP
- Top 10 par chemin
- Top 10 par pays

### Logs Bot Detection

**Fichier :** `k7m9x2p/panel/bot_logs.txt`

**Format :**
```
2024-01-15 14:30:25 | IP: 192.168.1.1 | Country: US | Reason: User-Agent: Pattern détecté: curl | Headers: OK | Timing: OK
```

**Méthode :** `BotDetection::logSuspiciousActivity()`

---

## ⚙️ Configuration

### Fichier de Configuration

**Fichier :** `k7m9x2p/panel/bot_detection_config.json`

**Paramètres disponibles :**

```json
{
    "enabled": true,                          // Activer/désactiver le système
    "user_agent_check": true,                 // Vérification User-Agent
    "header_check": true,                     // Vérification headers
    "timing_check": true,                     // Vérification timing
    "js_cookie_check": true,                  // Vérification cookie JS
    "fingerprint_check": true,                // Vérification fingerprint
    "behavior_check": true,                   // Analyse comportementale
    "js_challenge_check": true,               // Challenge JavaScript
    "honeypot_check": true,                   // Détection honeypot
    "datacenter_check": true,                 // Détection datacenter
    "proxy_check": true,                     // Détection proxy
    "tor_check": true,                        // Détection Tor
    "vpn_check": true,                        // Détection VPN
    "hcaptcha_check": true,                   // hCaptcha adaptatif
    "min_behavior_score": 50,                 // Score comportement minimum
    "min_fingerprint_score": 50,              // Score fingerprint minimum
    "block_datacenter": true,                 // Bloquer datacenter
    "block_datacenter_all_countries": true,   // Bloquer datacenter même pays autorisés
    "block_proxy": true,                      // Bloquer proxy
    "block_tor": true,                        // Bloquer Tor
    "block_vpn": true                         // Bloquer VPN
}
```

### Interface d'Administration

**Fichier :** `k7m9x2p/panel/ozyadmin.php`

**Section :** "Configuration Anti-Bot"

**Fonctionnalités :**
- Activer/désactiver chaque protection individuellement
- Ajuster les scores minimums
- Configurer les actions de blocage
- Voir les statistiques
- Consulter les logs

### Méthodes de Configuration

#### `BotDetection::getConfig()`
Retourne la configuration actuelle

#### `BotDetection::setConfig($newConfig)`
Met à jour la configuration

#### `BotDetection::toggleProtection($protection, $enabled)`
Active/désactive une protection spécifique

---

## 🔄 Flux de Traitement Complet

### Flux Principal (index.php)

```
1. Requête entrante
   ↓
2. Extraction IP
   ↓
3. Rate Limiting
   ↓
4. Vérification Scanner UA → BLOQUÉ si détecté
   ↓
5. Vérification Datacenter → BLOQUÉ si détecté
   ↓
6. Vérification Blacklist → BLOQUÉ si présent
   ↓
7. Vérification Whitelist → AUTORISÉ si présent
   ↓
8. Vérification Geo-filter → BLOQUÉ si pays non autorisé
   ↓
9. Analyse complète multi-critères
   ├─ User-Agent
   ├─ Headers
   ├─ Timing
   ├─ Cookie JS
   ├─ Honeypot
   ├─ Datacenter
   ├─ Proxy/Tor/VPN
   ├─ Comportement
   ├─ Fingerprint
   ├─ JS Challenge
   └─ Calcul score global
   ↓
10. Score >= 70 ?
    ├─ OUI → Accès direct autorisé
    └─ NON → Continuer
   ↓
11. hCaptcha requis ?
    ├─ OUI → Afficher captcha
    └─ NON → Continuer
   ↓
12. Proof of Work requis ?
    ├─ OUI → Afficher PoW
    └─ NON → Continuer
   ↓
13. Bot détecté (score < 50) ?
    ├─ OUI → BLOQUÉ + Blacklist + Redirection Google
    └─ NON → Autoriser
```

### Vérifications Post-Captcha

Même après avoir résolu le captcha, le système effectue des **re-vérifications critiques** :

```php
// Re-vérifier Scanner UA (les bots peuvent résoudre captcha via services)
$scannerRecheck = BotDetection::isKnownScanner();
if ($scannerRecheck['isScanner']) {
    // BLOQUÉ même après captcha
}

// Re-vérifier Datacenter
$dcRecheck = DatacenterDetection::isDatacenterIP($ip);
if ($dcRecheck['isDatacenter']) {
    // Autoriser session mais NE PAS whitelister
    $_SESSION['is_datacenter'] = true;
}
```

---

## 🛡️ Protection Anti-Bypass

### Techniques de Protection

#### 1. Délai Aléatoire
```php
BotDetection::addDelay(); // 500-2000ms aléatoire
```
Empêche les timing attacks et ralentit les bots

#### 2. Re-vérifications Multiples
- Vérification initiale (Scanner UA)
- Vérification après score élevé
- Vérification après captcha résolu
- Vérification à chaque point d'entrée

#### 3. Session Validation
```php
if (!isset($_SESSION['access_validated'])) {
    // Accès direct suspect → BLACKLIST IMMÉDIAT
}
```
Les bots qui accèdent directement aux pages protégées sont blacklistés

#### 4. Blacklist Automatique
Tous les bots détectés sont automatiquement ajoutés à la blacklist

#### 5. Redirections Aléatoires
Les bots sont redirigés vers des URLs aléatoires (honeypots) au lieu de pages d'erreur

#### 6. Headers Anti-Indexation
```php
header('X-Robots-Tag: noindex, nofollow');
```
Empêche l'indexation des pages de blocage

---

## 📈 Performance et Optimisation

### Temps de Réponse

- **Scanner UA :** ~0.1ms (vérification locale)
- **Blacklist/Whitelist :** ~1-5ms (lecture fichier)
- **Analyse complète :** ~50-200ms (selon APIs)
- **hCaptcha :** ~100-300ms (vérification API)

### Optimisations

1. **Vérifications rapides en premier** : Scanner UA avant toute autre vérification
2. **Cache des résultats** : Datacenter et proxy utilisent des caches
3. **Délais conditionnels** : Délai ajouté seulement si nécessaire
4. **APIs en parallèle** : Quand possible, les vérifications sont parallélisées

---

## 🎯 Cas d'Usage

### Cas 1 : Scanner de Sécurité

**Scénario :** Un scanner Nmap tente d'accéder au site

**Flux :**
1. User-Agent détecté : "nmap"
2. Blocage immédiat (~0.1ms)
3. Ajout à la blacklist
4. Redirection vers honeypot
5. Log enregistré

**Résultat :** Bloqué avant toute autre vérification

### Cas 2 : Bot avec Score Faible

**Scénario :** Un bot avec User-Agent suspect mais pas de scanner

**Flux :**
1. Scanner UA : Non détecté
2. Analyse complète : Score = 35
3. hCaptcha strict requis
4. Bot ne résout pas le captcha
5. Blocage avec raison "hCaptcha non vérifié"

**Résultat :** Bloqué après analyse

### Cas 3 : Honeypot Déclenché

**Scénario :** Un bot remplit un champ honeypot dans un formulaire

**Flux :**
1. Formulaire soumis
2. Honeypot détecté rempli
3. Score -50 points
4. Score final < 50
5. Blocage immédiat

**Résultat :** Bloqué avec raison "Honeypot"

### Cas 4 : Utilisateur Légitime

**Scénario :** Un utilisateur réel avec navigateur normal

**Flux :**
1. Scanner UA : Non détecté
2. Analyse complète : Score = 85
3. Score >= 70 → Accès direct
4. Ajout à la whitelist
5. Session validée

**Résultat :** Accès autorisé sans captcha

### Cas 5 : Bot qui Résout le Captcha

**Scénario :** Un bot utilise un service de résolution de captcha

**Flux :**
1. Score faible → hCaptcha requis
2. Bot résout le captcha via service
3. **Re-vérification Scanner UA** → Détecté
4. Blocage même après captcha résolu

**Résultat :** Bloqué par re-vérification

---

## 🔧 API Publique

### Méthodes Principales

#### `BotDetection::checkBot($options = [])`

Vérifie si la requête actuelle provient d'un bot.

**Retour :** `bool` - `true` si bot détecté

**Exemple :**
```php
if (BotDetection::checkBot()) {
    // Bloquer
}
```

#### `BotDetection::analyzeAll($options = [])`

Analyse complète sans blocage, retourne tous les résultats.

**Retour :** Array avec tous les résultats de détection

**Exemple :**
```php
$results = BotDetection::analyzeAll();
$score = $results['overall']['score'];
if ($score < 50) {
    // Bot probable
}
```

#### `BotDetection::isKnownScanner()`

Vérification rapide si c'est un scanner connu.

**Retour :** Array avec `isScanner`, `pattern`, `reason`

**Exemple :**
```php
$check = BotDetection::isKnownScanner();
if ($check['isScanner']) {
    // Blocage immédiat
}
```

#### `BotDetection::getConfig()`

Retourne la configuration actuelle.

#### `BotDetection::setConfig($newConfig)`

Met à jour la configuration.

#### `BotDetection::getRecentLogs($limit = 100)`

Retourne les logs récents.

#### `BotDetection::getStats()`

Retourne les statistiques de détection.

---

## 📝 Fichiers et Logs

### Fichiers de Logs

1. **`botfuck.txt`** (racine)
   - Logs centralisés de tous les bots bloqués
   - Format structuré avec IP, pays, raison, UA

2. **`k7m9x2p/panel/bot_logs.txt`**
   - Logs détaillés de l'analyse anti-bot
   - Raisons de suspicion

3. **`k7m9x2p/panel/datacenter_logs.txt`**
   - Logs spécifiques aux datacenters détectés

4. **`k7m9x2p/panel/honeypot_logs.txt`**
   - Logs des déclenchements de honeypot

### Fichiers de Configuration

1. **`k7m9x2p/panel/bot_detection_config.json`**
   - Configuration principale du système anti-bot

2. **`blacklist.txt`** (racine)
   - Liste des IPs blacklistées
   - Ajout automatique lors des détections

3. **`whitelist.txt`** (racine)
   - Liste des IPs whitelistées
   - Utilisateurs légitimes

---

## 🔮 Améliorations Futures

### Suggestions d'amélioration

1. **Machine Learning** : Détection basée sur l'apprentissage automatique
2. **Graphique de comportement** : Visualisation des patterns de bots
3. **API de statistiques** : Endpoint REST pour consulter les stats
4. **Notifications temps réel** : Alertes Telegram/Discord pour pics de bots
5. **Whitelist dynamique** : Apprentissage automatique des utilisateurs légitimes
6. **Rate limiting adaptatif** : Ajustement automatique selon la charge
7. **Détection de patterns** : Identification de campagnes coordonnées
8. **Export de logs** : Export CSV/JSON pour analyse externe
9. **Dashboard temps réel** : Interface web pour monitoring en direct
10. **Intégration Threat Intelligence** : Vérification contre bases de données de menaces

---

## 📚 Références

### Modules Associés

- **Datacenter Detection** : Voir `datacenterblock.md`
- **Proxy Detection** : `k7m9x2p/panel/proxy_detection.php`
- **Fingerprint** : `k7m9x2p/panel/fingerprint.php`
- **Behavior Analysis** : `k7m9x2p/panel/behavior_analysis.php`
- **Honeypot** : `k7m9x2p/panel/honeypot.php`
- **hCaptcha** : `k7m9x2p/panel/hcaptcha.php`
- **JS Challenge** : `k7m9x2p/panel/js_challenge.php`

### APIs Externes

- **ip-api.com** : Géolocalisation et détection datacenter
- **hCaptcha API** : Vérification des captchas
- **ipapi.co** : API alternative de géolocalisation

---

## ⚠️ Notes Techniques

### Dépendances

- PHP 7.0+
- Extension `json` (standard)
- Extension `session` (standard)
- Accès réseau pour les APIs externes
- Permissions d'écriture pour les fichiers de logs et cache

### Limitations

- **Dépendance APIs externes** : Si les APIs sont indisponibles, certaines vérifications peuvent échouer
- **Faux positifs possibles** : Certains utilisateurs légitimes peuvent être bloqués
- **Faux négatifs possibles** : Bots sophistiqués peuvent contourner certaines protections
- **Performance** : L'analyse complète peut prendre 50-200ms

### Bonnes Pratiques

1. **Surveiller les logs** régulièrement pour identifier les patterns
2. **Ajuster les scores** selon les faux positifs/négatifs observés
3. **Mettre à jour les patterns** de scanners régulièrement
4. **Tester avec des bots connus** pour valider les détections
5. **Monitorer les performances** des APIs externes
6. **Réviser la whitelist** périodiquement
7. **Analyser les statistiques** pour optimiser les seuils

---

**Date de création :** 2024  
**Version :** 1.0  
**Auteur :** Système d'intégration automatique
