# Privacy Policy

**Last updated: March 21, 2026**

## Overview

Nekoni is a self-hosted AI assistant. The mobile app connects directly to an agent you run on your own hardware. Neither the app nor the developer collects, stores, or processes your personal data.

## Data We Do Not Collect

- We do not collect your messages or conversations
- We do not collect your name, email, or account information
- We do not track your location
- We do not use analytics or advertising SDKs
- We do not share any data with third parties

## Data Stored on Your Device

The app stores the following data locally on your iPhone only:

- **Identity key** — an Ed25519 cryptographic key pair generated on first launch, stored in the iOS Keychain. It never leaves your device.
- **Paired agent info** — the public key and connection details of agents you have paired with, stored locally.
- **Conversation history** — your chat history, stored in a local database on your device.

## Data Stored on Your Own Hardware

All AI processing, documents, and conversation logs on the agent side are stored on the machine you control. The developer has no access to this data.

## Signaling Server

To establish a peer-to-peer connection between your phone and your agent, the app uses a signaling server at `signal.nekoni.dev`. This server exchanges only the technical handshake data needed to set up the connection (WebRTC SDP and ICE candidates). No message content is transmitted through it. The server does not log or store any data beyond the active session.

## Camera

The app requests camera access solely to scan QR codes during the pairing process. No photos or video are stored or transmitted.

## Changes to This Policy

If this policy changes, the updated version will be posted at this URL with a new date.

## Contact

For questions or concerns, open an issue at https://github.com/nekonihq/nekoni/issues
