import { nanoid } from 'nanoid'
import { givePlayerHand, joinGame, selectPlayerCard, lockPlayerSelection, areAllNonSelectorPlayersSelected, selectCzarCard, finalizeRound } from './gameService.js'
import { scheduleSelectionLockTimer, hasActiveSelectionLocks } from '../utils/selectionLockTimers.js'

import { roundTimer, phaseTimer } from '../utils/timers.js'

import { transitionPhase } from './phaseService.js'
import { startCzarPhase } from './phaseFlowService.js'


const roundTimerService = roundTimer();
const phaseTimerService = phaseTimer();

const BOT_LOOP_INTERVAL_MS = 500
const BOT_LOCK_DELAY_MS = 1200

const botLoops = new Map<string, ReturnType<typeof setInterval>>()

const isBotPlayer = (player) => Boolean(player?.isBot)
const isEligibleForRound = (player, roundNumber) => (Number(player?.eligibleFromRound) || 1) <= (Number(roundNumber) || 0)

const tryStartCzarIfReady = ({ io, games, lobbyId }) => {
    const gameNow = games.get(lobbyId)
    if (!gameNow) return
    if (gameNow.phase !== 'board') return
    if (!areAllNonSelectorPlayersSelected(gameNow)) return
    if (hasActiveSelectionLocks(lobbyId)) return

    roundTimerService.clear(lobbyId)
    startCzarPhase({ io, games, lobbyId, round: gameNow.currentRound })
}

const selectBotCardForRound = ({ io, games, lobbyId, bot }) => {
    const cards = bot.white_cards ?? []
    if (!cards.length) return

    const picked = cards[Math.floor(Math.random() * cards.length)]
    const res = selectPlayerCard({ games, lobbyId, playerId: bot.id, card: picked })
    if (res?.error) return

    const lockInfo = scheduleSelectionLockTimer({
        lobbyId,
        playerId: bot.id,
        delayMs: BOT_LOCK_DELAY_MS,
        onTimeout: () => {
            const lockRes = lockPlayerSelection({ games, lobbyId, playerId: bot.id })
            if (!lockRes?.error) {
                io.to(lobbyId).emit('board:player-card-locked', { playerId: bot.id })
            }
            tryStartCzarIfReady({ io, games, lobbyId })
        },
    })

    io.to(lobbyId).emit('board:player-card-selected', {
        playerId: bot.id,
        selectionLockDurationMs: lockInfo?.durationMs ?? BOT_LOCK_DELAY_MS,
        selectionLockExpiresAt: lockInfo?.expiresAt ?? (Date.now() + BOT_LOCK_DELAY_MS),
    })

    tryStartCzarIfReady({ io, games, lobbyId })
}

const emitPlayerCardsUpdated = (io, game) => {
    if (!game?.players?.length) return
    game.players.forEach((player) => {
        io.to(player.id).emit("room:player-cards-updated", { cards: player.white_cards ?? [] })
    })
}

const selectBotCzarCard = async ({ io, games, lobbyId, bot, round }) => {
    if (round.cardSelector?.selectedCard?.playerId) return

    const pool = round.playerSelectedCards ?? []
    if (!pool.length) return

    const picked = pool[Math.floor(Math.random() * pool.length)]
    const res = selectCzarCard({ games, lobbyId, playerId: bot.id, entry: picked })
    if (res?.error) return

    const updatedGame = games.get(lobbyId)
    io.to(lobbyId).emit('board:round-updated', {
        currentRound: res.round,
        roundNumber: updatedGame?.currentRound ?? null,
    })

    const finalizeRes = await finalizeRound({ games, lobbyId })
    if (!finalizeRes?.error && finalizeRes?.game) {
        emitPlayerCardsUpdated(io, finalizeRes.game)
    }

    phaseTimerService.clear(lobbyId)
    transitionPhase({ games, io, lobbyId, to: 'czar-result' })
}

const tickBotLobby = ({ io, games, lobbyId }) => {
    const game = games.get(lobbyId)
    if (!game) return false

    const bots = (game.players ?? []).filter(isBotPlayer)
    if (!bots.length) return false

    if (game.phase === 'czar') {
        const round = game.rounds?.[game.currentRound]
        if (!round) return true

        const czarBot = bots.find((bot) => bot.id === round.cardSelector?.player)
        if (czarBot) {
            void selectBotCzarCard({ io, games, lobbyId, bot: czarBot, round })
        }
        return true
    }

    if (game.phase !== 'board') return true

    const round = game.rounds?.[game.currentRound]
    if (!round) return true

    const selectorId = round.cardSelector?.player
    const selectedIds = new Set((round.playerSelectedCards ?? []).map((entry) => entry.playerId))

    bots.forEach((bot) => {
        if (!bot?.id) return
        if (bot.id === selectorId) return
        if (!isEligibleForRound(bot, game.currentRound)) return
        if (selectedIds.has(bot.id)) return
        selectBotCardForRound({ io, games, lobbyId, bot })
    })

    return true
}

export const ensureBotLoop = ({ io, games, lobbyId }) => {
    if (botLoops.has(lobbyId)) return
    const timer = setInterval(() => {
        const keep = tickBotLobby({ io, games, lobbyId })
        if (!keep) {
            clearInterval(timer)
            botLoops.delete(lobbyId)
        }
    }, BOT_LOOP_INTERVAL_MS)
    botLoops.set(lobbyId, timer)
}

export const spawnBotPlayer = async ({ games, lobbyId, name }) => {
    const game = games.get(lobbyId)
    if (!game) return { error: 'not_found' }

    const botId = `bot-${nanoid(6)}`
    const safeName = (name ?? `Bot ${(game.players?.length ?? 0) + 1}`).toString().trim().slice(0, 25)

    const joined = joinGame({
        games,
        lobbyId,
        player: {
            id: botId,
            name: safeName,
            ready: true,
            language: game.language,
            isBot: true,
        },
    })
    if (!joined) return { error: 'join_failed' }

    if (!['lobby', 'starting'].includes(joined.phase)) {
        await givePlayerHand({ games, lobbyId, playerId: botId })
    }

    const updatedGame = games.get(lobbyId)
    const player = updatedGame?.players?.find((p) => p.id === botId) ?? null
    return { game: updatedGame, player }
}
