import { useEffect, useRef, useState } from 'react'
import { apiFetch, getToken } from '../api'

type EventHandler = (event: unknown) => void

export const useAgentWS = (onEvent: EventHandler) => {
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const handlerRef = useRef(onEvent)
  handlerRef.current = onEvent

  useEffect(() => {
    let cancelled = false

    const connect = () => {
      // Re-read token on every connect attempt so reconnects after
      // re-login use the fresh token, not a stale captured value.
      const token = getToken()
      const base = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/traces`
      const wsUrl = token ? `${base}?token=${token}` : base
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        // Send token as first message — more reliable than query params
        // through Cloudflare and other proxies that may strip query strings.
        if (token) ws.send(JSON.stringify({ type: 'auth', token }))
        setConnected(true)
        // Keep-alive ping every 30 s to prevent proxy idle-timeout closes
        // (Cloudflare's default idle timeout is 100 s).
        const keepalive = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN)
            ws.send(JSON.stringify({ type: 'ping' }))
        }, 30_000)
        ws.addEventListener('close', () => clearInterval(keepalive), { once: true })
      }
      ws.onclose = () => {
        setConnected(false)
        if (cancelled) return
        // Probe a protected endpoint before reconnecting.
        // apiFetch clears the token and fires auth:logout on 401/403,
        // which sends the user back to the login screen (e.g. after an
        // agent restart that reset the in-memory token).
        apiFetch('/api/traces?limit=0')
          .then(() => {
            if (!cancelled && getToken()) setTimeout(connect, 2000)
          })
          .catch(() => {
            // Network error — keep retrying
            if (!cancelled && getToken()) setTimeout(connect, 2000)
          })
      }
      ws.onerror = () => ws.close()
      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data)
          handlerRef.current(data)
        } catch {}
      }
    }

    connect()
    return () => {
      cancelled = true
      wsRef.current?.close()
    }
  }, [])

  return { connected }
}
