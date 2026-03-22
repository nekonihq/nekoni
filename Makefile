.PHONY: up down build_up

up:
	docker compose up -d
	uv run --project apps/agent --env-file .env uvicorn nekoni_agent.main:app --host 0.0.0.0 --port 8000

build_up:
	docker compose up -d --build
	uv run --project apps/agent --env-file .env uvicorn nekoni_agent.main:app --host 0.0.0.0 --port 8000

down:
	docker compose down
