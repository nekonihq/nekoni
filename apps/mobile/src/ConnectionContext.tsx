import React, {
  createContext,
  useContext,
  useRef,
  useState,
} from 'react'

interface ConnectionContextValue {
  disconnectRef: React.MutableRefObject<(() => void) | null>
  sendRawRef: React.MutableRefObject<((data: string) => void) | null>
  onRagMessageRef: React.MutableRefObject<((msg: any) => void) | null>
  onSkillMessageRef: React.MutableRefObject<((msg: any) => void) | null>
  loadConversationRef: React.MutableRefObject<((id: string) => void) | null>
  rtcState: string
  setRtcState: (s: string) => void
  authState: string
  setAuthState: (s: string) => void
}

const ConnectionContext = createContext<ConnectionContextValue>({
  disconnectRef: { current: null },
  sendRawRef: { current: null },
  onRagMessageRef: { current: null },
  onSkillMessageRef: { current: null },
  loadConversationRef: { current: null },
  rtcState: 'idle',
  setRtcState: () => {},
  authState: 'pending',
  setAuthState: () => {},
})

export const ConnectionProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const disconnectRef = useRef<(() => void) | null>(null)
  const sendRawRef = useRef<((data: string) => void) | null>(null)
  const onRagMessageRef = useRef<((msg: any) => void) | null>(null)
  const onSkillMessageRef = useRef<((msg: any) => void) | null>(null)
  const loadConversationRef = useRef<((id: string) => void) | null>(null)
  const [rtcState, setRtcState] = useState('idle')
  const [authState, setAuthState] = useState('pending')

  return (
    <ConnectionContext.Provider
      value={{
        disconnectRef,
        sendRawRef,
        onRagMessageRef,
        onSkillMessageRef,
        loadConversationRef,
        rtcState,
        setRtcState,
        authState,
        setAuthState,
      }}
    >
      {children}
    </ConnectionContext.Provider>
  )
}

export const useConnection = () => useContext(ConnectionContext)
