import { createServer } from 'http'
import { Server } from 'socket.io'
import { nanoid } from 'nanoid'
import chalk from 'chalk';
import dotenv from "dotenv"

// server files
import { games, socketRooms, phaseTimers } from './state/store.js'
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

            if (allowedWsOrigins.some(p => allowedWsOrigins.startsWith(p.replace("*", ""))))
                return cb(null, true)

            cb(new Error("Not allowed by CORS"))
        },
        methods: ['GET', 'POST'],
    },
})




const createDevelopmentLobby = () => {
    const TEST_LOBBY_ID = 'TEST01'

    games.set(TEST_LOBBY_ID, {
        lobbyId: TEST_LOBBY_ID,
        host: 'test-host',
        players: [
            {
                id: 'test-host',
                name: 'DevHost',
                ready: false,
                language: 'nl',
                white_cards: [
                    {
                        pack: 'base',
                        card_id: 2,
                        name: 'Chiel'
                    },
                    {
                        pack: 'base',
                        card_id: 1,
                        name: 'Chiel'
                    },
                    {
                        pack: 'base',
                        card_id: 3,
                        name: 'Chiel'
                    }
                ]
            },
            {
                id: 'test-host2',
                name: 'DevHost',
                ready: false,
                language: 'nl',
                white_cards: [
                    {
                        pack: 'base',
                        card_id: 6,
                        name: 'Chiel'
                    },
                    {
                        pack: 'base',
                        card_id: 23,
                        name: 'Chiel'
                    },
                    {
                        pack: 'base',
                        card_id: 14,
                        name: 'Chiel'
                    }
                ]
            },
        ],
        phase: 'choosing',
        currentRound: 0,
        selectedPacks: [],
        rounds: {
            1: {
                cardSelector: {
                    player: "test-host",
                    selectedCard: {}
                },
                blackCard: {
                    pack: 'base',
                    card_id: 1,
                    name: 'Chiel'
                },
                playerSelectedCards: [],
            },
            2: {
                cardSelector: {
                    player: null,
                    selectedCard: {}
                },
                blackCard: {
                    pack: 'base',
                    card_id: 1,
                    name: 'Chiel'
                },
                playerSelectedCards: [],
            }


        },
        card_selector: {
            languageByPlayerId: {
                'test-host': 'nl',
                'test-host2': 'nl',
            },
        },
    })
}

createDevelopmentLobby();


io.on('connection', (socket) => {

    registerHandlers({ io, socket, games, socketRooms })
})

httpServer.listen(PORT, () => {
    return;
})

startConsole({ io, games, phaseTimers, intervalMs: 500 });
