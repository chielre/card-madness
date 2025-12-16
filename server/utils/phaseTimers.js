import { phaseTimers } from '../state/store.js'

export const clearPhaseTimer = (roomId) => {
    const existing = phaseTimers.get(roomId)
    const timer = existing?.timer ?? existing
    if (timer) {
        clearTimeout(timer)
    }
    phaseTimers.delete(roomId)
}

export const schedulePhaseTimer = ({ io, roomId, phase, durationMs, defaultDurations = {}, onTimeout }) => {
    clearPhaseTimer(roomId)

    const ms = durationMs ?? defaultDurations[phase]
    if (!ms || ms <= 0) return

    const expiresAt = Date.now() + ms
    const timer = setTimeout(() => {
        io.to(roomId).emit('room:phase-timeout', { phase })
        if (typeof onTimeout === 'function') {
            onTimeout()
        }
        phaseTimers.delete(roomId)
    }, ms)

    phaseTimers.set(roomId, { timer, phase, durationMs: ms, expiresAt })
}
