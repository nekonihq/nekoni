"""WebRTC peer connection management."""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from typing import Awaitable, Callable

import aiohttp
from aiortc import RTCConfiguration, RTCIceServer, RTCPeerConnection, RTCSessionDescription
from aiortc.sdp import candidate_from_sdp, candidate_to_sdp

from ..config import settings
from ..crypto.keys import load_approved_devices, load_or_create_identity
from ..crypto.verify import sign_payload

PeerMessageCallback = Callable[[str, str], Awaitable[None]]


class AgentPeer:
    """Manages the agent's WebRTC peer connections via signaling server."""

    def __init__(
        self,
        keys_dir: str,
        on_message: PeerMessageCallback | None = None,
        on_rag=None,
        on_skill=None,
    ):
        self.keys_dir = keys_dir
        self.on_message = on_message
        self.on_rag = on_rag
        self.on_skill = on_skill
        self._private_key, self.pub_key = load_or_create_identity(keys_dir)
        self.client_id = f"agent-{str(uuid.uuid4())[:8]}"
        self._pc: RTCPeerConnection | None = None
        self._ws = None
        self._channel = None
        self._room_id: str | None = None
        self._connected = False

    async def connect_to_signal(self, room_id: str) -> None:
        """Connect to signaling server and join room."""

        self._room_id = room_id

        signal_url = settings.signal_url
        session = aiohttp.ClientSession()

        async def _run():
            while True:
                try:
                    print(f"[peer] Connecting to signal server {signal_url}")
                    # Rebuild join_msg with fresh timestamp on each connect attempt
                    fresh_join = {
                        "type": "join",
                        "roomId": room_id,
                        "clientId": self.client_id,
                        "pubKey": self.pub_key,
                        "ts": int(time.time() * 1000),
                    }
                    fresh_join["sig"] = sign_payload(
                        {k: v for k, v in fresh_join.items()}, self._private_key
                    )
                    async with session.ws_connect(signal_url) as ws:
                        self._ws = ws
                        await ws.send_json(fresh_join)
                        print(f"[peer] Joined room {room_id} as {self.client_id}")

                        async for msg in ws:
                            if msg.type == aiohttp.WSMsgType.TEXT:
                                data = json.loads(msg.data)
                                await self._handle_signal(data)
                            elif msg.type in (
                                aiohttp.WSMsgType.CLOSED,
                                aiohttp.WSMsgType.ERROR,
                            ):
                                break
                    print("[peer] Signal WS closed, reconnecting in 3s...")
                except Exception as e:
                    print(f"[peer] Signal connection error: {e}, retrying in 3s...")
                self._ws = None
                await asyncio.sleep(3)

        asyncio.create_task(_run())

    async def _handle_signal(self, msg: dict) -> None:
        msg_type = msg.get("type")

        if msg_type == "peer_joined":
            print(f"[peer] Peer joined: {msg.get('clientId')}")
            # Agent waits for offer from mobile

        elif msg_type == "offer":
            await self._handle_offer(msg)

        elif msg_type == "ice":
            if self._pc:
                candidate_data = msg.get("candidate", {})
                sdp_str = candidate_data.get("candidate", "")
                if sdp_str:
                    try:
                        # aiortc expects a parsed candidate, not the raw SDP string
                        sdp_line = (
                            sdp_str[len("candidate:") :]
                            if sdp_str.startswith("candidate:")
                            else sdp_str
                        )
                        candidate = candidate_from_sdp(sdp_line)
                        candidate.sdpMid = candidate_data.get("sdpMid")
                        candidate.sdpMLineIndex = candidate_data.get("sdpMLineIndex")
                        await self._pc.addIceCandidate(candidate)
                    except Exception as e:
                        print(f"[peer] ICE candidate error: {e}")

    async def _handle_offer(self, msg: dict) -> None:
        from_client = msg.get("from", "")
        approved = load_approved_devices(self.keys_dir)

        from .channel import DataChannelHandler

        # Close previous peer connection before creating a new one
        if self._pc is not None:
            try:
                await self._pc.close()
            except Exception as e:
                print(f"[peer] Error closing previous PC: {e}")
        self._pc = RTCPeerConnection(
            configuration=RTCConfiguration(
                iceServers=[RTCIceServer(urls=["stun:stun.l.google.com:19302"])]
            )
        )

        @self._pc.on("datachannel")
        def on_datachannel(channel):
            handler = DataChannelHandler(
                channel=channel,
                agent_private_key=self._private_key,
                agent_pub_key=self.pub_key,
                approved_devices=approved,
                on_message=self.on_message,
                on_rag=self.on_rag,
                on_skill=self.on_skill,
            )
            handler.setup()

        @self._pc.on("icecandidate")
        async def on_icecandidate(candidate):
            if candidate and self._ws:
                ice_msg = {
                    "type": "ice",
                    "candidate": {
                        "candidate": "candidate:" + candidate_to_sdp(candidate),
                        "sdpMid": candidate.sdpMid,
                        "sdpMLineIndex": candidate.sdpMLineIndex,
                    },
                    "from": self.client_id,
                    "to": from_client,
                    "ts": int(time.time() * 1000),
                }
                payload_to_sign = {k: v for k, v in ice_msg.items()}
                payload_to_sign.pop("sig", None)
                payload_to_sign["pubKey"] = self.pub_key
                ice_msg["sig"] = sign_payload(payload_to_sign, self._private_key)
                await self._ws.send_json(ice_msg)

        sdp = msg.get("sdp", "")
        offer = RTCSessionDescription(sdp=sdp, type="offer")
        await self._pc.setRemoteDescription(offer)

        answer = await self._pc.createAnswer()
        await self._pc.setLocalDescription(answer)

        answer_msg = {
            "type": "answer",
            "sdp": self._pc.localDescription.sdp,
            "from": self.client_id,
            "to": from_client,
            "ts": int(time.time() * 1000),
        }
        payload_to_sign = {k: v for k, v in answer_msg.items()}
        payload_to_sign["pubKey"] = self.pub_key
        answer_msg["sig"] = sign_payload(payload_to_sign, self._private_key)

        if self._ws:
            await self._ws.send_json(answer_msg)
            print(f"[peer] Sent answer to {from_client}")
