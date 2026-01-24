import { registerRoomHandlers } from './room.handlers.js'
import { registerPlayerHandlers } from './player.handlers.js'
import { registerPacksHandlers } from './packs.handlers.js'
import { registerRoundsHandlers } from './round.handlers.js'
import { registerDevHandlers } from './dev.handlers.js'
import { leaveGame } from '../services/gameService.js'
import { trackLeave } from '../services/socketRoomService.js'

import { roundTimer, phaseTimer } from '../utils/timers.js'

const roundTimerService = roundTimer();
const roundPhaseService = phaseTimer();


export const registerHandlers = ({ io, socket, games, socketRooms }) => {
    registerRoomHandlers({ io, socket, games, socketRooms })
    registerPlayerHandlers({ io, socket, games })
    registerPacksHandlers({ socket, games })
    registerRoundsHandlers({ io, socket, games, socketRooms })
    registerDevHandlers({ io, socket, games })

    socket.on('disconnect', () => {
        const rooms = socketRooms.get(socket.id)
        if (!rooms) return

        rooms.forEach(lobbyId => {
            const res = leaveGame({ games, lobbyId, socketId: socket.id })
            if (!res) return

            socket.to(lobbyId).emit('room:player-left', { id: socket.id, players: res.game?.players ?? [] })
            if (res.hostChangedTo) io.to(lobbyId).emit('room:host-changed', { hostId: res.hostChangedTo })
            if (res.deleted) {
                roundTimerService.clear(lobbyId)
                roundPhaseService.clear(lobbyId)
            }
            trackLeave(socketRooms, socket.id, lobbyId)
        })
    })
}
