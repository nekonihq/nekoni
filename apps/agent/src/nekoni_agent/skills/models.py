"""Persistent storage for skills and cron jobs."""
from __future__ import annotations
import time
import uuid
import aiosqlite
from ..config import settings

async def _ensure_tables(db: aiosqlite.Connection) -> None:
    await db.execute("""
        CREATE TABLE IF NOT EXISTS skills (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            prompt TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            created_at INTEGER NOT NULL
        )
    """)
    await db.execute("""
        CREATE TABLE IF NOT EXISTS cron_jobs (
            id TEXT PRIMARY KEY,
            skill_id TEXT NOT NULL,
            cron_expression TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            last_run INTEGER,
            created_at INTEGER NOT NULL
        )
    """)
    await db.commit()

def _row_to_skill(row) -> dict:
    return {"id": row[0], "name": row[1], "prompt": row[2], "description": row[3], "createdAt": row[4]}

def _row_to_job(row) -> dict:
    return {"id": row[0], "skillId": row[1], "cronExpression": row[2], "enabled": bool(row[3]), "lastRun": row[4], "createdAt": row[5]}

async def list_skills() -> list[dict]:
    async with aiosqlite.connect(settings.sqlite_path) as db:
        await _ensure_tables(db)
        async with db.execute("SELECT id, name, prompt, description, created_at FROM skills ORDER BY created_at") as cur:
            return [_row_to_skill(r) for r in await cur.fetchall()]

async def get_skill(skill_id: str) -> dict | None:
    async with aiosqlite.connect(settings.sqlite_path) as db:
        await _ensure_tables(db)
        async with db.execute("SELECT id, name, prompt, description, created_at FROM skills WHERE id = ?", (skill_id,)) as cur:
            row = await cur.fetchone()
            return _row_to_skill(row) if row else None

async def create_skill(name: str, prompt: str, description: str = "") -> dict:
    skill = {"id": str(uuid.uuid4()), "name": name, "prompt": prompt, "description": description, "createdAt": int(time.time() * 1000)}
    async with aiosqlite.connect(settings.sqlite_path) as db:
        await _ensure_tables(db)
        await db.execute("INSERT INTO skills (id, name, prompt, description, created_at) VALUES (?, ?, ?, ?, ?)",
                         (skill["id"], skill["name"], skill["prompt"], skill["description"], skill["createdAt"]))
        await db.commit()
    return skill

async def update_skill(skill_id: str, **kwargs) -> dict | None:
    fields = {k: v for k, v in kwargs.items() if k in ("name", "prompt", "description") and v is not None}
    if not fields:
        return await get_skill(skill_id)
    set_clause = ", ".join(f"{k} = ?" for k in fields)
    async with aiosqlite.connect(settings.sqlite_path) as db:
        await _ensure_tables(db)
        await db.execute(f"UPDATE skills SET {set_clause} WHERE id = ?", (*fields.values(), skill_id))
        await db.commit()
    return await get_skill(skill_id)

async def delete_skill(skill_id: str) -> bool:
    async with aiosqlite.connect(settings.sqlite_path) as db:
        await _ensure_tables(db)
        await db.execute("DELETE FROM cron_jobs WHERE skill_id = ?", (skill_id,))
        cur = await db.execute("DELETE FROM skills WHERE id = ?", (skill_id,))
        await db.commit()
        return cur.rowcount > 0

async def list_cron_jobs(skill_id: str | None = None) -> list[dict]:
    async with aiosqlite.connect(settings.sqlite_path) as db:
        await _ensure_tables(db)
        if skill_id:
            async with db.execute("SELECT id, skill_id, cron_expression, enabled, last_run, created_at FROM cron_jobs WHERE skill_id = ? ORDER BY created_at", (skill_id,)) as cur:
                return [_row_to_job(r) for r in await cur.fetchall()]
        async with db.execute("SELECT id, skill_id, cron_expression, enabled, last_run, created_at FROM cron_jobs ORDER BY created_at") as cur:
            return [_row_to_job(r) for r in await cur.fetchall()]

async def get_cron_job(job_id: str) -> dict | None:
    async with aiosqlite.connect(settings.sqlite_path) as db:
        await _ensure_tables(db)
        async with db.execute("SELECT id, skill_id, cron_expression, enabled, last_run, created_at FROM cron_jobs WHERE id = ?", (job_id,)) as cur:
            row = await cur.fetchone()
            return _row_to_job(row) if row else None

async def create_cron_job(skill_id: str, cron_expression: str, enabled: bool = True) -> dict:
    job = {"id": str(uuid.uuid4()), "skillId": skill_id, "cronExpression": cron_expression, "enabled": enabled, "lastRun": None, "createdAt": int(time.time() * 1000)}
    async with aiosqlite.connect(settings.sqlite_path) as db:
        await _ensure_tables(db)
        await db.execute("INSERT INTO cron_jobs (id, skill_id, cron_expression, enabled, created_at) VALUES (?, ?, ?, ?, ?)",
                         (job["id"], job["skillId"], job["cronExpression"], int(job["enabled"]), job["createdAt"]))
        await db.commit()
    return job

async def update_cron_job(job_id: str, **kwargs) -> dict | None:
    fields = {}
    if "cronExpression" in kwargs and kwargs["cronExpression"] is not None:
        fields["cron_expression"] = kwargs["cronExpression"]
    if "enabled" in kwargs and kwargs["enabled"] is not None:
        fields["enabled"] = int(kwargs["enabled"])
    if not fields:
        return await get_cron_job(job_id)
    set_clause = ", ".join(f"{k} = ?" for k in fields)
    async with aiosqlite.connect(settings.sqlite_path) as db:
        await _ensure_tables(db)
        await db.execute(f"UPDATE cron_jobs SET {set_clause} WHERE id = ?", (*fields.values(), job_id))
        await db.commit()
    return await get_cron_job(job_id)

async def delete_cron_job(job_id: str) -> bool:
    async with aiosqlite.connect(settings.sqlite_path) as db:
        await _ensure_tables(db)
        cur = await db.execute("DELETE FROM cron_jobs WHERE id = ?", (job_id,))
        await db.commit()
        return cur.rowcount > 0

async def touch_last_run(job_id: str) -> None:
    ts = int(time.time() * 1000)
    async with aiosqlite.connect(settings.sqlite_path) as db:
        await _ensure_tables(db)
        await db.execute("UPDATE cron_jobs SET last_run = ? WHERE id = ?", (ts, job_id))
        await db.commit()
