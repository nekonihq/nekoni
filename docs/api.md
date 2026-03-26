# API Reference

## Agent API

Base URL:

```text
http://localhost:8000
```

| Method   | Path                          | Description                                    |
| -------- | ----------------------------- | ---------------------------------------------- |
| `GET`    | `/`                           | Branded page used to confirm certificate trust |
| `GET`    | `/health`                     | Healthcheck                                    |
| `GET`    | `/api/qr`                     | QR payload JSON for pairing                    |
| `GET`    | `/api/qr/image`               | QR code PNG                                    |
| `POST`   | `/api/pair`                   | Signed pairing request                         |
| `GET`    | `/api/pair/pending`           | Pending pairing requests                       |
| `POST`   | `/api/pair/approve`           | Approve or reject pairing                      |
| `GET`    | `/api/pair/devices`           | Approved devices                               |
| `DELETE` | `/api/pair/devices/{key}`     | Revoke a device                                |
| `POST`   | `/api/ingest`                 | Ingest a document into RAG                     |
| `GET`    | `/api/rag/documents`          | List all RAG documents                         |
| `DELETE` | `/api/rag/documents/{doc_id}` | Delete a document                              |
| `GET`    | `/api/skills`                 | List all skills                                |
| `POST`   | `/api/skills`                 | Create a skill                                 |
| `PUT`    | `/api/skills/{id}`            | Update a skill                                 |
| `DELETE` | `/api/skills/{id}`            | Delete a skill and its cron jobs               |
| `POST`   | `/api/skills/{id}/run`        | Run a skill immediately                        |
| `GET`    | `/api/cron`                   | List all cron jobs                             |
| `POST`   | `/api/cron`                   | Create cron job                                |
| `PUT`    | `/api/cron/{id}`              | Update a cron job                              |
| `DELETE` | `/api/cron/{id}`              | Delete a cron job                              |
| `POST`   | `/api/cron/{id}/run`          | Trigger a cron job immediately                 |
| `GET`    | `/api/traces`                 | List recent trace events                       |
| `DELETE` | `/api/traces`                 | Clear all trace history                        |
| `GET`    | `/api/traces/sessions`        | List distinct session IDs                      |
| `GET`    | `/api/tools`                  | List registered tools                          |
| `WS`     | `/ws/traces`                  | Live trace event stream                        |

## Example: Ingest a Document

```bash
curl -X POST http://localhost:8000/api/ingest \
  -F "file=@/path/to/document.pdf"
```

Example response:

```json
{
  "success": true,
  "documentId": "abc123",
  "chunks": 42,
  "filename": "document.pdf"
}
```

## Signal Server

Public:

```text
wss://signal.nekoni.dev
```

Self-hosted default:

```text
ws://localhost:3000
```

| Method | Path      | Description                   |
| ------ | --------- | ----------------------------- |
| `GET`  | `/health` | Healthcheck                   |
| `WS`   | `/`       | WebSocket signaling transport |
