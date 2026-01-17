import { createServer } from 'http'
import { Server } from 'socket.io'
import dotenv from "dotenv"
import { spawn } from "node:child_process"
import path from "node:path"

import { games, socketRooms, phaseTimers, roundTimers } from './state/store.js'
import { registerHandlers } from './io/registerHandlers.js'
import { startConsole } from './console.js'

const PORT = process.env.SERVER_WS_PORT || 3001
const rawWsOrigins = process.env.SERVER_WS_ORIGINS || ""
const allowedWsOrigins = rawWsOrigins.split(",").map(o => o.trim()).filter(Boolean)


dotenv.config({ path: "../.env", quiet: true })

const TRUTHY = new Set(["1", "true", "yes", "on"])

async function updatePacksOnStart() {
    const enabled = TRUTHY.has(String(process.env.PACKS_UPDATE_ON_SERVER_START ?? "").toLowerCase())
    if (!enabled) return

    const projectRoot = path.resolve(process.cwd(), "..")
    const scriptPath = path.join(projectRoot, "scripts", "install-packs.mjs")

    await new Promise<void>((resolve, reject) => {
        const child = spawn(process.execPath, [scriptPath], {
            stdio: "inherit",
            cwd: projectRoot,
        })
        child.on("error", reject)
        child.on("close", (code) => {
            if (code === 0) resolve()
            else reject(new Error(`install-packs exited with code ${code}`))
        })
    })
}

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



io.on('connection', (socket) => {
    registerHandlers({ io, socket, games, socketRooms })
})

httpServer.listen(PORT, () => {
    return;
})

const consoleIntervalMs = Number(process.env.CONSOLE_INTERVAL)
const resolvedConsoleIntervalMs = Number.isFinite(consoleIntervalMs) ? consoleIntervalMs : 1000
startConsole({ io, games, phaseTimers, roundTimers, intervalMs: resolvedConsoleIntervalMs });
