"""Sentence-transformers embedding wrapper."""

from __future__ import annotations

import asyncio
from functools import partial

_model = None
_model_name = "all-MiniLM-L6-v2"


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer(_model_name)
    return _model


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a list of texts asynchronously."""
    loop = asyncio.get_event_loop()
    model = _get_model()
    embeddings = await loop.run_in_executor(
        None,
        partial(model.encode, texts, convert_to_numpy=True),
    )
    return embeddings.tolist()


async def embed_query(query: str) -> list[float]:
    """Embed a single query string."""
    result = await embed_texts([query])
    return result[0]
