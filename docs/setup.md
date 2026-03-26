# Setup

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- `make`
  - macOS/Linux: usually built in
  - Windows: use Chocolatey or WSL
- ~4 GB disk space for the Ollama model

Everything else is installed by `make install`.

## Quick Start

```bash
git clone https://github.com/nekonihq/nekoni && cd nekoni

cp .env.example .env

make install
make pull
make up
```

## Services

| Service       | URL                    |
| ------------- | ---------------------- |
| Agent API     | http://localhost:8000  |
| Agent API TLS | https://localhost:8443 |
| Dashboard     | http://localhost:8080  |
| Ollama        | http://localhost:11434 |

## Change the Model

Update `OLLAMA_MODEL` in `.env` and then run:

```bash
make pull
```

## Stop Everything

```bash
make down
```

## Notes

The dashboard runs in Docker, while the agent runs on the host. This is intentional so WebRTC works correctly across platforms.
