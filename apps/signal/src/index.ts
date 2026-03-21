import { createServer } from './server.js'

const PORT = parseInt(process.env.SIGNAL_PORT ?? '3000', 10)
const HOST = process.env.SIGNAL_HOST ?? '0.0.0.0'

const { httpServer } = createServer()

httpServer.listen(PORT, HOST, () => {
  console.log(
    `[signal] Server listening on ${HOST}:${PORT}`,
  )
})
