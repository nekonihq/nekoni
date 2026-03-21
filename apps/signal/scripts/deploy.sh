#!/usr/bin/env bash
# deploy.sh — redeploy after pulling latest changes
# Run from within the repo on the instance:
#   cd nekoni && git pull && bash apps/signal/scripts/deploy.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVICE="nekoni-signal"

echo "=== Nekoni Signal — Redeploying ==="
cd "$APP_DIR"

export PATH="$HOME/.local/share/fnm:$PATH"
eval "$(fnm env)"

npm install
npm run build
pm2 restart "$SERVICE"

echo ""
pm2 status "$SERVICE"
