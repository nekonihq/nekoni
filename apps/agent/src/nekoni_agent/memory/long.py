"""SQLite episodic long-term memory."""

from __future__ import annotations

import time

import aiosqlite

from ..config import settings


class EpisodicMemory:
    """Stores conversation episodes in SQLite for long-term recall."""

    def __init__(self, db_path: str | None = None):
        self.db_path = db_path or settings.sqlite_path

    async def _init_db(self, db: aiosqlite.Connection) -> None:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS episodes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp REAL NOT NULL
            )
        """)
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_session ON episodes(session_id)"
        )
        await db.commit()

    async def store(self, session_id: str, role: str, content: str) -> None:
        from pathlib import Path

        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        async with aiosqlite.connect(self.db_path) as db:
            await self._init_db(db)
            await db.execute(
                "INSERT INTO episodes"
                " (session_id, role, content, timestamp)"
                " VALUES (?, ?, ?, ?)",
                (session_id, role, content, time.time()),
            )
            await db.commit()

    async def get_recent(self, session_id: str, limit: int = 20) -> list[dict]:
        try:
            async with aiosqlite.connect(self.db_path) as db:
                await self._init_db(db)
                async with db.execute(
                    "SELECT role, content, timestamp FROM episodes"
                    " WHERE session_id = ?"
                    " ORDER BY timestamp DESC LIMIT ?",
                    (session_id, limit),
                ) as cursor:
                    rows = await cursor.fetchall()
            return [
                {"role": r[0], "content": r[1], "timestamp": r[2]}
                for r in reversed(rows)
            ]
        except Exception:
            return []
