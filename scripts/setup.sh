#!/usr/bin/env bash
set -euo pipefail

echo "=== Nekoni Setup ==="

# Create data directories
mkdir -p data/keys data/chroma data/sqlite data/ollama

# Resolve model from env (mirrors docker-compose default)
MODEL="${OLLAMA_MODEL:-llama3.2}"

# Pull Ollama model if ollama CLI is available locally
if command -v ollama &> /dev/null; then
  echo "Pulling Ollama model: $MODEL"
  ollama pull "$MODEL"
else
  echo "Ollama CLI not found locally — model will be pulled by Docker on first start."
fi

echo "Setup complete. Copy .env.example to .env and set SIGNAL_URL, then run 'docker compose up'."
