import { setReady } from '../services/gameService.js'
import { emitPlayersUpdated } from './emitters.js'
import { handleStartIntroFlow } from '../services/phaseFlowService.js'

export const registerPlayerHandlers = ({ io, socket, games }) => {
    socket.on('player:ready', ({ lobbyId, ready }, cb) => {
        const res = setReady({ games, lobbyId, socketId: socket.id, ready })
        if (res.error) return cb?.({ error: res.error })

        emitPlayersUpdated({ io, lobbyId, game: res.game })

        // if everyone is ready we start the game
        const everyoneReady = res.game.players.length > 0 && res.game.players.every((p) => p.ready)
        if (everyoneReady) {
            handleStartIntroFlow({ io, socket, games, lobbyId, game: res.game })
        }

        cb?.({ ok: true })
    })
}
