"""Ed25519 sign/verify helpers."""

import base64
import json
import time

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)


def _public_key_from_b64(b64: str) -> Ed25519PublicKey:
    """Load an Ed25519PublicKey from base64url-encoded raw bytes."""

    # Pad base64url
    padded = b64 + "=" * (-len(b64) % 4)
    raw = base64.urlsafe_b64decode(padded)
    from cryptography.hazmat.primitives.asymmetric import ed25519

    return ed25519.Ed25519PublicKey.from_public_bytes(raw)


def sign_payload(payload: dict, private_key: Ed25519PrivateKey) -> str:
    """Sign JSON.stringify(payload) with private_key. Returns base64url sig."""
    payload_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    sig_bytes = private_key.sign(payload_bytes)
    return base64.urlsafe_b64encode(sig_bytes).rstrip(b"=").decode()


def verify_payload(payload: dict, sig_b64: str, pub_key_b64: str) -> bool:
    """Verify base64url sig over JSON.stringify(payload) with pub_key_b64."""
    try:
        pub_key = _public_key_from_b64(pub_key_b64)
        payload_bytes = json.dumps(
            payload, separators=(",", ":"), sort_keys=True
        ).encode()
        padded = sig_b64 + "=" * (-len(sig_b64) % 4)
        sig_bytes = base64.urlsafe_b64decode(padded)
        pub_key.verify(sig_bytes, payload_bytes)
        return True
    except (InvalidSignature, Exception):
        return False


def verify_message_sig(msg: dict, pub_key_b64: str) -> bool:
    """Verify a signaling message that includes a 'sig' field."""
    sig = msg.get("sig")
    if not sig:
        return False
    payload = {k: v for k, v in msg.items() if k != "sig"}
    return verify_payload(payload, sig, pub_key_b64)


def check_freshness(ts: int, tolerance_seconds: int = 300) -> bool:
    """Check that timestamp is within tolerance of now."""
    return abs(time.time() * 1000 - ts) < tolerance_seconds * 1000
