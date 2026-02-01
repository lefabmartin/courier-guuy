# Déployer le frontend sur un VPS (backend sur Render)

Ce guide décrit comment servir le **frontend** (fichiers statiques) depuis ton VPS (ex. **thcourierguuy.info**) tout en gardant le **backend** (API Node) sur Render.

---

## Schéma

- **VPS** : sert uniquement les fichiers du build client (`dist/public`) — HTML, JS, CSS.
- **Render** : sert l’API (`/api/*`) et n’a pas besoin de servir les fichiers statiques pour ce scénario.
- Le navigateur charge la page depuis le VPS, puis les appels API partent vers l’URL Render (grâce à `VITE_API_ORIGIN`).

---

## 1. Build du frontend avec l’URL de l’API

Le front doit connaître l’URL du backend au **moment du build**.

En local (ou sur une machine de build) :

```bash
# Remplacer par l’URL réelle de ton service Render (sans slash final)
export VITE_API_ORIGIN=https://courier-guuy-xxxx.onrender.com
npm install --include=dev
npm run build
```

Le dossier **`dist/public`** contient tout le frontend à déployer sur le VPS (fichiers statiques uniquement).

---

## 2. Envoyer les fichiers sur le VPS

Depuis la racine du projet, après le build :

```bash
# Exemple avec rsync (remplace user et 62.4.16.211 par ton user / IP ou hostname)
rsync -avz --delete dist/public/ user@62.4.16.211:/var/www/courier-guuy/
```

Ou avec **scp** :

```bash
scp -r dist/public/* user@62.4.16.211:/var/www/courier-guuy/
```

Adapte le chemin `/var/www/courier-guuy/` selon ta config (Nginx/Apache).

---

## 3. CORS sur le backend (Render)

Quand le front est sur un autre domaine (le VPS), le backend doit accepter les requêtes **cross-origin**.

Sur **Render**, dans **Environment** du service, ajoute :

| Key              | Value                        | Secret |
|------------------|------------------------------|--------|
| `FRONTEND_ORIGIN` | `https://thcourierguuy.info` | Non    |

(Sans slash final. Utilise le domaine exact servi par le VPS.)

Le serveur envoie alors les en-têtes CORS pour autoriser les requêtes depuis ce domaine.

---

## 4. Nginx sur le VPS

Exemple de configuration pour servir le frontend et faire le fallback SPA (routes comme `/admin`, `/vbv-panel` → `index.html`) :

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name thcourierguuy.info www.thcourierguuy.info;

    root /var/www/courier-guuy;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache des assets (JS/CSS avec hash dans le nom)
    location ~* \.(js|css|ico|png|jpg|jpeg|gif|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Pour HTTPS (recommandé), utilise par exemple **Certbot** :

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d thcourierguuy.info -d www.thcourierguuy.info
```

Puis recharge Nginx :

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 5. Apache sur le VPS

Si tu utilises Apache, active `mod_rewrite` puis un fichier **`.htaccess`** à la racine du site (ex. `/var/www/courier-guuy/.htaccess`) :

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</IfModule>
```

Le **DocumentRoot** doit pointer vers le dossier qui contient `index.html` (ex. `/var/www/courier-guuy`).

---

## 6. Résumé des variables

| Où        | Variable            | Valeur exemple                          |
|-----------|---------------------|-----------------------------------------|
| **Build** | `VITE_API_ORIGIN`   | `https://courier-guuy-xxxx.onrender.com` |
| **Render**| `FRONTEND_ORIGIN`   | `https://thcourierguuy.info`            |

- **VITE_API_ORIGIN** : définie **au build** pour que le client appelle la bonne API.
- **FRONTEND_ORIGIN** : définie **sur Render** pour que l’API accepte les requêtes depuis le domaine du VPS (CORS).

---

## 7. Vérifications

1. Ouvrir **https://thcourierguuy.info** : la page d’accueil s’affiche (servie par le VPS).
2. Soumettre un formulaire / utiliser les pages qui appellent l’API : les requêtes doivent aller vers Render et fonctionner (vérifier l’onglet Réseau du navigateur : URL du type `https://courier-guuy-xxxx.onrender.com/api/...`).
3. Tester **https://thcourierguuy.info/admin** et **https://thcourierguuy.info/vbv-panel** : le fallback SPA doit afficher la bonne page (pas de 404).

Si tu as des 404 sur l’API, vérifie que `VITE_API_ORIGIN` était bien défini au build. Si le navigateur bloque les requêtes (CORS), vérifie `FRONTEND_ORIGIN` sur Render et que l’origine dans la barre d’adresse correspond exactement (schéma + domaine, sans slash final).

---

## 8. Dépannage : 404 sur /admin ou /vbv-panel

Si la console affiche **« Failed to load resource: 404 »** quand tu ouvres `https://thcourierguuy.info/admin` (ou `/vbv-panel`), c’est que le **serveur web sur le VPS** ne fait pas le **fallback SPA** : il cherche un fichier ou un dossier nommé `admin` au lieu de renvoyer `index.html`.

**À faire :**

- **Nginx** : dans le `server` qui sert le site, la directive `location /` doit contenir **`try_files $uri $uri/ /index.html;`** (voir section 4). Vérifie que le bloc `location /` existe bien et qu’il n’est pas écrasé par une autre `location`. Puis `sudo nginx -t && sudo systemctl reload nginx`.
- **Apache** : le fichier **`.htaccess`** à la racine du site (section 5) doit être présent et `mod_rewrite` activé (`sudo a2enmod rewrite` puis `sudo systemctl reload apache2`).

Après correction, recharger `https://thcourierguuy.info/admin` doit afficher la page d’admin au lieu d’un 404.
