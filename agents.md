# Agent Internals

This document covers the internals of the nekoni agent: how it processes messages, how to extend it with tools and skills, and how the security layer works end-to-end.

---

## Table of Contents

1. [Request Lifecycle](#request-lifecycle)
2. [ReAct Loop](#react-loop)
3. [Tool System](#tool-system)
4. [Skill System](#skill-system)
5. [RAG Pipeline](#rag-pipeline)
6. [Memory](#memory)
7. [WebRTC + DataChannel Auth](#webrtc--datachannel-auth)
8. [DataChannel Message Protocol](#datachannel-message-protocol)
9. [Trace Events](#trace-events)
10. [Adding a Tool](#adding-a-tool)
11. [Code Style](#code-style)

---

## Request Lifecycle

A message travels through these layers before the user gets a response:

```
Mobile (DataChannel)
  │
  ▼
DataChannelHandler._handle_message()    # webrtc/channel.py
  │  auth check (_auth_complete == True)
  │  route by msg_type prefix
  ├─► rag_*   → _handle_rag()
  ├─► skill_* / cron_* → _handle_skill()
  └─► plain message → on_message callback
  ▼
main._on_datachannel_message()          # main.py
  │  look up or create SessionContext
  ▼
AgentLoop.run()                         # agent/loop.py
  │  1. RAG retrieval (top-k chunks, filtered by min score)
  │  2. Build system prompt (tools JSON + RAG context)
  │  3. LLM call (Ollama), streaming chunks back to mobile
  │  4. Parse response — tool call? → execute → loop
  │     text response? → done
  ▼
trace_manager.emit()                    # api/ws.py
  │  broadcast each step to dashboard WebSocket
  ▼
DataChannel.send(response)              # back to mobile
```

---

## ReAct Loop

**File:** `apps/agent/src/nekoni_agent/agent/loop.py`

The loop implements a simplified ReAct (Reason + Act) pattern:

```
user message
  │
  ├─► RAG query (ChromaDB, top_k=5, min_score=0.3)
  │     → inject matching chunks into system prompt
  │
  └─► for iteration in range(max_react_iterations=8):
        │
        ├─► Ollama chat(messages)  ← streaming, chunks sent to mobile live
        │
        ├─► parse response for tool_call JSON
        │     {"tool_call": {"name": "...", "arguments": {...}}}
        │
        ├─► if tool call found:
        │     execute tool
        │     append (assistant: tool_call_json) to context
        │     append (tool: result) to context
        │     continue loop
        │
        └─► if plain text: return as final response
```

**Tool call format the LLM must output:**

```json
{"tool_call": {"name": "get_time", "arguments": {"timezone": "UTC"}}}
```

The parser first tries `json.loads(response)`, then falls back to a regex search for embedded JSON — accommodating models that add prose around the call.

**Session context** (`agent/context.py`) keeps a rolling window of the last 20 messages. System messages are pinned; oldest non-system messages are dropped when the limit is exceeded.

---

## Tool System

**Files:** `tools/base.py`, `tools/registry.py`, `tools/builtin/`

### Architecture

```
Tool (ABC)
  ├── name: str
  ├── description: str
  ├── parameters_schema: dict  ← JSON Schema, sent to LLM
  └── execute(**kwargs) → Any  ← called by AgentLoop

ToolRegistry
  ├── register(tool)
  ├── execute(name, **kwargs)
  └── to_json_schema() → list[dict]  ← injected into system prompt
```

### Built-in Tools

| Tool | File | Description |
|---|---|---|
| `get_time` | `builtin/get_time.py` | Current date/time, optional timezone (zoneinfo) |
| `web_search` | `builtin/web_search.py` | DuckDuckGo instant-answer API, no key required |
| `rag_query` | `builtin/rag_query.py` | Query ChromaDB knowledge base, returns top-k chunks |

### How Tools Are Exposed to the LLM

At startup, `ToolRegistry.to_json_schema()` serializes all tools:

```json
[
  {
    "name": "get_time",
    "description": "Get the current date and time.",
    "parameters": {
      "type": "object",
      "properties": {
        "timezone": {"type": "string", "description": "..."}
      },
      "required": []
    }
  }
]
```

This JSON is embedded directly into the system prompt so the LLM knows what it can call and how to format calls.

---

## Skill System

**Files:** `skills/models.py`, `skills/runner.py`, `skills/scheduler.py`

Skills are named prompt templates stored in SQLite. They can be run on demand or scheduled via cron expressions. Manageable from both the web dashboard and the mobile app over WebRTC.

### Architecture

```
Skill (SQLite row)
  ├── id: UUID
  ├── name: str
  ├── description: str
  ├── prompt: str          ← markdown prompt sent to the agent loop
  └── createdAt: int

CronJob (SQLite row)
  ├── id: UUID
  ├── skillId: UUID        ← foreign key to skill
  ├── cronExpression: str  ← standard 5-field cron (APScheduler)
  ├── enabled: bool
  ├── lastRun: int | None
  └── createdAt: int
```

### Running a Skill

```
run_skill(skill_id, prompt, agent_loop, sessions, trace_cb)
  │
  ├─► load or create SessionContext (session_id = "skill:{skill_id}")
  ├─► emit skill_event trace (event="skill_run_start")
  ├─► AgentLoop.run(prompt)  ← same path as user messages
  ├─► save messages to episodic memory
  └─► emit skill_event trace (event="skill_run_complete")
```

### Scheduler

`SkillScheduler` wraps APScheduler's `AsyncIOScheduler`. On startup it loads all enabled cron jobs from SQLite and schedules them via `CronTrigger.from_crontab()`. When a cron job fires, it calls `run_skill()` and then updates `lastRun`.

```python
skill_scheduler.configure(agent_loop, sessions, trace_cb)
await skill_scheduler.start()   # loads DB, starts APScheduler

skill_scheduler.schedule_job(job)    # add/update a job
skill_scheduler.unschedule_job(id)   # remove a job
```

### Management via REST

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/skills` | List all skills |
| `POST` | `/api/skills` | Create skill `{name, prompt, description}` |
| `PUT` | `/api/skills/{id}` | Update skill fields |
| `DELETE` | `/api/skills/{id}` | Delete skill + its cron jobs |
| `POST` | `/api/skills/{id}/run` | Run skill immediately |
| `GET` | `/api/cron` | List all cron jobs |
| `POST` | `/api/cron` | Create cron job `{skillId, cronExpression, enabled}` |
| `PUT` | `/api/cron/{id}` | Update expression or enabled state |
| `DELETE` | `/api/cron/{id}` | Delete cron job |
| `POST` | `/api/cron/{id}/run` | Trigger cron job immediately |

### Management via WebRTC DataChannel

The mobile app manages skills over the authenticated DataChannel using these message types:

| type (mobile → agent) | response type | Description |
|---|---|---|
| `skill_list` | `skill_list_response` | Fetch all skills |
| `skill_create` | `skill_response` | Create skill |
| `skill_update` | `skill_response` | Update skill |
| `skill_delete` | `skill_delete_response` | Delete skill |
| `skill_run` | `skill_run_response` | Run skill now |
| `cron_list` | `cron_list_response` | Fetch all cron jobs |
| `cron_create` | `cron_response` | Create cron job |
| `cron_update` | `cron_response` | Update cron job |
| `cron_delete` | `cron_delete_response` | Delete cron job |

---

## RAG Pipeline

**Files:** `rag/pipeline.py`, `rag/embedder.py`, `rag/store.py`

### Ingest

```
document (file or text)
  │
  ├─► extractor: plain text, PDF via pypdf (required for PDFs)
  │
  ├─► chunker: split into ~512-token windows, 50-token overlap
  │     (approximated as chars/4)
  │
  ├─► embedder: sentence-transformers all-MiniLM-L6-v2
  │     runs in thread pool executor (non-blocking)
  │
  └─► ChromaDB upsert
        collection: "nekoni_docs"
        similarity: cosine
        persistence: data/chroma/
        metadata: {doc_id, source, chunk_index}
```

Document ID is `sha256(text)[:16]` — re-ingesting the same content is idempotent.

Supported file types: plain text, PDF (pypdf must be installed), any text-decodable format.

### Query

```
user query string
  │
  ├─► embed with all-MiniLM-L6-v2
  │
  └─► ChromaDB query (cosine similarity, top_k=5)
        filter: score >= rag_min_score (default 0.3)
        returns: [{content (truncated to 600 chars), source, score}, ...]
```

The top chunks are injected into the system prompt before the LLM call:

```
Relevant context from your knowledge base:
[document.pdf]: chunk text here
---
[notes.txt]: another chunk
```

### Document Management

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/rag/documents` | List all documents `[{doc_id, source, chunks}]` |
| `DELETE` | `/api/rag/documents/{doc_id}` | Delete document and all its chunks |
| `POST` | `/api/ingest` | Ingest a file (multipart/form-data) |

### Mobile Upload Protocol (WebRTC)

Large files are chunked into 15 KB base64 segments sent as sequential DataChannel messages:

```
mobile → {type: "rag_upload_start", uploadId, filename, totalChunks}
mobile → {type: "rag_upload_chunk", uploadId, index, content}  × N
agent  → reassemble → ingest_file() → {type: "rag_upload_response", doc_id, chunks}

mobile → {type: "rag_list"}   → agent → {type: "rag_list_response", documents: [...]}
mobile → {type: "rag_delete", doc_id} → agent → {type: "rag_delete_response"}
```

---

## Memory

### Short-term: Working Memory (`memory/short.py`)

An in-process bounded deque (`maxlen=50`). Stores typed entries for the current session.

```python
mem = WorkingMemory(maxlen=50)
mem.add("observation", "User mentioned they like jazz")
mem.get_recent(n=10)  # last 10 entries
```

### Long-term: Episodic Memory (`memory/long.py`)

SQLite-backed via `aiosqlite`. Stores the full message history across sessions.

```sql
CREATE TABLE episodes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role       TEXT NOT NULL,       -- user / assistant / tool
    content    TEXT NOT NULL,
    timestamp  REAL NOT NULL
);
```

---

## WebRTC + DataChannel Auth

### WebRTC Peer (`webrtc/peer.py`)

On startup the agent:
1. Loads or generates its Ed25519 identity key
2. Opens a WebSocket to the signal server and joins its fixed room
3. Waits for a `peer_joined` event (mobile connects)
4. On receiving an `offer`, creates an `RTCPeerConnection` (aiortc), generates an answer, sends it back
5. On `icecandidate`, forwards to the mobile peer via signaling
6. Once DataChannel is established, hands off to `DataChannelHandler`

All outgoing signaling messages are signed:
```python
sig = sign_payload({k: v for k, v in msg.items()}, self._private_key)
```

### DataChannel Handshake (`webrtc/channel.py`)

After the DTLS-encrypted DataChannel opens, a 4-step application-layer mutual auth runs:

```
Step 1  Mobile → Agent   {type:"hello", pubKey, nonce_m}
Step 2  Agent  → Mobile  {type:"challenge", nonce_a, sig=sign(nonce_m)}
Step 3  Mobile → Agent   {type:"response", sig=sign(nonce_a)}
Step 4  Agent  → Mobile  {type:"ready"}
```

- Step 1: Agent checks `pubKey` is in `approved_devices.json` — if not, closes immediately
- Step 2: Agent signs mobile's nonce with its identity key so mobile can verify it's talking to the real agent (matches QR-scanned pubKey)
- Step 3: Mobile signs agent's nonce — proves possession of the registered private key
- Step 4: Both sides are authenticated; normal message exchange begins

Any failure at any step sends `{type:"auth_failed", reason}` and closes the channel.

### Signature Format

All signatures (signaling + DataChannel):

```
sig = base64url(Ed25519Sign(UTF8(JSON.stringify(payload_without_sig, sorted_keys)), senderPrivKey))
```

- Payload is JSON-serialized with **sorted top-level keys only**, no extra whitespace
- Signature is Ed25519 over the raw UTF-8 encoded JSON bytes (no pre-hashing)
- Encoded as base64url without padding
- Python: `cryptography` library, `Ed25519PrivateKey.sign(payload_bytes)`
- TypeScript: `@noble/ed25519` v3, `ed.sign(payloadBytes, privKeyBytes)`
- React Native: `tweetnacl`, `nacl.sign.detached(payloadBytes, secretKeyBytes)`

---

## DataChannel Message Protocol

All messages are JSON. After auth, the channel handles:

### Chat messages
```json
{"type": "message", "content": "...", "sessionId": "..."}
```
Response: streaming `{"type": "chunk", "content": "..."}` tokens, then `{"type": "message_end"}` (or `{"type": "message", "content": "..."}` if no streaming occurred).

### Ping/pong
```json
{"type": "ping"}  →  {"type": "pong"}
```

### Session sync
```json
{"type": "sync", "sessionId": "...", "afterTimestamp": 0}
→ {"type": "sync_response", "messages": [...]}
```

### RAG operations
See [Mobile Upload Protocol](#mobile-upload-protocol-webrtc) above.

### Skill/cron operations
See [Management via WebRTC DataChannel](#management-via-webrtc-datachannel) above.

---

## Trace Events

Every step in the agent loop emits a `TraceEvent` broadcast to all connected dashboard WebSocket clients (`/ws/traces`).

```typescript
interface TraceEvent {
  id: string
  sessionId: string
  timestamp: number           // Unix ms
  type: "llm_call" | "tool_call" | "rag_query" | "skill_event" | "error" | "message"
  data: Record<string, unknown>
  parentId?: string
}
```

**Event types emitted by `AgentLoop.run()`:**

| type | when | data fields |
|---|---|---|
| `rag_query` | before every LLM call | `{query}` |
| `llm_call` | each LLM call | `{iteration, messages_count}` |
| `tool_call` | tool invocation | `{tool, arguments, iteration}` |
| `tool_call` | tool completion | `{tool, result, duration_ms, status}` |
| `error` | LLM or tool error | `{error}` |
| `message` | final response | `{role: "agent", content}` |
| `skill_event` | skill lifecycle / system events | `{event, ...}` |

**Trace sessions:** The `/api/traces/sessions` endpoint returns distinct `sessionId` values with event counts and last timestamps. The dashboard Traces page can filter by session.

---

## Adding a Tool

1. Create `apps/agent/src/nekoni_agent/tools/builtin/my_tool.py`:

```python
from typing import Any
from ..base import Tool

class WeatherTool(Tool):
    @property
    def name(self) -> str:
        return "get_weather"

    @property
    def description(self) -> str:
        return "Get current weather for a city."

    @property
    def parameters_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "city": {
                    "type": "string",
                    "description": "City name, e.g. 'London'",
                },
            },
            "required": ["city"],
        }

    async def execute(self, city: str) -> dict:
        return {"city": city, "temp": "22°C", "condition": "sunny"}
```

2. Register in `apps/agent/src/nekoni_agent/main.py`:

```python
from .tools.builtin.my_tool import WeatherTool
tool_registry.register(WeatherTool())
```

**Guidelines:**
- Keep `execute()` async — use `asyncio.get_event_loop().run_in_executor()` for blocking work
- Return JSON-serializable types
- Keep `description` concise — it goes into the LLM's context window
- Raise exceptions on failure; the loop catches them and reports an error trace event

---

## Code Style

### TypeScript / JavaScript

- **Fat arrow functions**: `const foo = () => {}` — not `function foo() {}`
- **Named exports**: `export const Foo = ...` — default exports only for Expo Router page files (framework requirement)
- **Hooks**: `export const useXxx = (...) => { ... }`
- **React components**: `export const MyComponent = (props: Props) => { ... }`

### Prettier (`.prettierrc`)

```json
{
  "printWidth": 60,
  "tabWidth": 2,
  "singleQuote": true,
  "trailingComma": "all",
  "semi": false,
  "arrowParens": "always"
}
```

Run: `npx prettier --write "apps/**/*.{ts,tsx}"`

### Python (Ruff)

Configured in `apps/agent/pyproject.toml`. Line length 88, double quotes, Black-compatible.

```bash
# from apps/agent/
.venv/bin/ruff format src/        # format
.venv/bin/ruff check src/         # lint
.venv/bin/ruff check --fix src/   # lint + auto-fix
```
