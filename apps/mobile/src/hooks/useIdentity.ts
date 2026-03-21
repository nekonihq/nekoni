import { useEffect, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import * as ExpoCrypto from 'expo-crypto'
import nacl from 'tweetnacl'
import { encodeBase64, decodeBase64 } from 'tweetnacl-util'

// Wire expo-crypto's native RNG into tweetnacl before any nacl call.
// Copy element-by-element — avoids Hermes cross-realm instanceof issues with .set().
nacl.setPRNG((output, length) => {
  const bytes = ExpoCrypto.getRandomBytes(length)
  for (let i = 0; i < length; i++) output[i] = bytes[i]
})

const PRIVATE_KEY_KEY = 'nekoni_identity_private_key'
const PUBLIC_KEY_KEY = 'nekoni_identity_public_key'

export interface Identity {
  publicKeyB64: string
  privateKeyB64: string
  sign: (message: Uint8Array) => Uint8Array
}

/** base64url (no padding) → Uint8Array, safe on Hermes */
export function b64ToBytes(b64: string): Uint8Array {
  const padding = (4 - (b64.length % 4)) % 4
  const std =
    b64.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat(padding)
  return new Uint8Array(decodeBase64(std))
}

function bytesToB64url(bytes: Uint8Array): string {
  return encodeBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/** UTF-8 encode and return a fresh Uint8Array (avoids cross-realm instanceof).
 *  Use TextEncoder — tweetnacl-util's encodeUTF8 returns empty bytes in Hermes. */
function toBytes(s: string): Uint8Array {
  return new Uint8Array(new TextEncoder().encode(s))
}

export async function getOrCreateIdentity(): Promise<Identity> {
  let privKeyB64 =
    await SecureStore.getItemAsync(PRIVATE_KEY_KEY)
  let pubKeyB64 =
    await SecureStore.getItemAsync(PUBLIC_KEY_KEY)

  if (!privKeyB64 || !pubKeyB64) {
    const keypair = nacl.sign.keyPair()
    // Wrap in new Uint8Array to avoid cross-realm issues with encodeBase64
    privKeyB64 = bytesToB64url(
      new Uint8Array(keypair.secretKey),
    )
    pubKeyB64 = bytesToB64url(
      new Uint8Array(keypair.publicKey),
    )
    console.log('[identity] generated new keypair')
    console.log(
      '[identity] secretKey len:',
      keypair.secretKey.length,
    )
    console.log(
      '[identity] publicKey len:',
      keypair.publicKey.length,
    )
    await SecureStore.setItemAsync(
      PRIVATE_KEY_KEY,
      privKeyB64,
    )
    await SecureStore.setItemAsync(
      PUBLIC_KEY_KEY,
      pubKeyB64,
    )
  }

  const privateKeyBytes = b64ToBytes(privKeyB64)
  console.log(
    '[identity] loaded secretKey len:',
    privateKeyBytes.length,
  )

  // Verify consistency: last 32 bytes of secretKey must equal publicKey
  const derivedPair =
    nacl.sign.keyPair.fromSecretKey(privateKeyBytes)
  const derivedPubKeyB64 = bytesToB64url(
    new Uint8Array(derivedPair.publicKey),
  )
  console.log('[identity] stored  pubKey :', pubKeyB64)
  console.log(
    '[identity] derived pubKey :',
    derivedPubKeyB64,
  )
  console.log(
    '[identity] keys match     :',
    pubKeyB64 === derivedPubKeyB64,
  )

  return {
    publicKeyB64: pubKeyB64,
    privateKeyB64: privKeyB64,
    sign: (message: Uint8Array) =>
      nacl.sign.detached(
        new Uint8Array(message),
        privateKeyBytes,
      ),
  }
}

export function signPayload(
  payload: Record<string, unknown>,
  identity: Identity,
): string {
  // Sort only top-level keys — matches sortedStringify on the signal server.
  // Do NOT use JSON.stringify array replacer: it recursively filters nested objects.
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(payload).sort())
    sorted[key] = payload[key]
  const msgBytes = toBytes(JSON.stringify(sorted))
  const sig = identity.sign(msgBytes)
  return bytesToB64url(sig)
}

export function useIdentity() {
  const [identity, setIdentity] = useState<Identity | null>(
    null,
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getOrCreateIdentity()
      .then(setIdentity)
      .catch((e) => console.error('[identity] Failed to load identity:', e))
      .finally(() => setLoading(false))
  }, [])

  return { identity, loading }
}
