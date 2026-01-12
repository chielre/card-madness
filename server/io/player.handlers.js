import { setReady, selectPlayerCard, unselectPlayerCard, areAllNonSelectorPlayersSelected, lockPlayerSelection } from '../services/gameService.js'
import { emitPlayersUpdated } from './emitters.js'
import { handleStartIntroFlow, startCzarPhase } from '../services/phaseFlowService.js'
import { clearRoundTimer } from '../utils/roundTimers.js'
import { clearSelectionLockTimer, hasActiveSelectionLocks, scheduleSelectionLockTimer } from '../utils/selectionLockTimers.js'

export const registerPlayerHandlers = ({ io, socket, games }) => {
    const tryStartCzarIfReady = (lobbyId) => {
        const gameNow = games.get(lobbyId)
        if (!gameNow) return
        if (gameNow.phase !== 'board') return
        if (!areAllNonSelectorPlayersSelected(gameNow)) return
        if (hasActiveSelectionLocks(lobbyId)) return
        clearRoundTimer(lobbyId)
        startCzarPhase({ io, games, lobbyId, round: gameNow.currentRound })
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
                const lockRes = lockPlayerSelection({ games, lobbyId, playerId: res.playerSelectedCard.playerId })
                if (!lockRes?.error && lockRes?.round) {
                    io.to(lobbyId).emit('board:player-card-locked', {
                        playerId: res.playerSelectedCard.playerId,
                    })
                }
                tryStartCzarIfReady(lobbyId)
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
}
