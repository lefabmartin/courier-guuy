/**
 * Configuration PM2 pour le déploiement en production
 * 
 * Pour utiliser ce fichier :
 * 1. Copiez-le en ecosystem.config.js
 * 2. Ajustez les paramètres selon vos besoins
 * 3. Lancez : pm2 start ecosystem.config.js
 */

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
    max_memory_restart: '1G',
    min_uptime: '10s',
    max_restarts: 10
  }]
};
