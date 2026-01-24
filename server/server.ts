import { createServer } from 'http'
import { Server } from 'socket.io'
import dotenv from "dotenv"

import { games, socketRooms } from './state/store.js'
import { registerHandlers } from './io/registerHandlers.js'
import { startConsole } from './console.js'
import { createMonitoring } from "./utils/monitoring.js";
import { updatePacksOnStart } from "./services/PackService.js";


dotenv.config({ path: "../.env", quiet: true })
const TRUTHY = new Set(["1", "true", "yes", "on"])

const environment = {
    WS_HOST: process.env.SERVER_WS_HOST || "127.0.0.1",
    WS_PORT: Number(process.env.SERVER_WS_PORT || 3001),
    WS_ORIGINS: process.env.SERVER_WS_ORIGINS?.split(",").map(o => o.trim()).filter(Boolean) || [""],
    METRICS_ENABLED: TRUTHY.has(String(process.env.METRCIS_ENABLED ?? "").toLowerCase()),
    METRICS_HOST: process.env.METRICS_HOST || "127.0.0.1",
    METRICS_PORT: Number(process.env.METRICS_PORT || 9100)
}


await updatePacksOnStart()

const httpServer = createServer()
const io = new Server(httpServer, {
    cors: {
        origin: (origin, cb) => {
            if (!origin || !environment.WS_ORIGINS.length) return cb(null, true)
            if (environment.WS_ORIGINS.some((p) => origin?.startsWith(p.replace("*", "")))) return cb(null, true)
            cb(new Error("Not allowed by CORS"))
        },
        methods: ['GET', 'POST'],
    },
})

if (environment.METRICS_ENABLED) {
    createMonitoring({
        getLobbiesCount: () => games.size,
        getSocketsCount: () => io.engine.clientsCount,
        updateIntervalMs: 1000,
        metricsPath: "/metrics",
        metricsHost: environment.METRICS_HOST,
        metricsPort: environment.METRICS_PORT,
    });
}

io.on('connection', (socket) => {
    registerHandlers({ io, socket, games, socketRooms })
})

httpServer.listen(environment.WS_PORT, environment.WS_HOST);

startConsole({ io, games });
