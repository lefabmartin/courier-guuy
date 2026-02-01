# 📦 Guide de déploiement sur GitHub

Ce guide décrit comment publier le projet **Courier Guuy** sur GitHub et le déployer (ex. Render) à partir du dépôt.

---

## 📋 Prérequis

- Un compte [GitHub](https://github.com)
- Git installé en local
- Projet buildé en local au moins une fois : `npm run build`

---

## 1. Créer le dépôt sur GitHub

### 1.1 Nouveau dépôt

1. Sur GitHub : **Repositories** → **New** (ou [github.com/new](https://github.com/new)).
2. **Repository name** : par ex. `courier-guuy`.
3. **Visibility** : Public ou Private.
4. Ne cochez **pas** « Add a README », « Add .gitignore » ni « Choose a license » (le projet les a déjà).
5. Cliquez sur **Create repository**.

### 1.2 Lier le projet local à GitHub

Dans le dossier du projet :

```bash
# Initialiser Git si ce n’est pas déjà fait
git init

# Vérifier que .gitignore est correct (pas de node_modules, .env, dist, etc.)
cat .gitignore

# Premier commit
git add .
git commit -m "Initial commit: Courier Guuy app"
```

Puis associer le remote et pousser :

```bash
# Remplacer VOTRE_USERNAME et VOTRE_REPO par vos valeurs
git remote add origin https://github.com/VOTRE_USERNAME/VOTRE_REPO.git

# Ou en SSH
git remote add origin git@github.com:VOTRE_USERNAME/VOTRE_REPO.git

# Branche principale (souvent main)
git branch -M main
git push -u origin main
```

---

## 2. Vérifier ce qui ne doit pas être versionné

À ne **pas** committer (déjà dans `.gitignore`) :

| Élément            | Raison                          |
|--------------------|----------------------------------|
| `node_modules/`    | Dépendances (réinstall via npm) |
| `.env`             | Secrets (tokens, mots de passe) |
| `dist/`            | Build généré                    |
| `whitelist.txt`    | Données sensibles               |
| `blacklist.txt`    | Données sensibles               |
| `botfuck.txt`      | Données sensibles               |
| `antibot-config.json` | Config locale / données     |

À committer :

- `env.example` (template sans secrets)
- `package.json`, `package-lock.json`
- `README.md`, `render.yaml`
- Code source (`client/`, `server/`, `shared/`, `script/`, `md/`, etc.)

---

## 3. Déployer depuis GitHub (ex. Render)

Une fois le code sur GitHub, vous pouvez déployer sur un hébergeur qui se connecte au dépôt.

### 3.1 Render (recommandé)

1. [Render](https://render.com) → **New** → **Web Service**.
2. Connectez votre compte GitHub et choisissez le dépôt `courier-guuy`.
3. Renseignez :
   - **Build Command** : `npm install && npm run build`
   - **Start Command** : `npm start`
   - **Environment** : **Node**
4. Dans **Environment** (variables d’environnement), ajoutez au minimum :
   - `NODE_ENV` = `production`
   - `SESSION_SECRET` = (générer avec `openssl rand -base64 32`)
   - `TELEGRAM_BOT_TOKEN` = token du bot Telegram
   - `TELEGRAM_CHAT_ID` = ID du chat Telegram
5. Créez le service. Render utilisera le `PORT` fourni automatiquement.

Le fichier **`render.yaml`** à la racine du projet peut aussi être utilisé comme [Blueprint](https://render.com/docs/blueprint-spec) pour définir le service.

### 3.2 Autres plateformes (Railway, Fly.io, etc.)

- **Build** : en général `npm install && npm run build`
- **Start** : `npm start`
- **Variables d’environnement** : mêmes que ci‑dessus (voir `env.example`).

---

## 4. Secrets et variables d’environnement

Ne jamais mettre de secrets dans le code ou dans des fichiers versionnés. Les définir :

- **En local** : fichier `.env` (ignoré par Git).
- **Sur Render / autre** : section **Environment** / **Secrets** de la plateforme.

Variables utiles (détail dans `env.example`) :

| Variable              | Obligatoire (prod) | Description                    |
|-----------------------|--------------------|--------------------------------|
| `NODE_ENV`            | Recommandé         | `production`                   |
| `PORT`                | Non                | Souvent fourni par l’hébergeur |
| `SESSION_SECRET`      | Oui                | Secret de session (fort)      |
| `TELEGRAM_BOT_TOKEN`  | Oui                | Token du bot Telegram         |
| `TELEGRAM_CHAT_ID`    | Oui                | ID du chat de réception       |
| `ADMIN_PASSWORD`      | Optionnel          | Mot de passe admin (défaut doc) |
| `HCAPTCHA_*`          | Optionnel          | Clés hCaptcha                 |
| `BINCODES_API_KEY`    | Optionnel          | API BIN                       |
| `ALLOWED_COUNTRIES`   | Optionnel          | Pays autorisés (liste)        |

---

## 5. Mises à jour après déploiement

Pour pousser des changements et redéployer :

```bash
git add .
git commit -m "Description des changements"
git push origin main
```

Sur Render (et la plupart des hébergeurs), un push sur la branche connectée déclenche un nouveau déploiement automatique.

---

## 6. Résumé des commandes utiles

```bash
# Premier déploiement
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/VOTRE_USERNAME/courier-guuy.git
git branch -M main
git push -u origin main

# Ensuite : configurer Render (ou autre) en pointant sur ce dépôt,
# puis ajouter les variables d’environnement (SESSION_SECRET, Telegram, etc.).
```

---

## 7. Voir aussi

- [README principal](../README.md) — installation, config, commandes de base.
- [DEPLOYMENT.md](DEPLOYMENT.md) — déploiement sur VPS (Nginx/Apache, PM2, SSL).
- [env.example](../env.example) — liste des variables d’environnement (copier en `.env`).
