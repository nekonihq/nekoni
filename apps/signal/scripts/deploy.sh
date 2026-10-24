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

# Keep in sync with setup-lightsail.sh.
NODE_VERSION="22.23.4"
fnm install "$NODE_VERSION"
fnm use "$NODE_VERSION"
fnm default "$NODE_VERSION"
# fnm's real install dir, not `which node` (a per-shell fnm_multishells path
# that vanishes when the shell exits).
NODE_DIR="$HOME/.local/share/fnm/node-versions/v$NODE_VERSION/installation/bin"
sudo ln -sf "$NODE_DIR/node" /usr/local/bin/node
sudo ln -sf "$NODE_DIR/npm"  /usr/local/bin/npm
npm install -g pnpm pm2 --silent

# Newer pnpm fails on unapproved build scripts; esbuild's is only for tsx
# (dev), the production build is plain tsc.
pnpm install --ignore-workspace --config.strict-dep-builds=false
pnpm build
# Recreate rather than restart/resurrect: PM2 saves the process env (incl. the
# old PATH), so `node` would keep resolving to the previous version.
pm2 delete "$SERVICE" 2>/dev/null || true
SIGNAL_PORT="${SIGNAL_PORT:-3000}" pm2 start dist/index.js --name "$SERVICE" --interpreter "$NODE_DIR/node"

pm2 save
# Respawn the PM2 daemon itself on the new node (resurrects the dump above).
pm2 update

# The systemd unit pins the pm2 path and node bin dir; regenerate it so a
# reboot resurrects PM2 on this node, not the previous version.
sudo env PATH="$NODE_DIR:$PATH" "$NODE_DIR/pm2" startup systemd -u "$USER" --hp "$HOME"

echo ""
pm2 status "$SERVICE"
