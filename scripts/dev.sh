#!/usr/bin/env bash
set -euo pipefail

echo "=== Nekoni Dev Mode ==="

# Start infrastructure services only
docker-compose -f docker-compose.dev.yml up -d ollama

# Wait for ollama
echo "Waiting for Ollama..."
until curl -sf http://localhost:11434/api/tags > /dev/null; do
  sleep 2
done
echo "Ollama ready."

# Start signal server
echo "Starting signal server..."
pnpm --filter @nekoni/signal dev &
SIGNAL_PID=$!

# Start agent
echo "Starting agent..."
cd apps/agent && uv run uvicorn nekoni_agent.main:app --reload --host 0.0.0.0 --port 8000 &
AGENT_PID=$!

# Start dashboard
echo "Starting dashboard..."
pnpm --filter @nekoni/dashboard dev &
DASH_PID=$!

echo "All services started."
echo "  Agent:     http://localhost:8000"
echo "  Signal:    ws://localhost:3000"
echo "  Dashboard: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all."

trap "kill $SIGNAL_PID $AGENT_PID $DASH_PID 2>/dev/null; exit" INT TERM
wait
