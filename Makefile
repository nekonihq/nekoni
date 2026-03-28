-include .env
export

OLLAMA_MODEL ?= llama3.2
OS := $(shell uname -s 2>/dev/null || echo Windows)

.PHONY: up down build_up install pull _kill_agent

install: _check_docker _install_uv _install_ollama _install_pnpm _sync_deps
	@echo ""
	@echo "All prerequisites installed. Next: make pull && make up"

_check_docker:
	@if ! command -v docker > /dev/null 2>&1; then \
		echo "ERROR: Docker not found."; \
		echo "Install Docker Desktop: https://www.docker.com/products/docker-desktop/"; \
		exit 1; \
	fi
	@echo "Docker: ok"

_install_uv:
	@if command -v uv > /dev/null 2>&1; then \
		echo "uv: ok"; \
	elif [ "$(OS)" = "Darwin" ] || [ "$(OS)" = "Linux" ]; then \
		curl -LsSf https://astral.sh/uv/install.sh | sh; \
	else \
		powershell -Command "irm https://astral.sh/uv/install.ps1 | iex"; \
	fi

_install_ollama:
	@if command -v ollama > /dev/null 2>&1; then \
		echo "Ollama: ok"; \
	elif [ "$(OS)" = "Darwin" ] || [ "$(OS)" = "Linux" ]; then \
		curl -fsSL https://ollama.com/install.sh | sh; \
	else \
		winget install Ollama.Ollama; \
	fi

_install_pnpm:
	@if command -v pnpm > /dev/null 2>&1; then \
		echo "pnpm: ok"; \
	elif command -v npm > /dev/null 2>&1; then \
		npm install -g pnpm; \
	else \
		echo "WARNING: Node.js not found. Install from https://nodejs.org (only needed for dashboard development)"; \
	fi

_sync_deps:
	uv sync --project apps/agent

pull:
	ollama pull $(OLLAMA_MODEL)

_kill_agent:
	@lsof -ti:8443,8000 | sort -u | xargs kill 2>/dev/null || true

up: _kill_agent
	docker compose up -d
	uv run --project apps/agent python scripts/gen_cert.py data/certs
	uv run --project apps/agent --env-file .env python scripts/run_agent.py

build_up: _kill_agent
	docker compose up -d --build
	uv run --project apps/agent python scripts/gen_cert.py data/certs
	uv run --project apps/agent --env-file .env python scripts/run_agent.py

down: _kill_agent
	docker compose down
