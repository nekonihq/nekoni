# Security Policy

## Supported versions

Only the latest release is actively maintained. Security fixes are not backported to older versions.

| Version | Supported |
| ------- | --------- |
| latest  | ✅        |
| older   | ❌        |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report security issues by emailing **denys@embedible.io**. Include:

- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- Any suggested fix if you have one

You can expect an acknowledgement within 48 hours and a resolution timeline within 7 days for critical issues.

## Scope

The following are in scope:

- `apps/agent` — the Python FastAPI agent (auth, WebRTC, API endpoints)
- `apps/signal` — the WebSocket signaling server
- `apps/mobile` — the React Native app
- `apps/web` — the React PWA
- The Ed25519 mutual auth handshake between client and agent

The following are **out of scope**:

- Vulnerabilities that require physical access to the user's home machine
- Issues in third-party dependencies (report these upstream)
- Self-XSS or attacks that require the user to run malicious code themselves

## Security model

nekoni is designed to run entirely on the user's own hardware. The public signal server (`signal.nekoni.dev`) is used only for WebRTC SDP/ICE exchange and never sees message content. All chat traffic is encrypted end-to-end over WebRTC DataChannel using DTLS.
