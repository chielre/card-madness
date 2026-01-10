import { transitionPhase } from './phaseService.js'
import { prepareGame, setRound } from './gameService.js'
import { clearPhaseTimer, schedulePhaseTimer } from '../utils/phaseTimers.js'
import { scheduleRoundTimer } from '../utils/roundTimers.js'

import { PHASE_DEFAULT_DURATIONS } from '../config/phaseDurations.js'


/**
 * Handles the "Start of the game".
 * 
 * @param {*} param0 
 * @returns 
 */

export const handleStartIntroFlow = async ({ io, socket, games, lobbyId, game }) => {
    const everyoneReady = game.players.length > 0 && game.players.every((p) => p.ready)
    if (!everyoneReady) return

    clearPhaseTimer(lobbyId)

    if (game.phase === 'starting') {

        const prepRes = await prepareGame({ games, lobbyId })
        if (prepRes?.error) return


        const preparedGame = games.get(lobbyId)
        const connectedPlayer = preparedGame?.players?.find(p => p.id === socket.id)
        if (connectedPlayer) {
            io.to(socket.id).emit("room:player-cards-updated", { cards: connectedPlayer.white_cards ?? [] })
        }



        const phaseRes = transitionPhase({ games, io, lobbyId, to: 'intro' })
        if (phaseRes.error) return


        schedulePhaseTimer({
            io,
            lobbyId,
            phase: phaseRes.game.phase,
            defaultDurations: PHASE_DEFAULT_DURATIONS,
            onTimeout: () => handleGameFlow({ io, socket, games, lobbyId, game: games.get(lobbyId) }),
        })

        return
    }

    schedulePhaseTimer({
        io,
        lobbyId,
        phase: game.phase,
        defaultDurations: PHASE_DEFAULT_DURATIONS,
    })
}

export const handleGameFlow = ({ io, socket, games, lobbyId, game }) => {
    const game = games.get(lobbyId)
    if (!game) return

    if (game.phase !== "intro") return

    transitionPhase({ games, io, lobbyId, to: 'board' })

    setRound({ games, lobbyId, to: 1 })
    io.to(lobbyId).emit('board:round-updated', { round: 1 })


    const freshGame = games.get(lobbyId)
    scheduleRoundTimer({ io, lobbyId, round: freshGame.currentRound, durationMs: 240000 })
    io.to(lobbyId).emit('board:round-started', { round: 1 })


}
