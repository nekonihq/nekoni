"""REST API routes."""

from __future__ import annotations

import asyncio
import io
import json
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from ..config import settings
from ..crypto.keys import (
    load_approved_devices,
    load_or_create_identity,
    save_approved_devices,
)
from ..crypto.verify import check_freshness, verify_message_sig
from ..rag.pipeline import RAGPipeline

router = APIRouter()
public_router = APIRouter()  # phone-facing, no auth required


# In-memory store for pending pairing requests (keyed by mobilePubKey)
_pending_pairings: dict[str, dict] = {}


def _get_lan_ip() -> str | None:
    """Discover the outbound LAN interface IP."""
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception as e:
        print(f"[routes] LAN IP resolution failed: {e}")
        return None


def _resolve_signal_url() -> str:
    """Return signal URL with localhost/0.0.0.0 replaced by the machine's LAN IP."""
    url = settings.signal_url
    if not any(h in url for h in ("localhost", "0.0.0.0", "127.0.0.1")):
        return url
    lan_ip = _get_lan_ip()
    if not lan_ip:
        return url
    return (
        url.replace("localhost", lan_ip)
        .replace("0.0.0.0", lan_ip)
        .replace("127.0.0.1", lan_ip)
    )


def _resolve_agent_url() -> str:
    """Return the agent's HTTP URL reachable by the mobile app."""
    if settings.agent_url:
        return settings.agent_url.rstrip("/")
    lan_ip = _get_lan_ip() or "localhost"
    return f"http://{lan_ip}:{settings.agent_port}"


def get_rag() -> RAGPipeline:
    from ..main import rag_pipeline

    return rag_pipeline


def get_trace_manager():
    from ..api.ws import trace_manager

    return trace_manager


@public_router.get("/health")
async def health():
    return {"status": "ok", "ts": int(time.time() * 1000), "agent": settings.agent_name}


@router.get("/api/qr")
async def get_qr():
    """Return QR payload for pairing."""
    _, pub_key = load_or_create_identity(settings.keys_dir)
    from ..main import room_id

    return {
        "agentPubKey": pub_key,
        "signalUrl": _resolve_signal_url(),
        "agentUrl": _resolve_agent_url(),
        "roomId": room_id,
        "agentName": settings.agent_name,
    }


@router.get("/api/qr/image")
async def get_qr_image():
    """Generate QR code image."""
    import qrcode
    from fastapi.responses import Response

    _, pub_key = load_or_create_identity(settings.keys_dir)
    from ..main import room_id

    payload = json.dumps(
        {
            "agentPubKey": pub_key,
            "signalUrl": _resolve_signal_url(),
            "agentUrl": _resolve_agent_url(),
            "roomId": room_id,
            "agentName": settings.agent_name,
        }
    )

    qr = qrcode.QRCode(box_size=8, border=2)
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")


class PairingRequest(BaseModel):
    mobilePubKey: str
    sig: str
    ts: int
    deviceName: str | None = None


@public_router.post("/api/pair")
async def pair_request(req: PairingRequest):
    """Mobile sends pairing request. Stored as pending for dashboard approval."""
    # Verify timestamp freshness
    if not check_freshness(req.ts):
        raise HTTPException(400, "Stale timestamp")

    payload = {"mobilePubKey": req.mobilePubKey, "ts": req.ts}
    if req.deviceName:
        payload["deviceName"] = req.deviceName
    import json as _json

    verified_str = _json.dumps(payload, separators=(",", ":"), sort_keys=True)
    print(f"[pair] verifying payload str : {verified_str}")
    print(f"[pair] verifying payload bytes: {verified_str.encode().hex()}")
    print(f"[pair] sig                    : {req.sig}")
    print(f"[pair] pub key                : {req.mobilePubKey}")
    valid = verify_message_sig({**payload, "sig": req.sig}, req.mobilePubKey)
    print(f"[pair] valid                  : {valid}")
    if not valid:
        raise HTTPException(400, "Invalid signature")

    # Check if already approved
    approved = load_approved_devices(settings.keys_dir)
    if req.mobilePubKey in approved:
        return {"status": "already_approved"}

    # Store as pending
    _pending_pairings[req.mobilePubKey] = {
        "mobilePubKey": req.mobilePubKey,
        "deviceName": req.deviceName,
        "ts": req.ts,
    }

    # Notify dashboard via WebSocket
    tm = get_trace_manager()
    await tm.emit(
        {
            "id": str(uuid.uuid4()),
            "sessionId": "system",
            "timestamp": int(time.time() * 1000),
            "type": "skill_event",
            "data": {
                "event": "pairing_request",
                "mobilePubKey": req.mobilePubKey,
                "deviceName": req.deviceName,
            },
        }
    )

    return {"status": "pending_approval"}


@router.get("/api/pair/pending")
async def get_pending_pairings():
    return list(_pending_pairings.values())


class PairingApproval(BaseModel):
    mobilePubKey: str
    approved: bool


@router.post("/api/pair/approve")
async def approve_pairing(approval: PairingApproval):
    """Dashboard approves or rejects a pairing request."""
    pending = _pending_pairings.pop(approval.mobilePubKey, None)
    if not pending:
        raise HTTPException(404, "Pairing request not found")

    if approval.approved:
        approved = load_approved_devices(settings.keys_dir)
        approved[approval.mobilePubKey] = {
            "mobilePubKey": approval.mobilePubKey,
            "deviceName": pending.get("deviceName"),
            "approvedAt": int(time.time() * 1000),
        }
        save_approved_devices(settings.keys_dir, approved)
        return {"status": "approved"}
    else:
        return {"status": "rejected"}


@router.get("/api/pair/devices")
async def list_devices():
    return list(load_approved_devices(settings.keys_dir).values())


@router.delete("/api/pair/devices/{mobile_pub_key}")
async def remove_device(mobile_pub_key: str):
    """Remove an approved device and close its active connection."""
    from ..webrtc.channel import close_channel

    approved = load_approved_devices(settings.keys_dir)
    if mobile_pub_key not in approved:
        raise HTTPException(404, "Device not found")
    del approved[mobile_pub_key]
    save_approved_devices(settings.keys_dir, approved)
    close_channel(mobile_pub_key)
    print(f"[pair] revoked device {mobile_pub_key[:16]}…")
    return {"status": "removed"}


@router.get("/api/rag/documents")
async def list_rag_documents(rag: RAGPipeline = Depends(get_rag)):
    """List all ingested documents."""
    return await rag.list_documents()


@router.delete("/api/rag/documents/{doc_id}")
async def delete_rag_document(
    doc_id: str, rag: RAGPipeline = Depends(get_rag)
):
    """Delete a document and all its chunks."""
    deleted = await rag.delete_document(doc_id)
    return {"deleted": deleted}


@router.post("/api/ingest")
async def ingest_document(
    file: UploadFile = File(...),
    rag: RAGPipeline = Depends(get_rag),
):
    """Ingest a document into the RAG knowledge base."""
    content = await file.read()
    suffix = Path(file.filename or "doc.txt").suffix.lower()

    with __import__("tempfile").NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        doc_id, chunks = await rag.ingest_file(tmp_path, source=file.filename)
    except RuntimeError as e:
        raise HTTPException(400, str(e))
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    return {
        "success": True,
        "documentId": doc_id,
        "chunks": chunks,
        "filename": file.filename,
    }


@router.get("/api/traces/sessions")
async def get_trace_sessions():
    tm = get_trace_manager()
    return await tm.get_sessions()


@router.get("/api/traces")
async def get_traces(
    limit: int = 500, session_id: str | None = None
):
    tm = get_trace_manager()
    return await tm.get_recent(limit, session_id=session_id)


@router.delete("/api/traces")
async def clear_traces():
    tm = get_trace_manager()
    await tm.clear()
    return {"status": "cleared"}


# ── Skills ────────────────────────────────────────────────────────────────────

class SkillBody(BaseModel):
    name: str
    prompt: str
    description: str = ""


class SkillUpdate(BaseModel):
    name: str | None = None
    prompt: str | None = None
    description: str | None = None


@router.get("/api/skills")
async def list_skills():
    from ..skills.models import list_skills as _list
    return await _list()


@router.post("/api/skills")
async def create_skill(body: SkillBody):
    from ..skills.models import create_skill as _create
    return await _create(body.name, body.prompt, body.description)


@router.put("/api/skills/{skill_id}")
async def update_skill(skill_id: str, body: SkillUpdate):
    from ..skills.models import update_skill as _update
    skill = await _update(skill_id, name=body.name, prompt=body.prompt, description=body.description)
    if not skill:
        raise HTTPException(404, "Skill not found")
    return skill


@router.delete("/api/skills/{skill_id}")
async def delete_skill(skill_id: str):
    from ..skills.models import delete_skill as _delete
    from ..skills.scheduler import skill_scheduler
    from ..skills.models import list_cron_jobs
    jobs = await list_cron_jobs(skill_id)
    for job in jobs:
        skill_scheduler.unschedule_job(job["id"])
    if not await _delete(skill_id):
        raise HTTPException(404, "Skill not found")
    return {"deleted": skill_id}


@router.post("/api/skills/{skill_id}/run")
async def run_skill_now(skill_id: str):
    from ..skills.models import get_skill
    from ..skills.runner import run_skill
    from ..skills.scheduler import skill_scheduler
    from ..main import _agent_loop, _sessions
    from ..api.ws import trace_manager

    skill = await get_skill(skill_id)
    if not skill:
        raise HTTPException(404, "Skill not found")
    if _agent_loop is None:
        raise HTTPException(503, "Agent not ready")

    async def _trace(event):
        await trace_manager.emit(event)

    result = await run_skill(
        skill_id=skill_id,
        prompt=skill["prompt"],
        agent_loop=_agent_loop,
        sessions=_sessions,
        trace_cb=_trace,
    )
    return {"result": result}


# ── Cron jobs ─────────────────────────────────────────────────────────────────

class CronBody(BaseModel):
    skillId: str
    cronExpression: str
    enabled: bool = True


class CronUpdate(BaseModel):
    cronExpression: str | None = None
    enabled: bool | None = None


@router.get("/api/cron")
async def list_cron():
    from ..skills.models import list_cron_jobs
    return await list_cron_jobs()


@router.post("/api/cron")
async def create_cron(body: CronBody):
    from ..skills.models import create_cron_job, get_skill
    from ..skills.scheduler import skill_scheduler
    if not await get_skill(body.skillId):
        raise HTTPException(404, "Skill not found")
    job = await create_cron_job(body.skillId, body.cronExpression, body.enabled)
    skill_scheduler.schedule_job(job)
    return job


@router.put("/api/cron/{job_id}")
async def update_cron(job_id: str, body: CronUpdate):
    from ..skills.models import update_cron_job
    from ..skills.scheduler import skill_scheduler
    job = await update_cron_job(job_id, cronExpression=body.cronExpression, enabled=body.enabled)
    if not job:
        raise HTTPException(404, "Cron job not found")
    skill_scheduler.schedule_job(job)
    return job


@router.delete("/api/cron/{job_id}")
async def delete_cron(job_id: str):
    from ..skills.models import delete_cron_job
    from ..skills.scheduler import skill_scheduler
    skill_scheduler.unschedule_job(job_id)
    if not await delete_cron_job(job_id):
        raise HTTPException(404, "Cron job not found")
    return {"deleted": job_id}


@router.post("/api/cron/{job_id}/run")
async def run_cron_now(job_id: str):
    from ..skills.models import get_cron_job
    from ..skills.scheduler import skill_scheduler
    job = await get_cron_job(job_id)
    if not job:
        raise HTTPException(404, "Cron job not found")
    asyncio.ensure_future(skill_scheduler._run_job(job_id, job["skillId"]))
    return {"status": "triggered"}


@router.get("/api/tools")
async def list_tools():
    from ..main import tool_registry

    return tool_registry.to_json_schema()


# ── Settings ──────────────────────────────────────────────────────────────────

SYSTEM_PROMPT_KEY = "system_prompt"


class SystemPromptBody(BaseModel):
    prompt: str


@router.get("/api/settings/system-prompt")
async def get_system_prompt():
    from ..settings.models import get_setting
    from ..llm.prompts import SYSTEM_PROMPT

    value = await get_setting(SYSTEM_PROMPT_KEY)
    return {"prompt": value if value is not None else SYSTEM_PROMPT}


@router.put("/api/settings/system-prompt")
async def put_system_prompt(body: SystemPromptBody):
    from ..settings.models import set_setting

    await set_setting(SYSTEM_PROMPT_KEY, body.prompt)
    return {"status": "ok"}
