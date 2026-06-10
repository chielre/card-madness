import { startNextTurn } from '../services/phaseFlowService.js'
import { transitionPhase } from '../services/phaseService.js'
import { phaseTimer } from '../utils/timers.js'
import { finalizeRound, selectCzarCard, recordCzarRatingVote } from '../services/gameService.js'
import { startCzarRatingFlow, resolveCzarRatingAndBroadcast } from '../services/czarRatingService.js'

const phaseTimerService = phaseTimer()

export const registerRoundsHandlers = ({ io, socket, games, socketRooms }) => {
    socket.on('round:next', async ({ lobbyId }, cb) => {
        const game = games.get(lobbyId)
        if (!game) return cb?.({ error: 'not_found' })

        if (game.phase !== 'czar-result') return cb?.({ error: 'invalid_phase' })

        const currentRound = Number(game.currentRound) || 1
        const roundState = game.rounds?.[currentRound]
        if (!roundState) return cb?.({ error: 'round_not_found' })

        if (roundState.cardSelector?.player !== socket.id) {
            return cb?.({ error: 'not_card_selector' })
        }

        phaseTimerService.clear(lobbyId)
        const res = startNextTurn({ io, games, lobbyId })
        if (res && 'error' in res) return cb?.(res)

        const updated = games.get(lobbyId)
        if (updated?.phase === 'results') return cb?.({ ok: true, phase: 'results' })
        cb?.({ ok: true, round: updated?.currentRound ?? null })
    })

    socket.on('czar:card-selected', async ({ lobbyId, entry }, cb) => {
        const res = selectCzarCard({ games, lobbyId, playerId: socket.id, entry })
        if (res.error) return cb?.({ error: res.error })

        const updatedGame = games.get(lobbyId)
        io.to(lobbyId).emit('board:round-updated', {
            currentRound: res.round,
            roundNumber: updatedGame?.currentRound ?? null,
        })
        const finalizeRes = await finalizeRound({ games, lobbyId })
        if (!finalizeRes?.error && finalizeRes?.game?.players?.length) {
            finalizeRes.game.players.forEach((player) => {
                io.to(player.id).emit("room:player-cards-updated", { cards: player.white_cards ?? [] })
            })
        }
        phaseTimerService.clear(lobbyId)
        transitionPhase({ games, io, lobbyId, to: 'czar-result' })

        // start the audience rating (no-op when the setting is off / no audience)
        startCzarRatingFlow({ io, games, lobbyId })
        cb?.({ ok: true })
    })

    socket.on('czar:rating-vote', ({ lobbyId, vote }, cb) => {
        const res = recordCzarRatingVote({ games, lobbyId, playerId: socket.id, vote })
        if (res.error) return cb?.({ error: res.error })

        io.to(lobbyId).emit('czar:rating-voted', {
            playerId: socket.id,
            vote,
            up: res.up,
            down: res.down,
        })

        if (res.allVoted) resolveCzarRatingAndBroadcast({ io, games, lobbyId })
        cb?.({ ok: true })
    })
}
