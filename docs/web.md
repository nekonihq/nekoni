# Web App

The web app is a browser-based PWA with feature parity to the mobile app, including chat, RAG management, skills, cron scheduling, settings, and conversation history.

Hosted version:

**[app.nekoni.dev](https://app.nekoni.dev)**

## Local Development

```bash
cd apps/web
pnpm install
pnpm dev
```

The dev server runs at:

```text
https://localhost:5173
```

It uses a self-signed certificate.

## First Launch Flow

1. Start the agent with `make up`
2. Open the web app and tap **Pair**
3. Scan the QR code shown on the dashboard Pair page
4. Tap **Open Agent in Browser**
5. Accept the self-signed certificate warning
6. Return to the app and continue
7. Approve the pairing request in the dashboard

After the certificate is trusted once, the browser remembers the exception.

## Why HTTPS Is Required

The web app connects to the local agent over WebRTC and uses the HTTPS endpoint so browser mixed-content restrictions are satisfied.
