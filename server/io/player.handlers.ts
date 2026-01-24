import { setReady, selectPlayerCard, unselectPlayerCard, areAllNonSelectorPlayersSelected, lockPlayerSelection } from '../services/gameService.js'
import { emitPlayersUpdated } from './emitters.js'
import { handleStartIntroFlow, startCzarPhase } from '../services/phaseFlowService.js'

import { roundTimer } from '../utils/timers.js'

import { clearSelectionLockTimer, getSelectionLockInfo, hasActiveSelectionLocks, scheduleSelectionLockTimer } from '../utils/selectionLockTimers.js'
import { OTHER_LOCK_BOOST_MS, SELF_LOCK_BOOST_MS } from '../config/player.js'


const roundTimerService = roundTimer();

export const registerPlayerHandlers = ({ io, socket, games }) => {
    const clamp01 = (value) => Math.min(1, Math.max(0, value))

    const tryStartCzarIfReady = (lobbyId) => {
        const gameNow = games.get(lobbyId)
        if (!gameNow) return
        if (gameNow.phase !== 'board') return
        if (!areAllNonSelectorPlayersSelected(gameNow)) return
        if (hasActiveSelectionLocks(lobbyId)) return

        roundTimerService.clear(lobbyId)
        startCzarPhase({ io, games, lobbyId, round: gameNow.currentRound })
    }

    const lockSelectionAndCheck = ({ lobbyId, playerId }) => {
        const lockRes = lockPlayerSelection({ games, lobbyId, playerId })
        if (!lockRes?.error && lockRes?.round) {
            io.to(lobbyId).emit('board:player-card-locked', { playerId })
        }
        tryStartCzarIfReady(lobbyId)
    }

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

        const lockInfo = scheduleSelectionLockTimer({
            lobbyId,
            playerId: res.playerSelectedCard.playerId,
            delayMs: 10000,
            onTimeout: () => {
                lockSelectionAndCheck({ lobbyId, playerId: res.playerSelectedCard.playerId })
            },
        })

        io.to(lobbyId).emit('board:player-card-selected', {
            playerId: res.playerSelectedCard.playerId,
            selectionLockDurationMs: lockInfo?.durationMs ?? 10000,
            selectionLockExpiresAt: lockInfo?.expiresAt ?? (Date.now() + 10000),
        })

        if (areAllNonSelectorPlayersSelected(res.game)) {
            tryStartCzarIfReady(lobbyId)
        }
        cb?.({ ok: true })
    })

    socket.on('player:card-unselected', ({ lobbyId, card }, cb) => {
        const res = unselectPlayerCard({ games, lobbyId, playerId: socket.id, card })
        if (res.error) return cb?.({ error: res.error })

        io.to(lobbyId).emit('board:player-card-unselected', { playerId: res.playerSelectedCard.playerId })
        clearSelectionLockTimer({ lobbyId, playerId: res.playerSelectedCard.playerId })
        cb?.({ ok: true })
    })

    socket.on('player:card-lock-boost', ({ lobbyId, playerId }, cb) => {
        if (!lobbyId || !playerId) return cb?.({ error: 'invalid_payload' })
        const game = games.get(lobbyId)
        if (!game || game.phase !== 'board') return cb?.({ error: 'invalid_phase' })

        const roundNumber = game.currentRound
        const round = game.rounds?.[roundNumber]
        if (!round) return cb?.({ error: 'round_not_found' })

        const czarId = round.cardSelector?.player
        if (socket.id === czarId) return cb?.({ error: 'czar_blocked' })

        const selectedEntry = round.playerSelectedCards?.find((entry) => entry.playerId === playerId)
        if (!selectedEntry || selectedEntry.locked) return cb?.({ error: 'not_pending' })

        const lockInfo = getSelectionLockInfo({ lobbyId, playerId })
        if (!lockInfo?.expiresAt) return cb?.({ error: 'no_lock' })

        const boostMs = socket.id === playerId ? SELF_LOCK_BOOST_MS : OTHER_LOCK_BOOST_MS
        const remainingMs = Math.max(0, lockInfo.expiresAt - Date.now())
        const nextRemainingMs = Math.max(0, remainingMs - boostMs)

        if (nextRemainingMs <= 0) {
            clearSelectionLockTimer({ lobbyId, playerId })
            lockSelectionAndCheck({ lobbyId, playerId })
            return cb?.({ ok: true, locked: true })
        }

        const nextInfo = scheduleSelectionLockTimer({
            lobbyId,
            playerId,
            delayMs: nextRemainingMs,
            onTimeout: () => lockSelectionAndCheck({ lobbyId, playerId }),
        })

        io.to(lobbyId).emit('board:player-card-lock-boost', {
            playerId,
            selectionLockDurationMs: nextInfo?.durationMs ?? nextRemainingMs,
            selectionLockExpiresAt: nextInfo?.expiresAt ?? (Date.now() + nextRemainingMs),
        })
        cb?.({ ok: true })
    })

    socket.on('czar:cursor-update', ({ lobbyId, x, y, visible }, cb) => {
        if (!lobbyId || typeof x !== 'number' || typeof y !== 'number') return cb?.({ error: 'invalid_payload' })

        const game = games.get(lobbyId)
        if (!game || game.phase !== 'czar') return cb?.({ error: 'invalid_phase' })

        const roundNumber = game.currentRound
        const round = game.rounds?.[roundNumber]
        const czarId = round?.cardSelector?.player
        if (socket.id !== czarId) return cb?.({ error: 'not_czar' })

        io.to(lobbyId).emit('czar:cursor-update', {
            playerId: socket.id,
            x: clamp01(x),
            y: clamp01(y),
            visible: visible !== false,
        })
        cb?.({ ok: true })
    })
}
