import { nanoid } from 'nanoid'
import { getPacks, packExists } from '../utils/packs.js'
import {
    getCardsByPack,
    getPackCards,
    pickUniqueRandomBlackCard,
    buildWhitePool,
    buildUsedWhiteSet,
    whiteCardExists,
    blackCardExists
} from '../utils/cards.js'

const normalizeName = (name) => (name ?? '').toString().trim()
const normalizeLanguage = (language) => (language ?? '').toString().trim() || 'nl'

const keyOf = (c) => `${c.pack}:${c.card_id}`
const rand = (max) => Math.floor(Math.random() * max)
const randomPlayerLobbyName = (players) => players[rand(players.length)]?.name ?? ""

export const createGame = ({ games, hostId, hostName, language }) => {
    const normalizedHostName = normalizeName(hostName)
    const hostLanguage = normalizeLanguage(language)
    const lobbyId = nanoid(6)
    const game = {
        lobbyId,
        host: hostId,
        players: [{
            id: hostId,
            name: normalizedHostName,
            ready: false,
            language: hostLanguage,
            white_cards: []
        }],
        phase: 'lobby',
        currentRound: 0,
        rounds: {},
        selectedPacks: [],

    }
    games.set(lobbyId, game)
    return game
}


export const prepareGame = async ({ games, lobbyId }) => {
    const game = games.get(lobbyId)
    if (!game) return { error: "not_found" }

    if (!game.selectedPacks || !game.selectedPacks.length) {
        game.selectedPacks = getPacks().map(p => p.id)
    }



    // 1) Create 4 default rounds
    game.rounds = game.rounds ?? {}
    for (let r = 1; r <= 4; r++) {
        if (!game.rounds[r]) game.rounds[r] = {
            cardSelector: { player: null, selectedCard: {} },
            blackCard: null,
            playerSelectedCards: [],
        }
    }

    games.set(lobbyId, game)

    // 3) Deal initial hands
    const dealRes = await givePlayersWhiteCards({
        games,
        lobbyId,
        handSize: 5,
        uniquePerGame: true,
    })
    if (dealRes?.error) return dealRes

    return { game: games.get(lobbyId) }
}

/**
 * Deals white cards to all players until they reach handSize.
 */
export const givePlayersWhiteCards = async ({ games, lobbyId, handSize = 5, uniquePerGame = true }) => {
    const game = games.get(lobbyId)
    if (!game) return { error: "not_found" }

    game.players = game.players ?? []
    if (!game.players.length) return { error: "no_players" }

    const poolRes = buildWhitePool(game)
    if (poolRes.error) return poolRes
    const { pool } = poolRes

    const used = uniquePerGame ? buildUsedWhiteSet(game) : null

    for (const player of game.players) {
        player.white_cards = player.white_cards ?? []

        while (player.white_cards.length < handSize) {
            const localUsed = new Set(player.white_cards.map(keyOf))

            const candidates = pool.filter((c) =>
                uniquePerGame ? !used.has(keyOf(c)) : !localUsed.has(keyOf(c))
            )
            if (!candidates.length) return { error: "not_enough_white_cards" }

            const picked = candidates[rand(candidates.length)]
            player.white_cards.push({ ...picked, name: randomPlayerLobbyName(game.players) })
            if (uniquePerGame) used.add(keyOf(picked))
        }
    }

    games.set(lobbyId, game)
    return { game }
}

/**
 * Gives a single white card to one player (optioneel: tot maxHandSize).
 */
export const givePlayerOneWhiteCard = async ({ games, lobbyId, playerId, uniquePerGame = true, maxHandSize = null }) => {
    const game = games.get(lobbyId)
    if (!game) return { error: "not_found" }

    game.players = game.players ?? []
    const player = game.players.find((p) => p.id === playerId)
    if (!player) return { error: "player_not_found" }

    player.white_cards = player.white_cards ?? []
    if (maxHandSize != null && player.white_cards.length >= maxHandSize) {
        return { game, player } // niets doen
    }

    const poolRes = buildWhitePool(game)
    if (poolRes.error) return poolRes
    const { pool } = poolRes

    const used = uniquePerGame ? buildUsedWhiteSet(game) : null
    const localUsed = new Set(player.white_cards.map(keyOf))

    const candidates = pool.filter((c) =>
        uniquePerGame ? !used.has(keyOf(c)) : !localUsed.has(keyOf(c))
    )
    if (!candidates.length) return { error: "not_enough_white_cards" }

    const picked = candidates[rand(candidates.length)]
    const card = { ...picked, name: randomPlayerLobbyName(game.players) }

    player.white_cards.push(card)
    games.set(lobbyId, game)

    return { game, player, card }
}


export const joinGame = ({ games, lobbyId, player }) => {
    const game = games.get(lobbyId)
    if (!game) return null

    const nextPlayer = {
        ...player,
        name: normalizeName(player?.name),
        language: normalizeLanguage(player?.language),
        white_cards: []
    }

    game.players.push(nextPlayer)


    games.set(lobbyId, game)
    return game
}

export const leaveGame = ({ games, lobbyId, socketId }) => {
    const game = games.get(lobbyId)
    if (!game) return null

    game.players = game.players.filter(p => p.id !== socketId)

    if (game.players.length === 0) {
        games.delete(lobbyId)
        return { deleted: true, game: null }
    }

    // host overdragen
    if (game.host === socketId) {
        game.host = game.players[0]?.id
        games.set(lobbyId, game)
        return { deleted: false, hostChangedTo: game.host, game }
    }

    games.set(lobbyId, game)
    return { deleted: false, game }
}

export const setReady = ({ games, lobbyId, socketId, ready }) => {
    const game = games.get(lobbyId)
    if (!game) return { error: 'not_found' }

    const player = game.players.find(p => p.id === socketId)
    if (!player) return { error: 'player_not_found' }

    player.ready = !!ready
    games.set(lobbyId, game)

    return { game, player }
}

export const updatePacks = ({ games, lobbyId, packs }) => {
    const game = games.get(lobbyId)
    if (!game) return null
    game.selectedPacks = Array.isArray(packs) ? packs : []
    games.set(lobbyId, game)
    return game
}

export const setPhase = ({ games, lobbyId, to }) => {
    const game = games.get(lobbyId)
    if (!game) return { error: 'not_found' }

    const Phase = Object.freeze({
        LOBBY: 'lobby',
        STARTING: 'starting',
        INTRO: 'intro',
        BOARD: 'board',
        CZAR: 'czar',
        CZAR_RESULT: 'czar-result',
        RESULTS: 'results',
    })

    const transitions = {
        [Phase.LOBBY]: new Set([Phase.STARTING]),
        [Phase.STARTING]: new Set([Phase.INTRO]),
        [Phase.INTRO]: new Set([Phase.BOARD]),
        [Phase.BOARD]: new Set([Phase.CZAR]),
        [Phase.CZAR]: new Set([Phase.CZAR_RESULT]),
        [Phase.CZAR_RESULT]: new Set([Phase.BOARD, Phase.RESULTS]),
        [Phase.RESULTS]: new Set([Phase.LOBBY]),
    }

    const canTransition = (from, to) => !!transitions[from]?.has(to)

    if (!canTransition(game.phase, to)) {
        return { error: 'invalid_transition', from: game.phase, to }
    }

    game.phase = to
    games.set(lobbyId, game)
    return { game }
}

export const hasRound = (game, round) => !!game?.rounds?.[round]


export const pickNextCardSelector = (game, round) => {
    const players = game.players ?? []
    if (!players.length) return null

    const idx = (Number(round) - 1) % players.length
    return players[idx]?.id ?? null
}

export const setRound = ({ games, lobbyId, to }) => {
    const game = games.get(lobbyId)
    if (!game) return { error: "not_found" }

    if (!hasRound(game, to)) return { error: "round_not_found" }

    prepareRound({ games, lobbyId, round: to })

    game.currentRound = to
    games.set(lobbyId, game)

    return { game }
}

export const prepareRound = ({ games, lobbyId, round }) => {
    const game = games.get(lobbyId)
    if (!game) return { error: "not_found" }

    if (!hasRound(game, round)) return { error: "round_not_found" }


    const targetRound = game.rounds[round]

    // 1) select next card selector (next in line)
    targetRound.cardSelector = {
        player: pickNextCardSelector(game, round),
        selectedCard: {},
    }

    // 2) random black card from selected packs
    const uniqueBlackCard = pickUniqueRandomBlackCard(game)
    if (!uniqueBlackCard) return { error: "no_black_cards_left" }

    targetRound.blackCard = uniqueBlackCard

    // 3) Removing dust from previous rounds 
    targetRound.playerSelectedCards = []

    // 3) update the game storage
    game.rounds[round] = targetRound
    games.set(lobbyId, game)

    return { game, round: targetRound }
}

export const selectPlayerCard = ({ games, lobbyId, playerId, card }) => {
    const game = games.get(lobbyId)
    if (!game) return { error: "not_found" }

    if (game.phase !== 'board') return { error: "round_not_active" }

    const roundNumber = game.currentRound
    const round = game.rounds?.[roundNumber]
    if (!round) return { error: "round_not_found" }

    if (round.cardSelector?.player === playerId) return { error: "card_selector_cannot_select" }

    const player = game.players?.find((p) => p.id === playerId)
    if (!player) return { error: "player_not_found" }

    const selected = player.white_cards?.find((c) => c.pack === card?.pack && c.card_id === card?.card_id) ?? card
    if (!selected) return { error: "card_not_found" }

    round.playerSelectedCards = round.playerSelectedCards ?? []
    const idx = round.playerSelectedCards.findIndex((c) => c.playerId === playerId)
    const entry = { playerId, card: selected }
    if (idx >= 0) {
        round.playerSelectedCards[idx] = entry
    } else {
        round.playerSelectedCards.push(entry)
    }

    game.rounds[roundNumber] = round
    games.set(lobbyId, game)

    return { game, round, playerSelectedCard: entry }
}

export const unselectPlayerCard = ({ games, lobbyId, playerId, card }) => {
    const game = games.get(lobbyId)
    if (!game) return { error: "not_found" }

    if (game.phase !== 'board') return { error: "round_not_active" }

    const roundNumber = game.currentRound
    const round = game.rounds?.[roundNumber]
    if (!round) return { error: "round_not_found" }

    round.playerSelectedCards = (round.playerSelectedCards ?? []).filter((c) => c.playerId !== playerId)
    game.rounds[roundNumber] = round
    games.set(lobbyId, game)

    return { game, round, playerSelectedCard: { playerId, card } }
}

export const areAllNonSelectorPlayersSelected = (game) => {
    if (!game) return false
    if (game.phase !== 'board') return false

    const round = game.rounds?.[game.currentRound]
    if (!round) return false

    const selectorId = round.cardSelector?.player
    const eligiblePlayers = (game.players ?? []).filter((p) => p.id !== selectorId)
    if (!eligiblePlayers.length) return false

    const selectedIds = new Set((round.playerSelectedCards ?? []).map((entry) => entry.playerId))
    return eligiblePlayers.every((p) => selectedIds.has(p.id))
}

export const autoSelectMissingPlayerCards = ({ games, lobbyId }) => {
    const game = games.get(lobbyId)
    if (!game) return { error: "not_found" }

    const roundNumber = game.currentRound
    const round = game.rounds?.[roundNumber]
    if (!round) return { error: "round_not_found" }

    const selectorId = round.cardSelector?.player
    const selectedIds = new Set((round.playerSelectedCards ?? []).map((entry) => entry.playerId))
    const missingPlayers = (game.players ?? []).filter((p) => p.id !== selectorId && !selectedIds.has(p.id))

    if (!missingPlayers.length) return { game, round, added: [] }

    const rand = (max) => Math.floor(Math.random() * max)
    round.playerSelectedCards = round.playerSelectedCards ?? []
    const added = []

    for (const player of missingPlayers) {
        const cards = player.white_cards ?? []
        if (!cards.length) continue
        const picked = cards[rand(cards.length)]
        const entry = { playerId: player.id, card: picked }
        round.playerSelectedCards.push(entry)
        added.push(entry)
    }

    game.rounds[roundNumber] = round
    games.set(lobbyId, game)

    return { game, round, added }
}

export const autoSelectCzarCard = ({ games, lobbyId }) => {
    const game = games.get(lobbyId)
    if (!game) return { error: "not_found" }

    const roundNumber = game.currentRound
    const round = game.rounds?.[roundNumber]
    if (!round) return { error: "round_not_found" }

    const currentSelected = round.cardSelector?.selectedCard
    if (currentSelected?.playerId) return { game, round, selected: currentSelected }

    const pool = round.playerSelectedCards ?? []
    if (!pool.length) return { game, round, selected: null }

    const rand = (max) => Math.floor(Math.random() * max)
    const picked = pool[rand(pool.length)]
    round.cardSelector = round.cardSelector ?? { player: null, selectedCard: {} }
    round.cardSelector.selectedCard = picked

    game.rounds[roundNumber] = round
    games.set(lobbyId, game)

    return { game, round, selected: picked }
}

export const finalizeRound = async ({ games, lobbyId, handSize = 5, uniquePerGame = true }) => {
    const game = games.get(lobbyId)
    if (!game) return { error: "not_found" }

    const roundNumber = game.currentRound
    const round = game.rounds?.[roundNumber]
    if (!round) return { error: "round_not_found" }

    const selectedEntries = round.playerSelectedCards ?? []
    const updatedPlayerIds = new Set()

    for (const entry of selectedEntries) {
        const player = game.players?.find((p) => p.id === entry.playerId)
        if (!player) continue
        const card = entry.card
        if (!card) continue

        player.white_cards = (player.white_cards ?? []).filter(
            (c) => !(c.pack === card.pack && c.card_id === card.card_id)
        )
        updatedPlayerIds.add(player.id)
    }

    games.set(lobbyId, game)

    for (const playerId of updatedPlayerIds) {
        await givePlayerOneWhiteCard({ games, lobbyId, playerId, uniquePerGame, maxHandSize: handSize })
    }

    const updatedGame = games.get(lobbyId)
    return { game: updatedGame, round, updatedPlayerIds: [...updatedPlayerIds] }
}

export const selectCzarCard = ({ games, lobbyId, playerId, entry }) => {
    const game = games.get(lobbyId)
    if (!game) return { error: "not_found" }

    if (game.phase !== 'czar') return { error: "invalid_phase" }

    const roundNumber = game.currentRound
    const round = game.rounds?.[roundNumber]
    if (!round) return { error: "round_not_found" }

    if (round.cardSelector?.player !== playerId) return { error: "not_card_selector" }

    const pool = round.playerSelectedCards ?? []
    const match = pool.find(
        (p) => p.playerId === entry?.playerId
            && p.card?.pack === entry?.card?.pack
            && p.card?.card_id === entry?.card?.card_id
    )
    if (!match) return { error: "card_not_found" }

    round.cardSelector = round.cardSelector ?? { player: null, selectedCard: {} }
    round.cardSelector.selectedCard = match

    game.rounds[roundNumber] = round
    games.set(lobbyId, game)

    return { game, round, selected: match }
}
