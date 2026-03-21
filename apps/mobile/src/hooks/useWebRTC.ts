/**
 * WebRTC hook for mobile - handles signaling and peer connection.
 */
import { useRef, useState, useCallback } from 'react'
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
} from 'react-native-webrtc'
import Toast from 'react-native-toast-message'
import { Identity, signPayload } from './useIdentity'

export type RTCState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'

interface AgentQRPayload {
  agentPubKey: string
  signalUrl: string
  roomId: string
  agentName: string
}

interface UseWebRTCOptions {
  identity: Identity | null
  onDataChannelMessage?: (msg: string) => void
}

export function useWebRTC({
  identity,
  onDataChannelMessage,
}: UseWebRTCOptions) {
  const [state, setState] = useState<RTCState>('idle')
  const [error, setError] = useState<string | null>(null)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<any>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const pingIntervalRef = useRef<ReturnType<
    typeof setInterval
  > | null>(null)
  const lastPongRef = useRef<number>(0)
  // Generation counter — incremented on every connect() call.
  // Async operations compare against it to detect being superseded.
  const connectGenRef = useRef(0)

  const clientId = useRef(
    `mobile-${Math.random().toString(36).slice(2, 10)}`,
  )

  const onDataChannelMessageRef = useRef(
    onDataChannelMessage,
  )
  onDataChannelMessageRef.current = onDataChannelMessage

  const connectionTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null)

  const cleanup = useCallback(() => {
    clearTimeout(connectionTimeoutRef.current!)
    connectionTimeoutRef.current = null
    clearInterval(pingIntervalRef.current!)
    pingIntervalRef.current = null

    if (wsRef.current) {
      wsRef.current.onopen = null
      wsRef.current.onmessage = null
      wsRef.current.onerror = null
      wsRef.current.onclose = null
      wsRef.current.close()
      wsRef.current = null
    }
    if (dcRef.current) {
      dcRef.current.onopen = null
      dcRef.current.onclose = null
      dcRef.current.onmessage = null
      dcRef.current.close()
      dcRef.current = null
    }
    if (pcRef.current) {
      pcRef.current.onicecandidate = null
      pcRef.current.close()
      pcRef.current = null
    }
  }, [])

  const disconnect = useCallback(() => {
    connectGenRef.current++ // invalidate any in-flight connect
    cleanup()
    setState('disconnected')
  }, [cleanup])

  const connect = useCallback(
    async (agentInfo: AgentQRPayload) => {
      if (!identity) {
        setError('Identity not initialized')
        return
      }

      // Claim this generation; any older async ops will bail out
      const gen = ++connectGenRef.current

      cleanup()
      setState('connecting')
      setError(null)

      // Give native layer time to release resources
      await new Promise((r) => setTimeout(r, 150))
      if (connectGenRef.current !== gen) return

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
        ],
      })
      pcRef.current = pc

      let offerSent = false
      let remoteDescSet = false
      const pendingCandidates: any[] = []

      // Bail out if data channel doesn't open within 20 seconds
      connectionTimeoutRef.current = setTimeout(() => {
        if (connectGenRef.current !== gen) return
        console.log('[webrtc] connection timeout')
        cleanup()
        setState('disconnected')
      }, 20_000)

      const dc = pc.createDataChannel('nekoni', {
        ordered: true,
      })
      dcRef.current = dc

      dc.onopen = () => {
        if (connectGenRef.current !== gen) return
        clearTimeout(connectionTimeoutRef.current!)
        console.log('[webrtc] DataChannel open')
        setState('connected')
        lastPongRef.current = Date.now()
        pingIntervalRef.current = setInterval(() => {
          if (dc.readyState !== 'open') return
          dc.send(JSON.stringify({ type: 'ping' }))
          if (Date.now() - lastPongRef.current > 15_000) {
            console.log(
              '[webrtc] pong timeout, disconnecting',
            )
            cleanup()
            setState('disconnected')
          }
        }, 5_000)
      }

      dc.onclose = () => {
        if (connectGenRef.current !== gen) return
        clearInterval(pingIntervalRef.current!)
        setState('disconnected')
      }

      dc.onmessage = (evt: any) => {
        try {
          const msg = JSON.parse(evt.data)
          if (msg.type === 'pong') {
            lastPongRef.current = Date.now()
            return
          }
        } catch (e) {
          console.error('[webrtc] DataChannel message parse error:', e)
        }
        onDataChannelMessageRef.current?.(evt.data)
      }

      let agentClientId = ''

      pc.onicecandidate = (evt: any) => {
        if (
          evt.candidate &&
          wsRef.current?.readyState === WebSocket.OPEN &&
          agentClientId
        ) {
          const payload = {
            type: 'ice',
            candidate: evt.candidate.toJSON(),
            from: clientId.current,
            to: agentClientId,
            ts: Date.now(),
            pubKey: identity.publicKeyB64,
          }
          wsRef.current.send(
            JSON.stringify({
              ...payload,
              sig: signPayload(payload, identity),
            }),
          )
        }
      }

      pc.oniceconnectionstatechange = () => {
        const s = pc.iceConnectionState
        console.log('[webrtc] ICE state:', s)
        if (
          (s === 'failed' || s === 'closed') &&
          connectGenRef.current === gen
        ) {
          console.log('[webrtc] ICE failed, reconnecting')
          cleanup()
          setState('disconnected')
        }
      }

      const ws = new WebSocket(agentInfo.signalUrl)
      wsRef.current = ws

      ws.onopen = () => {
        if (connectGenRef.current !== gen) return
        const joinPayload = {
          type: 'join',
          roomId: agentInfo.roomId,
          clientId: clientId.current,
          pubKey: identity.publicKeyB64,
          ts: Date.now(),
        }
        const sig = signPayload(joinPayload, identity)
        const sortedKeys = Object.keys(joinPayload).sort()
        const signedStr = JSON.stringify(
          joinPayload,
          sortedKeys,
        )
        console.log(
          '[webrtc:join] payload str :',
          signedStr,
        )
        console.log('[webrtc:join] sig         :', sig)
        console.log(
          '[webrtc:join] pubKey      :',
          identity.publicKeyB64,
        )
        ws.send(JSON.stringify({ ...joinPayload, sig }))
      }

      ws.onmessage = async (evt: any) => {
        if (connectGenRef.current !== gen) return

        let msg: any
        try {
          msg = JSON.parse(evt.data)
        } catch (e) {
          console.error('[webrtc] Signal message parse error:', e)
          return
        }

        try {

        if (msg.type === 'peer_joined') {
          agentClientId = msg.clientId

          if (offerSent) {
            if (remoteDescSet) {
              // Negotiation was complete — agent signal WS
              // reconnected, need a fresh WebRTC session.
              console.log(
                '[webrtc] peer_joined after negotiation, restarting',
              )
              connectGenRef.current++
              cleanup()
              setState('disconnected')
            } else {
              // Still mid-negotiation — agent WS blip.
              // Update the target clientId and keep going.
              console.log(
                '[webrtc] peer_joined during negotiation, ignoring',
              )
              agentClientId = msg.clientId
            }
            return
          }
          offerSent = true

          const offer = await pc.createOffer({
            offerToReceiveAudio: false,
            offerToReceiveVideo: false,
          })
          if (connectGenRef.current !== gen) return
          await pc.setLocalDescription(offer)
          if (connectGenRef.current !== gen) return

          const offerPayload = {
            type: 'offer',
            sdp: pc.localDescription?.sdp,
            from: clientId.current,
            to: agentClientId,
            ts: Date.now(),
            pubKey: identity.publicKeyB64,
          }
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                ...offerPayload,
                sig: signPayload(offerPayload, identity),
              }),
            )
          }
        }

        if (msg.type === 'answer') {
          await pc.setRemoteDescription(
            new RTCSessionDescription(msg),
          )
          if (connectGenRef.current !== gen) return
          remoteDescSet = true
          for (const c of pendingCandidates) {
            await pc.addIceCandidate(new RTCIceCandidate(c))
          }
          pendingCandidates.length = 0
        }

        if (msg.type === 'ice' && msg.candidate) {
          if (remoteDescSet) {
            await pc.addIceCandidate(
              new RTCIceCandidate(msg.candidate),
            )
          } else {
            pendingCandidates.push(msg.candidate)
          }
        }

        if (msg.type === 'error') {
          setError(msg.message)
          setState('error')
          Toast.show({
            type: 'error',
            text1: 'Agent error',
            text2: msg.message,
            props: {
              reportData: `signal error: ${JSON.stringify(msg)}`,
            },
          })
        }

        } catch (e: any) {
          console.error('[webrtc] Signal message handling error:', e)
          if (connectGenRef.current === gen) {
            cleanup()
            setState('disconnected')
          }
        }
      }

      ws.onerror = () => {
        if (connectGenRef.current !== gen) return
        const errMsg = 'Signal server connection failed'
        setError(errMsg)
        setState('error')
        Toast.show({
          type: 'error',
          text1: 'Connection failed',
          text2: `Could not reach ${agentInfo.agentName}`,
          props: {
            reportData: `signal url: ${agentInfo.signalUrl}`,
          },
        })
      }

      ws.onclose = () => {
        if (connectGenRef.current !== gen) return
        if (dcRef.current?.readyState !== 'open') {
          setState('disconnected')
        }
      }
    },
    [identity, cleanup],
  )

  const sendMessage = useCallback((data: string) => {
    if (dcRef.current?.readyState === 'open') {
      dcRef.current.send(data)
    }
  }, [])

  return { state, error, connect, disconnect, sendMessage }
}
