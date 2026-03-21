"""Authentication for the dashboard API."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from ..config import settings

auth_router = APIRouter()

_token: str | None = None

_bearer = HTTPBearer(auto_error=False)


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
    return {"token": _token}


async def require_auth(
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer),
):
    if not _token or not credentials or credentials.credentials != _token:
        raise HTTPException(401, "Unauthorized")
    return credentials.credentials


def get_current_token() -> str | None:
    return _token
