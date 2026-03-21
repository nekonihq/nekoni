import { WebSocket } from 'ws'

export interface RoomClient {
  ws: WebSocket
  clientId: string
  pubKey: string
  roomId: string
  joinedAt: number
}

export class RoomManager {
  private rooms = new Map<string, Map<string, RoomClient>>()
  private clientIndex = new Map<WebSocket, RoomClient>()

  join(
    roomId: string,
    clientId: string,
    pubKey: string,
    ws: WebSocket,
  ): void {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Map())
    }
    const room = this.rooms.get(roomId)!
    const client: RoomClient = {
      ws,
      clientId,
      pubKey,
      roomId,
      joinedAt: Date.now(),
    }
    room.set(clientId, client)
    this.clientIndex.set(ws, client)
  }

  getRoom(
    roomId: string,
  ): Map<string, RoomClient> | undefined {
    return this.rooms.get(roomId)
  }

  getClient(
    roomId: string,
    clientId: string,
  ): RoomClient | undefined {
    return this.rooms.get(roomId)?.get(clientId)
  }

  getClientByWs(ws: WebSocket): RoomClient | undefined {
    return this.clientIndex.get(ws)
  }

  getApprovedPubKeys(roomId: string): string[] {
    const room = this.rooms.get(roomId)
    if (!room) return []
    return Array.from(room.values()).map((c) => c.pubKey)
  }

  removeClient(ws: WebSocket): void {
    const client = this.clientIndex.get(ws)
    if (!client) return
    this.clientIndex.delete(ws)
    const room = this.rooms.get(client.roomId)
    if (room) {
      room.delete(client.clientId)
      if (room.size === 0) {
        this.rooms.delete(client.roomId)
      }
      // Notify peers
      for (const peer of room.values()) {
        if (peer.ws.readyState === peer.ws.OPEN) {
          try {
            peer.ws.send(
              JSON.stringify({
                type: 'peer_left',
                clientId: client.clientId,
                pubKey: client.pubKey,
              }),
            )
          } catch (e) {
            console.error(`[signal] Failed to notify peer ${peer.clientId} of disconnect:`, e)
          }
        }
      }
    }
  }

  broadcastToRoom(
    roomId: string,
    msg: unknown,
    excludeClientId?: string,
  ): void {
    const room = this.rooms.get(roomId)
    if (!room) return
    const payload = JSON.stringify(msg)
    for (const client of room.values()) {
      if (client.clientId === excludeClientId) continue
      if (client.ws.readyState === client.ws.OPEN) {
        client.ws.send(payload)
      }
    }
  }
}
