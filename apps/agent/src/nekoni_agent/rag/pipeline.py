"""RAG ingest and query pipeline."""

from __future__ import annotations

import hashlib
from pathlib import Path

from ..config import settings
from . import embedder, store


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
        """Ingest a file (text, pdf, etc.)."""
        path = Path(path)
        if path.suffix.lower() == ".pdf":
            text = self._extract_pdf(path)
        else:
            text = path.read_text(errors="ignore")
        return await self.ingest_text(text, source=source or str(path.name))

    def _extract_pdf(self, path: Path) -> str:
        try:
            import pypdf
        except ImportError:
            raise RuntimeError(
                "pypdf is required for PDF ingestion. "
                "Install it with: pip install pypdf"
            )
        reader = pypdf.PdfReader(str(path))
        text = "\n".join(page.extract_text() or "" for page in reader.pages).strip()
        if not text:
            raise RuntimeError(
                "No text could be extracted from this PDF — "
                "it may be scanned/image-based or encrypted."
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
