import { transitionPhase } from './phaseService.js'
import { autoSelectCzarCard, autoSelectMissingPlayerCards, finalizeRound, prepareGame, setRound } from './gameService.js'
import { clearPhaseTimer, schedulePhaseTimer } from '../utils/phaseTimers.js'
import { scheduleRoundTimer } from '../utils/roundTimers.js'
import { clearSelectionLockTimers, getSelectionLockDelayMs, hasActiveSelectionLocks } from '../utils/selectionLockTimers.js'

import { PHASE_DEFAULT_DURATIONS } from '../config/phaseDurations.js'

const shouldSkipIntro = () =>
    process.env.STAGE === 'development' && String(process.env.DEV_PLAY_INTRO) === '0'

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
        emitPlayerCardsUpdated(io, preparedGame)


        // Debug 
        if (shouldSkipIntro()) {
            const introRes = transitionPhase({ games, io, lobbyId, to: 'intro' })
            if (introRes?.error) return
            const boardRes = transitionPhase({ games, io, lobbyId, to: 'board' })
            if (boardRes?.error) return
            startRoundFlow({ io, games, lobbyId, round: 1 })
            return
        }

        const phaseRes = transitionPhase({ games, io, lobbyId, to: 'intro' })
        if (phaseRes.error) return

        const phaseTimer = schedulePhaseTimer({
            io,
            lobbyId,
            phase: phaseRes.game.phase,
            defaultDurations: PHASE_DEFAULT_DURATIONS,
            onTimeout: () => handleGameFlow({ io, socket, games, lobbyId, game: games.get(lobbyId) }),
        })
        if (phaseTimer) {
            io.to(lobbyId).emit('room:phase-timer', { phase: phaseRes.game.phase, ...phaseTimer })
        }

        return
    }

    const phaseTimer = schedulePhaseTimer({
        io,
        lobbyId,
        phase: game.phase,
        defaultDurations: PHASE_DEFAULT_DURATIONS,
    })
    if (phaseTimer) {
        io.to(lobbyId).emit('room:phase-timer', { phase: game.phase, ...phaseTimer })
    }
}

export const handleGameFlow = ({ io, socket, games, lobbyId, game }) => {
    if (!game) return

    if (game.phase !== "intro") return

    transitionPhase({ games, io, lobbyId, to: 'board' })
    startRoundFlow({ io, games, lobbyId, round: 1 })


}

export const startRoundFlow = ({ io, games, lobbyId, round, durationMs = 90000 }) => {
    clearSelectionLockTimers(lobbyId)

    const setRoundRes = setRound({ games, lobbyId, to: round })
    if (setRoundRes?.error) return setRoundRes

    const updatedGame = games.get(lobbyId)
    const updatedRound = updatedGame?.rounds?.[updatedGame?.currentRound]
    io.to(lobbyId).emit('board:round-updated', { currentRound: updatedRound })

    const freshGame = games.get(lobbyId)
    const startedRound = freshGame?.rounds?.[freshGame?.currentRound]
    const expiresAt = Date.now() + durationMs
    scheduleRoundTimer({
        io,
        lobbyId,
        round: freshGame.currentRound,
        durationMs,
        onTimeout: () => {
            const waitForSelectionLocks = () => {
                const gameNow = games.get(lobbyId)
                if (!gameNow) return
                if (gameNow.phase !== 'board') return
                if (hasActiveSelectionLocks(lobbyId)) {
                    const delayMs = Math.max(50, getSelectionLockDelayMs(lobbyId))
                    setTimeout(waitForSelectionLocks, delayMs)
                    return
                }
                startCzarPhase({ io, games, lobbyId, round })
            }

            waitForSelectionLocks()
        }
    })
    io.to(lobbyId).emit('board:round-started', { currentRound: startedRound, durationMs, expiresAt })

    return { game: freshGame, round: startedRound }
}

export const startCzarPhase = ({ io, games, lobbyId, round, durationMs }) => {
    const game = games.get(lobbyId)
    if (!game) return

    clearSelectionLockTimers(lobbyId)

    if (game.phase !== 'czar') {
        transitionPhase({ games, io, lobbyId, to: 'czar' })
    }

    autoSelectMissingPlayerCards({ games, lobbyId })

    
    const afterAutoGame = games.get(lobbyId)
    if (!afterAutoGame) return
    const roundState = afterAutoGame.rounds?.[afterAutoGame.currentRound]
    if (!roundState) return

    const cards = [...(roundState.playerSelectedCards ?? [])]
    for (let i = cards.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1))
        const tmp = cards[i]
        cards[i] = cards[j]
        cards[j] = tmp
    }
    roundState.playerSelectedCards = cards
    afterAutoGame.rounds[afterAutoGame.currentRound] = roundState
    games.set(lobbyId, afterAutoGame)
    io.to(lobbyId).emit('board:round-updated', { currentRound: roundState })

    const phaseTimer = schedulePhaseTimer({
        io,
        lobbyId,
        phase: 'czar',
        durationMs,
        defaultDurations: PHASE_DEFAULT_DURATIONS,
        onTimeout: async () => {
            const autoPick = autoSelectCzarCard({ games, lobbyId })
            if (!autoPick?.error && autoPick?.round) {
                io.to(lobbyId).emit('board:round-updated', { currentRound: autoPick.round })
            }

            const finalizeRes = await finalizeRound({ games, lobbyId })
            if (!finalizeRes?.error && finalizeRes?.game) {
                emitPlayerCardsUpdated(io, finalizeRes.game)
            }
            transitionPhase({ games, io, lobbyId, to: 'czar-result' })
        }
    })
    if (phaseTimer) {
        io.to(lobbyId).emit('room:phase-timer', { phase: 'czar', ...phaseTimer })
    }
}

const emitPlayerCardsUpdated = (io, game) => {
    if (!game?.players?.length) return
    game.players.forEach((player) => {
        io.to(player.id).emit("room:player-cards-updated", { cards: player.white_cards ?? [] })
    })
}
