"""ChromaDB vector store wrapper."""

from __future__ import annotations

import asyncio
from functools import partial

import chromadb

from ..config import settings

_client: chromadb.ClientAPI | None = None
_collection = None
COLLECTION_NAME = "nekoni_docs"


def _get_client():
    global _client, _collection
    if _client is None:
        _client = chromadb.PersistentClient(path=settings.chroma_path)
        _collection = _client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
    return _client, _collection


async def upsert_chunks(
    ids: list[str],
    embeddings: list[list[float]],
    documents: list[str],
    metadatas: list[dict],
) -> None:
    """Upsert chunks into ChromaDB."""
    loop = asyncio.get_event_loop()
    _, collection = _get_client()
    await loop.run_in_executor(
        None,
        partial(
            collection.upsert,
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
        ),
    )


async def list_documents() -> list[dict]:
    """Return one entry per unique doc_id with source and chunk count."""
    loop = asyncio.get_event_loop()
    _, collection = _get_client()

    def _get():
        return collection.get(include=["metadatas"])

    results = await loop.run_in_executor(None, _get)
    docs: dict[str, dict] = {}
    for meta in results.get("metadatas") or []:
        doc_id = meta.get("doc_id", "")
        if not doc_id:
            continue
        if doc_id not in docs:
            docs[doc_id] = {
                "doc_id": doc_id,
                "source": meta.get("source", ""),
                "chunks": 0,
            }
        docs[doc_id]["chunks"] += 1
    return list(docs.values())


async def delete_document(doc_id: str) -> int:
    """Delete all chunks belonging to doc_id. Returns number deleted."""
    loop = asyncio.get_event_loop()
    _, collection = _get_client()

    def _del():
        results = collection.get(
            where={"doc_id": doc_id}, include=[]
        )
        ids = results.get("ids") or []
        if ids:
            collection.delete(ids=ids)
        return len(ids)

    return await loop.run_in_executor(None, _del)


async def query_chunks(
    query_embedding: list[float],
    top_k: int = 5,
) -> list[dict]:
    """Query ChromaDB for similar chunks."""
    loop = asyncio.get_event_loop()
    _, collection = _get_client()

    def _query():
        return collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances"],
        )

    results = await loop.run_in_executor(None, _query)

    chunks = []
    docs = results.get("documents", [[]])[0]
    metas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    for doc, meta, dist in zip(docs, metas, distances):
        chunks.append(
            {
                "content": doc,
                "source": meta.get("source", ""),
                "score": 1 - dist,  # cosine similarity
            }
        )
    return chunks
