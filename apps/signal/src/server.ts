import { createServer as createHttpServer } from 'node:http'
import express from 'express'
import { WebSocketServer, WebSocket } from 'ws'
import { RoomManager } from './rooms.js'
import { createMessageHandler } from './handlers.js'

export function createServer() {
  const app = express()
  app.use(express.json())

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', ts: Date.now() })
  })

  const httpServer = createHttpServer(app)
  const wss = new WebSocketServer({ server: httpServer })
  const rooms = new RoomManager()

  wss.on('connection', (ws: WebSocket, req) => {
    const ip = req.socket.remoteAddress
    console.log(`[signal] Client connected from ${ip}`)

    const handler = createMessageHandler(ws, rooms)

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString())
        handler(msg)
      } catch (err) {
        console.error(
          '[signal] Failed to parse message:',
          err,
        )
        ws.send(
          JSON.stringify({
            type: 'error',
            code: 'PARSE_ERROR',
            message: 'Invalid JSON',
          }),
        )
      }
    })

    ws.on('close', () => {
      console.log(`[signal] Client disconnected from ${ip}`)
      rooms.removeClient(ws)
    })

    ws.on('error', (err) => {
      console.error('[signal] WebSocket error:', err)
    })
  })

  return { httpServer, wss, rooms }
}
