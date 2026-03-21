"""In-session working memory."""

from __future__ import annotations

from collections import deque
from typing import Any


class WorkingMemory:
    """Stores recent context for the current session."""

    def __init__(self, maxlen: int = 50):
        self._items: deque[dict] = deque(maxlen=maxlen)

    def add(self, item_type: str, content: Any) -> None:
        self._items.append({"type": item_type, "content": content})

    def get_recent(self, n: int = 10) -> list[dict]:
        return list(self._items)[-n:]

    def clear(self) -> None:
        self._items.clear()
