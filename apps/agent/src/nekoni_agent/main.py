"""FastAPI entrypoint for nekoni agent."""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .agent.context import SessionContext
from .agent.history import load_messages, save_message
from .agent.loop import AgentLoop
from .api.auth import auth_router, get_current_token, load_token_on_startup, require_auth
from .api.routes import public_router, router
from .api.ws import trace_manager
from .config import settings
from .llm.client import OllamaClient
from .rag.pipeline import RAGPipeline
from .tools.builtin.get_time import GetTimeTool
from .tools.builtin.rag_query import RAGQueryTool
from .tools.builtin.web_search import WebSearchTool
from .tools.registry import ToolRegistry
from .webrtc.peer import AgentPeer


# Global singletons — room_id is persisted so QR codes stay valid across reloads
def _load_or_create_room_id() -> str:
    import os

    path = os.path.join(settings.agent_keys_dir, "room_id.txt")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        with open(path) as f:
            return f.read().strip()
    except FileNotFoundError:
        rid = str(uuid.uuid4())
        with open(path, "w") as f:
            f.write(rid)
        return rid


room_id: str = _load_or_create_room_id()
rag_pipeline = RAGPipeline()
tool_registry = ToolRegistry()
_llm: OllamaClient | None = None
_agent_loop: AgentLoop | None = None
_peer: AgentPeer | None = None
_sessions: dict[str, SessionContext] = {}
_skill_scheduler_started = False


async def _on_datachannel_message(
    content: str,
    mobile_pub_key: str,
    session_id: str,
    send_chunk,
) -> str | None:
    """Called when an authenticated DataChannel message arrives."""
    # Use conversation ID from mobile; fall back to device key prefix
    if not session_id:
        session_id = mobile_pub_key[:16] if mobile_pub_key else "default"

    if session_id not in _sessions:
        # Load persisted history so the agent has full context
        prior = await load_messages(session_id)
        ctx = SessionContext(session_id=session_id)
        ctx.messages = prior
        _sessions[session_id] = ctx
        if prior:
            print(
                f"[main] Restored {len(prior)} messages"
                f" for session {session_id!r}"
            )

    context = _sessions[session_id]

    if _agent_loop is None:
        return

    now_ms = int(time.time() * 1000)
    await trace_manager.emit(
        {
            "id": str(uuid.uuid4()),
            "sessionId": session_id,
            "timestamp": now_ms,
            "type": "message",
            "data": {"role": "user", "content": content},
        }
    )

    async def on_token(token: str) -> None:
        send_chunk(token)

    # Track message count before run so we save only new messages
    before = len(context.messages)
    response = await _agent_loop.run(content, context, on_token=on_token)

    # Persist messages added during this turn
    for msg in context.messages[before:]:
        await save_message(session_id, msg)

    await trace_manager.emit(
        {
            "id": str(uuid.uuid4()),
            "sessionId": session_id,
            "timestamp": int(time.time() * 1000),
            "type": "message",
            "data": {"role": "agent", "content": response},
        }
    )

    return response


async def _on_rag_message(msg_type: str, payload: dict) -> dict:
    import base64 as _b64
    import tempfile
    from pathlib import Path as _Path

    if msg_type == "rag_list":
        docs = await rag_pipeline.list_documents()
        return {"type": "rag_list_response", "documents": docs}

    elif msg_type == "rag_delete":
        doc_id = payload.get("docId", "")
        if not doc_id:
            return {"type": "rag_error", "message": "Missing docId"}
        deleted = await rag_pipeline.delete_document(doc_id)
        return {"type": "rag_delete_response", "deleted": deleted, "docId": doc_id}

    elif msg_type == "rag_upload":
        filename = payload.get("filename", "document.txt")
        content_b64 = payload.get("content", "")
        if not content_b64:
            return {"type": "rag_error", "message": "Missing content"}
        content = _b64.b64decode(content_b64)
        suffix = _Path(filename).suffix.lower() or ".txt"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        try:
            doc_id, chunks = await rag_pipeline.ingest_file(tmp_path, source=filename)
        except RuntimeError as e:
            return {"type": "rag_error", "message": str(e)}
        finally:
            _Path(tmp_path).unlink(missing_ok=True)
        return {
            "type": "rag_upload_response",
            "docId": doc_id,
            "chunks": chunks,
            "filename": filename,
        }

    return {"type": "rag_error", "message": f"Unknown rag type: {msg_type}"}


async def _on_skill_message(msg_type: str, payload: dict) -> dict:
    from .skills.models import (
        list_skills, get_skill, create_skill, update_skill, delete_skill,
        list_cron_jobs, get_cron_job, create_cron_job, update_cron_job,
        delete_cron_job,
    )
    from .skills.runner import run_skill
    from .skills.scheduler import skill_scheduler

    if msg_type == "skill_list":
        return {"type": "skill_list_response", "skills": await list_skills()}

    elif msg_type == "skill_create":
        skill = await create_skill(
            payload.get("name", ""),
            payload.get("prompt", ""),
            payload.get("description", ""),
        )
        return {"type": "skill_response", "skill": skill}

    elif msg_type == "skill_update":
        skill = await update_skill(
            payload.get("id", ""),
            name=payload.get("name"),
            prompt=payload.get("prompt"),
            description=payload.get("description"),
        )
        return {"type": "skill_response", "skill": skill} if skill else {"type": "skill_error", "message": "Not found"}

    elif msg_type == "skill_delete":
        skill_id = payload.get("id", "")
        jobs = await list_cron_jobs(skill_id)
        for job in jobs:
            skill_scheduler.unschedule_job(job["id"])
        ok = await delete_skill(skill_id)
        return {"type": "skill_delete_response", "id": skill_id} if ok else {"type": "skill_error", "message": "Not found"}

    elif msg_type == "skill_run":
        skill_id = payload.get("id", "")
        skill = await get_skill(skill_id)
        if not skill or _agent_loop is None:
            return {"type": "skill_error", "message": "Skill not found or agent not ready"}
        result = await run_skill(
            skill_id=skill_id,
            prompt=skill["prompt"],
            agent_loop=_agent_loop,
            sessions=_sessions,
            trace_cb=trace_manager.emit,
        )
        return {"type": "skill_run_response", "id": skill_id, "result": result}

    elif msg_type == "cron_list":
        return {"type": "cron_list_response", "jobs": await list_cron_jobs(payload.get("skillId"))}

    elif msg_type == "cron_create":
        skill = await get_skill(payload.get("skillId", ""))
        if not skill:
            return {"type": "skill_error", "message": "Skill not found"}
        job = await create_cron_job(
            payload.get("skillId", ""),
            payload.get("cronExpression", ""),
            payload.get("enabled", True),
        )
        skill_scheduler.schedule_job(job)
        return {"type": "cron_response", "job": job}

    elif msg_type == "cron_update":
        job = await update_cron_job(
            payload.get("id", ""),
            cronExpression=payload.get("cronExpression"),
            enabled=payload.get("enabled"),
        )
        if not job:
            return {"type": "skill_error", "message": "Job not found"}
        skill_scheduler.schedule_job(job)
        return {"type": "cron_response", "job": job}

    elif msg_type == "cron_delete":
        job_id = payload.get("id", "")
        skill_scheduler.unschedule_job(job_id)
        ok = await delete_cron_job(job_id)
        return {"type": "cron_delete_response", "id": job_id} if ok else {"type": "skill_error", "message": "Not found"}

    return {"type": "skill_error", "message": f"Unknown type: {msg_type}"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _llm, _agent_loop, _peer

    load_token_on_startup()

    _llm = OllamaClient()

    tool_registry.register(GetTimeTool())
    tool_registry.register(WebSearchTool())
    tool_registry.register(RAGQueryTool(rag_pipeline))

    async def trace_cb(event: dict):
        await trace_manager.emit(event)

    _agent_loop = AgentLoop(
        llm=_llm,
        tools=tool_registry,
        rag=rag_pipeline,
        trace_cb=trace_cb,
    )

    from .skills.scheduler import skill_scheduler as _sched
    from .api.ws import trace_manager as _tm
    _sched.configure(_agent_loop, _sessions, _tm.emit)
    await _sched.start()

    _peer = AgentPeer(
        keys_dir=settings.keys_dir,
        on_message=_on_datachannel_message,
        on_rag=_on_rag_message,
        on_skill=_on_skill_message,
    )

    try:
        await _peer.connect_to_signal(room_id)
        print(f"[main] Connected to signal server, room: {room_id}")
    except Exception as e:
        print(f"[main] Could not connect to signal server: {e}")

    pub_key = _peer.pub_key if _peer else "unknown"
    print(f"[main] Agent '{settings.agent_name}' started")
    print(f"[main] Room ID: {room_id}")
    print(f"[main] Agent pub key: {pub_key}")

    yield

    if _llm:
        await _llm.close()

    from .skills.scheduler import skill_scheduler as _sched
    _sched.stop()


app = FastAPI(title="Nekoni Agent", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(public_router)
app.include_router(router, dependencies=[Depends(require_auth)])


@app.websocket("/ws/traces")
async def traces_ws(websocket: WebSocket):
    await websocket.accept()

    # Try query-param token first; fall back to first-message auth.
    # First-message auth is preferred because Cloudflare and some reverse
    # proxies strip query parameters on WebSocket upgrade requests.
    token = websocket.query_params.get("token", "")
    current = get_current_token()

    if not token or token != current:
        # Wait up to 5 s for {"type": "auth", "token": "..."}
        try:
            raw = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
            token = json.loads(raw).get("token", "")
        except Exception:
            token = ""

    if not current or token != current:
        await websocket.close(code=4001)
        return

    await trace_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        trace_manager.disconnect(websocket)
