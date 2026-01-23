import { createServer } from 'http'
import { Server } from 'socket.io'
import dotenv from "dotenv"


import { games, socketRooms, phaseTimers, roundTimers } from './state/store.js'
import { registerHandlers } from './io/registerHandlers.js'
import { startConsole } from './console.js'
import { createMonitoring } from "./utils/monitoring.js";
import { updatePacksOnStart } from "./utils/packInstallation.js";

dotenv.config({ path: "../.env", quiet: true })
const TRUTHY = new Set(["1", "true", "yes", "on"])


const WS_PORT = process.env.SERVER_WS_PORT || 3001
const WS_HOST = process.env.SERVER_WS_HOST || "127.0.0.1"
const rawWsOrigins = process.env.SERVER_WS_ORIGINS || ""
const allowedWsOrigins = rawWsOrigins.split(",").map(o => o.trim()).filter(Boolean)
const metricsEnabled = TRUTHY.has(String(process.env.METRCIS_ENABLED ?? "").toLowerCase())
const metricsHost = process.env.METRICS_HOST || "127.0.01"
const metricsPort = Number(process.env.METRICS_PORT || 9100)
const consoleIntervalMs = Number(process.env.CONSOLE_INTERVAL)
const resolvedConsoleIntervalMs = Number.isFinite(consoleIntervalMs) ? consoleIntervalMs : 1000




await updatePacksOnStart()

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

if (metricsEnabled) {
    createMonitoring({
        getLobbiesCount: () => games.size,
        getSocketsCount: () => io.engine.clientsCount,
        updateIntervalMs: 1000,
        metricsPath: "/metrics",
        metricsHost,
        metricsPort,
    });
}

io.on('connection', (socket) => {
    registerHandlers({ io, socket, games, socketRooms })
})

httpServer.listen(Number(WS_PORT), WS_HOST);


startConsole({ io, games, phaseTimers, roundTimers, intervalMs: resolvedConsoleIntervalMs });
