import { startRoundFlow } from '../services/phaseFlowService.js'
import { transitionPhase } from '../services/phaseService.js'
import { clearPhaseTimer } from '../utils/phaseTimers.js'
import { finalizeRound, selectCzarCard } from '../services/gameService.js'


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

        const nextRound = currentRound + 1
        if (!game.rounds?.[nextRound]) return cb?.({ error: 'round_not_found' })

        clearPhaseTimer(lobbyId)
        transitionPhase({ games, io, lobbyId, to: 'board' })
        const res = startRoundFlow({ io, games, lobbyId, round: nextRound })
        if (res?.error) return cb?.(res)

        cb?.({ ok: true, round: nextRound })
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
        clearPhaseTimer(lobbyId)
        transitionPhase({ games, io, lobbyId, to: 'czar-result' })
        cb?.({ ok: true })
    })
}
