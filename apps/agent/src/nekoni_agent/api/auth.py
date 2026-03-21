"""Authentication for the dashboard API."""

from __future__ import annotations

import sqlite3
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from ..config import settings

auth_router = APIRouter()

_token: str | None = None

_bearer = HTTPBearer(auto_error=False)

_TOKEN_KEY = "dashboard_token"


def _load_persisted_token() -> str | None:
    """Load the last-issued dashboard token from SQLite (synchronous)."""
    try:
        db_path = settings.sqlite_path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        con = sqlite3.connect(db_path)
        try:
            con.execute(
                "CREATE TABLE IF NOT EXISTS settings"
                " (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
            )
            row = con.execute(
                "SELECT value FROM settings WHERE key=?", (_TOKEN_KEY,)
            ).fetchone()
            return row[0] if row else None
        finally:
            con.close()
    except Exception as e:
        print(f"[auth] Could not load persisted token: {e}")
        return None


def _save_persisted_token(token: str) -> None:
    """Persist the dashboard token to SQLite so it survives agent restarts."""
    try:
        db_path = settings.sqlite_path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        con = sqlite3.connect(db_path)
        try:
            con.execute(
                "CREATE TABLE IF NOT EXISTS settings"
                " (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
            )
            con.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?)"
                " ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (_TOKEN_KEY, token),
            )
            con.commit()
        finally:
            con.close()
    except Exception as e:
        print(f"[auth] Could not persist token: {e}")


def load_token_on_startup() -> None:
    """Called once from lifespan to restore the token after a restart."""
    global _token
    _token = _load_persisted_token()
    if _token:
        print("[auth] Restored dashboard token from SQLite")


class LoginRequest(BaseModel):
    username: str
    password: str


@auth_router.post("/api/auth/login")
async def login(req: LoginRequest):
    global _token
    if (
        req.username != settings.dashboard_username
        or req.password != settings.dashboard_password
    ):
        raise HTTPException(401, "Invalid credentials")
    _token = str(uuid.uuid4())
    _save_persisted_token(_token)
    return {"token": _token}


async def require_auth(
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer),
):
    if not _token or not credentials or credentials.credentials != _token:
        raise HTTPException(401, "Unauthorized")
    return credentials.credentials


def get_current_token() -> str | None:
    return _token
