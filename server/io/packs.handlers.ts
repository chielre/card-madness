import { updatePacks } from '../services/gameService.js'

export const registerPacksHandlers = ({ socket, games }) => {
    socket.on('packs:update', ({ lobbyId, packs }) => {
        const game = updatePacks({ games, lobbyId, packs })
        if (!game) return
        socket.to(lobbyId).emit('packs:updated', { packs: game.selectedPacks })
    })
}
