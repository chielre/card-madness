import { registerRoomHandlers } from './room.handlers.js'
import { registerPlayerHandlers } from './player.handlers.js'
import { registerPacksHandlers } from './packs.handlers.js'
import { leaveGame } from '../services/gameService.js'
import { trackLeave } from '../services/socketRoomService.js'

export const registerHandlers = ({ io, socket, games, socketRooms }) => {
    registerRoomHandlers({ io, socket, games, socketRooms })
    registerPlayerHandlers({ io, socket, games })
    registerPacksHandlers({ socket, games })

    socket.on('disconnect', () => {
        const rooms = socketRooms.get(socket.id)
        if (!rooms) return

        rooms.forEach(roomId => {
            const res = leaveGame({ games, roomId, socketId: socket.id })
            if (!res) return

            socket.to(roomId).emit('room:player-left', { id: socket.id, players: res.game?.players ?? [] })
            if (res.hostChangedTo) io.to(roomId).emit('room:host-changed', { hostId: res.hostChangedTo })
            trackLeave(socketRooms, socket.id, roomId)
        })
    })
}
