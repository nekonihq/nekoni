#!/usr/bin/env bash
# setup-lightsail.sh — run once on a fresh Ubuntu 24.04 Lightsail instance
# Usage:
#   git clone <repo> nekoni && bash nekoni/apps/signal/scripts/setup-lightsail.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"   # apps/signal
SERVICE="nekoni-signal"
PORT="${SIGNAL_PORT:-3000}"

echo "=== Nekoni Signal Server — Lightsail Setup ==="
echo "App dir: $APP_DIR"
echo "Port   : $PORT"
echo ""

# ── Swap (prevents OOM on 512 MB instances) ───────────────────────────────────
if [[ ! -f /swapfile ]]; then
  echo "Creating 1 GB swap file..."
  sudo fallocate -l 1G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

# ── System packages ────────────────────────────────────────────────────────────
echo "[1/4] Installing system dependencies..."
sudo apt-get update -q
sudo apt-get install -y -q git curl rsync unzip

# ── Node.js 22 via fnm ────────────────────────────────────────────────────────
# Pinned: >= 22.23.4 fixes CVE-2026-111497 (Node2Shell, Brotli RCE).
NODE_VERSION="22.23.4"
echo "[2/4] Installing Node.js $NODE_VERSION..."
if ! command -v fnm &>/dev/null; then
  curl -fsSL https://fnm.vercel.app/install | bash
fi
export PATH="$HOME/.local/share/fnm:$PATH"
eval "$(fnm env)"
fnm install "$NODE_VERSION"
fnm use "$NODE_VERSION"
fnm default "$NODE_VERSION"

# Make node available system-wide for pm2 startup hook
# fnm's real install dir, not `which node` (a per-shell fnm_multishells path).
NODE_DIR="$HOME/.local/share/fnm/node-versions/v$NODE_VERSION/installation/bin"
sudo ln -sf "$NODE_DIR/node" /usr/local/bin/node
sudo ln -sf "$NODE_DIR/npm"  /usr/local/bin/npm

npm install -g pnpm pm2 --silent

# ── Build ──────────────────────────────────────────────────────────────────────
echo "[3/4] Installing dependencies and building..."
cd "$APP_DIR"
# --ignore-workspace treats the signal app as standalone, skipping workspace:* resolution
pnpm install --ignore-workspace --config.strict-dep-builds=false
pnpm build

# ── PM2 ───────────────────────────────────────────────────────────────────────
echo "[4/4] Starting with PM2..."
pm2 delete "$SERVICE" 2>/dev/null || true
SIGNAL_PORT="$PORT" pm2 start dist/index.js --name "$SERVICE"
pm2 save

STARTUP_CMD="$(pm2 startup systemd -u "$USER" --hp "$HOME" | tail -1)"
if [[ "$STARTUP_CMD" == sudo* ]]; then
  eval "$STARTUP_CMD"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "=== Setup complete ==="
echo ""
echo "Signal server is running on port $PORT."
echo ""
echo "Next steps:"
echo "  1. Point a domain at this instance's static IP"
echo "  2. Set up Caddy for TLS (see DEPLOY.md)"
echo "  3. Set in your home machine .env:"
echo "       SIGNAL_URL=wss://<your-domain>"
echo ""
pm2 status
