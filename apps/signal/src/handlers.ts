import { WebSocket } from 'ws'
import * as ed from '@noble/ed25519'
import { createHash } from 'node:crypto'
import { RoomManager } from './rooms.js'

// @noble/ed25519 v3 requires sha512 to be explicitly wired
ed.hashes.sha512 = (msg: Uint8Array): Uint8Array =>
  new Uint8Array(createHash('sha512').update(msg).digest())

function base64ToBytes(b64: string): Uint8Array {
  return Buffer.from(b64, 'base64url')
}

/** Canonical JSON: sort keys alphabetically (matches mobile signPayload and Python sort_keys=True) */
function sortedStringify(
  obj: Record<string, unknown>,
): string {
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(obj).sort())
    sorted[key] = obj[key]
  return JSON.stringify(sorted)
}

/** Verify Ed25519 signature over raw JSON payload bytes (no pre-hashing) */
async function verifySignature(
  msg: Record<string, unknown>,
): Promise<boolean> {
  try {
    const { sig, ...payload } = msg
    if (typeof sig !== 'string') return false

    const pubKeyField = (msg.pubKey ?? msg.from) as string | undefined
    if (!pubKeyField) return false

    const payloadStr = sortedStringify(payload)
    const payloadBytes = new TextEncoder().encode(payloadStr)
    const sigBytes = base64ToBytes(sig)
    const pubKeyBytes = base64ToBytes(pubKeyField)

    return ed.verify(sigBytes, payloadBytes, pubKeyBytes)
  } catch {
    return false
  }
}

type MessageHandler = (msg: Record<string, unknown>) => void

export function createMessageHandler(
  ws: WebSocket,
  rooms: RoomManager,
): MessageHandler {
  function send(obj: unknown) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(obj))
    }
  }

  function error(code: string, message: string) {
    send({ type: 'error', code, message })
  }

  return async function handle(
    msg: Record<string, unknown>,
  ) {
    try {
      const type = msg.type as string

      // join does not require pre-existing room membership, but must be signed
      if (type === 'join') {
        const { roomId, clientId, pubKey, ts } = msg as {
          roomId: string
          clientId: string
          pubKey: string
          ts: number
          sig: string
        }

        if (!roomId || !clientId || !pubKey || !ts) {
          return error('INVALID_JOIN', 'Missing required fields')
        }

        // Verify timestamp freshness (±5 minutes)
        if (Math.abs(Date.now() - ts) > 5 * 60 * 1000) {
          return error('STALE_TIMESTAMP', 'Message timestamp too old or in future')
        }

        if (!await verifySignature(msg)) {
          return error('INVALID_SIGNATURE', 'Signature verification failed')
        }

        // Deduplicate: remove existing client with same ID
        const existing = rooms.getClient(roomId, clientId)
        if (existing) {
          rooms.removeClient(existing.ws)
        }

        // Snapshot peers before joining so we can notify the newcomer
        const existingRoom = rooms.getRoom(roomId)
        const peers = existingRoom ? Array.from(existingRoom.values()) : []

        rooms.join(roomId, clientId, pubKey, ws)

        // Notify new client about existing peers
        for (const peer of peers) {
          send({ type: 'peer_joined', clientId: peer.clientId, pubKey: peer.pubKey })
        }

        // Notify existing peers about new client
        rooms.broadcastToRoom(roomId, { type: 'peer_joined', clientId, pubKey }, clientId)

        console.log(`[signal] ${clientId} joined room ${roomId}`)
        return
      }

      // All other messages require sender to be in a room
      const sender = rooms.getClientByWs(ws)
      if (!sender) {
        return error('NOT_JOINED', 'Must join a room first')
      }

      // Verify signature for offer/answer/ice
      if (['offer', 'answer', 'ice'].includes(type)) {
        const ts = msg.ts as number
        if (!ts || Math.abs(Date.now() - ts) > 5 * 60 * 1000) {
          return error('STALE_TIMESTAMP', 'Message timestamp too old or in future')
        }

        // sig is from the sender — attach sender's pubKey for verification
        if (!await verifySignature({ ...msg, pubKey: sender.pubKey })) {
          return error('INVALID_SIGNATURE', 'Signature verification failed')
        }

        const toClientId = msg.to as string
        if (!toClientId) {
          return error('MISSING_TO', "Missing 'to' field")
        }

        const target = rooms.getClient(sender.roomId, toClientId)
        if (!target || target.ws.readyState !== target.ws.OPEN) {
          return error('PEER_NOT_FOUND', `Peer ${toClientId} not found or not connected`)
        }

        target.ws.send(JSON.stringify(msg))
        return
      }

      error('UNKNOWN_TYPE', `Unknown message type: ${type}`)
    } catch (e) {
      console.error('[signal] Unhandled error in message handler:', e)
      send({ type: 'error', code: 'INTERNAL_ERROR', message: 'Internal server error' })
    }
  }
}
