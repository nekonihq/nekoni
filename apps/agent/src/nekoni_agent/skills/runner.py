"""Run a skill through the agent loop."""
from __future__ import annotations
import time
import uuid
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..agent.loop import AgentLoop
    from ..agent.context import SessionContext

async def run_skill(
    skill_id: str,
    prompt: str,
    agent_loop: "AgentLoop",
    sessions: dict,
    trace_cb=None,
    job_id: str | None = None,
) -> str:
    """Run a skill prompt through the agent loop. Returns the response."""
    from ..agent.context import SessionContext
    from ..agent.history import load_messages, save_message

    session_id = f"cron_{job_id}" if job_id else f"skill_{skill_id}_{int(time.time())}"

    if session_id not in sessions:
        prior = await load_messages(session_id)
        ctx = SessionContext(session_id=session_id)
        ctx.messages = prior
        sessions[session_id] = ctx

    context = sessions[session_id]
    before = len(context.messages)

    if trace_cb:
        await trace_cb({
            "id": str(uuid.uuid4()),
            "sessionId": session_id,
            "timestamp": int(time.time() * 1000),
            "type": "message",
            "data": {"role": "user", "content": prompt, "source": "skill"},
        })

    response = await agent_loop.run(prompt, context)

    for msg in context.messages[before:]:
        await save_message(session_id, msg)

    if trace_cb:
        await trace_cb({
            "id": str(uuid.uuid4()),
            "sessionId": session_id,
            "timestamp": int(time.time() * 1000),
            "type": "message",
            "data": {"role": "agent", "content": response, "source": "skill"},
        })

    return response
