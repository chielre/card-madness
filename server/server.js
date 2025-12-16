import { createServer } from 'http'
import { Server } from 'socket.io'
import { nanoid } from 'nanoid'
import logUpdate from 'log-update';
import chalk from 'chalk';

// server files
import { games, socketRooms } from './state/store.js'
import { registerHandlers } from './io/registerHandlers.js'
import { startConsole } from './console.js'

const PORT = process.env.PORT || 3000

logUpdate(chalk.yellow("Server starting up: "));


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
            { id: 'test-host', name: 'DevHost', ready: false },
            { id: 'test-host2', name: 'Player1', ready: true },
            { id: 'test-host3', name: 'Player2', ready: true },
            { id: 'test-host4', name: 'Player3', ready: false }
        ],
        phase: 'lobby',
        selectedPacks: [],
    })
    logUpdate(chalk.yellow("Server starting up: created development lobby " + TEST_LOBBY_ID));
}

createDevelopmentLobby();


io.on('connection', (socket) => {

    registerHandlers({ io, socket, games, socketRooms })
})

httpServer.listen(PORT, () => {
    logUpdate(chalk.green("Server started: Socket.io server listening on http://localhost:${PORT}"));
})

startConsole({ io, games, intervalMs: 500 });