"""Async Ollama LLM client."""

import json
from typing import AsyncIterator

import httpx

from ..config import settings


class OllamaClient:
    def __init__(self, base_url: str | None = None, model: str | None = None):
        self.base_url = (base_url or settings.ollama_base_url).rstrip("/")
        self.model = model or settings.ollama_model
        self._client = httpx.AsyncClient(timeout=settings.ollama_timeout)

    async def chat(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        stream: bool = False,
    ) -> str:
        """Send chat messages and return response text."""
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": stream,
            "options": {"temperature": temperature},
        }
        print(
            f"[llm] POST {self.base_url}/api/chat"
            f" model={self.model} msgs={len(messages)}"
        )
        try:
            resp = await self._client.post(
                f"{self.base_url}/api/chat",
                json=payload,
            )
            resp.raise_for_status()
        except Exception as e:
            print(f"[llm] request failed: {e}")
            raise
        data = resp.json()
        content = data["message"]["content"]
        print(f"[llm] response ({len(content)} chars): {content[:80]!r}")
        return content

    async def chat_stream(
        self,
        messages: list[dict],
        temperature: float = 0.7,
    ) -> AsyncIterator[str]:
        """Stream chat response tokens."""
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": True,
            "options": {"temperature": temperature},
        }
        async with self._client.stream(
            "POST", f"{self.base_url}/api/chat", json=payload
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if line:
                    chunk = json.loads(line)
                    if token := chunk.get("message", {}).get("content"):
                        yield token

    async def health(self) -> bool:
        """Check if Ollama is reachable."""
        try:
            resp = await self._client.get(f"{self.base_url}/api/tags", timeout=5)
            return resp.status_code == 200
        except Exception:
            return False

    async def close(self):
        await self._client.aclose()
