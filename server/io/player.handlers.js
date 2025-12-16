import { setReady, setPhase } from '../services/gameService.js'
import { emitPlayersUpdated } from './emitters.js'
import { clearPhaseTimer, schedulePhaseTimer } from '../utils/phaseTimers.js'
import { PHASE_DEFAULT_DURATIONS } from '../config/phaseDurations.js'

export const registerPlayerHandlers = ({ io, socket, games }) => {
    socket.on('player:ready', ({ roomId, ready }, cb) => {
        const res = setReady({ games, roomId, socketId: socket.id, ready })
        if (res.error) return cb?.({ error: res.error })


        emitPlayersUpdated({ io, roomId, game: res.game })

        const everyoneReady = res.game.players.length > 0 && res.game.players.every((p) => p.ready)
        if (everyoneReady) {
            clearPhaseTimer(roomId)

            if (res.game.phase == 'starting') {
                const phaseRes = setPhase({ games, roomId, to: 'intro' })
                if (!phaseRes.error) {
                    io.to(roomId).emit('room:phase-changed', { phase: phaseRes.game.phase })
                    schedulePhaseTimer({
                        io,
                        roomId,
                        phase: phaseRes.game.phase,
                        defaultDurations: PHASE_DEFAULT_DURATIONS,
                    })
                }
            } else {
                schedulePhaseTimer({
                    io,
                    roomId,
                    phase: res.game.phase,
                    defaultDurations: PHASE_DEFAULT_DURATIONS,
                })
            }
        }

        cb?.({ ok: true })
    })
}
