import { setReady, selectPlayerCard, unselectPlayerCard, areAllNonSelectorPlayersSelected } from '../services/gameService.js'
import { emitPlayersUpdated } from './emitters.js'
import { handleStartIntroFlow, startCzarPhase } from '../services/phaseFlowService.js'
import { clearRoundTimer } from '../utils/roundTimers.js'

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

    socket.on('player:card-selected', ({ lobbyId, card }, cb) => {
        const res = selectPlayerCard({ games, lobbyId, playerId: socket.id, card })
        if (res.error) return cb?.({ error: res.error })

        io.to(lobbyId).emit('board:player-card-selected', { playerId: res.playerSelectedCard.playerId })

        if (areAllNonSelectorPlayersSelected(res.game)) {
            clearRoundTimer(lobbyId)
            startCzarPhase({ io, games, lobbyId, round: res.game.currentRound })
        }
        cb?.({ ok: true })
    })

    socket.on('player:card-unselected', ({ lobbyId, card }, cb) => {
        const res = unselectPlayerCard({ games, lobbyId, playerId: socket.id, card })
        if (res.error) return cb?.({ error: res.error })

        io.to(lobbyId).emit('board:player-card-unselected', { playerId: res.playerSelectedCard.playerId })
        cb?.({ ok: true })
    })
}
