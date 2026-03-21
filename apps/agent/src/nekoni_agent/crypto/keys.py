"""Ed25519 key management for agent identity."""

import base64
import json
from pathlib import Path

from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    NoEncryption,
    PrivateFormat,
    PublicFormat,
    load_pem_private_key,
)


def generate_keypair() -> Ed25519PrivateKey:
    """Generate a new Ed25519 private key."""
    return Ed25519PrivateKey.generate()


def private_key_to_pem(key: Ed25519PrivateKey) -> bytes:
    return key.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption())


def public_key_to_b64(key: Ed25519PublicKey) -> str:
    raw = key.public_bytes(Encoding.Raw, PublicFormat.Raw)
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def private_key_from_pem(pem: bytes) -> Ed25519PrivateKey:
    return load_pem_private_key(pem, password=None)


def load_or_create_identity(keys_dir: str) -> tuple[Ed25519PrivateKey, str]:
    """Load or create identity key.

    Returns (private_key, public_key_b64).
    """
    path = Path(keys_dir)
    path.mkdir(parents=True, exist_ok=True)

    key_file = path / "agent_identity.pem"

    if key_file.exists():
        private_key = private_key_from_pem(key_file.read_bytes())
        print(f"[crypto] Loaded identity key from {key_file}")
    else:
        private_key = generate_keypair()
        key_file.write_bytes(private_key_to_pem(private_key))
        key_file.chmod(0o600)
        print(f"[crypto] Generated new identity key at {key_file}")

    pub_key_b64 = public_key_to_b64(private_key.public_key())
    return private_key, pub_key_b64


def load_approved_devices(keys_dir: str) -> dict[str, dict]:
    """Load approved mobile device public keys."""
    path = Path(keys_dir) / "approved_devices.json"
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except Exception:
        return {}


def save_approved_devices(keys_dir: str, devices: dict[str, dict]) -> None:
    """Persist approved device keys to disk."""
    path = Path(keys_dir) / "approved_devices.json"
    path.write_text(json.dumps(devices, indent=2))
