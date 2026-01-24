import { roundTimers, phaseTimers } from '../state/store.js'

export const phaseTimer = () => {
  const clear = (lobbyId) => {
    const existing = phaseTimers.get(lobbyId)
    if (existing?.timer) clearTimeout(existing.timer)
    phaseTimers.delete(lobbyId)
  }

  const schedule = ({
    io,
    lobbyId,
    phase,
    durationMs,
    defaultDurations = {},
    onTimeout,
  }: {
    io: any
    lobbyId: any
    phase: any
    durationMs?: number
    defaultDurations?: Record<string, number>
    onTimeout?: () => void
  }) => {
    clear(lobbyId)

    const ms = durationMs ?? defaultDurations[phase]
    if (!ms || ms <= 0) return

    const expiresAt = Date.now() + ms
    const timer = setTimeout(() => {
      io.to(lobbyId).emit('room:phase-timeout', { phase })
      if (typeof onTimeout === 'function') onTimeout()
      phaseTimers.delete(lobbyId)
    }, ms)

    phaseTimers.set(lobbyId, { timer, phase, durationMs: ms, expiresAt })
    return { durationMs: ms, expiresAt }
  }

  return { schedule, clear }
}

export const roundTimer = () => {
  const clear = (lobbyId) => {
    const existing = roundTimers.get(lobbyId)
    if (existing?.timer) clearTimeout(existing.timer)
    roundTimers.delete(lobbyId)
  }

  const schedule = ({
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
    clear(lobbyId)

    const ms = durationMs ?? defaultDuration
    if (!ms || ms <= 0) return

    const expiresAt = Date.now() + ms
    const timer = setTimeout(() => {
      io.to(lobbyId).emit('board:round-timeout', { round })
      if (typeof onTimeout === 'function') onTimeout()
      roundTimers.delete(lobbyId)
    }, ms)

    roundTimers.set(lobbyId, { timer, round, durationMs: ms, expiresAt })
    return { durationMs: ms, expiresAt } // ✅ client sync mogelijk
  }

  return { schedule, clear }
}
