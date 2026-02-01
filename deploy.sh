#!/bin/bash

# Script de déploiement rapide pour VPS
# Usage: ./deploy.sh

set -e

echo "🚀 Déploiement de Courier Guuy"
echo "================================"
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Erreur: package.json introuvable. Exécutez ce script depuis la racine du projet.${NC}"
    exit 1
fi

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js n'est pas installé. Installez Node.js 20+ d'abord.${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}❌ Node.js version 20+ requis. Version actuelle: $(node -v)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node -v) détecté${NC}"

# Vérifier le fichier .env
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Fichier .env introuvable${NC}"
    echo "Création d'un fichier .env à partir de l'exemple..."
    
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${YELLOW}⚠️  IMPORTANT: Modifiez le fichier .env avec vos vraies valeurs avant de continuer !${NC}"
        echo "Appuyez sur Entrée pour continuer après avoir modifié .env..."
        read
    else
        echo -e "${YELLOW}Création d'un fichier .env basique...${NC}"
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
        echo "Appuyez sur Entrée pour continuer après avoir modifié .env..."
        read
    fi
else
    echo -e "${GREEN}✅ Fichier .env trouvé${NC}"
fi

# Installation des dépendances
echo ""
echo "📦 Installation des dépendances..."
npm install

# Build du projet
echo ""
echo "🏗️  Build du projet..."
npm run build

# Vérifier que le build a réussi
if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Erreur: Le dossier dist/ n'a pas été créé. Le build a échoué.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build réussi${NC}"

# Créer les fichiers de données s'ils n'existent pas
echo ""
echo "📝 Création des fichiers de données..."
touch whitelist.txt blacklist.txt botfuck.txt
[ ! -f "antibot-config.json" ] && echo '{}' > antibot-config.json

# Créer le dossier de logs
mkdir -p logs

# Vérifier PM2
if command -v pm2 &> /dev/null; then
    echo -e "${GREEN}✅ PM2 détecté${NC}"
    
    # Vérifier si ecosystem.config.js existe
    if [ ! -f "ecosystem.config.js" ]; then
        if [ -f "ecosystem.config.example.js" ]; then
            cp ecosystem.config.example.js ecosystem.config.js
            echo -e "${YELLOW}⚠️  Fichier ecosystem.config.js créé depuis l'exemple. Vérifiez la configuration.${NC}"
        fi
    fi
    
    # Proposer de démarrer avec PM2
    echo ""
    echo "🤔 Voulez-vous démarrer l'application avec PM2 maintenant ? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        if [ -f "ecosystem.config.js" ]; then
            pm2 start ecosystem.config.js
            pm2 save
            echo -e "${GREEN}✅ Application démarrée avec PM2${NC}"
            echo "Commandes utiles:"
            echo "  pm2 status          - Voir l'état"
            echo "  pm2 logs courier-guuy - Voir les logs"
            echo "  pm2 restart courier-guuy - Redémarrer"
        else
            echo -e "${YELLOW}⚠️  ecosystem.config.js introuvable. Démarrage manuel requis.${NC}"
            echo "Commande: pm2 start dist/index.cjs --name courier-guuy"
        fi
    fi
else
    echo -e "${YELLOW}⚠️  PM2 n'est pas installé. Installation recommandée pour la production.${NC}"
    echo "Pour installer: npm install -g pm2"
    echo ""
    echo "Pour démarrer manuellement:"
    echo "  NODE_ENV=production node dist/index.cjs"
fi

echo ""
echo -e "${GREEN}✅ Déploiement terminé !${NC}"
echo ""
echo "📚 Prochaines étapes:"
echo "  1. Configurez Nginx comme reverse proxy (voir DEPLOYMENT.md)"
echo "  2. Configurez SSL avec Let's Encrypt (voir DEPLOYMENT.md)"
echo "  3. Configurez le firewall (voir DEPLOYMENT.md)"
echo ""
echo "Pour plus de détails, consultez DEPLOYMENT.md"
