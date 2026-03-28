#!/usr/bin/env bash
# Nekoni installer
# Usage: curl -sSL https://raw.githubusercontent.com/nekonihq/nekoni/refs/heads/main/install.sh | bash
#
# Options (env vars):
#   NEKONI_DIR    - install directory (default: $HOME/.nekoni)
#   OLLAMA_MODEL  - model to pull   (default: llama3.2)
#   NEKONI_BRANCH - git branch      (default: main)

set -euo pipefail

REPO_URL="https://github.com/nekonihq/nekoni.git"
INSTALL_DIR="${NEKONI_DIR:-$HOME/.nekoni}"
OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.2}"
BRANCH="${NEKONI_BRANCH:-main}"

# ── colours ───────────────────────────────────────────────────────────────────
if [ -t 1 ]; then
  BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
else
  BOLD=''; GREEN=''; YELLOW=''; RED=''; CYAN=''; NC=''
fi

log()   { echo -e "${GREEN}==>${NC} ${BOLD}$*${NC}"; }
info()  { echo -e "    $*"; }
warn()  { echo -e "${YELLOW}warn:${NC} $*"; }
fatal() { echo -e "${RED}error:${NC} $*" >&2; exit 1; }

# ── OS / environment detection ────────────────────────────────────────────────
is_wsl() { grep -qi microsoft /proc/version 2>/dev/null; }

detect_os() {
  case "$(uname -s)" in
    Darwin) echo "macos" ;;
    Linux)
      if is_wsl; then echo "wsl"
      else echo "linux"; fi
      ;;
    *) fatal "Unsupported OS. On Windows, run install.ps1 instead:\n  irm https://nekoni.dev/install.ps1 | iex" ;;
  esac
}

OS=$(detect_os)

# ── helpers ───────────────────────────────────────────────────────────────────
has() { command -v "$1" &>/dev/null; }

need_sudo() {
  if [ "$EUID" -eq 0 ]; then "$@"
  else sudo "$@"; fi
}

# ── prerequisite: git ─────────────────────────────────────────────────────────
check_git() {
  if has git; then return; fi
  log "Installing git..."
  case "$OS" in
    macos)
      # Triggers the Xcode CLT installer prompt
      xcode-select --install 2>/dev/null || true
      until has git; do sleep 2; done
      ;;
    linux|wsl)
      if   has apt-get; then need_sudo apt-get install -y -q git
      elif has dnf;     then need_sudo dnf install -y git
      elif has yum;     then need_sudo yum install -y git
      elif has pacman;  then need_sudo pacman -Sy --noconfirm git
      else fatal "Cannot install git automatically. Please install it and retry."; fi
      ;;
  esac
}

# ── prerequisite: docker ──────────────────────────────────────────────────────
check_docker() {
  if has docker && docker info &>/dev/null 2>&1; then return; fi

  case "$OS" in
    macos)
      if has brew; then
        log "Installing Docker Desktop via Homebrew..."
        brew install --cask docker --quiet
        log "Starting Docker Desktop..."
        open -a Docker
        info "Waiting for Docker to be ready (this can take ~30 s on first launch)..."
        local i=0
        until docker info &>/dev/null 2>&1; do
          sleep 2; i=$((i+1))
          [ $i -le 30 ] || fatal "Docker did not start in time. Open Docker Desktop manually and re-run the installer."
        done
      else
        fatal "Docker Desktop is required.\n    Install Homebrew first (https://brew.sh) and re-run, or install Docker Desktop manually:\n    https://www.docker.com/products/docker-desktop/"
      fi
      ;;
    wsl)
      # Docker daemon is provided by Docker Desktop's WSL2 integration.
      # If it's not available the user needs to enable it in Docker Desktop settings.
      fatal "Docker not found.\n    Install Docker Desktop for Windows and enable WSL2 integration:\n    https://docs.docker.com/desktop/wsl/\n    Then re-run this installer from WSL."
      ;;
    linux)
      log "Installing Docker Engine..."
      curl -fsSL https://get.docker.com | sh
      need_sudo systemctl enable --now docker
      if [ -n "${USER:-}" ] && [ "$EUID" -ne 0 ]; then
        need_sudo usermod -aG docker "$USER"
        warn "Added $USER to the 'docker' group — you may need to log out and back in."
        warn "Using sudo for docker commands for the remainder of this session."
        docker() { need_sudo docker "$@"; }
      fi
      has docker || fatal "Docker installation failed. Please install Docker manually and retry."
      ;;
  esac
}

# ── prerequisite: uv ──────────────────────────────────────────────────────────
check_uv() {
  if has uv; then return; fi
  log "Installing uv (Python package manager)..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
  has uv || fatal "uv installation failed. See https://docs.astral.sh/uv/"
}

# ── prerequisite: ollama ──────────────────────────────────────────────────────
check_ollama() {
  if has ollama; then return; fi
  log "Installing Ollama..."
  if [ "$OS" = "macos" ] && has brew; then
    brew install --cask ollama --quiet
  else
    curl -fsSL https://ollama.com/install.sh | sh
  fi
  has ollama || fatal "Ollama installation failed. See https://ollama.com"
}

# ── clone / update ────────────────────────────────────────────────────────────
setup_repo() {
  if [ -d "$INSTALL_DIR/.git" ]; then
    log "Updating existing installation at $INSTALL_DIR..."
    git -C "$INSTALL_DIR" fetch --quiet origin
    git -C "$INSTALL_DIR" checkout --quiet "$BRANCH"
    git -C "$INSTALL_DIR" pull --quiet --ff-only origin "$BRANCH"
  else
    # Directory may exist from a previous partial install — remove it before cloning
    [ -d "$INSTALL_DIR" ] && rm -rf "$INSTALL_DIR"
    log "Cloning Nekoni into $INSTALL_DIR..."
    git clone --quiet --branch "$BRANCH" --depth 1 "$REPO_URL" "$INSTALL_DIR"
  fi
}

# ── env file ──────────────────────────────────────────────────────────────────
setup_env() {
  local env_file="$INSTALL_DIR/.env"
  if [ ! -f "$env_file" ]; then
    cp "$INSTALL_DIR/.env.example" "$env_file"
    info "Created .env from defaults — edit $env_file to customise"
  else
    info ".env already exists — skipping"
  fi
}

# ── Python deps ───────────────────────────────────────────────────────────────
sync_python() {
  log "Syncing Python dependencies..."
  uv sync --project "$INSTALL_DIR/apps/agent" --quiet
}

# ── Ollama model ──────────────────────────────────────────────────────────────
pull_model() {
  log "Pulling Ollama model: $OLLAMA_MODEL (this may take a few minutes)..."
  # start ollama serve in background if not already running
  if ! ollama list &>/dev/null 2>&1; then
    ollama serve &>/dev/null &
    local pid=$!
    sleep 3
    trap 'kill $pid 2>/dev/null || true' EXIT
  fi
  ollama pull "$OLLAMA_MODEL"
}

# ── start services ────────────────────────────────────────────────────────────
start_services() {
  log "Building and starting the dashboard..."
  docker compose -f "$INSTALL_DIR/docker-compose.yml" up -d --build --quiet-pull

  log "Generating TLS certificate..."
  uv run --project "$INSTALL_DIR/apps/agent" \
    python "$INSTALL_DIR/scripts/gen_cert.py" "$INSTALL_DIR/data/certs"

  log "Starting agent..."
  local log_file="$INSTALL_DIR/data/agent.log"
  (cd "$INSTALL_DIR" && uv run --project apps/agent \
    --env-file .env \
    python scripts/run_agent.py \
    > "$log_file" 2>&1 &)
  info "Agent running in background. Logs: $log_file"
}

# ── print next steps ──────────────────────────────────────────────────────────
print_success() {
  echo ""
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}${BOLD}  Nekoni is running!${NC}"
  echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo -e "  ${BOLD}Dashboard${NC}  →  http://localhost:8080"
  echo -e "  ${BOLD}Agent API${NC}  →  https://localhost:8443"
  echo ""
  echo -e "  ${BOLD}Connect from your phone:${NC}"
  echo -e "    Open the Nekoni mobile app and scan the QR code in the dashboard."
  echo ""
  echo -e "  ${BOLD}To stop:${NC}   cd $INSTALL_DIR && make down"
  echo -e "  ${BOLD}To start:${NC}  cd $INSTALL_DIR && make up"
  echo -e "  ${BOLD}Logs:${NC}      $INSTALL_DIR/data/agent.log"
  echo -e "  ${BOLD}Config:${NC}    $INSTALL_DIR/.env"
  echo ""
}

# ── main ──────────────────────────────────────────────────────────────────────
main() {
  echo ""
  echo -e "${CYAN}${BOLD}  Nekoni installer${NC}"
  echo ""

  check_git
  check_docker
  check_uv
  check_ollama

  setup_repo

  mkdir -p "$INSTALL_DIR/data/keys" \
           "$INSTALL_DIR/data/chroma" \
           "$INSTALL_DIR/data/sqlite" \
           "$INSTALL_DIR/data/certs" \
           "$INSTALL_DIR/data/ollama"
  setup_env
  sync_python
  pull_model
  start_services

  print_success
}

main "$@"
