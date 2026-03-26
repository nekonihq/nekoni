# Mobile App

The mobile app is built with React Native and Expo.

## Run Locally

```bash
cd apps/mobile
pnpm install
pnpm start
```

Then press:

- `i` for iOS
- `a` for Android

## First Launch Flow

1. Open the app
2. The app opens the camera to scan a QR code
3. Open the dashboard Pair page
4. Scan the QR code
5. Approve the pairing request in the dashboard
6. The app connects automatically and navigates to chat

## Notes

The mobile app connects to the agent over HTTP to avoid self-signed certificate issues in React Native.
