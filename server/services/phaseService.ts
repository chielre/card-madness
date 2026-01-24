import { resetGameForLobby, setPhase } from './gameService.js'
import { roundTimer } from '../utils/timers.js'
import { emitPlayersUpdated } from '../io/emitters.js'

const roundTimerService = roundTimer()

export const transitionPhase = ({ games, io, lobbyId, to }) => {
    const res = setPhase({ games, lobbyId, to })
    if (res.error) return res

    io.to(lobbyId).emit('room:phase-changed', { phase: res.game.phase })

    if (res.game.phase === 'board') {
        const round = Number(res.game.currentRound) || 1

        const roundTimerState = roundTimerService.schedule({
            io,
            lobbyId,
            round,
        })

        if (roundTimerState) {
            io.to(lobbyId).emit('board:round-timer', { round, ...roundTimerState })
        }
    } else {
        roundTimerService.clear(lobbyId)
    }

    if (res.game.phase === 'lobby') {
        const resetRes = resetGameForLobby({ games, lobbyId })
        if (resetRes && !('error' in resetRes) && resetRes.game) {
            emitPlayersUpdated({ io, lobbyId, game: resetRes.game })
            io.to(lobbyId).emit('packs:updated', { packs: resetRes.game.selectedPacks })
            io.to(lobbyId).emit('board:round-updated', {
                currentRound: null,
                roundNumber: null,
            })
            resetRes.game.players?.forEach((player) => {
                io.to(player.id).emit('room:player-cards-updated', { cards: player.white_cards ?? [] })
            })
        }
    }

    return res
}
