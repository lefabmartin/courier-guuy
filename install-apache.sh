#!/bin/bash

# Script d'installation automatique pour Apache
# Usage: sudo ./install-apache.sh [domaine]

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
echo -e "${BLUE}║   Installation Automatique Apache pour Courier Guuy     ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Variables
DOMAIN="${1:-}"
PROJECT_DIR="/var/www/courier-guuy"
APACHE_CONF="/etc/apache2/sites-available/courier-guuy.conf"
APACHE_ENABLED="/etc/apache2/sites-enabled/courier-guuy.conf"

# Vérifier que le projet existe
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ Erreur: Le répertoire $PROJECT_DIR n'existe pas${NC}"
    echo "Assurez-vous que le projet est dans $PROJECT_DIR"
    exit 1
fi

echo -e "${GREEN}✅ Répertoire du projet trouvé: $PROJECT_DIR${NC}"

# Demander le domaine si non fourni
if [ -z "$DOMAIN" ]; then
    echo -e "${YELLOW}📝 Entrez votre nom de domaine (ou appuyez sur Entrée pour utiliser l'IP):${NC}"
    read -r DOMAIN
fi

# Installation d'Apache si non installé
if ! command -v apache2 &> /dev/null; then
    echo -e "${YELLOW}📦 Installation d'Apache...${NC}"
    apt update
    apt install -y apache2
    echo -e "${GREEN}✅ Apache installé${NC}"
else
    echo -e "${GREEN}✅ Apache déjà installé${NC}"
fi

# Activer les modules nécessaires
echo -e "${YELLOW}🔧 Activation des modules Apache nécessaires...${NC}"
a2enmod proxy
a2enmod proxy_http
a2enmod proxy_wstunnel
a2enmod rewrite
a2enmod headers
a2enmod ssl
a2enmod expires
a2enmod deflate
echo -e "${GREEN}✅ Modules activés${NC}"

# Désactiver le site par défaut
if [ -f "/etc/apache2/sites-enabled/000-default.conf" ]; then
    echo -e "${YELLOW}🔧 Désactivation du site par défaut...${NC}"
    a2dissite 000-default.conf
    echo -e "${GREEN}✅ Site par défaut désactivé${NC}"
fi

# Créer la configuration Apache
echo -e "${YELLOW}📝 Création de la configuration Apache...${NC}"

# Déterminer le ServerName
if [ -z "$DOMAIN" ]; then
    SERVER_NAME=$(hostname -I | awk '{print $1}')
    SERVER_ALIAS=""
    echo -e "${YELLOW}⚠️  Utilisation de l'IP: $SERVER_NAME${NC}"
else
    SERVER_NAME="$DOMAIN"
    SERVER_ALIAS="www.$DOMAIN"
    echo -e "${GREEN}✅ Domaine configuré: $SERVER_NAME${NC}"
fi

# Créer le fichier de configuration
cat > "$APACHE_CONF" << EOF
<VirtualHost *:80>
    ServerName $SERVER_NAME
EOF

if [ -n "$SERVER_ALIAS" ]; then
    echo "    ServerAlias $SERVER_ALIAS" >> "$APACHE_CONF"
fi

cat >> "$APACHE_CONF" << 'EOF'
    DocumentRoot /var/www/courier-guuy/client/public

    # Logs
    ErrorLog ${APACHE_LOG_DIR}/courier-guuy-error.log
    CustomLog ${APACHE_LOG_DIR}/courier-guuy-access.log combined

    # Taille maximale des uploads
    LimitRequestBody 10485760

    # Proxy vers l'application Node.js
    ProxyPreserveHost On
    ProxyRequests Off

    # Proxy pour toutes les requêtes
    <Location />
        ProxyPass http://localhost:3000/
        ProxyPassReverse http://localhost:3000/
        ProxyPassReverse /
        
        # Headers nécessaires
        RequestHeader set X-Forwarded-Proto "http"
        RequestHeader set X-Forwarded-Port "80"
    </Location>

    # WebSocket support
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule /(.*) ws://localhost:3000/$1 [P,L]
    RewriteCond %{HTTP:Upgrade} !=websocket [NC]
    RewriteRule /(.*) http://localhost:3000/$1 [P,L]

    # Timeouts
    ProxyTimeout 60
    Timeout 60

    # Headers de sécurité
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
</VirtualHost>
EOF

echo -e "${GREEN}✅ Configuration créée: $APACHE_CONF${NC}"

# Activer le site
echo -e "${YELLOW}🔧 Activation du site...${NC}"
a2ensite courier-guuy.conf

# Tester la configuration
echo -e "${YELLOW}🔍 Test de la configuration Apache...${NC}"
if apache2ctl configtest; then
    echo -e "${GREEN}✅ Configuration Apache valide${NC}"
else
    echo -e "${RED}❌ Erreur dans la configuration Apache${NC}"
    exit 1
fi

# Redémarrer Apache
echo -e "${YELLOW}🔄 Redémarrage d'Apache...${NC}"
systemctl restart apache2
echo -e "${GREEN}✅ Apache redémarré${NC}"

# Vérifier le statut
if systemctl is-active --quiet apache2; then
    echo -e "${GREEN}✅ Apache est actif${NC}"
else
    echo -e "${RED}❌ Erreur: Apache n'est pas actif${NC}"
    exit 1
fi

# Configuration SSL (optionnel)
if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "$(hostname -I | awk '{print $1}')" ]; then
    echo ""
    echo -e "${YELLOW}🔒 Voulez-vous configurer SSL avec Let's Encrypt ? (y/n)${NC}"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        # Vérifier si certbot est installé
        if ! command -v certbot &> /dev/null; then
            echo -e "${YELLOW}📦 Installation de Certbot...${NC}"
            apt install -y certbot python3-certbot-apache
            echo -e "${GREEN}✅ Certbot installé${NC}"
        fi
        
        echo -e "${YELLOW}🔒 Génération du certificat SSL...${NC}"
        certbot --apache -d "$DOMAIN" ${SERVER_ALIAS:+-d "$SERVER_ALIAS"} --non-interactive --agree-tos --email "admin@$DOMAIN" --redirect
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ SSL configuré avec succès${NC}"
        else
            echo -e "${YELLOW}⚠️  La configuration SSL a échoué. Vous pouvez la configurer manuellement plus tard.${NC}"
        fi
    fi
fi

# Afficher le résumé
echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              Installation Terminée avec Succès          ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}📋 Résumé de la configuration:${NC}"
echo "  • Configuration: $APACHE_CONF"
echo "  • Site activé: $APACHE_ENABLED"
echo "  • ServerName: $SERVER_NAME"
if [ -n "$SERVER_ALIAS" ]; then
    echo "  • ServerAlias: $SERVER_ALIAS"
fi
echo "  • Proxy vers: http://localhost:3000"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT:${NC}"
echo "  1. Assurez-vous que l'application Node.js tourne sur le port 3000"
echo "  2. Vérifiez que PM2 est configuré et que l'app est démarrée"
echo "  3. Testez l'application: http://$SERVER_NAME"
echo ""
echo -e "${BLUE}📚 Commandes utiles:${NC}"
echo "  • Voir les logs Apache: sudo tail -f /var/log/apache2/courier-guuy-*.log"
echo "  • Redémarrer Apache: sudo systemctl restart apache2"
echo "  • Tester la config: sudo apache2ctl configtest"
echo "  • Voir le statut: sudo systemctl status apache2"
echo ""
