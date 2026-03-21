"""WebSocket endpoint for dashboard traces."""

from __future__ import annotations

import json
from pathlib import Path

import aiosqlite
from fastapi import WebSocket

from ..config import settings


class TraceManager:
    """Manages dashboard WebSocket connections and
    broadcasts trace events. Persists to SQLite."""

    def __init__(self):
        self._connections: list[WebSocket] = []
        self._db_path = settings.sqlite_path

    async def _init_db(self, db: aiosqlite.Connection) -> None:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS traces (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                type TEXT NOT NULL,
                data TEXT NOT NULL,
                parent_id TEXT
            )
        """)
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_traces_ts ON traces(timestamp)"
        )
        await db.commit()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.append(ws)
        print(f"[traces] Dashboard connected ({len(self._connections)} total)")

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self._connections:
            self._connections.remove(ws)
        print(f"[traces] Dashboard disconnected ({len(self._connections)} remaining)")

    async def emit(self, event: dict) -> None:
        """Persist event and broadcast to dashboards."""
        await self._persist(event)
        n = len(self._connections)
        if not n:
            return
        print(f"[traces] emit {event.get('type')} → {n} client(s)")
        payload = json.dumps(event)
        dead = []
        for ws in self._connections:
            try:
                await ws.send_text(payload)
            except Exception as e:
                print(f"[traces] send failed: {e}")
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    async def _persist(self, event: dict) -> None:
        try:
            Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)
            async with aiosqlite.connect(self._db_path) as db:
                await self._init_db(db)
                await db.execute(
                    "INSERT OR IGNORE INTO traces"
                    " (id, session_id, timestamp,"
                    "  type, data, parent_id)"
                    " VALUES (?, ?, ?, ?, ?, ?)",
                    (
                        event.get("id", ""),
                        event.get("sessionId", ""),
                        event.get("timestamp", 0),
                        event.get("type", ""),
                        json.dumps(event.get("data", {})),
                        event.get("parentId"),
                    ),
                )
                await db.commit()
        except Exception as e:
            print(f"[traces] persist error: {e}")

    async def get_recent(
        self, limit: int = 500, session_id: str | None = None
    ) -> list[dict]:
        try:
            Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)
            async with aiosqlite.connect(self._db_path) as db:
                await self._init_db(db)
                if session_id:
                    query = (
                        "SELECT id, session_id, timestamp,"
                        " type, data, parent_id"
                        " FROM traces"
                        " WHERE session_id = ?"
                        " ORDER BY timestamp DESC"
                        " LIMIT ?"
                    )
                    params = (session_id, limit)
                else:
                    query = (
                        "SELECT id, session_id, timestamp,"
                        " type, data, parent_id"
                        " FROM traces"
                        " ORDER BY timestamp DESC"
                        " LIMIT ?"
                    )
                    params = (limit,)
                async with db.execute(query, params) as cursor:
                    rows = await cursor.fetchall()
            return [
                {
                    "id": r[0],
                    "sessionId": r[1],
                    "timestamp": r[2],
                    "type": r[3],
                    "data": json.loads(r[4]),
                    **({"parentId": r[5]} if r[5] else {}),
                }
                for r in reversed(rows)
            ]
        except Exception as e:
            print(f"[traces] get_recent error: {e}")
            return []

    async def get_sessions(self) -> list[dict]:
        """Return distinct session IDs with trace counts and last activity."""
        try:
            Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)
            async with aiosqlite.connect(self._db_path) as db:
                await self._init_db(db)
                async with db.execute(
                    "SELECT session_id, COUNT(*) as count,"
                    " MAX(timestamp) as last_ts"
                    " FROM traces"
                    " GROUP BY session_id"
                    " ORDER BY last_ts DESC"
                ) as cursor:
                    rows = await cursor.fetchall()
            return [
                {
                    "sessionId": r[0],
                    "count": r[1],
                    "lastTimestamp": r[2],
                }
                for r in rows
            ]
        except Exception as e:
            print(f"[traces] get_sessions error: {e}")
            return []

    async def clear(self) -> None:
        try:
            async with aiosqlite.connect(self._db_path) as db:
                await self._init_db(db)
                await db.execute("DELETE FROM traces")
                await db.commit()
        except Exception as e:
            print(f"[traces] clear error: {e}")


trace_manager = TraceManager()
