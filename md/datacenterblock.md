# Rapport d'Intégration - Détection et Blocage des IPs Datacenter

## 📋 Vue d'ensemble

Le système de détection des IPs de datacenter est un composant critique de la sécurité de l'application. Il identifie et bloque automatiquement les connexions provenant de serveurs d'hébergement, de cloud providers, et de datacenters, même si ces IPs proviennent de pays normalement autorisés.

**Fichier principal :** `k7m9x2p/panel/datacenter_detection.php`  
**Classe :** `DatacenterDetection`

---

## 🏗️ Architecture

### Structure de la classe

La classe `DatacenterDetection` est une classe statique qui implémente :

- **Détection multi-critères** : Utilise plusieurs méthodes pour identifier les datacenters
- **Système de cache** : Optimise les performances en évitant les appels API répétés
- **APIs multiples** : Supporte une API principale et une API de secours
- **Logging automatique** : Enregistre toutes les détections de datacenters

### Fichiers associés

```
k7m9x2p/panel/
├── datacenter_detection.php      # Classe principale
├── datacenter_cache.json          # Cache des vérifications IP
└── datacenter_logs.txt            # Logs des détections
```

---

## 🔍 Méthodes de Détection

Le système utilise **4 méthodes de détection** en cascade, appliquées dans l'ordre suivant :

### 1. Flag `hosting` de l'API (Priorité 1)

L'API `ip-api.com` fournit un champ `hosting` qui indique directement si une IP provient d'un hébergeur.

```php
if (isset($data['hosting']) && $data['hosting'] === true) {
    $result['isDatacenter'] = true;
    $result['reason'] = 'Détecté comme hébergeur par API';
}
```

**Avantage :** Méthode la plus fiable, basée sur les données de l'API.

### 2. Flag `proxy` de l'API (Priorité 2)

Certains datacenters sont marqués comme proxy par l'API.

```php
if (isset($data['proxy']) && $data['proxy'] === true) {
    $result['isDatacenter'] = true;
    $result['reason'] = 'Détecté comme proxy par API';
}
```

### 3. Liste d'organisations connues (Priorité 3)

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
- Censys
- Shodan
- BinaryEdge
- ShadowServer
- Rapid7
- Qualys
- Tenable
- Nessus
- Et autres...

La vérification compare les champs `org` et `isp` de l'API avec cette liste.

### 4. Liste d'ASN connus (Priorité 4)

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

---

## 🔌 Intégration dans le Système

### Points d'intégration

Le système de détection des datacenters est intégré à **2 points critiques** :

#### 1. Point d'entrée principal (`index.php`)

**Ligne 113-125 :** Vérification prioritaire après les scanners User-Agent

```php
// 1. DATACENTER - Bloquer les IPs de datacenter (même pays autorisés)
require_once(__DIR__ . "/secure/panel/datacenter_detection.php");
$botConfig = BotDetection::getConfig();
if (isset($botConfig['block_datacenter_all_countries']) && $botConfig['block_datacenter_all_countries']) {
    $dcResult = DatacenterDetection::isDatacenterIP($ip);
    if ($dcResult['isDatacenter']) {
        BotFuckLogger::log($ip, 'Datacenter IP blocked: ' . ($dcResult['reason'] ?? 'unknown'), 'redirected', '/');
        $ipManager->addToBlacklist($ip, "Datacenter blocked - " . ($dcResult['org'] ?? 'unknown'));
        $redirectUrl = $ipManager->getRandomRedirectUrl();
        header("Location: " . $redirectUrl);
        exit;
    }
}
```

**Ordre de priorité :**
1. Scanner User-Agent (blocage immédiat, ~0.1ms)
2. **Datacenter** (blocage prioritaire)
3. Blacklist
4. Whitelist
5. Geo-filter

#### 2. Vérification IP sécurisée (`k7m9x2p/r4t8w1n/ip_check.php`)

**Ligne 44-58 :** Vérification avec exception pour sessions autorisées

```php
// 0.5. DATACENTER - Bloquer les IPs de datacenter (même pays autorisés)
// SAUF si session datacenter autorisée (a passé le captcha)
if (!isset($_SESSION['is_datacenter'])) {
    $botConfig = BotDetection::getConfig();
    if (isset($botConfig['block_datacenter_all_countries']) && $botConfig['block_datacenter_all_countries']) {
        $dcResult = DatacenterDetection::isDatacenterIP($ip);
        if ($dcResult['isDatacenter']) {
            BotFuckLogger::log($ip, 'Datacenter IP blocked: ' . ($dcResult['reason'] ?? 'unknown'), 'redirected', $_SERVER['REQUEST_URI'] ?? '/');
            $ipManager->addToBlacklist($ip, "Datacenter blocked - " . ($dcResult['org'] ?? 'unknown'));
            $redirectUrl = $ipManager->getRandomRedirectUrl();
            header("Location: " . $redirectUrl);
            exit;
        }
    }
}
```

**Exception :** Si `$_SESSION['is_datacenter']` est défini, l'IP de datacenter est autorisée (utilisateur a passé le captcha).

---

## ⚙️ Configuration

### Paramètre de configuration

Le blocage des datacenters est contrôlé par le paramètre :

```json
{
    "block_datacenter_all_countries": true
}
```

**Fichier de configuration :** `k7m9x2p/panel/bot_detection_config.json`

### Interface d'administration

Le paramètre peut être modifié via l'interface d'administration :

- **Fichier :** `k7m9x2p/panel/ozyadmin.php`
- **Section :** "Actions de blocage"
- **Checkbox :** "🛡️ Bloquer Datacenter (même pays autorisés)"

### Comportement

- **Si `true` :** Toutes les IPs de datacenter sont bloquées, même si elles proviennent de pays autorisés
- **Si `false` :** Les IPs de datacenter ne sont pas bloquées automatiquement

---

## 🚀 Performance et Optimisation

### Système de cache

Le système implémente un cache intelligent pour optimiser les performances :

**Durées de cache :**
- **IPs normales :** 24 heures (86400 secondes)
- **IPs datacenter :** 1 heure (3600 secondes) - re-vérification plus fréquente

**Gestion du cache :**
- **Fichier :** `datacenter_cache.json`
- **Limite :** Maximum 1000 entrées
- **Nettoyage automatique :** Les entrées expirées sont supprimées automatiquement
- **Réduction automatique :** Si le cache dépasse 1000 entrées, il est réduit à 500

**Avantages :**
- Réduction drastique des appels API
- Amélioration des temps de réponse
- Réduction des coûts API

### Temps de réponse

- **Avec cache :** ~0.1ms (lecture fichier JSON)
- **Sans cache (API) :** ~200-500ms (appel API externe)

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

## 📊 Logging et Monitoring

### Fichier de logs

**Fichier :** `k7m9x2p/panel/datacenter_logs.txt`

**Format des logs :**
```
2024-01-15 14:30:25 | IP: 165.227.255.184 | Country: US | Org: DigitalOcean, LLC | ISP: DigitalOcean, LLC | ASN: AS14061 DigitalOcean, LLC | Raison: Détecté comme hébergeur par API
```

**Informations enregistrées :**
- Date et heure
- Adresse IP
- Code pays
- Organisation
- ISP
- ASN
- Raison de la détection

### Intégration avec BotFuckLogger

Toutes les détections sont également loggées via `BotFuckLogger` :

```php
BotFuckLogger::log($ip, 'Datacenter IP blocked: ' . ($dcResult['reason'] ?? 'unknown'), 'redirected', '/');
```

### Actions automatiques

Lorsqu'une IP de datacenter est détectée :

1. **Logging** : Enregistrement dans `datacenter_logs.txt`
2. **Blacklist** : Ajout automatique à la blacklist
3. **Redirection** : Redirection vers une URL aléatoire (honeypot)
4. **Cache** : Mise en cache du résultat

---

## 🔧 API Publique

### Méthodes disponibles

#### `isDatacenterIP($ip)`

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

**Exemple :**
```php
$result = DatacenterDetection::isDatacenterIP('165.227.255.184');
if ($result['isDatacenter']) {
    echo "IP de datacenter détectée : " . $result['org'];
}
```

#### `check($ip)`

Vérification simple retournant un booléen.

**Paramètres :**
- `$ip` (string) : Adresse IP à vérifier

**Retour :** `true` si datacenter, `false` sinon

**Exemple :**
```php
if (DatacenterDetection::check($ip)) {
    // Bloquer l'IP
}
```

#### `addOrganization($org)`

Ajoute une organisation à la liste des datacenters.

**Paramètres :**
- `$org` (string) : Nom de l'organisation

**Exemple :**
```php
DatacenterDetection::addOrganization('nouveau-hébergeur');
```

#### `addASN($asn)`

Ajoute un ASN à la liste des datacenters.

**Paramètres :**
- `$asn` (string) : ASN (ex: "AS12345")

**Exemple :**
```php
DatacenterDetection::addASN('AS99999');
```

#### `getOrganizations()`

Retourne la liste complète des organisations datacenter.

**Retour :** Array des organisations

#### `getASNs()`

Retourne la liste complète des ASN datacenter.

**Retour :** Array des ASN

#### `clearCache()`

Vide le cache des vérifications IP.

**Exemple :**
```php
DatacenterDetection::clearCache();
```

---

## 🛡️ Sécurité

### Protection contre les IPs locales

Le système ignore automatiquement les IPs locales :

- `127.x.x.x` (localhost)
- `10.x.x.x` (réseau privé)
- `192.168.x.x` (réseau privé)
- `172.16-31.x.x` (réseau privé)
- `::1` (IPv6 localhost)
- `localhost`

### Gestion des erreurs

- **Timeout API :** 5 secondes maximum
- **API alternative :** Bascule automatique si l'API principale échoue
- **Gestion silencieuse :** Les erreurs sont loggées mais n'interrompent pas le processus
- **Fallback :** Si toutes les APIs échouent, l'IP n'est pas bloquée (fail-open)

### Validation des entrées

- Vérification que l'IP n'est pas vide
- Vérification que l'IP n'est pas locale
- Normalisation des ASN (uppercase)
- Normalisation des organisations (lowercase pour comparaison)

---

## 📈 Statistiques et Métriques

### Données du cache

Le fichier `datacenter_cache.json` contient des statistiques sur les vérifications :

```json
{
    "156.146.63.187": {
        "timestamp": 1768676368,
        "data": {
            "isDatacenter": true,
            "hosting": true,
            "org": "Cdnext PAR",
            "isp": "Datacamp Limited",
            "asn": "AS212238 Datacamp Limited",
            "reason": "Détecté comme hébergeur par API"
        }
    }
}
```

### Analyse des logs

Les logs permettent d'analyser :
- Nombre de datacenters détectés par jour
- Organisations les plus fréquentes
- Pays d'origine des datacenters
- Raisons de détection les plus communes

---

## 🔄 Flux de Traitement

### Flux complet d'une requête

```
1. Requête entrante
   ↓
2. Extraction de l'IP
   ↓
3. Vérification IP locale ? → OUI → Autoriser
   ↓ NON
4. Vérification cache ? → OUI → Retourner résultat
   ↓ NON
5. Appel API ip-api.com
   ↓
6. Vérification flag hosting ? → OUI → Datacenter détecté
   ↓ NON
7. Vérification flag proxy ? → OUI → Datacenter détecté
   ↓ NON
8. Vérification organisation ? → OUI → Datacenter détecté
   ↓ NON
9. Vérification ASN ? → OUI → Datacenter détecté
   ↓ NON
10. IP normale
   ↓
11. Mise en cache
   ↓
12. Si datacenter → Logging + Blacklist + Redirection
```

---

## 🎯 Cas d'Usage

### Cas 1 : Blocage automatique

Un bot depuis AWS EC2 tente d'accéder au site :
1. IP détectée comme datacenter (flag `hosting: true`)
2. IP ajoutée à la blacklist
3. Redirection vers honeypot
4. Log enregistré

### Cas 2 : Exception pour session autorisée

Un utilisateur légitime depuis DigitalOcean a passé le captcha :
1. `$_SESSION['is_datacenter']` est défini
2. Vérification datacenter ignorée
3. Accès autorisé

### Cas 3 : Cache hit

Un bot tente d'accéder avec une IP déjà vérifiée :
1. Résultat récupéré du cache (< 0.1ms)
2. Pas d'appel API
3. Blocage immédiat

---

## 🔮 Améliorations Futures

### Suggestions d'amélioration

1. **Base de données locale** : Remplacer les listes statiques par une base de données
2. **Machine Learning** : Détection basée sur les patterns de comportement
3. **API premium** : Utiliser des APIs premium pour une meilleure précision
4. **Whitelist d'exceptions** : Permettre certaines IPs de datacenter spécifiques
5. **Statistiques dashboard** : Interface pour visualiser les statistiques de détection
6. **Notifications** : Alertes en cas de pic de datacenters détectés
7. **Rate limiting API** : Gérer les limites de rate des APIs externes

---

## 📝 Notes Techniques

### Dépendances

- PHP 7.0+
- Extension `json` (standard)
- Accès réseau pour les APIs externes
- Permissions d'écriture pour les fichiers de cache et logs

### Limitations

- **Dépendance API externe :** Si les APIs sont indisponibles, la détection peut échouer
- **Faux positifs possibles :** Certaines IPs résidentielles peuvent être mal classées
- **Faux négatifs possibles :** Nouveaux datacenters non encore dans les listes
- **Rate limiting :** Les APIs gratuites ont des limites de requêtes

### Bonnes pratiques

1. **Surveiller les logs** régulièrement pour identifier les patterns
2. **Mettre à jour les listes** d'organisations et d'ASN périodiquement
3. **Vider le cache** en cas de problème de détection
4. **Tester avec des IPs connues** pour valider le fonctionnement
5. **Monitorer les performances** des APIs externes

---

## 📚 Références

- **API ip-api.com :** https://ip-api.com/docs
- **API ipapi.co :** https://ipapi.co/documentation
- **ASN Database :** https://www.iana.org/assignments/as-numbers/as-numbers.xhtml
- **RFC 1918 :** Adresses IP privées

---

**Date de création :** 2024  
**Version :** 1.0  
**Auteur :** Système d'intégration automatique
