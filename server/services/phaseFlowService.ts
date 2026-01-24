import { transitionPhase } from './phaseService.js'
import {
  autoSelectCzarCard,
  autoSelectMissingPlayerCards,
  finalizeRound,
  prepareGame,
  setRound,
} from './gameService.js'

import { phaseTimer, roundTimer } from '../utils/timers.js'
import {
  clearSelectionLockTimers,
  getSelectionLockDelayMs,
  hasActiveSelectionLocks,
} from '../utils/selectionLockTimers.js'

import { PHASE_DEFAULT_DURATIONS } from '../config/phaseDurations.js'
import { emitPlayersUpdated } from '../io/emitters.js'

const phaseTimerService = phaseTimer()
const roundTimerService = roundTimer()

const shouldSkipIntro = () =>
  process.env.STAGE === 'development' && String(process.env.DEV_SKIP_INTRO) === '1'

/**
 * Handles the "Start of the game".
 */
export const handleStartIntroFlow = async ({ io, socket, games, lobbyId, game }) => {
  const everyoneReady = game.players.length > 0 && game.players.every((p) => p.ready)
  const hasMinimumPlayers = (game.players?.length ?? 0) >= 2
  if (!hasMinimumPlayers) return
  if (!everyoneReady) return

  phaseTimerService.clear(lobbyId)

  if (game.phase === 'starting') {
    const prepRes = await prepareGame({ games, lobbyId })
    if (prepRes && 'error' in prepRes) return

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

    const phaseTimerState = phaseTimerService.schedule({
      io,
      lobbyId,
      phase: phaseRes.game.phase,
      defaultDurations: PHASE_DEFAULT_DURATIONS,
      onTimeout: () => handleGameFlow({ io, socket, games, lobbyId, game: games.get(lobbyId) }),
    })

    if (phaseTimerState) {
      io.to(lobbyId).emit('room:phase-timer', { phase: phaseRes.game.phase, ...phaseTimerState })
    }

    return
  }

  const phaseTimerState = phaseTimerService.schedule({
    io,
    lobbyId,
    phase: game.phase,
    defaultDurations: PHASE_DEFAULT_DURATIONS,
  })

  if (phaseTimerState) {
    io.to(lobbyId).emit('room:phase-timer', { phase: game.phase, ...phaseTimerState })
  }
}

export const handleGameFlow = ({ io, socket, games, lobbyId, game }) => {
  if (!game) return
  if (game.phase !== 'intro') return

  transitionPhase({ games, io, lobbyId, to: 'board' })
  startRoundFlow({ io, games, lobbyId, round: 1 })
}

export const startResultsPhase = ({ io, games, lobbyId }) => {
  const res = transitionPhase({ games, io, lobbyId, to: 'results' })
  const updatedGame = games.get(lobbyId)
  if (updatedGame) {
    emitPlayersUpdated({ io, lobbyId, game: updatedGame })
  }
  return res
}

export const startRoundFlow = ({ io, games, lobbyId, round, durationMs = 90000 }) => {
  clearSelectionLockTimers(lobbyId)

  const game = games.get(lobbyId)
  if (!game) return { error: 'not_found' }
  if (!game.rounds?.[round]) {
    return startResultsPhase({ io, games, lobbyId })
  }

  const setRoundRes = setRound({ games, lobbyId, to: round })
  if (setRoundRes?.error) return setRoundRes

  const updatedGame = games.get(lobbyId)
  const updatedRound = updatedGame?.rounds?.[updatedGame?.currentRound]
  io.to(lobbyId).emit('board:round-updated', {
    currentRound: updatedRound,
    roundNumber: updatedGame?.currentRound ?? null,
  })

  const freshGame = games.get(lobbyId)
  const startedRound = freshGame?.rounds?.[freshGame?.currentRound]

  // ✅ client update: round timer state sync (return + emit)
  const roundTimerState = roundTimerService.schedule({
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
    },
  })

  if (roundTimerState) {
    io.to(lobbyId).emit('board:round-timer', {
      round: freshGame.currentRound,
      ...roundTimerState,
    })
  }

  io.to(lobbyId).emit('board:round-started', {
    currentRound: startedRound,
    roundNumber: freshGame.currentRound,
    durationMs: roundTimerState?.durationMs ?? durationMs,
    expiresAt: roundTimerState?.expiresAt ?? (Date.now() + durationMs),
  })

  emitPlayersUpdated({ io, lobbyId, game: freshGame })
  return { game: freshGame, round: startedRound }
}

export const startCzarPhase = ({
  io,
  games,
  lobbyId,
  round,
  durationMs,
}: {
  io: any
  games: any
  lobbyId: any
  round: any
  durationMs?: number
}) => {
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

  // shuffle selected cards
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

  io.to(lobbyId).emit('board:round-updated', {
    currentRound: roundState,
    roundNumber: afterAutoGame.currentRound,
  })

  const phaseTimerState = phaseTimerService.schedule({
    io,
    lobbyId,
    phase: 'czar',
    durationMs: durationMs ?? PHASE_DEFAULT_DURATIONS.czar,
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
    },
  })

  if (phaseTimerState) {
    io.to(lobbyId).emit('room:phase-timer', { phase: 'czar', ...phaseTimerState })
  }
}

const emitPlayerCardsUpdated = (io, game) => {
  if (!game?.players?.length) return
  game.players.forEach((player) => {
    io.to(player.id).emit('room:player-cards-updated', { cards: player.white_cards ?? [] })
  })
}
