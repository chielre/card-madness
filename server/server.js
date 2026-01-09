import { createServer } from 'http'
import { Server } from 'socket.io'
import { nanoid } from 'nanoid'
import chalk from 'chalk';

// server files
import { games, socketRooms, phaseTimers } from './state/store.js'
import { registerHandlers } from './io/registerHandlers.js'
import { startConsole } from './console.js'

const PORT = process.env.PORT || 3000



const httpServer = createServer()
const io = new Server(httpServer, {
    cors: {
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST'],
    },
})




const createDevelopmentLobby = () => {
    const TEST_LOBBY_ID = 'TEST01'

    games.set(TEST_LOBBY_ID, {
        lobbyId: TEST_LOBBY_ID,
        host: 'test-host',
        players: [
            { id: 'test-host', name: 'DevHost', ready: false, language: 'nl' },
            { id: 'test-host2', name: 'Player1', ready: true, language: 'nl' },
            { id: 'test-host3', name: 'Player2', ready: true, language: 'nl' },
            { id: 'test-host4', name: 'Player3', ready: false, language: 'nl' }
        ],
        phase: 'lobby',
        selectedPacks: [],
        card_selector: {
            languageByPlayerId: {
                'test-host': 'nl',
                'test-host2': 'nl',
                'test-host3': 'nl',
                'test-host4': 'nl',
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
