"""Tool registry."""

from typing import Any

from .base import Tool


class ToolRegistry:
    def __init__(self):
        self._tools: dict[str, Tool] = {}

    def register(self, tool: Tool) -> None:
        self._tools[tool.name] = tool

    def get(self, name: str) -> Tool | None:
        return self._tools.get(name)

    def list_tools(self) -> list[Tool]:
        return list(self._tools.values())

    def to_json_schema(self) -> list[dict]:
        return [t.to_dict() for t in self._tools.values()]

    async def execute(self, name: str, **kwargs: Any) -> Any:
        tool = self.get(name)
        if not tool:
            raise ValueError(f"Tool '{name}' not found")
        return await tool.execute(**kwargs)
