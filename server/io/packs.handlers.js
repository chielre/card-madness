import { updatePacks } from '../services/gameService.js'

export const registerPacksHandlers = ({ socket, games }) => {
    socket.on('packs:update', ({ roomId, packs }) => {
        const game = updatePacks({ games, roomId, packs })
        if (!game) return
        socket.to(roomId).emit('packs:updated', { packs: game.selectedPacks })
    })
}
