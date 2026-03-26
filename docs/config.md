# Configuration

Copy `.env.example` to `.env` and adjust values as needed.

| Variable             | Default                   | Description                             |
| -------------------- | ------------------------- | --------------------------------------- |
| `SIGNAL_URL`         | `wss://signal.nekoni.dev` | Signal server WebSocket                 |
| `OLLAMA_MODEL`       | `llama3.2`                | Model to use                            |
| `OLLAMA_BASE_URL`    | `http://localhost:11434`  | Ollama endpoint                         |
| `DASHBOARD_USERNAME` | `admin`                   | Dashboard login username                |
| `DASHBOARD_PASSWORD` | `nekoni`                  | Dashboard login password — change this  |
| `AGENT_NAME`         | `nekoni`                  | Agent display name                      |
| `AGENT_PORT`         | `8000`                    | Agent HTTP port                         |
| `AGENT_PORT_HTTPS`   | `8443`                    | Agent HTTPS port                        |
| `AGENT_CERTS_DIR`    | `data/certs`              | Path for auto-generated TLS certificate |
| `AGENT_KEYS_DIR`     | `./data/keys`             | Path for identity key storage           |
| `CHROMA_PATH`        | `./data/chroma`           | ChromaDB data directory                 |
| `SQLITE_PATH`        | `./data/sqlite/memory.db` | SQLite DB path                          |

## Notes

After changing `OLLAMA_MODEL`, run:

```bash
make pull
```
