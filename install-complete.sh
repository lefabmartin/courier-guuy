#!/bin/bash

# Script d'installation complète pour VPS
# Installe Node.js, PM2, configure le projet et le serveur web
# Usage: sudo ./install-complete.sh [domaine] [nginx|apache]

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Vérifier que le script est exécuté en root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Erreur: Ce script doit être exécuté en tant que root (sudo)${NC}"
    exit 1
fi

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Installation Complète Courier Guuy sur VPS          ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Variables
DOMAIN="${1:-}"
WEB_SERVER="${2:-apache}"  # apache ou nginx
PROJECT_DIR="/var/www/courier-guuy"

# Validation du serveur web
if [ "$WEB_SERVER" != "apache" ] && [ "$WEB_SERVER" != "nginx" ]; then
    echo -e "${RED}❌ Erreur: Serveur web invalide. Utilisez 'apache' ou 'nginx'${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Serveur web sélectionné: $WEB_SERVER${NC}"

# Étape 1 : Mise à jour du système
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Étape 1/7 : Mise à jour du système${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
apt update && apt upgrade -y
echo -e "${GREEN}✅ Système mis à jour${NC}"

# Étape 2 : Installation de Node.js
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Étape 2/7 : Installation de Node.js${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✅ Node.js déjà installé: $NODE_VERSION${NC}"
else
    echo -e "${YELLOW}📦 Installation de Node.js 20...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    echo -e "${GREEN}✅ Node.js installé: $(node -v)${NC}"
fi

# Étape 3 : Installation de PM2
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Étape 3/7 : Installation de PM2${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

if command -v pm2 &> /dev/null; then
    echo -e "${GREEN}✅ PM2 déjà installé${NC}"
else
    echo -e "${YELLOW}📦 Installation de PM2...${NC}"
    npm install -g pm2
    echo -e "${GREEN}✅ PM2 installé${NC}"
fi

# Étape 4 : Vérification du projet
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Étape 4/7 : Vérification du projet${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ Erreur: Le répertoire $PROJECT_DIR n'existe pas${NC}"
    echo "Assurez-vous que le projet est dans $PROJECT_DIR"
    exit 1
fi

cd "$PROJECT_DIR"
echo -e "${GREEN}✅ Répertoire du projet trouvé${NC}"

# Vérifier le fichier .env
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Fichier .env introuvable${NC}"
    echo "Création d'un fichier .env basique..."
    cat > .env << EOF
NODE_ENV=production
PORT=3000
SESSION_SECRET=$(openssl rand -base64 32)
TELEGRAM_BOT_TOKEN=votre_bot_token
TELEGRAM_CHAT_ID=votre_chat_id
HCAPTCHA_SITE_KEY=votre_site_key
HCAPTCHA_SECRET_KEY=votre_secret_key
BINCODES_API_KEY=votre_api_key
EOF
    echo -e "${YELLOW}⚠️  IMPORTANT: Modifiez le fichier .env avec vos vraies valeurs !${NC}"
    echo "Appuyez sur Entrée pour continuer..."
    read
else
    echo -e "${GREEN}✅ Fichier .env trouvé${NC}"
fi

# Installation des dépendances
echo ""
echo -e "${YELLOW}📦 Installation des dépendances...${NC}"
npm install
echo -e "${GREEN}✅ Dépendances installées${NC}"

# Build du projet
echo ""
echo -e "${YELLOW}🏗️  Build du projet...${NC}"
npm run build
echo -e "${GREEN}✅ Projet buildé${NC}"

# Créer les fichiers de données
echo ""
echo -e "${YELLOW}📝 Création des fichiers de données...${NC}"
touch whitelist.txt blacklist.txt botfuck.txt
[ ! -f "antibot-config.json" ] && echo '{}' > antibot-config.json
mkdir -p logs
echo -e "${GREEN}✅ Fichiers de données créés${NC}"

# Configuration PM2
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Étape 5/7 : Configuration PM2${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

if [ ! -f "ecosystem.config.js" ]; then
    if [ -f "ecosystem.config.example.js" ]; then
        cp ecosystem.config.example.js ecosystem.config.js
        echo -e "${GREEN}✅ Configuration PM2 créée${NC}"
    fi
fi

# Démarrer avec PM2
echo -e "${YELLOW}🚀 Démarrage de l'application avec PM2...${NC}"
if [ -f "ecosystem.config.js" ]; then
    pm2 start ecosystem.config.js
else
    pm2 start dist/index.cjs --name courier-guuy
fi

pm2 save
pm2 startup
echo -e "${GREEN}✅ Application démarrée avec PM2${NC}"

# Étape 6 : Configuration du serveur web
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Étape 6/7 : Configuration $WEB_SERVER${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

if [ "$WEB_SERVER" = "apache" ]; then
    if [ -f "install-apache.sh" ]; then
        echo -e "${YELLOW}🔧 Exécution du script d'installation Apache...${NC}"
        chmod +x install-apache.sh
        if [ -n "$DOMAIN" ]; then
            ./install-apache.sh "$DOMAIN"
        else
            ./install-apache.sh
        fi
    else
        echo -e "${RED}❌ Erreur: install-apache.sh introuvable${NC}"
        exit 1
    fi
else
    # Installation Nginx
    if ! command -v nginx &> /dev/null; then
        echo -e "${YELLOW}📦 Installation de Nginx...${NC}"
        apt install -y nginx
    fi
    
    # Créer la configuration Nginx
    NGINX_CONF="/etc/nginx/sites-available/courier-guuy"
    if [ -n "$DOMAIN" ]; then
        SERVER_NAME="$DOMAIN"
    else
        SERVER_NAME=$(hostname -I | awk '{print $1}')
    fi
    
    cat > "$NGINX_CONF" << EOF
server {
    listen 80;
    server_name $SERVER_NAME;

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF
    
    ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/courier-guuy
    rm -f /etc/nginx/sites-enabled/default
    
    nginx -t
    systemctl restart nginx
    echo -e "${GREEN}✅ Nginx configuré${NC}"
fi

# Étape 7 : Configuration SSL (optionnel)
if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "$(hostname -I | awk '{print $1}')" ]; then
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}Étape 7/7 : Configuration SSL${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}🔒 Voulez-vous configurer SSL avec Let's Encrypt ? (y/n)${NC}"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        if [ "$WEB_SERVER" = "apache" ]; then
            apt install -y certbot python3-certbot-apache
            certbot --apache -d "$DOMAIN" --non-interactive --agree-tos --email "admin@$DOMAIN" --redirect
        else
            apt install -y certbot python3-certbot-nginx
            certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "admin@$DOMAIN" --redirect
        fi
        echo -e "${GREEN}✅ SSL configuré${NC}"
    fi
fi

# Résumé final
echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          Installation Terminée avec Succès !            ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}📋 Résumé:${NC}"
echo "  • Node.js: $(node -v)"
echo "  • PM2: $(pm2 -v)"
echo "  • Serveur web: $WEB_SERVER"
if [ -n "$DOMAIN" ]; then
    echo "  • Domaine: $DOMAIN"
    echo "  • URL: http://$DOMAIN"
else
    IP=$(hostname -I | awk '{print $1}')
    echo "  • IP: $IP"
    echo "  • URL: http://$IP"
fi
echo "  • Projet: $PROJECT_DIR"
echo ""
echo -e "${YELLOW}⚠️  Actions requises:${NC}"
echo "  1. Modifiez le fichier .env avec vos vraies valeurs"
echo "  2. Redémarrez l'application: pm2 restart courier-guuy"
echo "  3. Testez l'application dans votre navigateur"
echo ""
echo -e "${BLUE}📚 Commandes utiles:${NC}"
echo "  • Voir les logs PM2: pm2 logs courier-guuy"
echo "  • Redémarrer: pm2 restart courier-guuy"
echo "  • Statut: pm2 status"
if [ "$WEB_SERVER" = "apache" ]; then
    echo "  • Logs Apache: tail -f /var/log/apache2/courier-guuy-*.log"
    echo "  • Redémarrer Apache: systemctl restart apache2"
else
    echo "  • Logs Nginx: tail -f /var/log/nginx/access.log"
    echo "  • Redémarrer Nginx: systemctl restart nginx"
fi
echo ""
