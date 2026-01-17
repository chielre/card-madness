import { roundTimers } from '../state/store.js'

export const clearRoundTimer = (lobbyId) => {
    const existing = roundTimers.get(lobbyId)
    const timer = existing?.timer ?? existing
    if (timer) {
        clearTimeout(timer)
    }
    roundTimers.delete(lobbyId)
}

export const scheduleRoundTimer = ({
    io,
    lobbyId,
    round,
    durationMs,
    defaultDuration = 240000,
    onTimeout,
}: {
    io: any
    lobbyId: any
    round: any
    durationMs?: number
    defaultDuration?: number
    onTimeout?: () => void
}) => {
    clearRoundTimer(lobbyId)

    const ms = durationMs ?? defaultDuration
    if (!ms || ms <= 0) return

    const expiresAt = Date.now() + ms
    const timer = setTimeout(() => {
        io.to(lobbyId).emit('board:round-timeout', { round })
        if (typeof onTimeout === 'function') {
            onTimeout()
        }
        roundTimers.delete(lobbyId)
    }, ms)

    roundTimers.set(lobbyId, { timer, round, durationMs: ms, expiresAt })
}
