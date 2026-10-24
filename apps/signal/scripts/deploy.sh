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

# Keep in sync with setup-lightsail.sh. Re-point the system-wide symlinks and
# `pm2 update` so the PM2 daemon itself respawns on the new node.
NODE_VERSION="22.23.4"
fnm install "$NODE_VERSION"
fnm use "$NODE_VERSION"
fnm default "$NODE_VERSION"
NODE_DIR="$(dirname "$(which node)")"
sudo ln -sf "$NODE_DIR/node" /usr/local/bin/node
sudo ln -sf "$NODE_DIR/npm"  /usr/local/bin/npm
npm install -g pnpm pm2 --silent

# Newer pnpm fails on unapproved build scripts; esbuild's is only for tsx
# (dev), the production build is plain tsc.
pnpm install --ignore-workspace --config.strict-dep-builds=false
pnpm build
pm2 restart "$SERVICE"
pm2 update

# The systemd unit pins the node bin dir in its PATH; regenerate it so a
# reboot resurrects PM2 on this node, not the previous version.
pm2 save
sudo env PATH="$PATH:$NODE_DIR" "$(which pm2)" startup systemd -u "$USER" --hp "$HOME"

echo ""
pm2 status "$SERVICE"
