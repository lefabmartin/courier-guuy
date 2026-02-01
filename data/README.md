# 📁 Fichiers de Configuration et Logs

Les fichiers de configuration et de logs sont stockés **à la racine du projet**.

## 📋 Fichiers

### `whitelist.txt` (racine du projet)
Liste des adresses IP autorisées (whitelist). Une IP dans cette liste contourne toutes les vérifications de sécurité.

**Format** : Une IP par ligne
```
127.0.0.1
192.168.1.1
# Les lignes commençant par # sont des commentaires
```

### `blacklist.txt` (racine du projet)
Liste des adresses IP bloquées (blacklist). Une IP dans cette liste est automatiquement bloquée.

**Format** : Une IP par ligne
```
10.0.0.1
172.16.0.1
# Les lignes commençant par # sont des commentaires
```

### `botfuck.txt` (racine du projet)
Fichier de logs des activités suspectes de bots. Enregistre toutes les détections de bots, tentatives de blocage, et activités suspectes.

**Format** : 
```
[2024-01-15T10:30:45.123Z] 192.168.1.100 | Mozilla/5.0... | Suspicious User-Agent | Score: 75 | Action: blocked | Details: {...}
```

## 🔧 Gestion des Fichiers

### Via le Code

Les fichiers sont gérés automatiquement par les modules suivants :

- **`server/secure/panel/ip-manager.ts`** : Gestion de `whitelist.txt` et `blacklist.txt`
- **`server/secure/panel/botfuck-logger.ts`** : Gestion de `botfuck.txt`

### Fonctions Disponibles

#### IP Manager (`ip-manager.ts`)
```typescript
import { 
  loadWhitelist, 
  loadBlacklist, 
  addToWhitelist, 
  addToBlacklist,
  removeFromWhitelist,
  removeFromBlacklist,
  isWhitelisted,
  isBlacklisted
} from "./server/secure/panel/ip-manager";

// Ajouter une IP à la blacklist
await addToBlacklist("192.168.1.100");

// Vérifier si une IP est whitelistée
const isAllowed = await isWhitelisted("127.0.0.1");
```

#### BotFuck Logger (`botfuck-logger.ts`)
```typescript
import { 
  logBotActivity, 
  readBotLogs, 
  clearBotLogs,
  countBotLogs 
} from "./server/secure/panel/botfuck-logger";

// Logger une activité suspecte
await logBotActivity(
  "192.168.1.100",
  "Suspicious User-Agent detected",
  "blocked",
  {
    userAgent: "curl/7.68.0",
    score: 85,
    details: { url: "/api/payment" }
  }
);

// Lire les dernières entrées
const logs = await readBotLogs(50); // 50 dernières entrées
```

## 📝 Notes

- Les fichiers sont créés automatiquement s'ils n'existent pas
- Les commentaires (lignes commençant par `#`) sont ignorés lors de la lecture
- Les fichiers sont stockés **à la racine du projet** (même niveau que `package.json`)

## 🔒 Sécurité

⚠️ **Important** : Ces fichiers contiennent des informations sensibles. Assurez-vous de :
- Ne pas les commiter dans Git (ajoutez `data/` au `.gitignore`)
- Protéger l'accès au serveur
- Ne pas exposer ces fichiers via le serveur web
