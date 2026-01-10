import { phaseTimers } from '../state/store.js'

export const clearPhaseTimer = (lobbyId) => {
    const existing = phaseTimers.get(lobbyId)
    const timer = existing?.timer ?? existing
    if (timer) {
        clearTimeout(timer)
    }
    phaseTimers.delete(lobbyId)
}

export const schedulePhaseTimer = ({ io, lobbyId, phase, durationMs, defaultDurations = {}, onTimeout }) => {
    clearPhaseTimer(lobbyId)

    const ms = durationMs ?? defaultDurations[phase]
    if (!ms || ms <= 0) return

    const expiresAt = Date.now() + ms
    const timer = setTimeout(() => {
        io.to(lobbyId).emit('room:phase-timeout', { phase })
        if (typeof onTimeout === 'function') {
            onTimeout()
        }
        phaseTimers.delete(lobbyId)
    }, ms)

    phaseTimers.set(lobbyId, { timer, phase, durationMs: ms, expiresAt })
}
