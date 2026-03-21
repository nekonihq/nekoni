import { useState, useCallback, useRef, useEffect } from 'react'
import nacl from 'tweetnacl'
import { encodeBase64, decodeBase64 } from 'tweetnacl-util'
import { Identity } from './useIdentity'

export interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: number
}

type AuthState =
  | 'pending'
  | 'authenticating'
  | 'ready'
  | 'failed'

function b64url(bytes: Uint8Array): string {
  return encodeBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/** base64url → fresh Uint8Array, safe on Hermes */
function fromB64url(s: string): Uint8Array {
  const padding = (4 - (s.length % 4)) % 4
  const std =
    s.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat(padding)
  return new Uint8Array(decodeBase64(std))
}

/** UTF-8 encode → fresh Uint8Array */
function toBytes(s: string): Uint8Array {
  return new Uint8Array(new TextEncoder().encode(s))
}

export function useAgent(
  identity: Identity | null,
  agentPubKey: string | null,
  sendRaw: (data: string) => void,
  sessionId: string | null = null,
) {
  const [authState, setAuthState] =
    useState<AuthState>('pending')
  const [messages, setMessages] = useState<ChatMessage[]>(
    [],
  )
  const messagesRef = useRef<ChatMessage[]>([])
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])
  const [pendingMessage, setPendingMessage] = useState<
    string | null
  >(null)
  const [isThinking, setIsThinking] = useState(false)
  const nonceMRef = useRef<string>('')
  // Refs keep values current inside event-handler callbacks without stale closures
  const authStateRef = useRef<AuthState>('pending')
  const sessionIdRef = useRef(sessionId)
  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  const handleDataChannelMessage = useCallback(
    (raw: string) => {
      let msg: any
      try {
        msg = JSON.parse(raw)
      } catch (e) {
        console.error('[agent] Failed to parse message:', e, 'raw:', raw.slice(0, 100))
        return
      }

      if (authStateRef.current !== 'ready') {
        if (msg.type === 'challenge') {
          if (!identity || !agentPubKey) return

          const agentPubKeyBytes = fromB64url(agentPubKey)
          const sigBytes = fromB64url(msg.sig)
          const payloadBytes = toBytes(
            JSON.stringify({ nonce: nonceMRef.current }),
          )

          const valid = nacl.sign.detached.verify(
            payloadBytes,
            sigBytes,
            agentPubKeyBytes,
          )
          if (!valid) {
            setAuthState('failed')
            return
          }

          const responsePayload = toBytes(
            JSON.stringify({ nonce: msg.nonce }),
          )
          const responseSig = nacl.sign.detached(
            responsePayload,
            fromB64url(identity.privateKeyB64),
          )
          sendRaw(
            JSON.stringify({
              type: 'response',
              sig: b64url(responseSig),
            }),
          )
        } else if (msg.type === 'sync_response') {
          const synced = (msg.messages ?? []) as ChatMessage[]
          if (synced.length === 0) return
          setMessages((prev) => {
            const existingTs = new Set(prev.map((m) => m.timestamp))
            const fresh = synced.filter(
              (m) => !existingTs.has(m.timestamp),
            )
            return fresh.length > 0 ? [...prev, ...fresh] : prev
          })
        } else if (msg.type === 'ready') {
          authStateRef.current = 'ready'
          setAuthState('ready')
          // Request any messages missed while disconnected
          const lastTs =
            messagesRef.current.length > 0
              ? messagesRef.current[
                  messagesRef.current.length - 1
                ].timestamp
              : 0
          sendRaw(
            JSON.stringify({
              type: 'sync',
              sessionId: sessionIdRef.current ?? 'default',
              afterTimestamp: lastTs,
            }),
          )
        } else if (msg.type === 'auth_failed') {
          authStateRef.current = 'failed'
          setAuthState('failed')
        }
      } else {
        if (msg.type === 'chunk') {
          setIsThinking(false)
          setPendingMessage(
            (prev) => (prev ?? '') + msg.content,
          )
        } else if (msg.type === 'message_end') {
          setIsThinking(false)
          setPendingMessage((prev) => {
            if (prev) {
              setMessages((msgs) => [
                ...msgs,
                {
                  id: String(Date.now()),
                  role: 'agent',
                  content: prev,
                  timestamp: Date.now(),
                },
              ])
            }
            return null
          })
        } else if (msg.type === 'message' && msg.content) {
          // non-streaming fallback
          setIsThinking(false)
          setMessages((prev) => [
            ...prev,
            {
              id: msg.id || String(Date.now()),
              role: 'agent',
              content: msg.content,
              timestamp: msg.timestamp || Date.now(),
            },
          ])
        }
      }
    },
    [authState, identity, agentPubKey, sendRaw],
  )

  const startHandshake = useCallback(() => {
    if (!identity) return
    const nonce = b64url(nacl.randomBytes(32))
    nonceMRef.current = nonce
    setAuthState('authenticating')
    sendRaw(
      JSON.stringify({
        type: 'hello',
        pubKey: identity.publicKeyB64,
        nonce,
      }),
    )
  }, [identity, sendRaw])

  const sendMessage = useCallback(
    (content: string) => {
      if (authState !== 'ready') return
      const msg: ChatMessage = {
        id: String(Date.now()),
        role: 'user',
        content,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, msg])
      setIsThinking(true)
      sendRaw(
        JSON.stringify({
          content,
          sessionId: sessionIdRef.current ?? 'default',
        }),
      )
    },
    [authState, sendRaw],
  )

  const reset = useCallback(() => {
    setAuthState('pending')
    authStateRef.current = 'pending'
    setPendingMessage(null)
    setIsThinking(false)
  }, [])

  const setInitialMessages = useCallback(
    (msgs: ChatMessage[]) => {
      setMessages(msgs)
    },
    [],
  )

  return {
    authState,
    messages,
    pendingMessage,
    isThinking,
    handleDataChannelMessage,
    startHandshake,
    sendMessage,
    reset,
    setInitialMessages,
  }
}
