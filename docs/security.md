# Security Model

## Identity Keys

Both the agent and the client device have long-lived Ed25519 keypairs.

- **Agent key** — generated on first run and stored at `data/keys/agent_identity.pem`
- **Client key** — generated on first install and stored securely on the device

The public agent key is embedded in the QR code used during pairing.

## Pairing

Pairing is performed once per device on the local network.

```mermaid
sequenceDiagram
    participant C as Client (Mobile / Web)
    participant A as Agent
    participant D as Dashboard

    D-->>C: QR code (agentPubKey + signalUrl + agentUrl + agentUrlHttps + roomId)
    Note over C: Web app opens agentUrlHttps to trust self-signed cert
    C->>A: POST /api/pair {mobilePubKey, sig, ts}
    A->>D: WS pairing_request
    Note over D: User approves request
    D->>A: POST /api/pair/approve
    Note over A: Stores mobilePubKey
    A->>C: 200 OK
```

The QR payload includes:

- `agentUrl` for mobile
- `agentUrlHttps` for the web app

## Signaling Authentication

Every WebSocket signaling message is signed.

```text
sig = base64url(Ed25519Sign(sha256(JSON.stringify(payload_without_sig)), senderPrivKey))
```

The signal server verifies signatures and enforces a ±5 minute timestamp window to reduce replay risk.

## DataChannel Mutual Authentication

After WebRTC opens, mutual authentication is performed before any normal messages are accepted.

```mermaid
sequenceDiagram
    participant M as Mobile
    participant A as Agent

    M->>A: Hello {pubKey, nonce_m}
    Note over A: Verify pubKey in approved list
    A->>M: Challenge {nonce_a, sig: sign(nonce_m, agentPrivKey)}
    Note over M: Verify sig with QR-scanned agentPubKey
    M->>A: Response {sig: sign(nonce_a, mobilePrivKey)}
    Note over A: Verify sig with approved pubKey
    A->>M: Ready
```

The connection is dropped immediately on any authentication failure. There is no fallback mode.
