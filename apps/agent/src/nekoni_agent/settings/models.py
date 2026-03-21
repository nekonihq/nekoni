"""Persistent key-value settings stored in SQLite."""
from __future__ import annotations

import aiosqlite
from ..config import settings


async def _ensure_table(db: aiosqlite.Connection) -> None:
    await db.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)
    await db.commit()


async def get_setting(key: str) -> str | None:
    async with aiosqlite.connect(settings.sqlite_path) as db:
        await _ensure_table(db)
        async with db.execute("SELECT value FROM settings WHERE key = ?", (key,)) as cur:
            row = await cur.fetchone()
            return row[0] if row else None


async def set_setting(key: str, value: str) -> None:
    async with aiosqlite.connect(settings.sqlite_path) as db:
        await _ensure_table(db)
        await db.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )
        await db.commit()
