import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export interface AgentInfo {
  agentPubKey: string
  signalUrl: string
  agentUrl: string
  roomId: string
  agentName: string
}

const AGENTS_KEY = 'nekoni_agents'
const ACTIVE_AGENT_KEY = 'nekoni_active_agent_id'

interface AgentContextValue {
  agents: Record<string, AgentInfo>
  activeAgentId: string | null
  activeAgent: AgentInfo | null
  loaded: boolean
  addAgent: (info: AgentInfo) => void
  removeAgent: (roomId: string) => void
  selectAgent: (roomId: string) => void
}

const AgentContext = createContext<AgentContextValue | null>(null)

export const AgentProvider = ({ children }: { children: ReactNode }) => {
  const [agents, setAgents] = useState<Record<string, AgentInfo>>({})
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem(AGENTS_KEY)
    const stored: Record<string, AgentInfo> = raw ? JSON.parse(raw) : {}
    setAgents(stored)

    const activeId = localStorage.getItem(ACTIVE_AGENT_KEY)
    if (activeId && stored[activeId]) {
      setActiveAgentId(activeId)
    } else {
      const ids = Object.keys(stored)
      if (ids.length > 0) {
        setActiveAgentId(ids[0])
        localStorage.setItem(ACTIVE_AGENT_KEY, ids[0])
      }
    }
    setLoaded(true)
  }, [])

  const addAgent = (info: AgentInfo) => {
    const updated = { ...agents, [info.roomId]: info }
    setAgents(updated)
    localStorage.setItem(AGENTS_KEY, JSON.stringify(updated))
    if (!activeAgentId) {
      setActiveAgentId(info.roomId)
      localStorage.setItem(ACTIVE_AGENT_KEY, info.roomId)
    }
  }

  const removeAgent = (roomId: string) => {
    const updated = { ...agents }
    delete updated[roomId]
    setAgents(updated)
    localStorage.setItem(AGENTS_KEY, JSON.stringify(updated))
    if (activeAgentId === roomId) {
      const remaining = Object.keys(updated)
      const next = remaining.length > 0 ? remaining[0] : null
      setActiveAgentId(next)
      if (next) localStorage.setItem(ACTIVE_AGENT_KEY, next)
      else localStorage.removeItem(ACTIVE_AGENT_KEY)
    }
  }

  const selectAgent = (roomId: string) => {
    setActiveAgentId(roomId)
    localStorage.setItem(ACTIVE_AGENT_KEY, roomId)
  }

  const activeAgent = activeAgentId ? (agents[activeAgentId] ?? null) : null

  return (
    <AgentContext.Provider value={{ agents, activeAgentId, activeAgent, loaded, addAgent, removeAgent, selectAgent }}>
      {children}
    </AgentContext.Provider>
  )
}

export const useAgentContext = () => {
  const ctx = useContext(AgentContext)
  if (!ctx) throw new Error('useAgentContext must be used within AgentProvider')
  return ctx
}
