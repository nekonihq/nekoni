import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
} from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { useNavigation, useRouter, useFocusEffect } from 'expo-router'
import Toast from 'react-native-toast-message'
import { useIdentity } from '../../hooks/useIdentity'
import { useWebRTC } from '../../hooks/useWebRTC'
import { useAgent, ChatMessage } from '../../hooks/useAgent'
import { colors } from '../../theme'
import { useConnection } from '../../ConnectionContext'
import { useAgentContext } from '../../AgentContext'
import {
  createConversation,
  getOrCreateConversation,
  getMessages,
  saveMessage,
  MessageRow,
} from '../../db'

export default function ChatScreen() {
  const navigation = useNavigation()
  const router = useRouter()
  const { identity, loading } = useIdentity()
  const { activeAgent, loaded: agentsLoaded } =
    useAgentContext()
  const activeAgentRef = useRef(activeAgent)
  useEffect(() => {
    activeAgentRef.current = activeAgent
  }, [activeAgent])

  const rtcStateRef = useRef<string>('idle')

  const [conversationId, setConversationId] = useState<
    string | null
  >(null)
  const conversationIdRef = useRef<string | null>(null)
  const savedMessageIdsRef = useRef<Set<string>>(new Set())

  const [input, setInput] = useState('')
  const listRef = useRef<FlatList>(null)

  useEffect(() => {
    if (!agentsLoaded) return
    if (!activeAgent) router.push('/pair')
  }, [agentsLoaded, activeAgent])

  const {
    disconnectRef,
    sendRawRef,
    onRagMessageRef,
    onSkillMessageRef,
    loadConversationRef,
    setRtcState: setSharedRtcState,
    setAuthState: setSharedAuthState,
  } = useConnection()

  // handleDataChannelMessage comes from useAgent below; use a ref to avoid
  // forward-reference issues when passing the callback to useWebRTC.
  const handleDataChannelMessageRef = useRef<((raw: string) => void) | null>(null)

  const {
    state: rtcState,
    error: rtcError,
    connect,
    disconnect,
    sendMessage: sendRaw,
  } = useWebRTC({
    identity,
    onDataChannelMessage: (msg) => handleDataChannelMessageRef.current?.(msg),
  })

  useEffect(() => {
    sendRawRef.current = sendRaw
  }, [sendRaw])

  useEffect(() => {
    disconnectRef.current = disconnect
  }, [disconnect])

  useEffect(() => {
    rtcStateRef.current = rtcState
    setSharedRtcState(rtcState)
  }, [rtcState])

  const {
    authState,
    messages,
    pendingMessage,
    isThinking,
    handleDataChannelMessage,
    startHandshake,
    sendMessage,
    reset,
    setInitialMessages,
  } = useAgent(
    identity,
    activeAgent?.agentPubKey ?? null,
    sendRaw,
    conversationId,
  )

  const handleChannelMessage = useCallback(
    (raw: string) => {
      try {
        const parsed = JSON.parse(raw)
        if (typeof parsed.type === 'string' && (parsed.type.startsWith('rag_') || parsed.type.startsWith('skill_') || parsed.type.startsWith('cron_'))) {
          if (parsed.type.startsWith('rag_')) {
            onRagMessageRef.current?.(parsed)
          } else {
            onSkillMessageRef.current?.(parsed)
          }
          return
        }
      } catch (e) {
        console.error('[chat] DataChannel message parse error:', e)
      }
      handleDataChannelMessage(raw)
    },
    [handleDataChannelMessage, onRagMessageRef, onSkillMessageRef],
  )

  // Keep the ref in sync so useWebRTC's callback always calls the latest version
  useEffect(() => {
    handleDataChannelMessageRef.current = handleChannelMessage
  }, [handleChannelMessage])

  useEffect(() => {
    setSharedAuthState(authState)
  }, [authState])

  // Load or create a conversation when agent changes
  useEffect(() => {
    if (!activeAgent) return
    const id = getOrCreateConversation(activeAgent.roomId)
    conversationIdRef.current = id
    savedMessageIdsRef.current = new Set()
    setConversationId(id)
    setInitialMessages([])
  }, [activeAgent?.roomId])

  // Persist new messages to DB
  useEffect(() => {
    const convId = conversationIdRef.current
    if (!convId) return
    for (const msg of messages) {
      if (!savedMessageIdsRef.current.has(msg.id)) {
        savedMessageIdsRef.current.add(msg.id)
        saveMessage(convId, msg)
      }
    }
  }, [messages])

  // Register loadConversation so history screen can continue a past conversation
  useEffect(() => {
    loadConversationRef.current = (id: string) => {
      const rows: MessageRow[] = getMessages(id)
      conversationIdRef.current = id
      savedMessageIdsRef.current = new Set(rows.map((r) => r.id))
      setConversationId(id)
      setInitialMessages(
        rows.map((r) => ({
          id: r.id,
          role: r.role as 'user' | 'agent',
          content: r.content,
          timestamp: r.timestamp,
        })),
      )
    }
  }, [setInitialMessages])

  const handleNewChat = useCallback(() => {
    if (!activeAgent) return
    const id = createConversation(activeAgent.roomId)
    conversationIdRef.current = id
    savedMessageIdsRef.current = new Set()
    setConversationId(id)
    setInitialMessages([])
  }, [activeAgent, setInitialMessages])

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => router.push('/history')}
          style={styles.headerBtn}
        >
          <Text style={styles.headerBtnText}>History</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={handleNewChat}
          style={styles.headerBtn}
        >
          <Text style={styles.headerBtnText}>New Chat</Text>
        </TouchableOpacity>
      ),
    })
  }, [navigation, handleNewChat])

  useEffect(() => {
    if (
      activeAgent &&
      identity &&
      (rtcState === 'idle' || rtcState === 'disconnected')
    ) {
      connect(activeAgent)
    }
  }, [activeAgent, identity])

  useEffect(() => {
    if (rtcError) {
      Toast.show({
        type: 'error',
        text1: 'Connection error',
        text2: rtcError,
        visibilityTime: 6000,
        props: {
          reportData: [
            `agent: ${activeAgent?.agentName ?? 'unknown'}`,
            `rtcState: ${rtcState}`,
            `error: ${rtcError}`,
          ].join('\n'),
        },
      })
    }
  }, [rtcError])

  useEffect(() => {
    if (
      (rtcState === 'disconnected' || rtcState === 'error') &&
      activeAgent &&
      identity
    ) {
      reset()
      const t = setTimeout(() => {
        if (activeAgentRef.current) {
          connect(activeAgentRef.current)
        }
      }, 3000)
      return () => clearTimeout(t)
    }
  }, [rtcState])

  // Reconnect whenever this screen comes into focus (e.g. returning from
  // the pair screen after pairing — at that point activeAgent and identity
  // are already stable so the [activeAgent, identity] effect won't re-fire).
  // rtcState is read via ref so this callback doesn't change on every state
  // transition (which would compete with the retry effect below).
  useFocusEffect(
    useCallback(() => {
      const s = rtcStateRef.current
      if (
        activeAgentRef.current &&
        identity &&
        (s === 'idle' || s === 'disconnected' || s === 'error')
      ) {
        connect(activeAgentRef.current)
      }
    }, [identity, connect]),
  )

  useEffect(() => {
    if (authState === 'failed') {
      // dc.onclose does not reliably fire in RN WebRTC when the remote side
      // closes the channel (e.g. after auth_failed). Force a disconnect so the
      // retry loop can take over regardless.
      disconnect()
    }
  }, [authState])

  useEffect(() => {
    if (
      rtcState === 'connected' &&
      authState === 'pending'
    ) {
      startHandshake()
    }
  }, [rtcState, authState])

  const handleConnect = () => {
    if (activeAgent && identity) connect(activeAgent)
  }

  const handleSend = () => {
    const text = input.trim()
    if (!text) return
    sendMessage(text)
    setInput('')
  }

  useEffect(() => {
    if (
      messages.length > 0 ||
      pendingMessage ||
      isThinking
    ) {
      listRef.current?.scrollToEnd({ animated: true })
    }
  }, [messages, pendingMessage, isThinking])

  if (loading || !agentsLoaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  const renderMessage = ({
    item,
  }: {
    item: ChatMessage
  }) => (
    <View
      style={[
        styles.bubble,
        item.role === 'user'
          ? styles.userBubble
          : styles.agentBubble,
      ]}
    >
      <Text style={styles.bubbleText}>{item.content}</Text>
      <Text style={styles.timestamp}>
        {new Date(item.timestamp).toLocaleTimeString()}
      </Text>
    </View>
  )

  const statusColor =
    rtcState === 'connected' ? colors.green : colors.red

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === 'ios' ? 'padding' : 'height'
      }
      keyboardVerticalOffset={
        Platform.OS === 'ios' ? 88 : 0
      }
    >
      <View style={styles.statusBar}>
        <View
          style={[
            styles.dot,
            { backgroundColor: statusColor },
          ]}
        />
        <Text style={styles.statusText}>
          {rtcState === 'connected'
            ? authState === 'ready'
              ? (activeAgent?.agentName ?? 'Connected')
              : 'Authenticating...'
            : rtcState === 'connecting'
              ? 'Connecting...'
              : rtcState === 'disconnected'
                ? 'Disconnected'
                : 'Not connected'}
        </Text>
        {rtcError && (
          <Text style={styles.errorText}>{rtcError}</Text>
        )}
        {(rtcState === 'idle' ||
          rtcState === 'disconnected') && (
          <TouchableOpacity
            onPress={handleConnect}
            style={styles.connectBtn}
          >
            <Text style={styles.connectBtnText}>
              Connect
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={
          !pendingMessage ? (
            <Text style={styles.emptyText}>
              {authState === 'ready'
                ? 'Send a message to start chatting'
                : 'Connect to your agent to start'}
            </Text>
          ) : null
        }
        ListFooterComponent={
          isThinking ? (
            <View
              style={[styles.bubble, styles.agentBubble]}
            >
              <ActivityIndicator
                size="small"
                color={colors.textMed}
              />
            </View>
          ) : pendingMessage != null ? (
            <View
              style={[styles.bubble, styles.agentBubble]}
            >
              <Text style={styles.bubbleText}>
                {pendingMessage}
              </Text>
            </View>
          ) : null
        }
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Message..."
          placeholderTextColor={colors.textLow}
          multiline
          editable={authState === 'ready'}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          onPress={handleSend}
          style={[
            styles.sendBtn,
            authState !== 'ready' && styles.sendBtnDisabled,
          ]}
          disabled={authState !== 'ready'}
        >
          <Text
            style={[
              styles.sendBtnText,
              authState !== 'ready' &&
                styles.sendBtnTextDisabled,
            ]}
          >
            Send
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  headerBtn: { paddingHorizontal: 12 },
  headerBtnText: {
    color: colors.accent,
    fontSize: 15,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: {
    color: colors.textMed,
    fontSize: 13,
    flex: 1,
  },
  errorText: { color: colors.red, fontSize: 11 },
  connectBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    justifyContent: 'center',
  },
  connectBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  messageList: { padding: 12, flexGrow: 1 },
  emptyText: {
    color: colors.textLow,
    textAlign: 'center',
    marginTop: 60,
    fontSize: 14,
  },
  bubble: {
    maxWidth: '80%',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.accentSurface,
    borderWidth: 1,
    borderColor: colors.accent + '44',
  },
  agentBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: { color: colors.textHigh, fontSize: 15 },
  timestamp: {
    color: colors.textLow,
    fontSize: 10,
    marginTop: 4,
  },
  inputRow: {
    flexDirection: 'row',
    padding: 8,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 6,
    padding: 8,
    color: colors.textHigh,
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  sendBtnText: { color: '#fff', fontWeight: '600' },
  sendBtnTextDisabled: { color: colors.textLow },
})
