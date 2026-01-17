import { selectionLockTimers } from '../state/store.js'

const getLobbyTimers = (lobbyId) => {
    const existing = selectionLockTimers.get(lobbyId)
    if (existing) return existing
    const map = new Map()
    selectionLockTimers.set(lobbyId, map)
    return map
}

export const clearSelectionLockTimer = ({ lobbyId, playerId }) => {
    const lobbyTimers = selectionLockTimers.get(lobbyId)
    if (!lobbyTimers) return
    const existing = lobbyTimers.get(playerId)
    const timer = existing?.timer ?? existing
    if (timer) {
        clearTimeout(timer)
    }
    lobbyTimers.delete(playerId)
    if (!lobbyTimers.size) {
        selectionLockTimers.delete(lobbyId)
    }
}

export const clearSelectionLockTimers = (lobbyId) => {
    const lobbyTimers = selectionLockTimers.get(lobbyId)
    if (!lobbyTimers) return
    lobbyTimers.forEach((value) => {
        const timer = value?.timer ?? value
        if (timer) clearTimeout(timer)
    })
    selectionLockTimers.delete(lobbyId)
}

export const hasActiveSelectionLocks = (lobbyId) => {
    const lobbyTimers = selectionLockTimers.get(lobbyId)
    return !!lobbyTimers && lobbyTimers.size > 0
}

export const getSelectionLockInfo = ({ lobbyId, playerId }) => {
    const lobbyTimers = selectionLockTimers.get(lobbyId)
    if (!lobbyTimers) return null
    return lobbyTimers.get(playerId) ?? null
}

export const getSelectionLockDelayMs = (lobbyId) => {
    const lobbyTimers = selectionLockTimers.get(lobbyId)
    if (!lobbyTimers || lobbyTimers.size === 0) return 0
    let nextExpiresAt = Infinity
    lobbyTimers.forEach((value) => {
        if (value?.expiresAt && value.expiresAt < nextExpiresAt) {
            nextExpiresAt = value.expiresAt
        }
    })
    if (!Number.isFinite(nextExpiresAt)) return 0
    return Math.max(0, nextExpiresAt - Date.now())
}

export const scheduleSelectionLockTimer = ({ lobbyId, playerId, delayMs = 10000, onTimeout }) => {
    if (!lobbyId || !playerId) return null
    clearSelectionLockTimer({ lobbyId, playerId })

    const ms = delayMs ?? 0
    if (!ms || ms <= 0) return null

    const lobbyTimers = getLobbyTimers(lobbyId)
    const expiresAt = Date.now() + ms
    const timer = setTimeout(() => {
        clearSelectionLockTimer({ lobbyId, playerId })
        if (typeof onTimeout === 'function') {
            onTimeout()
        }
    }, ms)

    lobbyTimers.set(playerId, { timer, durationMs: ms, expiresAt })
    return { durationMs: ms, expiresAt }
}
