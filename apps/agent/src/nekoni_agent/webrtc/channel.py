"""DataChannel authentication handshake and message handler."""

from __future__ import annotations

import asyncio
import base64
import json
import os
from typing import Awaitable, Callable

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from ..crypto.verify import sign_payload, verify_payload

SendChunkFn = Callable[[str], None]
# (content, mobile_pub_key, session_id, send_chunk) -> response
MessageCallback = Callable[[str, str, str, SendChunkFn], Awaitable[str | None]]
RagCallback = Callable[[str, dict], Awaitable[dict]]
SkillCallback = Callable[[str, dict], Awaitable[dict]]

# Registry of authenticated channels keyed by mobilePubKey
_active_channels: dict[str, "DataChannelHandler"] = {}


def close_channel(mobile_pub_key: str) -> bool:
    """Close an active channel by mobile public key. Returns True if found."""
    handler = _active_channels.pop(mobile_pub_key, None)
    if handler:
        handler.channel.close()
        print(f"[channel] force-closed channel for {mobile_pub_key[:16]}…")
        return True
    return False


class DataChannelHandler:
    """Handles the 4-step mutual auth handshake then message routing."""

    def __init__(
        self,
        channel,
        agent_private_key: Ed25519PrivateKey,
        agent_pub_key: str,
        approved_devices: dict,
        on_message: MessageCallback | None = None,
        on_rag: RagCallback | None = None,
        on_skill: SkillCallback | None = None,
    ):
        self.channel = channel
        self._private_key = agent_private_key
        self._pub_key = agent_pub_key
        self._approved = approved_devices
        self.on_message = on_message
        self.on_rag = on_rag
        self.on_skill = on_skill
        self._auth_complete = False
        self._mobile_pub_key: str | None = None
        self._nonce_m: str | None = None
        self._nonce_a: str | None = None
        self._pending_uploads: dict[str, dict] = {}

    def setup(self):
        @self.channel.on("open")
        def on_open():
            print("[channel] DataChannel opened, waiting for hello")

        @self.channel.on("message")
        def on_message(raw: str):
            asyncio.ensure_future(self._handle_message(raw))

        @self.channel.on("close")
        def on_close():
            print("[channel] DataChannel closed")
            if self._mobile_pub_key:
                _active_channels.pop(self._mobile_pub_key, None)

    def _send(self, obj: dict) -> None:
        if self.channel.readyState != "open":
            print(
                f"[channel] drop {obj.get('type')}: channel {self.channel.readyState}"
            )
            return
        self.channel.send(json.dumps(obj))

    async def _handle_sync(self, msg: dict) -> None:
        from ..agent.history import get_messages_after

        session_id = msg.get("sessionId", "")
        after_ts = int(msg.get("afterTimestamp", 0))
        if not session_id:
            return
        print(
            f"[channel] sync request session={session_id!r}"
            f" after={after_ts}"
        )
        messages = await get_messages_after(session_id, after_ts)
        print(f"[channel] sync: returning {len(messages)} message(s)")
        self._send({"type": "sync_response", "messages": messages})

    def _fail(self, reason: str) -> None:
        print(f"[channel] Auth failed: {reason}")
        self._send({"type": "auth_failed", "reason": reason})
        self.channel.close()

    async def _handle_message(self, raw: str) -> None:
        print(f"[channel] ← received raw ({len(raw)} bytes): {raw[:120]}")
        try:
            msg = json.loads(raw)
        except Exception:
            self._fail("Invalid JSON")
            return

        msg_type = msg.get("type")

        if msg_type == "ping":
            self._send({"type": "pong"})
            return

        print(f"[channel] msg_type={msg_type!r} auth_complete={self._auth_complete}")

        if not self._auth_complete:
            await self._handle_handshake(msg_type, msg)
        elif msg_type == "sync":
            asyncio.ensure_future(self._handle_sync(msg))

        else:
            if msg_type in (
                "rag_list", "rag_delete", "rag_upload",
                "rag_upload_start", "rag_upload_chunk",
            ):
                asyncio.ensure_future(self._handle_rag(msg_type, msg))
                return
            if msg_type and (msg_type.startswith("skill_") or msg_type.startswith("cron_")):
                asyncio.ensure_future(self._handle_skill(msg_type, msg))
                return
            content = msg.get("content", "")
            print(
                f"[channel] authenticated message:"
                f" content={content[:80]!r}"
                f" on_message={self.on_message is not None}"
            )
            if self.on_message and content:
                session_id = msg.get("sessionId", "") or ""
                print(
                    f"[channel] invoking agent loop"
                    f" session={session_id!r}…"
                )

                chunks_sent = 0

                def send_chunk(token: str) -> None:
                    nonlocal chunks_sent
                    if self.channel.readyState == "open":
                        self.channel.send(
                            json.dumps({"type": "chunk", "content": token})
                        )
                        chunks_sent += 1

                try:
                    response = await self.on_message(
                        content,
                        self._mobile_pub_key or "",
                        session_id,
                        send_chunk,
                    )
                except Exception as e:
                    print(f"[channel] on_message raised: {e}")
                    return

                if chunks_sent == 0 and response:
                    # No streaming happened (tool-call iterations only)
                    self._send({"type": "message", "content": response})
                else:
                    self._send({"type": "message_end"})
            elif not content:
                print(f"[channel] dropped: no 'content' field in {msg}")

    async def _handle_rag(self, msg_type: str, msg: dict) -> None:
        if not self.on_rag:
            self._send({"type": "rag_error", "message": "RAG not available"})
            return

        if msg_type == "rag_upload_start":
            upload_id = msg.get("uploadId", "")
            self._pending_uploads[upload_id] = {
                "filename": msg.get("filename", "document.txt"),
                "total_chunks": int(msg.get("totalChunks", 1)),
                "chunks": {},
            }
            print(
                f"[channel] rag_upload_start id={upload_id!r}"
                f" total={msg.get('totalChunks')} file={msg.get('filename')!r}"
            )
            return

        if msg_type == "rag_upload_chunk":
            upload_id = msg.get("uploadId", "")
            index = int(msg.get("index", 0))
            upload = self._pending_uploads.get(upload_id)
            if upload is None:
                self._send({"type": "rag_error", "message": f"Unknown upload {upload_id}"})
                return
            upload["chunks"][index] = msg.get("content", "")
            print(
                f"[channel] rag_upload_chunk id={upload_id!r}"
                f" {index+1}/{upload['total_chunks']}"
            )
            if len(upload["chunks"]) >= upload["total_chunks"]:
                full_b64 = "".join(
                    upload["chunks"][i] for i in range(upload["total_chunks"])
                )
                filename = upload["filename"]
                del self._pending_uploads[upload_id]
                try:
                    result = await self.on_rag(
                        "rag_upload", {"filename": filename, "content": full_b64}
                    )
                    self._send(result)
                except Exception as e:
                    self._send({"type": "rag_error", "message": str(e)})
            return

        try:
            result = await self.on_rag(msg_type, msg)
            self._send(result)
        except Exception as e:
            self._send({"type": "rag_error", "message": str(e)})

    async def _handle_skill(self, msg_type: str, msg: dict) -> None:
        if not self.on_skill:
            self._send({"type": "skill_error", "message": "Skills not available"})
            return
        try:
            result = await self.on_skill(msg_type, msg)
            self._send(result)
        except Exception as e:
            self._send({"type": "skill_error", "message": str(e)})

    async def _handle_handshake(self, msg_type: str, msg: dict) -> None:
        if msg_type == "hello":
            mobile_pub_key = msg.get("pubKey", "")
            nonce_m = msg.get("nonce", "")

            if not mobile_pub_key or not nonce_m:
                self._fail("Missing pubKey or nonce")
                return

            # Check if this device is approved
            if mobile_pub_key not in self._approved:
                self._fail("Device not approved")
                return

            self._mobile_pub_key = mobile_pub_key
            self._nonce_m = nonce_m

            # Generate agent nonce
            self._nonce_a = (
                base64.urlsafe_b64encode(os.urandom(32)).decode().rstrip("=")
            )

            # Sign mobile's nonce
            sig = sign_payload({"nonce": nonce_m}, self._private_key)

            self._send(
                {
                    "type": "challenge",
                    "nonce": self._nonce_a,
                    "sig": sig,
                }
            )

        elif msg_type == "response":
            if not self._nonce_a or not self._mobile_pub_key:
                self._fail("Unexpected response")
                return

            sig = msg.get("sig", "")
            # Verify mobile signed our nonce
            valid = verify_payload({"nonce": self._nonce_a}, sig, self._mobile_pub_key)
            if not valid:
                self._fail("Invalid response signature")
                return

            self._auth_complete = True
            _active_channels[self._mobile_pub_key] = self
            self._send({"type": "ready"})
            print(f"[channel] Auth complete for device {self._mobile_pub_key[:16]}...")

        else:
            self._fail(f"Unexpected message type during handshake: {msg_type}")
