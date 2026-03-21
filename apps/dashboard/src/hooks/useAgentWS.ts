import { useEffect, useRef, useState } from 'react'
import { getToken } from '../api'

type EventHandler = (event: unknown) => void

export const useAgentWS = (onEvent: EventHandler) => {
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const handlerRef = useRef(onEvent)
  handlerRef.current = onEvent

  useEffect(() => {
    const token = getToken()
    const base = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/traces`
    const wsUrl = token ? `${base}?token=${token}` : base
    let cancelled = false

    const connect = () => {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[traces] WS connected', wsUrl)
        setConnected(true)
      }
      ws.onclose = () => {
        console.log(
          '[traces] WS closed, cancelled=',
          cancelled,
        )
        setConnected(false)
        if (!cancelled) setTimeout(connect, 2000)
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
