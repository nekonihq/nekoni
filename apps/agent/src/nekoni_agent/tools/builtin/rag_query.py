"""Tool: rag_query - query the RAG knowledge base."""

from typing import TYPE_CHECKING

from ..base import Tool

if TYPE_CHECKING:
    from ...rag.pipeline import RAGPipeline


class RAGQueryTool(Tool):
    def __init__(self, rag: "RAGPipeline"):
        self._rag = rag

    @property
    def name(self) -> str:
        return "rag_query"

    @property
    def description(self) -> str:
        return (
            "Query the local knowledge base (ingested documents)."
            " Use this when the user asks about documents, notes, or files."
        )

    @property
    def parameters_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"},
                "top_k": {
                    "type": "integer",
                    "description": "Number of results (default 5)",
                    "default": 5,
                },
            },
            "required": ["query"],
        }

    async def execute(self, query: str, top_k: int = 5) -> list[dict]:
        from ...config import settings

        top_k = int(top_k)  # LLM occasionally sends a string
        chunks = await self._rag.query(query, top_k=top_k)
        return [
            {
                "content": c["content"][:600],
                "source": c.get("source", ""),
                "score": round(c.get("score", 0), 3),
            }
            for c in chunks
            if c.get("score", 0) >= settings.rag_min_score
        ]
