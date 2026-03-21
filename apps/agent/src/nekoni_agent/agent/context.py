"""Session context and working memory."""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field


@dataclass
class Message:
    role: str  # "user", "assistant", "system", "tool"
    content: str
    timestamp: float = field(default_factory=time.time)
    tool_name: str | None = None


@dataclass
class SessionContext:
    session_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    messages: list[Message] = field(default_factory=list)
    max_history: int = 20

    def add_message(
        self, role: str, content: str, tool_name: str | None = None
    ) -> None:
        self.messages.append(Message(role=role, content=content, tool_name=tool_name))
        # Keep only recent messages to manage context window
        if len(self.messages) > self.max_history:
            # Always keep system message if present
            system = [m for m in self.messages if m.role == "system"]
            rest = [m for m in self.messages if m.role != "system"]
            self.messages = system + rest[-(self.max_history - len(system)) :]

    def to_ollama_messages(self) -> list[dict]:
        """Convert to Ollama API message format."""
        result = []
        for msg in self.messages:
            if msg.role == "tool":
                # Pass as user message so the model sees tool results as observations
                result.append(
                    {
                        "role": "user",
                        "content": f"[Tool result from {msg.tool_name}]: {msg.content}",
                    }
                )
            else:
                result.append({"role": msg.role, "content": msg.content})
        return result
