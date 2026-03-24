import { openDB, IDBPDatabase } from 'idb'

export interface ConversationRow {
  id: string
  agent_id: string
  title: string | null
  created_at: number
  updated_at: number
}

export interface MessageRow {
  id: string
  conversation_id: string
  role: string
  content: string
  timestamp: number
}

let _db: IDBPDatabase | null = null

const getDB = async (): Promise<IDBPDatabase> => {
  if (!_db) {
    _db = await openDB('nekoni', 1, {
      upgrade(db) {
        const convStore = db.createObjectStore('conversations', { keyPath: 'id' })
        convStore.createIndex('by-agent', 'agent_id')
        const msgStore = db.createObjectStore('messages', { keyPath: 'id' })
        msgStore.createIndex('by-conversation', 'conversation_id')
      },
    })
  }
  return _db
}

export const createConversation = async (agentId: string): Promise<string> => {
  const db = await getDB()
  const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const now = Date.now()
  await db.put('conversations', { id, agent_id: agentId, title: null, created_at: now, updated_at: now })
  return id
}

export const getConversations = async (agentId: string): Promise<ConversationRow[]> => {
  const db = await getDB()
  const all = await db.getAllFromIndex('conversations', 'by-agent', agentId)
  return all.sort((a, b) => b.updated_at - a.updated_at)
}

export const getMessages = async (conversationId: string): Promise<MessageRow[]> => {
  const db = await getDB()
  const all = await db.getAllFromIndex('messages', 'by-conversation', conversationId)
  return all.sort((a, b) => a.timestamp - b.timestamp)
}

export const saveMessage = async (
  conversationId: string,
  msg: { id: string; role: string; content: string; timestamp: number },
): Promise<void> => {
  const db = await getDB()
  const tx = db.transaction(['messages', 'conversations'], 'readwrite')
  await tx.objectStore('messages').put({ ...msg, conversation_id: conversationId })
  const conv = await tx.objectStore('conversations').get(conversationId) as ConversationRow | undefined
  if (conv) {
    conv.updated_at = Date.now()
    if (!conv.title && msg.role === 'user') conv.title = msg.content.slice(0, 60)
    await tx.objectStore('conversations').put(conv)
  }
  await tx.done
}

export const getOrCreateConversation = async (agentId: string): Promise<string> => {
  const convs = await getConversations(agentId)
  if (convs.length > 0) {
    const msgs = await getMessages(convs[0].id)
    if (msgs.length === 0) return convs[0].id
  }
  return createConversation(agentId)
}

export const deleteConversation = async (id: string): Promise<void> => {
  const db = await getDB()
  const tx = db.transaction(['messages', 'conversations'], 'readwrite')
  const msgs = await tx.objectStore('messages').index('by-conversation').getAllKeys(id)
  for (const key of msgs) await tx.objectStore('messages').delete(key)
  await tx.objectStore('conversations').delete(id)
  await tx.done
}
