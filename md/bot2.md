# Guide Complet - Détection et Blocage des IPs de Datacenter

## 📋 Table des Matières

1. [Comment fonctionne le blocage](#comment-fonctionne-le-blocage)
2. [Détection des IPs de datacenter](#détection-des-ips-de-datacenter)
3. [Intégration dans le projet](#intégration-dans-le-projet)
4. [Configuration sur un autre projet](#configuration-sur-un-autre-projet)

---

## 🔒 Comment fonctionne le blocage

### Vue d'ensemble du système de blocage

Le système de blocage utilise une **approche en cascade** avec des vérifications prioritaires appliquées dans un ordre spécifique pour optimiser les performances et la sécurité.

### Ordre de priorité des vérifications

```
0. Scanner User-Agent (blocage immédiat ~0.1ms)
   ↓
1. Datacenter Detection (blocage prioritaire)
   ↓
2. Blacklist (récidivistes connus)
   ↓
3. Whitelist (utilisateurs autorisés)
   ↓
4. Geo-filter (pays autorisés)
   ↓
5. Analyse complète multi-critères
   ↓
6. hCaptcha adaptatif
   ↓
7. Proof of Work (si nécessaire)
```

### Mécanisme de blocage des datacenters

#### 1. Point d'entrée principal (`index.php`)

Le blocage des datacenters est effectué **en priorité** après la vérification des scanners User-Agent :

```php
// 1. DATACENTER - Bloquer les IPs de datacenter (même pays autorisés)
require_once(__DIR__ . "/secure/panel/datacenter_detection.php");
$botConfig = BotDetection::getConfig();

if (isset($botConfig['block_datacenter_all_countries']) && 
    $botConfig['block_datacenter_all_countries']) {
    
    $dcResult = DatacenterDetection::isDatacenterIP($ip);
    
    if ($dcResult['isDatacenter']) {
        // 1. Logger l'événement
        BotFuckLogger::log($ip, 
            'Datacenter IP blocked: ' . ($dcResult['reason'] ?? 'unknown'), 
            'redirected', 
            '/'
        );
        
        // 2. Ajouter à la blacklist
        $ipManager->addToBlacklist($ip, 
            "Datacenter blocked - " . ($dcResult['org'] ?? 'unknown')
        );
        
        // 3. Rediriger vers une URL aléatoire (honeypot)
        $redirectUrl = $ipManager->getRandomRedirectUrl();
        header("Location: " . $redirectUrl);
        exit;
    }
}
```

**Actions effectuées lors du blocage :**
1. ✅ **Logging** : Enregistrement dans `botfuck.txt` avec toutes les informations
2. ✅ **Blacklist** : Ajout automatique à `blacklist.txt`
3. ✅ **Redirection** : Redirection vers une URL aléatoire (honeypot)
4. ✅ **Sortie immédiate** : `exit` pour empêcher tout traitement ultérieur

#### 2. Point d'entrée sécurisé (`ip_check.php`)

Pour les pages protégées, une vérification supplémentaire avec exception pour les sessions autorisées :

```php
// 0.5. DATACENTER - Bloquer les IPs de datacenter (même pays autorisés)
// SAUF si session datacenter autorisée (a passé le captcha)
if (!isset($_SESSION['is_datacenter'])) {
    $botConfig = BotDetection::getConfig();
    if (isset($botConfig['block_datacenter_all_countries']) && 
        $botConfig['block_datacenter_all_countries']) {
        
        $dcResult = DatacenterDetection::isDatacenterIP($ip);
        
        if ($dcResult['isDatacenter']) {
            BotFuckLogger::log($ip, 
                'Datacenter IP blocked: ' . ($dcResult['reason'] ?? 'unknown'), 
                'redirected', 
                $_SERVER['REQUEST_URI'] ?? '/'
            );
            $ipManager->addToBlacklist($ip, 
                "Datacenter blocked - " . ($dcResult['org'] ?? 'unknown')
            );
            $redirectUrl = $ipManager->getRandomRedirectUrl();
            header("Location: " . $redirectUrl);
            exit;
        }
    }
}
```

**Exception importante :** Si `$_SESSION['is_datacenter']` est défini, l'IP de datacenter est autorisée (utilisateur a passé le captcha).

#### 3. Re-vérifications post-captcha

Même après avoir résolu le captcha, le système effectue des **re-vérifications critiques** :

```php
// Re-vérifier Datacenter (CRITIQUE - les bots de datacenter peuvent passer hCaptcha)
$dcRecheck = DatacenterDetection::isDatacenterIP($ip);
if ($dcRecheck['isDatacenter']) {
    // Datacenter a passé le captcha - autoriser session mais NE PAS whitelister
    BotFuckLogger::log($ip, 
        'Datacenter passed captcha: ' . ($dcRecheck['org'] ?? 'unknown'), 
        'allowed_session', 
        '/'
    );
    $_SESSION['access_validated'] = true;
    $_SESSION['access_validated_time'] = time();
    $_SESSION['is_datacenter'] = true; // Marquer comme datacenter
    // PAS de whitelist - session uniquement
    header("Location: do.php");
    exit;
}
```

**Comportement :** Les datacenters qui passent le captcha obtiennent une **session temporaire** mais ne sont **pas whitelistés**.

---

## 🔍 Détection des IPs de datacenter

### Méthodes de détection

Le système utilise **4 méthodes de détection** en cascade :

#### 1. Flag `hosting` de l'API (Priorité 1)

L'API `ip-api.com` fournit un champ `hosting` qui indique directement si une IP provient d'un hébergeur.

```php
if (isset($data['hosting']) && $data['hosting'] === true) {
    $result['isDatacenter'] = true;
    $result['hosting'] = true;
    $result['reason'] = 'Détecté comme hébergeur par API';
    return $result;
}
```

**Avantage :** Méthode la plus fiable, basée sur les données de l'API.

#### 2. Flag `proxy` de l'API (Priorité 2)

Certains datacenters sont marqués comme proxy par l'API.

```php
if (isset($data['proxy']) && $data['proxy'] === true) {
    $result['isDatacenter'] = true;
    $result['reason'] = 'Détecté comme proxy par API';
    return $result;
}
```

#### 3. Liste d'organisations connues (Priorité 3)

Le système maintient une liste de **60+ organisations** connues pour être des datacenters :

**Cloud Providers Majeurs :**
- Amazon, AWS, EC2
- Google Cloud, Google LLC
- Microsoft, Azure
- DigitalOcean
- OVH, OVHcloud
- Hetzner
- Cloudflare
- Alibaba, Aliyun
- Oracle Cloud
- IBM Cloud, SoftLayer
- Rackspace
- Scaleway
- Vultr, Choopa
- Linode
- Et 40+ autres...

**Scanners de Sécurité :**
- Censys, Shodan, BinaryEdge
- ShadowServer, Rapid7
- Qualys, Tenable, Nessus
- Et autres...

**Vérification :**
```php
$orgLower = strtolower($result['org']);
$ispLower = strtolower($result['isp']);

foreach (self::$datacenterOrganizations as $dcOrg) {
    if (strpos($orgLower, $dcOrg) !== false || 
        strpos($ispLower, $dcOrg) !== false) {
        $result['isDatacenter'] = true;
        $result['reason'] = "Organisation connue: $dcOrg";
        return $result;
    }
}
```

#### 4. Liste d'ASN connus (Priorité 4)

Le système maintient une liste de **30+ ASN** (Autonomous System Number) connus pour être des datacenters :

```php
'AS14061',  // DigitalOcean
'AS16276',  // OVH
'AS24940',  // Hetzner
'AS20473',  // Choopa/Vultr
'AS63949',  // Linode
'AS16509',  // Amazon
'AS15169',  // Google
'AS8075',   // Microsoft
'AS13335',  // Cloudflare
// ... et 20+ autres
```

**Vérification :**
```php
if (!empty($result['asn'])) {
    $asnNumber = strtoupper(explode(' ', $result['asn'])[0]);
    if (in_array($asnNumber, self::$datacenterASNs)) {
        $result['isDatacenter'] = true;
        $result['reason'] = "ASN datacenter: $asnNumber";
        return $result;
    }
}
```

### Système de cache

Le système implémente un **cache intelligent** pour optimiser les performances :

**Durées de cache :**
- **IPs normales :** 24 heures (86400 secondes)
- **IPs datacenter :** 1 heure (3600 secondes) - re-vérification plus fréquente

**Avantages :**
- Réduction drastique des appels API
- Amélioration des temps de réponse (~0.1ms avec cache vs ~200-500ms sans cache)
- Réduction des coûts API

**Gestion automatique :**
- Nettoyage des entrées expirées
- Limite de 1000 entrées (réduction automatique à 500 si dépassé)

### APIs utilisées

**API principale :** `ip-api.com`
```
http://ip-api.com/json/{ip}?fields=status,org,isp,as,hosting,proxy
```

**API alternative :** `ipapi.co` (si la principale échoue)
```
https://ipapi.co/{ip}/json/
```

**Timeout :** 5 secondes par API

---

## 🔌 Intégration dans le projet

### Structure des fichiers

```
projet/
├── index.php                          # Point d'entrée principal
├── do.php                             # Point d'entrée alternatif
├── k7m9x2p/panel/
│   ├── datacenter_detection.php       # Classe principale
│   ├── bot_detection.php              # Système anti-bot
│   ├── bot_detection_config.json      # Configuration
│   ├── botfuck_logger.php             # Logger centralisé
│   ├── ip_manager.php                 # Gestion blacklist/whitelist
│   ├── geo_filter.php                 # Filtrage géographique
│   ├── datacenter_cache.json          # Cache des vérifications
│   └── datacenter_logs.txt            # Logs des détections
├── blacklist.txt                      # Liste des IPs bloquées
└── botfuck.txt                        # Logs centralisés
```

### Points d'intégration

#### 1. Point d'entrée principal (`index.php`)

**Ligne 113-125 :** Vérification prioritaire après les scanners User-Agent

```php
// 1. DATACENTER - Bloquer les IPs de datacenter (même pays autorisés)
require_once(__DIR__ . "/secure/panel/datacenter_detection.php");
$botConfig = BotDetection::getConfig();
if (isset($botConfig['block_datacenter_all_countries']) && 
    $botConfig['block_datacenter_all_countries']) {
    $dcResult = DatacenterDetection::isDatacenterIP($ip);
    if ($dcResult['isDatacenter']) {
        BotFuckLogger::log($ip, 
            'Datacenter IP blocked: ' . ($dcResult['reason'] ?? 'unknown'), 
            'redirected', 
            '/'
        );
        $ipManager->addToBlacklist($ip, 
            "Datacenter blocked - " . ($dcResult['org'] ?? 'unknown')
        );
        $redirectUrl = $ipManager->getRandomRedirectUrl();
        header("Location: " . $redirectUrl);
        exit;
    }
}
```

#### 2. Re-vérification après score élevé (`index.php`)

**Ligne 218-229 :** Re-vérification même si l'IP a passé le premier check

```php
// RE-VÉRIFICATION: Datacenter (même si passé le premier check)
$dcRecheck = DatacenterDetection::isDatacenterIP($ip);
if ($dcRecheck['isDatacenter']) {
    // Datacenter détecté - autoriser session mais NE PAS whitelister
    BotFuckLogger::log($ip, 
        'Datacenter allowed session only: ' . ($dcRecheck['org'] ?? 'unknown'), 
        'allowed_session', 
        '/'
    );
    $_SESSION['access_validated'] = true;
    $_SESSION['access_validated_time'] = time();
    $_SESSION['is_datacenter'] = true; // Marquer comme datacenter
    // PAS de whitelist pour les datacenters
    header("Location: do.php");
    exit;
}
```

#### 3. Re-vérification post-captcha (`index.php`)

**Ligne 294-305 :** Re-vérification après résolution du captcha

```php
// 2. Re-vérifier Datacenter (CRITIQUE - les bots de datacenter peuvent passer hCaptcha)
$dcRecheck = DatacenterDetection::isDatacenterIP($ip);
if ($dcRecheck['isDatacenter']) {
    // Datacenter a passé le captcha - autoriser session mais NE PAS whitelister
    BotFuckLogger::log($ip, 
        'Datacenter passed captcha: ' . ($dcRecheck['org'] ?? 'unknown'), 
        'allowed_session', 
        '/'
    );
    $_SESSION['access_validated'] = true;
    $_SESSION['access_validated_time'] = time();
    $_SESSION['is_datacenter'] = true;
    // PAS de whitelist - session uniquement
    header("Location: do.php");
    exit;
}
```

#### 4. Vérification IP sécurisée (`ip_check.php`)

**Ligne 44-58 :** Vérification avec exception pour sessions autorisées

```php
// 0.5. DATACENTER - Bloquer les IPs de datacenter (même pays autorisés)
// SAUF si session datacenter autorisée (a passé le captcha)
if (!isset($_SESSION['is_datacenter'])) {
    $botConfig = BotDetection::getConfig();
    if (isset($botConfig['block_datacenter_all_countries']) && 
        $botConfig['block_datacenter_all_countries']) {
        $dcResult = DatacenterDetection::isDatacenterIP($ip);
        if ($dcResult['isDatacenter']) {
            BotFuckLogger::log($ip, 
                'Datacenter IP blocked: ' . ($dcResult['reason'] ?? 'unknown'), 
                'redirected', 
                $_SERVER['REQUEST_URI'] ?? '/'
            );
            $ipManager->addToBlacklist($ip, 
                "Datacenter blocked - " . ($dcResult['org'] ?? 'unknown')
            );
            $redirectUrl = $ipManager->getRandomRedirectUrl();
            header("Location: " . $redirectUrl);
            exit;
        }
    }
}
```

### Configuration

**Fichier :** `k7m9x2p/panel/bot_detection_config.json`

```json
{
    "block_datacenter": true,
    "block_datacenter_all_countries": true
}
```

**Interface d'administration :** `k7m9x2p/panel/ozyadmin.php`

---

## 🚀 Configuration sur un autre projet

### Étape 1 : Copier les fichiers nécessaires

Copiez les fichiers suivants dans votre nouveau projet :

```
votre-projet/
├── includes/
│   ├── datacenter_detection.php      # Classe principale
│   ├── botfuck_logger.php            # Logger (optionnel)
│   └── ip_manager.php                 # Gestion blacklist (optionnel)
├── config/
│   └── bot_detection_config.json     # Configuration
└── logs/
    ├── datacenter_cache.json         # Cache (créé automatiquement)
    └── datacenter_logs.txt           # Logs (créé automatiquement)
```

### Étape 2 : Modifier les chemins dans `datacenter_detection.php`

Ajustez les chemins des fichiers dans la méthode `init()` :

```php
private static function init() {
    // Ajustez ces chemins selon votre structure
    self::$logFile = __DIR__ . '/../logs/datacenter_logs.txt';
    self::$cacheFile = __DIR__ . '/../logs/datacenter_cache.json';
}
```

### Étape 3 : Intégration dans votre point d'entrée

#### Exemple minimal

```php
<?php
// Votre fichier index.php ou point d'entrée

// Charger la classe
require_once __DIR__ . '/includes/datacenter_detection.php';

// Obtenir l'IP du visiteur
$ip = $_SERVER['REMOTE_ADDR'] ?? '';

// Vérifier si c'est un datacenter
$dcResult = DatacenterDetection::isDatacenterIP($ip);

if ($dcResult['isDatacenter']) {
    // Bloquer l'accès
    http_response_code(403);
    die('Access denied');
}
```

#### Exemple avec configuration

```php
<?php
// Charger la classe
require_once __DIR__ . '/includes/datacenter_detection.php';

// Charger la configuration
$configFile = __DIR__ . '/config/bot_detection_config.json';
$config = json_decode(file_get_contents($configFile), true) ?? [];

// Obtenir l'IP
$ip = $_SERVER['REMOTE_ADDR'] ?? '';

// Vérifier si le blocage est activé
if (isset($config['block_datacenter']) && $config['block_datacenter']) {
    $dcResult = DatacenterDetection::isDatacenterIP($ip);
    
    if ($dcResult['isDatacenter']) {
        // Logger (si vous avez BotFuckLogger)
        if (class_exists('BotFuckLogger')) {
            BotFuckLogger::log($ip, 
                'Datacenter IP blocked: ' . ($dcResult['reason'] ?? 'unknown'), 
                'redirected', 
                $_SERVER['REQUEST_URI'] ?? '/'
            );
        }
        
        // Ajouter à la blacklist (si vous avez IPManager)
        if (class_exists('IPManager')) {
            $ipManager = new IPManager();
            $ipManager->addToBlacklist($ip, 
                "Datacenter blocked - " . ($dcResult['org'] ?? 'unknown')
            );
        }
        
        // Rediriger ou bloquer
        header("Location: https://www.google.com", true, 301);
        exit;
    }
}
```

### Étape 4 : Configuration

Créez le fichier `config/bot_detection_config.json` :

```json
{
    "block_datacenter": true,
    "block_datacenter_all_countries": true
}
```

**Options disponibles :**
- `block_datacenter` : Activer/désactiver la détection
- `block_datacenter_all_countries` : Bloquer même les pays autorisés

### Étape 5 : Personnaliser les listes

#### Ajouter une organisation

```php
DatacenterDetection::addOrganization('nouveau-hébergeur');
```

#### Ajouter un ASN

```php
DatacenterDetection::addASN('AS99999');
```

#### Modifier directement dans le fichier

Éditez les tableaux `$datacenterOrganizations` et `$datacenterASNs` dans `datacenter_detection.php`.

### Étape 6 : Gestion des permissions

Assurez-vous que les dossiers ont les bonnes permissions :

```bash
chmod 755 logs/
chmod 644 logs/datacenter_cache.json
chmod 644 logs/datacenter_logs.txt
```

### Étape 7 : Test

Créez un fichier de test :

```php
<?php
// test_datacenter.php

require_once __DIR__ . '/includes/datacenter_detection.php';

// Tester avec une IP connue de datacenter
$testIPs = [
    '165.227.255.184', // DigitalOcean
    '8.8.8.8',         // Google (pas un datacenter)
];

foreach ($testIPs as $ip) {
    $result = DatacenterDetection::isDatacenterIP($ip);
    echo "IP: $ip\n";
    echo "Datacenter: " . ($result['isDatacenter'] ? 'OUI' : 'NON') . "\n";
    echo "Raison: " . ($result['reason'] ?? 'N/A') . "\n";
    echo "Organisation: " . ($result['org'] ?? 'N/A') . "\n";
    echo "---\n";
}
```

### Exemple d'intégration complète

```php
<?php
/**
 * Exemple d'intégration complète
 */

// 1. Charger les dépendances
require_once __DIR__ . '/includes/datacenter_detection.php';
require_once __DIR__ . '/includes/botfuck_logger.php';
require_once __DIR__ . '/includes/ip_manager.php';

// 2. Configuration
$configFile = __DIR__ . '/config/bot_detection_config.json';
$config = json_decode(file_get_contents($configFile), true) ?? [
    'block_datacenter' => true,
    'block_datacenter_all_countries' => true
];

// 3. Obtenir l'IP
$ip = $_SERVER['REMOTE_ADDR'] ?? '';

// 4. Ignorer localhost
if (in_array($ip, ['127.0.0.1', '::1', 'localhost'])) {
    // Autoriser localhost
    return;
}

// 5. Vérification datacenter
if ($config['block_datacenter']) {
    $dcResult = DatacenterDetection::isDatacenterIP($ip);
    
    if ($dcResult['isDatacenter']) {
        // Logger
        BotFuckLogger::log($ip, 
            'Datacenter IP blocked: ' . ($dcResult['reason'] ?? 'unknown'), 
            'redirected', 
            $_SERVER['REQUEST_URI'] ?? '/'
        );
        
        // Blacklist
        $ipManager = new IPManager();
        $ipManager->addToBlacklist($ip, 
            "Datacenter blocked - " . ($dcResult['org'] ?? 'unknown')
        );
        
        // Redirection
        header("Location: https://www.google.com", true, 301);
        exit;
    }
}

// 6. Continuer le traitement normal
// ... votre code ...
```

### Optimisations pour production

#### 1. Utiliser un cache Redis (optionnel)

```php
// Exemple avec Redis
if (class_exists('Redis')) {
    $redis = new Redis();
    $redis->connect('127.0.0.1', 6379);
    
    $cacheKey = "dc_check:" . $ip;
    $cached = $redis->get($cacheKey);
    
    if ($cached !== false) {
        $result = json_decode($cached, true);
    } else {
        $result = DatacenterDetection::isDatacenterIP($ip);
        $redis->setex($cacheKey, 3600, json_encode($result));
    }
}
```

#### 2. Limiter les appels API

Utilisez le cache intégré et limitez les vérifications aux nouvelles IPs uniquement.

#### 3. Monitoring

Surveillez les logs pour identifier les patterns :

```php
// Analyser les logs
$logFile = __DIR__ . '/logs/datacenter_logs.txt';
$lines = file($logFile, FILE_IGNORE_NEW_LINES);
$datacenters = [];

foreach ($lines as $line) {
    if (preg_match('/Org: ([^|]+)/', $line, $matches)) {
        $org = trim($matches[1]);
        $datacenters[$org] = ($datacenters[$org] ?? 0) + 1;
    }
}

arsort($datacenters);
print_r($datacenters);
```

---

## 📊 API Publique

### Méthodes disponibles

#### `DatacenterDetection::isDatacenterIP($ip)`

Vérifie si une IP provient d'un datacenter.

**Paramètres :**
- `$ip` (string) : Adresse IP à vérifier

**Retour :**
```php
[
    'isDatacenter' => true/false,
    'hosting' => true/false,
    'org' => 'Nom de l\'organisation',
    'isp' => 'Nom de l\'ISP',
    'asn' => 'AS12345 Nom',
    'reason' => 'Raison de la détection'
]
```

#### `DatacenterDetection::check($ip)`

Vérification simple retournant un booléen.

**Retour :** `true` si datacenter, `false` sinon

#### `DatacenterDetection::addOrganization($org)`

Ajoute une organisation à la liste.

#### `DatacenterDetection::addASN($asn)`

Ajoute un ASN à la liste.

#### `DatacenterDetection::clearCache()`

Vide le cache.

---

## ⚠️ Notes importantes

### Limitations

- **Dépendance API externe :** Si les APIs sont indisponibles, la détection peut échouer
- **Faux positifs possibles :** Certaines IPs résidentielles peuvent être mal classées
- **Faux négatifs possibles :** Nouveaux datacenters non encore dans les listes
- **Rate limiting :** Les APIs gratuites ont des limites de requêtes

### Bonnes pratiques

1. **Surveiller les logs** régulièrement
2. **Mettre à jour les listes** périodiquement
3. **Tester avec des IPs connues** pour valider
4. **Monitorer les performances** des APIs
5. **Ajuster les durées de cache** selon vos besoins

---

## 🔗 Références

- **API ip-api.com :** https://ip-api.com/docs
- **API ipapi.co :** https://ipapi.co/documentation
- **ASN Database :** https://www.iana.org/assignments/as-numbers/as-numbers.xhtml

---

**Date de création :** 2024  
**Version :** 1.0
