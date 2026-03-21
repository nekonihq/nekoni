import * as SQLite from 'expo-sqlite'

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

let _db: SQLite.SQLiteDatabase | null = null

const getDB = (): SQLite.SQLiteDatabase => {
  if (!_db) {
    _db = SQLite.openDatabaseSync('nekoni.db')
    _db.execSync(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        title TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_conv_agent
        ON conversations(agent_id, updated_at);
      CREATE INDEX IF NOT EXISTS idx_msg_conv
        ON messages(conversation_id, timestamp);
    `)
  }
  return _db
}

export const createConversation = (agentId: string): string => {
  const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const now = Date.now()
  getDB().runSync(
    'INSERT INTO conversations (id, agent_id, title, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)',
    [id, agentId, now, now],
  )
  return id
}

export const getConversations = (
  agentId: string,
): ConversationRow[] =>
  getDB().getAllSync<ConversationRow>(
    'SELECT * FROM conversations WHERE agent_id = ? ORDER BY updated_at DESC',
    [agentId],
  )

export const getMessages = (
  conversationId: string,
): MessageRow[] =>
  getDB().getAllSync<MessageRow>(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC',
    [conversationId],
  )

export const saveMessage = (
  conversationId: string,
  msg: {
    id: string
    role: string
    content: string
    timestamp: number
  },
): void => {
  const d = getDB()
  d.runSync(
    'INSERT OR IGNORE INTO messages (id, conversation_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)',
    [msg.id, conversationId, msg.role, msg.content, msg.timestamp],
  )
  d.runSync(
    `UPDATE conversations
     SET updated_at = ?,
         title = COALESCE(title, ?)
     WHERE id = ?`,
    [
      Date.now(),
      msg.role === 'user' ? msg.content.slice(0, 60) : null,
      conversationId,
    ],
  )
}

export const deleteConversation = (id: string): void => {
  const d = getDB()
  d.runSync('DELETE FROM messages WHERE conversation_id = ?', [id])
  d.runSync('DELETE FROM conversations WHERE id = ?', [id])
}
