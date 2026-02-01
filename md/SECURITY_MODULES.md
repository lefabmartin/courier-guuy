# 🔒 Modules de Sécurité Avancés

Tous les modules de sécurité avancés du projet beta ont été implémentés en TypeScript.

## ✅ Modules Implémentés

### 1. hCaptcha Adaptatif ✅
**Fichier**: `server/secure/panel/hcaptcha.ts`

Système de captcha basé sur le score de confiance :
- **Score ≥ 70**: Pas de captcha (utilisateur de confiance)
- **Score 40-69**: hCaptcha invisible (vérification silencieuse)
- **Score < 40**: hCaptcha visible (challenge obligatoire)

**Fonctions**:
- `shouldShowCaptcha(score)`: Détermine le mode d'affichage
- `verifyHCaptcha(response, remoteIp)`: Vérifie la réponse hCaptcha
- `getSiteKey()`: Récupère la clé publique

**Utilisation**:
```typescript
import { shouldShowCaptcha, verifyHCaptcha } from "./secure/panel/hcaptcha";

const mode = shouldShowCaptcha(botScore); // "none" | "invisible" | "visible"
const result = await verifyHCaptcha(token, ip);
```

---

### 2. Proof of Work ✅
**Fichier**: `server/secure/panel/proof-of-work.ts`

Challenge cryptographique pour ralentir les bots :
- Génère un challenge aléatoire
- Le client doit trouver un nonce tel que SHA256(challenge + nonce) commence par N zéros
- Difficulté adaptative selon le score

**Fonctions**:
- `generateChallenge()`: Génère un nouveau challenge
- `verifySolution(solution)`: Vérifie la solution
- `getDifficultyForScore(score)`: Détermine la difficulté selon le score

**Utilisation**:
```typescript
import { generateChallenge, verifySolution } from "./secure/panel/proof-of-work";

const challenge = generateChallenge();
// Envoyer challenge au client
const isValid = verifySolution({ token: challenge.token, nonce: 12345 });
```

---

### 3. Mouse Dynamics ✅
**Fichier**: `server/secure/panel/mouse-dynamics.ts`

Analyse avancée des mouvements de souris :
- Linéarité vs courbes naturelles
- Variance de vitesse
- Accélération
- Micro-mouvements (tremblements humains)
- Intervalles de temps

**Fonctions**:
- `analyzeMouseDynamics(movements)`: Analyse les mouvements et retourne un score

**Utilisation**:
```typescript
import { analyzeMouseDynamics } from "./secure/panel/mouse-dynamics";

const result = analyzeMouseDynamics([
  { x: 100, y: 200, t: Date.now() },
  { x: 150, y: 250, t: Date.now() + 100 },
  // ...
]);
// result.score: 0-100, result.isHuman: boolean
```

---

### 4. WebGL Fingerprint ✅
**Fichier**: `server/secure/panel/webgl-fingerprint.ts`

Empreinte unique basée sur le GPU :
- Détecte les renderers de bots (SwiftShader, etc.)
- Identifie les VMs et environnements suspects
- Génère une empreinte unique par visiteur

**Fonctions**:
- `analyzeWebGLFingerprint(data)`: Analyse l'empreinte WebGL

**Utilisation**:
```typescript
import { analyzeWebGLFingerprint } from "./secure/panel/webgl-fingerprint";

const result = analyzeWebGLFingerprint({
  renderer: "ANGLE (NVIDIA GeForce RTX 3080)",
  vendor: "Google Inc. (NVIDIA)",
  extensions: ["WEBGL_compressed_texture_s3tc", ...],
  canvasHash: "abc123...",
});
```

---

### 5. Behavior Analysis ✅
**Fichier**: `server/secure/panel/behavior-analysis.ts`

Analyse comportementale des visiteurs :
- Patterns de mouvements de souris
- Patterns de clics
- Patterns de scroll
- Timing sur la page

**Fonctions**:
- `analyzeBehavior(data)`: Analyse complète du comportement

**Utilisation**:
```typescript
import { analyzeBehavior } from "./secure/panel/behavior-analysis";

const result = analyzeBehavior({
  mouseMovements: [...],
  clicks: [...],
  scrollEvents: [...],
  timeOnPage: 5000,
});
```

---

### 6. JS Challenge ✅
**Fichier**: `server/secure/panel/js-challenge.ts`

Challenge JavaScript invisible (Proof of Work léger) :
- Génère un challenge côté serveur
- Le client doit résoudre le challenge
- Vérification instantanée

**Fonctions**:
- `generateJSChallenge()`: Génère un nouveau challenge
- `verifyJSChallenge(solution)`: Vérifie la solution

**Utilisation**:
```typescript
import { generateJSChallenge, verifyJSChallenge } from "./secure/panel/js-challenge";

const challenge = generateJSChallenge();
// Envoyer au client
const isValid = verifyJSChallenge({ token: challenge.token, nonce: 12345 });
```

---

### 7. Honeypot ✅
**Fichier**: `server/secure/panel/honeypot.ts`

Système de champs honeypot invisibles :
- Génère des champs cachés dans les formulaires
- Seuls les bots les remplissent
- Détection instantanée

**Fonctions**:
- `generateHoneypotField()`: Génère un champ honeypot
- `generateHoneypotFields(count)`: Génère plusieurs champs
- `checkHoneypot(formData, fields)`: Vérifie si un bot a rempli les champs
- `quickHoneypotCheck(formData)`: Vérification rapide

**Utilisation**:
```typescript
import { generateHoneypotFields, checkHoneypot } from "./secure/panel/honeypot";

const fields = generateHoneypotFields(2);
// Inclure fields[0].html dans le formulaire
const { isBot } = checkHoneypot(req.body, fields);
```

---

## 📦 Export Centralisé

Tous les modules sont exportés depuis :
```typescript
import * from "./secure/panel/security-modules";
```

---

## 🔄 Intégration avec Bot Detection

Ces modules peuvent être intégrés dans le système de détection de bots existant pour calculer un score global de confiance.

**Exemple d'intégration**:
```typescript
import { analyzeMouseDynamics } from "./secure/panel/mouse-dynamics";
import { analyzeBehavior } from "./secure/panel/behavior-analysis";
import { analyzeWebGLFingerprint } from "./secure/panel/webgl-fingerprint";

function calculateBotScore(req: Request, clientData: any): number {
  let score = 50; // Score de base

  // Analyser les mouvements de souris
  if (clientData.mouseMovements) {
    const mouseResult = analyzeMouseDynamics(clientData.mouseMovements);
    score = (score + mouseResult.score) / 2;
  }

  // Analyser le comportement
  if (clientData.behavior) {
    const behaviorResult = analyzeBehavior(clientData.behavior);
    score = (score + behaviorResult.score) / 2;
  }

  // Analyser l'empreinte WebGL
  if (clientData.webgl) {
    const webglResult = analyzeWebGLFingerprint(clientData.webgl);
    score = (score + webglResult.score) / 2;
  }

  return Math.round(score);
}
```

---

## 📝 Notes

- Tous les modules sont en TypeScript avec types complets
- Compatibles avec l'architecture Node.js/Express
- Peuvent être utilisés individuellement ou en combinaison
- Configuration centralisée dans `server/secure/config/config.ts`

---

## 🚀 Prochaines Étapes

Pour utiliser ces modules dans l'application :

1. **Côté client** : Créer des composants React pour collecter les données (mouvements souris, WebGL, etc.)
2. **Côté serveur** : Intégrer dans les middlewares de détection de bots
3. **API endpoints** : Créer des routes pour les challenges (PoW, JS Challenge)
4. **Intégration** : Combiner tous les scores pour un score global de confiance
