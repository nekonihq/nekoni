import React, { useEffect, useRef, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Flex,
  ScrollArea,
  Select,
  Text,
  TextField,
} from '@radix-ui/themes'
import { useAgentWS } from '../hooks/useAgentWS'
import { apiFetch } from '../api'
import { ConfirmDialog } from '../components/ConfirmDialog'

interface TraceEvent {
  id: string
  sessionId: string
  timestamp: number
  type: string
  data: Record<string, unknown>
  parentId?: string
}

interface SessionInfo {
  sessionId: string
  count: number
  lastTimestamp: number
}

type BadgeColor =
  | 'blue'
  | 'yellow'
  | 'green'
  | 'red'
  | 'gray'

const TYPE_COLORS: Record<string, BadgeColor> = {
  llm_call: 'blue',
  tool_call: 'yellow',
  rag_query: 'green',
  skill_event: 'blue',
  error: 'red',
  message: 'green',
}

export const TracesPage = () => {
  const [traces, setTraces] = useState<TraceEvent[]>([])
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [selectedSession, setSelectedSession] = useState<string>('all')
  const [filter, setFilter] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [confirmClear, setConfirmClear] = useState(false)

  const loadTraces = (sessionId?: string) => {
    const url =
      sessionId && sessionId !== 'all'
        ? `/api/traces?limit=500&session_id=${encodeURIComponent(sessionId)}`
        : '/api/traces?limit=500'
    apiFetch(url)
      .then((r) => r.json())
      .then(setTraces)
      .catch(() => {})
  }

  const loadSessions = () => {
    apiFetch('/api/traces/sessions')
      .then((r) => r.json())
      .then(setSessions)
      .catch(() => {})
  }

  useEffect(() => {
    loadTraces()
    loadSessions()
  }, [])

  const handleSessionChange = (value: string) => {
    setSelectedSession(value)
    loadTraces(value)
  }

  const { connected } = useAgentWS((event) => {
    const ev = event as TraceEvent
    setTraces((prev) => {
      if (
        selectedSession !== 'all' &&
        ev.sessionId !== selectedSession
      ) {
        return prev
      }
      return [...prev.slice(-999), ev]
    })
    // Refresh sessions list so counts/ordering stay fresh
    loadSessions()
  })

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({
        behavior: 'smooth',
      })
    }
  }, [traces, autoScroll])

  const filtered = filter
    ? traces.filter(
        (t) =>
          t.type.includes(filter) ||
          t.sessionId.includes(filter) ||
          JSON.stringify(t.data)
            .toLowerCase()
            .includes(filter.toLowerCase()),
      )
    : traces

  const handleClear = async () => {
    await apiFetch('/api/traces', { method: 'DELETE' })
    setTraces([])
    setSessions([])
    setSelectedSession('all')
  }

  return (
    <Box>
      <Flex justify="between" align="center" mb="4">
        <Flex align="center" gap="2">
          <Text size="5" weight="bold">
            Traces
          </Text>
          <Badge color={connected ? 'green' : 'red'}>
            {connected ? 'live' : 'disconnected'}
          </Badge>
        </Flex>
        <Flex gap="2" align="center">
          <Select.Root
            value={selectedSession}
            onValueChange={handleSessionChange}
            size="2"
          >
            <Select.Trigger placeholder="All sessions" />
            <Select.Content>
              <Select.Item value="all">All sessions</Select.Item>
              {sessions.map((s) => (
                <Select.Item key={s.sessionId} value={s.sessionId}>
                  {s.sessionId.slice(0, 16)}…{' '}
                  <Text color="gray" size="1">
                    ({s.count})
                  </Text>
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
          <TextField.Root
            placeholder="Filter..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            size="2"
          />
          <Button
            variant="soft"
            onClick={() => setAutoScroll((v) => !v)}
          >
            {autoScroll ? 'Pause scroll' : 'Auto scroll'}
          </Button>
          <Button
            variant="soft"
            color="red"
            onClick={() => setConfirmClear(true)}
          >
            Clear
          </Button>
        </Flex>
      </Flex>

      <ScrollArea style={{ height: '70vh' }}>
        <Box
          p="2"
          style={{
            fontFamily: 'monospace',
            fontSize: '0.8rem',
          }}
        >
          {filtered.length === 0 && (
            <Text
              color="gray"
              style={{
                display: 'block',
                textAlign: 'center',
                paddingTop: '2rem',
              }}
            >
              No trace events yet. Send a message from
              mobile.
            </Text>
          )}
          {filtered.map((t) => (
            <Flex
              key={t.id}
              gap="3"
              align="start"
              py="1"
              style={{
                borderBottom: '1px solid var(--gray-4)',
              }}
            >
              <Text color="gray" style={{ minWidth: 90 }}>
                {new Date(t.timestamp).toLocaleTimeString()}
              </Text>
              <Box style={{ minWidth: 90 }}>
                <Badge
                  color={TYPE_COLORS[t.type] ?? 'blue'}
                >
                  {t.type}
                </Badge>
              </Box>
              <Text style={{ wordBreak: 'break-all' }}>
                <Text color="gray">
                  [{t.sessionId.slice(0, 8)}]
                </Text>{' '}
                {JSON.stringify(t.data)}
              </Text>
            </Flex>
          ))}
          <div ref={bottomRef} />
        </Box>
      </ScrollArea>

      <ConfirmDialog
        open={confirmClear}
        title="Clear Traces"
        description="This will permanently delete all trace history. This cannot be undone."
        confirmLabel="Clear"
        onConfirm={() => { handleClear(); setConfirmClear(false) }}
        onCancel={() => setConfirmClear(false)}
      />
    </Box>
  )
}
