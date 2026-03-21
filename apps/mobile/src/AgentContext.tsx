import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react'
import * as SecureStore from 'expo-secure-store'

export interface AgentInfo {
  agentPubKey: string
  signalUrl: string
  roomId: string
  agentName: string
}

const AGENTS_KEY = 'nekoni_agents'
const ACTIVE_AGENT_KEY = 'nekoni_active_agent_id'
const LEGACY_KEY = 'nekoni_agent_info'

interface AgentContextValue {
  agents: Record<string, AgentInfo>
  activeAgentId: string | null
  activeAgent: AgentInfo | null
  loaded: boolean
  addAgent: (info: AgentInfo) => Promise<void>
  removeAgent: (roomId: string) => Promise<void>
  selectAgent: (roomId: string) => Promise<void>
}

const AgentContext = createContext<AgentContextValue | null>(
  null,
)

export const AgentProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const [agents, setAgents] = useState<
    Record<string, AgentInfo>
  >({})
  const [activeAgentId, setActiveAgentId] = useState<
    string | null
  >(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const load = async () => {
      let stored: Record<string, AgentInfo> = {}
      const raw = await SecureStore.getItemAsync(AGENTS_KEY)
      if (raw) {
        stored = JSON.parse(raw)
      } else {
        // Migrate legacy single-agent key
        const legacy =
          await SecureStore.getItemAsync(LEGACY_KEY)
        if (legacy) {
          const info = JSON.parse(legacy) as AgentInfo
          stored = { [info.roomId]: info }
          await SecureStore.setItemAsync(
            AGENTS_KEY,
            JSON.stringify(stored),
          )
          await SecureStore.deleteItemAsync(LEGACY_KEY)
        }
      }
      setAgents(stored)

      const activeId =
        await SecureStore.getItemAsync(ACTIVE_AGENT_KEY)
      if (activeId && stored[activeId]) {
        setActiveAgentId(activeId)
      } else {
        const ids = Object.keys(stored)
        if (ids.length > 0) {
          setActiveAgentId(ids[0])
          await SecureStore.setItemAsync(
            ACTIVE_AGENT_KEY,
            ids[0],
          )
        }
      }
      setLoaded(true)
    }
    load()
  }, [])

  const addAgent = async (info: AgentInfo) => {
    const updated = { ...agents, [info.roomId]: info }
    setAgents(updated)
    await SecureStore.setItemAsync(
      AGENTS_KEY,
      JSON.stringify(updated),
    )
    if (!activeAgentId) {
      setActiveAgentId(info.roomId)
      await SecureStore.setItemAsync(
        ACTIVE_AGENT_KEY,
        info.roomId,
      )
    }
  }

  const removeAgent = async (roomId: string) => {
    const updated = { ...agents }
    delete updated[roomId]
    setAgents(updated)
    await SecureStore.setItemAsync(
      AGENTS_KEY,
      JSON.stringify(updated),
    )
    if (activeAgentId === roomId) {
      const remaining = Object.keys(updated)
      const next =
        remaining.length > 0 ? remaining[0] : null
      setActiveAgentId(next)
      if (next) {
        await SecureStore.setItemAsync(
          ACTIVE_AGENT_KEY,
          next,
        )
      } else {
        await SecureStore.deleteItemAsync(ACTIVE_AGENT_KEY)
      }
    }
  }

  const selectAgent = async (roomId: string) => {
    setActiveAgentId(roomId)
    await SecureStore.setItemAsync(ACTIVE_AGENT_KEY, roomId)
  }

  const activeAgent = activeAgentId
    ? (agents[activeAgentId] ?? null)
    : null

  return (
    <AgentContext.Provider
      value={{
        agents,
        activeAgentId,
        activeAgent,
        loaded,
        addAgent,
        removeAgent,
        selectAgent,
      }}
    >
      {children}
    </AgentContext.Provider>
  )
}

export const useAgentContext = () => {
  const ctx = useContext(AgentContext)
  if (!ctx) {
    throw new Error(
      'useAgentContext must be used within AgentProvider',
    )
  }
  return ctx
}
