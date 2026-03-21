"""ReAct agent loop."""

from __future__ import annotations

import json
import re
import time
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

from ..llm.client import OllamaClient
from ..llm.prompts import SYSTEM_PROMPT
from ..rag.pipeline import RAGPipeline
from ..tools.registry import ToolRegistry
from .context import SessionContext

SendChunkFn = Callable[[str], None]
OnTokenFn = Callable[[str], Awaitable[None]]
TraceCb = Callable[[dict], Awaitable[None]]

MAX_REACT_ITERATIONS = 8
CHUNK_SIZE = 6


class AgentLoop:
    def __init__(
        self,
        llm: OllamaClient,
        tools: ToolRegistry,
        rag: RAGPipeline,
        trace_cb: TraceCb | None = None,
    ):
        self.llm = llm
        self.tools = tools
        self.rag = rag
        self._trace_cb = trace_cb

    async def _emit(self, session_id: str, event_type: str, data: dict) -> None:
        if self._trace_cb:
            await self._trace_cb(
                {
                    "id": str(uuid.uuid4()),
                    "sessionId": session_id,
                    "timestamp": int(time.time() * 1000),
                    "type": event_type,
                    "data": data,
                }
            )

    async def run(
        self,
        user_message: str,
        context: SessionContext,
        on_token: OnTokenFn | None = None,
    ) -> str:
        session_id = context.session_id

        # RAG retrieval
        await self._emit(session_id, "rag_query", {"query": user_message})
        try:
            from ..config import settings as _s
            raw_chunks = await self.rag.query(user_message)
            rag_chunks = [
                c for c in raw_chunks
                if c.get("score", 0) >= _s.rag_min_score
            ]
        except Exception as e:
            print(f"[loop] RAG query failed: {e}")
            rag_chunks = []

        # Build system prompt
        tools_json = json.dumps(self.tools.to_json_schema(), indent=2)
        system_content = SYSTEM_PROMPT.format(tools_json=tools_json)
        if rag_chunks:
            rag_context = "\n---\n".join(
                f"[{c.get('source', 'unknown')}]: {c.get('content', '')}"
                for c in rag_chunks
            )
            system_content += (
                f"\n\nRelevant context from your knowledge base:\n{rag_context}"
            )

        # Initialise context with system message on first turn
        if not context.messages or context.messages[0].role != "system":
            context.add_message("system", system_content)

        context.add_message("user", user_message)

        for iteration in range(MAX_REACT_ITERATIONS):
            messages = context.to_ollama_messages()
            await self._emit(
                session_id,
                "llm_call",
                {"iteration": iteration, "messages_count": len(messages)},
            )

            # Always buffer the full response before deciding what to do
            buffer = ""
            try:
                async for token in self.llm.chat_stream(messages):
                    buffer += token
            except Exception as e:
                err_msg = str(e) or repr(e) or type(e).__name__
                print(f"[loop] LLM stream error (iter={iteration}): {e}")
                await self._emit(session_id, "error", {"error": err_msg})
                return f"I encountered an error: {err_msg}"

            response = buffer
            tool_call = self._parse_tool_call(response)

            if tool_call is None:
                # Plain text response — replay as streaming chunks
                context.add_message("assistant", response)
                if on_token:
                    for i in range(0, len(response), CHUNK_SIZE):
                        await on_token(response[i : i + CHUNK_SIZE])
                return response

            # Tool call — execute and loop
            tool_name = tool_call.get("name", "")
            tool_args = tool_call.get("arguments", {})
            await self._emit(
                session_id,
                "tool_call",
                {
                    "tool": tool_name,
                    "arguments": tool_args,
                    "iteration": iteration,
                },
            )

            t0 = time.time()
            try:
                result: Any = await self.tools.execute(tool_name, **tool_args)
                duration_ms = int((time.time() - t0) * 1000)
                result_str = (
                    json.dumps(result) if not isinstance(result, str) else result
                )
                await self._emit(
                    session_id,
                    "tool_call",
                    {
                        "tool": tool_name,
                        "result": result_str,
                        "duration_ms": duration_ms,
                        "status": "ok",
                    },
                )
            except Exception as e:
                duration_ms = int((time.time() - t0) * 1000)
                print(f"[loop] Tool '{tool_name}' raised: {e}")
                result_str = f"Error: {e}"
                await self._emit(
                    session_id,
                    "tool_call",
                    {
                        "tool": tool_name,
                        "error": str(e),
                        "duration_ms": duration_ms,
                        "status": "error",
                    },
                )

            context.add_message("assistant", response)
            context.add_message("tool", result_str, tool_name=tool_name)

        return (
            "I reached the maximum number of reasoning steps."
            " Please try a simpler request."
        )

    def _parse_tool_call(self, response: str) -> dict | None:
        """Parse tool call from LLM response. Returns None if no tool call."""
        stripped = response.strip()

        # Fast path: response starts with '{' — try raw_decode so trailing
        # text is ignored
        if stripped.startswith("{"):
            try:
                data, _ = json.JSONDecoder().raw_decode(stripped)
                if isinstance(data, dict) and "tool_call" in data:
                    return data["tool_call"]
            except (json.JSONDecodeError, ValueError):
                pass

        # Slow path: scan for any embedded JSON object containing "tool_call"
        for match in re.finditer(r"\{", stripped):
            try:
                data, _ = json.JSONDecoder().raw_decode(stripped, match.start())
                if isinstance(data, dict) and "tool_call" in data:
                    return data["tool_call"]
            except (json.JSONDecodeError, ValueError):
                continue

        return None
