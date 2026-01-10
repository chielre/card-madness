import { setPhase } from './gameService.js'
import { scheduleRoundTimer } from '../utils/roundTimers.js'

export const transitionPhase = ({ games, io, lobbyId, to }) => {
    const res = setPhase({ games, lobbyId, to })
    if (res.error) return res

    io.to(lobbyId).emit('room:phase-changed', { phase: res.game.phase })

    if (res.game.phase === 'board') {
        const round = Number(res.game.currentRound) || 1
        scheduleRoundTimer({ io, lobbyId, round })
    }

    return res
}
