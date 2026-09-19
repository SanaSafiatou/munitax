#!/usr/bin/env bash
# Veille MuniTax (plan gratuit) : redémarre automatiquement l'application ou
# le tunnel ngrok dès qu'il détecte une panne, et journallise chaque contrôle.
# Appelé par cron toutes les 2 minutes : * * * * * /home/ange-eudes/taxes-municipales/scripts/veille.sh
set -uo pipefail
LOG="/tmp/opencode/veille.log"
LOCAL="http://localhost:3100/login"
PUBLIC="https://taco-oaf-graduate.ngrok-free.dev/login"

ecrire() { echo "[$(date '+%F %T')] $*" >> "$LOG"; }

# 1. L'application locale doit répondre.
if curl -s -o /dev/null --max-time 8 "$LOCAL"; then
  APP="ok"
else
  APP="relancee"
  ecrire "application locale KO -> pm2 restart munitax-app"
  pm2 restart munitax-app --update-env >/dev/null 2>&1
fi

# 2. Le lien public doit répondre (tunnel ngrok vers le port 3100).
if curl -s -o /dev/null --max-time 20 "$PUBLIC"; then
  TUN="ok"
else
  TUN="relance"
  ecrire "lien public KO -> pm2 restart munitax-tunnel"
  pm2 restart munitax-tunnel >/dev/null 2>&1
fi

ecrire "controle : app=$APP tunnel=$TUN"