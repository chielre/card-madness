import { createServer } from 'http'
import { Server } from 'socket.io'
import dotenv from "dotenv"

import { games, socketRooms, phaseTimers, roundTimers } from './state/store.js'
import { registerHandlers } from './io/registerHandlers.js'
import { startConsole } from './console.js'

const PORT = process.env.SERVER_WS_PORT || 3001
const rawWsOrigins = process.env.SERVER_WS_ORIGINS || ""
const allowedWsOrigins = rawWsOrigins.split(",").map(o => o.trim()).filter(Boolean)


dotenv.config({ path: "../.env", quiet: true })


const httpServer = createServer()
const io = new Server(httpServer, {
    cors: {
        origin: (origin, cb) => {
            if (!origin || !allowedWsOrigins.length) return cb(null, true)

            if (allowedWsOrigins.some((p) => origin?.startsWith(p.replace("*", ""))))
                return cb(null, true)

            cb(new Error("Not allowed by CORS"))
        },
        methods: ['GET', 'POST'],
    },
})



io.on('connection', (socket) => {
    registerHandlers({ io, socket, games, socketRooms })
})

httpServer.listen(PORT, () => {
    return;
})

const consoleIntervalMs = Number(process.env.CONSOLE_INTERVAL)
const resolvedConsoleIntervalMs = Number.isFinite(consoleIntervalMs) ? consoleIntervalMs : 1000
startConsole({ io, games, phaseTimers, roundTimers, intervalMs: resolvedConsoleIntervalMs });
