import { phaseTimer } from '../utils/timers.js'
import { ensureLobbySettings, resolveCzarRating } from './gameService.js'

const phaseTimerService = phaseTimer()

/**
 * Time (ms) the client spends animating the chosen-card reveal before the
 * rating UI (thumbs + progress bar) appears. Kept in sync with the reveal
 * timeline in Results.vue so the audience's countdown starts when the bar
 * actually shows. See server/config/phaseDurations.ts for the same caveat.
 */
const REVEAL_LEADIN_MS = 8100

/**
 * Starts the audience rating after the czar has picked a card. No-ops when the
 * setting is off, there is no chosen card, or there is no audience (everyone
 * except the czar). The rating is only ever started from a manual czar pick.
 */
export const startCzarRatingFlow = ({ io, games, lobbyId }) => {
    const game = games.get(lobbyId)
    if (!game) return
    if (game.phase !== 'czar-result') return

    const settings = ensureLobbySettings(game)
    if (!settings.czarRatingEnabled) return

    const round = game.rounds?.[game.currentRound]
    if (!round) return

    const czarId = round.cardSelector?.player
    const selected = round.cardSelector?.selectedCard
    if (!selected?.playerId) return

    const audience = (game.players ?? []).filter((p) => p.id !== czarId)
    if (!audience.length) return

    const ratingMs = settings.czarRatingTimeMs
    const expiresAt = Date.now() + REVEAL_LEADIN_MS + ratingMs

    round.czarRating = {
        active: true,
        votes: {},
        up: 0,
        down: 0,
        resolved: false,
        durationMs: ratingMs,
        expiresAt,
    }
    games.set(lobbyId, game)

    io.to(lobbyId).emit('czar:rating-started', {
        durationMs: ratingMs,
        expiresAt,
        startsInMs: REVEAL_LEADIN_MS,
    })

    phaseTimerService.schedule({
        io,
        lobbyId,
        phase: 'czar-rating',
        durationMs: REVEAL_LEADIN_MS + ratingMs,
        onTimeout: () => resolveCzarRatingAndBroadcast({ io, games, lobbyId }),
    })
}

/**
 * Resolves the rating (awards the czar bonus server-side) and broadcasts the
 * outcome. We deliberately do NOT broadcast players-changed here: the
 * czar-result scoreboard animates the delta client-side, and the authoritative
 * point totals sync on the next round's board:round-started.
 */
export const resolveCzarRatingAndBroadcast = ({ io, games, lobbyId }) => {
    phaseTimerService.clear(lobbyId)

    const res = resolveCzarRating({ games, lobbyId })
    if (res?.error || res?.alreadyResolved) return

    io.to(lobbyId).emit('czar:rating-result', {
        result: res.result,
        up: res.up,
        down: res.down,
        bonus: res.bonus,
        czarId: res.czarId,
    })
}
