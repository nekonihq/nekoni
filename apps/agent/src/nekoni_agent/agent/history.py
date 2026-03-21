"""Persistent conversation history backed by SQLite."""

from __future__ import annotations

import aiosqlite

from ..config import settings
from .context import Message


async def _ensure_table(db: aiosqlite.Connection) -> None:
    await db.execute(
        """
        CREATE TABLE IF NOT EXISTS conversation_messages (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            role       TEXT NOT NULL,
            content    TEXT NOT NULL,
            tool_name  TEXT,
            timestamp  REAL NOT NULL
        )
        """
    )
    await db.execute(
        "CREATE INDEX IF NOT EXISTS idx_conv_msgs"
        " ON conversation_messages(session_id, timestamp)"
    )
    await db.commit()


async def load_messages(session_id: str) -> list[Message]:
    """Return all persisted messages for a session, oldest first."""
    try:
        async with aiosqlite.connect(settings.sqlite_path) as db:
            await _ensure_table(db)
            async with db.execute(
                "SELECT role, content, tool_name, timestamp"
                " FROM conversation_messages"
                " WHERE session_id = ?"
                " ORDER BY timestamp",
                (session_id,),
            ) as cursor:
                rows = await cursor.fetchall()
        return [
            Message(
                role=row[0],
                content=row[1],
                tool_name=row[2],
                timestamp=row[3],
            )
            for row in rows
        ]
    except Exception as e:
        print(f"[history] load error: {e}")
        return []


async def get_messages_after(
    session_id: str,
    after_timestamp_ms: int,
) -> list[dict]:
    """Return assistant messages for a session newer than after_timestamp_ms."""
    after_s = after_timestamp_ms / 1000.0
    try:
        async with aiosqlite.connect(settings.sqlite_path) as db:
            await _ensure_table(db)
            async with db.execute(
                "SELECT role, content, timestamp"
                " FROM conversation_messages"
                " WHERE session_id = ?"
                "   AND timestamp > ?"
                "   AND role = 'assistant'"
                " ORDER BY timestamp",
                (session_id, after_s),
            ) as cursor:
                rows = await cursor.fetchall()
        return [
            {
                "id": f"sync_{int(row[2] * 1000)}",
                "role": row[0],
                "content": row[1],
                "timestamp": int(row[2] * 1000),
            }
            for row in rows
        ]
    except Exception as e:
        print(f"[history] get_messages_after error: {e}")
        return []


async def save_message(session_id: str, msg: Message) -> None:
    """Append a single message to persistent storage."""
    try:
        async with aiosqlite.connect(settings.sqlite_path) as db:
            await _ensure_table(db)
            await db.execute(
                "INSERT INTO conversation_messages"
                " (session_id, role, content, tool_name, timestamp)"
                " VALUES (?, ?, ?, ?, ?)",
                (
                    session_id,
                    msg.role,
                    msg.content,
                    msg.tool_name,
                    msg.timestamp,
                ),
            )
            await db.commit()
    except Exception as e:
        print(f"[history] save error: {e}")
