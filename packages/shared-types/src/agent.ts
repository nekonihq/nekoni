/** DataChannel handshake messages */
export type DataChannelHandshake =
  | { type: "hello"; pubKey: string; nonce: string }
  | { type: "challenge"; nonce: string; sig: string }
  | { type: "response"; sig: string }
  | { type: "ready" }
  | { type: "auth_failed"; reason: string }

/** Messages exchanged over authenticated DataChannel */
export interface AgentMessage {
  id: string
  sessionId: string
  role: "user" | "agent"
  content: string
  timestamp: number
  attachments?: Attachment[]
}

export interface Attachment {
  type: "image" | "file"
  name: string
  data: string  // base64
  mimeType: string
}

/** Trace events emitted by agent → dashboard WebSocket */
export interface TraceEvent {
  id: string
  sessionId: string
  timestamp: number
  type: "llm_call" | "tool_call" | "rag_query" | "skill_event" | "error" | "message"
  data: Record<string, unknown>
  parentId?: string
}

/** Tool definition exposed to LLM */
export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>  // JSON Schema
}

/** Tool call result */
export interface ToolResult {
  toolName: string
  result: unknown
  error?: string
  durationMs: number
}

/** Skill info returned by /api/skills */
export interface SkillInfo {
  name: string
  description: string
  enabled: boolean
  tools: string[]
}

/** Ingest response */
export interface IngestResponse {
  success: boolean
  chunks: number
  documentId: string
}
