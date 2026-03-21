"""Base class for tools."""

from abc import ABC, abstractmethod
from typing import Any


class Tool(ABC):
    """Base class for all agent tools."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique tool name, snake_case."""

    @property
    @abstractmethod
    def description(self) -> str:
        """Human-readable description for LLM."""

    @property
    @abstractmethod
    def parameters_schema(self) -> dict:
        """JSON Schema for tool parameters."""

    @abstractmethod
    async def execute(self, **kwargs: Any) -> Any:
        """Execute the tool and return result."""

    def to_dict(self) -> dict:
        """Return tool definition for LLM prompt."""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters_schema,
        }
