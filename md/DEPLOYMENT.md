# 🚀 Guide de Déploiement sur VPS

Ce guide vous explique comment déployer le projet **Courier Guuy** sur un VPS (Virtual Private Server).

## 📋 Prérequis

- Un VPS avec Ubuntu 20.04+ ou Debian 11+
- Accès SSH au serveur
- Un nom de domaine pointant vers l'IP du VPS (optionnel mais recommandé)
- Node.js 20+ installé

---

## 🔧 Étape 1 : Préparation du Serveur

### 1.1 Connexion SSH

```bash
ssh root@votre-ip-serveur
# ou
ssh utilisateur@votre-ip-serveur
```

### 1.2 Mise à jour du système

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.3 Installation de Node.js 20+

```bash
# Installation de Node.js via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Vérification
node --version  # Doit afficher v20.x.x ou supérieur
npm --version
```

### 1.4 Installation de PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

### 1.5 Installation du Serveur Web (Nginx ou Apache)

**Option A : Nginx (Recommandé)**

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

**Option B : Apache**

```bash
sudo apt install -y apache2
sudo systemctl enable apache2
sudo systemctl start apache2
```

> 💡 **Installation automatique Apache** : Utilisez le script `install-apache.sh` pour une configuration automatique (voir section Apache ci-dessous).

---

## 📦 Étape 2 : Upload du Projet

### Option A : Via Git (Recommandé)

```bash
# Sur le serveur
cd /var/www
sudo git clone https://github.com/votre-repo/courier-guuy.git
# ou via SSH
sudo git clone git@github.com:votre-repo/courier-guuy.git

cd courier-guuy
sudo chown -R $USER:$USER /var/www/courier-guuy
```

### Option B : Via SCP (depuis votre machine locale)

```bash
# Depuis votre machine locale
scp -r /chemin/vers/courier-guuy root@votre-ip:/var/www/
```

### Option C : Via SFTP

Utilisez un client SFTP (FileZilla, WinSCP, etc.) pour transférer les fichiers.

---

## ⚙️ Étape 3 : Configuration de l'Environnement

### 3.1 Création du fichier `.env`

```bash
cd /var/www/courier-guuy
nano .env
```

### 3.2 Contenu du fichier `.env`

```env
# Environnement
NODE_ENV=production
PORT=3000

# Session Secret (GÉNÉREZ UN SECRET FORT)
SESSION_SECRET=votre-secret-session-tres-long-et-aleatoire

# Telegram
TELEGRAM_BOT_TOKEN=votre_bot_token_telegram
TELEGRAM_CHAT_ID=votre_chat_id_telegram

# hCaptcha
HCAPTCHA_SITE_KEY=votre_site_key_hcaptcha
HCAPTCHA_SECRET_KEY=votre_secret_key_hcaptcha

# BIN Checker API
BINCODES_API_KEY=votre_api_key_bincodes

# Pays autorisés (optionnel, séparés par des virgules)
ALLOWED_COUNTRIES=CM,MA,BM,US,GB
```

**⚠️ IMPORTANT :** Générez un `SESSION_SECRET` fort :

```bash
openssl rand -base64 32
```

### 3.3 Création des fichiers de données

```bash
# Créer les fichiers vides si nécessaire
touch whitelist.txt blacklist.txt botfuck.txt
touch antibot-config.json
```

---

## 🏗️ Étape 4 : Installation et Build

### 4.1 Installation des dépendances

```bash
cd /var/www/courier-guuy
npm install
```

### 4.2 Build du projet

```bash
npm run build
```

Cela va :
- Compiler le code TypeScript
- Builder l'application React
- Créer le dossier `dist/` avec les fichiers de production

---

## 🚀 Étape 5 : Déploiement avec PM2

### 5.1 Création du fichier de configuration PM2

```bash
nano ecosystem.config.js
```

Contenu :

```javascript
export default {
  apps: [{
    name: 'courier-guuy',
    script: './dist/index.cjs',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
```

### 5.2 Création du dossier de logs

```bash
mkdir -p logs
```

### 5.3 Démarrage avec PM2

```bash
pm2 start ecosystem.config.js
```

### 5.4 Configuration de PM2 au démarrage

```bash
# Sauvegarder la configuration actuelle
pm2 save

# Générer le script de démarrage
pm2 startup

# Suivre les instructions affichées (généralement une commande sudo à exécuter)
```

### 5.5 Commandes PM2 utiles

```bash
pm2 status          # Voir l'état des processus
pm2 logs courier-guuy  # Voir les logs
pm2 restart courier-guuy  # Redémarrer
pm2 stop courier-guuy     # Arrêter
pm2 delete courier-guuy   # Supprimer
```

---

## 🌐 Étape 6 : Configuration du Serveur Web

### Option A : Configuration Nginx

### 6.1 Création de la configuration Nginx

```bash
sudo nano /etc/nginx/sites-available/courier-guuy
```

Contenu :

```nginx
server {
    listen 80;
    server_name votre-domaine.com www.votre-domaine.com;
    # ou utilisez l'IP directement si pas de domaine :
    # server_name votre-ip-serveur;

    # Taille maximale des uploads
    client_max_body_size 10M;

    # Proxy vers l'application Node.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Cache pour les assets statiques
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 6.2 Activation du site

```bash
# Créer le lien symbolique
sudo ln -s /etc/nginx/sites-available/courier-guuy /etc/nginx/sites-enabled/

# Tester la configuration
sudo nginx -t

# Recharger Nginx
sudo systemctl reload nginx
```

### Option B : Configuration Apache (Installation Automatique)

#### Méthode 1 : Script d'installation automatique (Recommandé)

```bash
cd /var/www/courier-guuy
sudo chmod +x install-apache.sh
sudo ./install-apache.sh votre-domaine.com
```

Le script va automatiquement :
- Installer Apache si nécessaire
- Activer tous les modules requis
- Créer la configuration
- Configurer SSL avec Let's Encrypt (optionnel)
- Redémarrer Apache

#### Méthode 2 : Installation manuelle

```bash
# 1. Installer Apache
sudo apt install -y apache2

# 2. Activer les modules nécessaires
sudo a2enmod proxy proxy_http proxy_wstunnel rewrite headers ssl expires deflate

# 3. Copier la configuration
sudo cp apache/courier-guuy.conf /etc/apache2/sites-available/courier-guuy.conf

# 4. Modifier le fichier avec votre domaine
sudo nano /etc/apache2/sites-available/courier-guuy.conf
# Remplacez "votre-domaine.com" par votre vrai domaine

# 5. Activer le site
sudo a2ensite courier-guuy.conf

# 6. Désactiver le site par défaut
sudo a2dissite 000-default.conf

# 7. Tester la configuration
sudo apache2ctl configtest

# 8. Redémarrer Apache
sudo systemctl restart apache2
```

#### Configuration SSL avec Let's Encrypt (Apache)

```bash
# Installer Certbot pour Apache
sudo apt install -y certbot python3-certbot-apache

# Générer le certificat SSL
sudo certbot --apache -d votre-domaine.com -d www.votre-domaine.com
```

---

## 🔒 Étape 7 : Configuration SSL avec Let's Encrypt (Optionnel mais Recommandé)

### 7.1 Installation de Certbot

**Pour Nginx :**
```bash
sudo apt install -y certbot python3-certbot-nginx
```

**Pour Apache :**
```bash
sudo apt install -y certbot python3-certbot-apache
```

### 7.2 Génération du certificat SSL

**Pour Nginx :**
```bash
sudo certbot --nginx -d votre-domaine.com -d www.votre-domaine.com
```

**Pour Apache :**
```bash
sudo certbot --apache -d votre-domaine.com -d www.votre-domaine.com
```

Suivez les instructions à l'écran. Certbot va :
- Générer le certificat SSL
- Modifier automatiquement la configuration Nginx
- Configurer le renouvellement automatique

### 7.3 Test du renouvellement automatique

```bash
sudo certbot renew --dry-run
```

---

## 📝 Étape 8 : Vérification et Tests

### 8.1 Vérifier que l'application fonctionne

```bash
# Vérifier les logs PM2
pm2 logs courier-guuy --lines 50

# Vérifier que le port 3000 écoute
sudo netstat -tlnp | grep 3000
# ou
sudo ss -tlnp | grep 3000
```

### 8.2 Tester l'application

Ouvrez votre navigateur et accédez à :
- `http://votre-ip` (sans domaine)
- `http://votre-domaine.com` (avec domaine)
- `https://votre-domaine.com` (avec SSL)

---

## 🔄 Étape 9 : Mise à Jour du Projet

### 9.1 Mise à jour via Git

```bash
cd /var/www/courier-guuy

# Récupérer les dernières modifications
git pull origin main

# Réinstaller les dépendances si nécessaire
npm install

# Rebuild
npm run build

# Redémarrer avec PM2
pm2 restart courier-guuy
```

### 9.2 Vérifier les logs après mise à jour

```bash
pm2 logs courier-guuy --lines 100
```

---

## 🛡️ Étape 10 : Sécurité Supplémentaire

### 10.1 Configuration du Firewall (UFW)

```bash
# Autoriser SSH
sudo ufw allow 22/tcp

# Autoriser HTTP
sudo ufw allow 80/tcp

# Autoriser HTTPS
sudo ufw allow 443/tcp

# Activer le firewall
sudo ufw enable

# Vérifier le statut
sudo ufw status
```

### 10.2 Sécurisation des fichiers sensibles

```bash
# Protéger le fichier .env
chmod 600 .env

# Protéger les fichiers de données
chmod 644 whitelist.txt blacklist.txt botfuck.txt antibot-config.json
```

### 10.3 Sauvegarde régulière

Créez un script de sauvegarde :

```bash
nano /var/www/courier-guuy/backup.sh
```

Contenu :

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/courier-guuy"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Sauvegarder les fichiers de données
tar -czf $BACKUP_DIR/data_$DATE.tar.gz \
  whitelist.txt \
  blacklist.txt \
  botfuck.txt \
  antibot-config.json \
  .env

# Garder seulement les 7 derniers backups
find $BACKUP_DIR -name "data_*.tar.gz" -mtime +7 -delete

echo "Backup completed: data_$DATE.tar.gz"
```

Rendre exécutable :

```bash
chmod +x backup.sh
```

Ajouter au cron pour exécution quotidienne :

```bash
crontab -e
```

Ajouter :

```
0 2 * * * /var/www/courier-guuy/backup.sh >> /var/log/courier-guuy-backup.log 2>&1
```

---

## 📊 Monitoring

### Voir les métriques PM2

```bash
pm2 monit
```

### Voir les logs en temps réel

```bash
pm2 logs courier-guuy --lines 0
```

### Voir les logs Nginx

```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## 🐛 Dépannage

### L'application ne démarre pas

```bash
# Vérifier les logs PM2
pm2 logs courier-guuy --err

# Vérifier que le port 3000 n'est pas utilisé
sudo lsof -i :3000

# Vérifier les permissions
ls -la /var/www/courier-guuy
```

### Erreur 502 Bad Gateway

```bash
# Vérifier que l'application tourne
pm2 status

# Vérifier les logs
pm2 logs courier-guuy

# Vérifier la configuration Nginx
sudo nginx -t
```

### Erreur de permissions

```bash
# Corriger les permissions
sudo chown -R $USER:$USER /var/www/courier-guuy
chmod -R 755 /var/www/courier-guuy
chmod 600 .env
```

---

## 📚 Ressources Utiles

- [Documentation PM2](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Documentation Nginx](https://nginx.org/en/docs/)
- [Documentation Let's Encrypt](https://letsencrypt.org/docs/)
- [Documentation Node.js](https://nodejs.org/en/docs/)

---

## ✅ Checklist de Déploiement

- [ ] Serveur mis à jour
- [ ] Node.js 20+ installé
- [ ] PM2 installé et configuré
- [ ] Nginx installé et configuré
- [ ] Projet uploadé sur le serveur
- [ ] Fichier `.env` créé et configuré
- [ ] Dépendances installées (`npm install`)
- [ ] Projet buildé (`npm run build`)
- [ ] Application démarrée avec PM2
- [ ] PM2 configuré pour le démarrage automatique
- [ ] Nginx configuré et testé
- [ ] SSL configuré (si domaine disponible)
- [ ] Firewall configuré
- [ ] Fichiers de données créés
- [ ] Script de sauvegarde configuré
- [ ] Application accessible et fonctionnelle

---

**🎉 Félicitations ! Votre application est maintenant déployée sur votre VPS !**
