import { useState, useEffect } from 'react'
import nacl from 'tweetnacl'
import { encodeBase64, decodeBase64 } from 'tweetnacl-util'

const PRIVATE_KEY = 'nekoni_identity_private_key'
const PUBLIC_KEY = 'nekoni_identity_public_key'

export interface Identity {
  publicKeyB64: string
  privateKeyB64: string
  sign: (message: Uint8Array) => Uint8Array
}

export function b64ToBytes(b64: string): Uint8Array {
  const padding = (4 - (b64.length % 4)) % 4
  const std = b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padding)
  return new Uint8Array(decodeBase64(std))
}

function bytesToB64url(bytes: Uint8Array): string {
  return encodeBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export async function getOrCreateIdentity(): Promise<Identity> {
  let privKeyB64 = localStorage.getItem(PRIVATE_KEY)
  let pubKeyB64 = localStorage.getItem(PUBLIC_KEY)

  if (!privKeyB64 || !pubKeyB64) {
    const keypair = nacl.sign.keyPair()
    privKeyB64 = bytesToB64url(new Uint8Array(keypair.secretKey))
    pubKeyB64 = bytesToB64url(new Uint8Array(keypair.publicKey))
    localStorage.setItem(PRIVATE_KEY, privKeyB64)
    localStorage.setItem(PUBLIC_KEY, pubKeyB64)
  }

  const privateKeyBytes = b64ToBytes(privKeyB64)

  return {
    publicKeyB64: pubKeyB64,
    privateKeyB64: privKeyB64,
    sign: (message: Uint8Array) =>
      nacl.sign.detached(new Uint8Array(message), privateKeyBytes),
  }
}

export function signPayload(payload: Record<string, unknown>, identity: Identity): string {
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(payload).sort()) sorted[key] = payload[key]
  const msgBytes = new Uint8Array(new TextEncoder().encode(JSON.stringify(sorted)))
  const sig = identity.sign(msgBytes)
  return bytesToB64url(sig)
}

export function useIdentity() {
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getOrCreateIdentity()
      .then(setIdentity)
      .catch((e) => console.error('[identity] failed:', e))
      .finally(() => setLoading(false))
  }, [])

  return { identity, loading }
}
