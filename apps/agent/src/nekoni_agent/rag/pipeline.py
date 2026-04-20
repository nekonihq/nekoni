"""RAG ingest and query pipeline."""

from __future__ import annotations

import asyncio
import hashlib
from functools import lru_cache
from pathlib import Path

from ..config import settings
from . import embedder, store

_DOCLING_EXTENSIONS = {
    ".pdf", ".docx", ".xlsx", ".pptx", ".html",
    ".png", ".jpg", ".jpeg", ".tiff", ".bmp",
}


@lru_cache(maxsize=1)
def _get_converter():
    from docling.document_converter import DocumentConverter

    return DocumentConverter()


def _chunk_text(text: str, chunk_size: int = 512, overlap: int = 50) -> list[str]:
    """Split text into overlapping chunks by approximate token count (chars/4)."""
    char_size = chunk_size * 4
    char_overlap = overlap * 4
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + char_size, len(text))
        chunks.append(text[start:end])
        if end >= len(text):
            break
        start += char_size - char_overlap
    return chunks


class RAGPipeline:
    async def ingest_text(self, text: str, source: str = "") -> tuple[str, int]:
        """Ingest a text string. Returns (document_id, chunk_count)."""
        doc_id = hashlib.sha256(text.encode()).hexdigest()[:16]
        chunks = _chunk_text(text, settings.chunk_size, settings.chunk_overlap)

        ids = [f"{doc_id}_{i}" for i in range(len(chunks))]
        metadatas = [
            {"source": source, "doc_id": doc_id, "chunk_idx": i}
            for i in range(len(chunks))
        ]

        embeddings = await embedder.embed_texts(chunks)
        await store.upsert_chunks(ids, embeddings, chunks, metadatas)

        return doc_id, len(chunks)

    async def ingest_file(
        self, path: str | Path, source: str | None = None
    ) -> tuple[str, int]:
        """Ingest a file (text, pdf, docx, images, etc.)."""
        path = Path(path)
        if path.suffix.lower() in _DOCLING_EXTENSIONS:
            loop = asyncio.get_running_loop()
            text = await loop.run_in_executor(None, self._extract_document, path)
        else:
            text = path.read_text(errors="ignore")
        return await self.ingest_text(text, source=source or str(path.name))

    def _extract_document(self, path: Path) -> str:
        converter = _get_converter()
        result = converter.convert(str(path))
        text = result.document.export_to_markdown()
        if not text.strip():
            raise RuntimeError(
                f"No content could be extracted from {path.name}."
            )
        return text

    async def list_documents(self) -> list[dict]:
        """Return all ingested documents with metadata."""
        return await store.list_documents()

    async def delete_document(self, doc_id: str) -> int:
        """Delete a document by doc_id. Returns chunks removed."""
        return await store.delete_document(doc_id)

    async def query(self, query: str, top_k: int | None = None) -> list[dict]:
        """Query knowledge base for relevant chunks."""
        k = top_k or settings.rag_top_k
        query_embedding = await embedder.embed_query(query)
        return await store.query_chunks(query_embedding, top_k=k)
