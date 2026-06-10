import { getPacks, packExists } from '../utils/packs.js'
import {
    getPackCards,
    pickUniqueRandomBlackCard,
    buildWhitePool,
    buildUsedWhiteSet,
    whiteCardExists,
    blackCardExists,
    pickFairWhiteCard
} from '../utils/cards.js'
import { POINTS_CZAR_PICKED, POINTS_CZAR_SELECT, POINTS_CARD_SWAP_COST, POINTS_CZAR_RATING_BONUS } from '../config/points.js'
import { normalizeLobbySettings } from '../config/lobbySettings.js'

const MAX_PLAYER_NAME_LENGTH = 25
const normalizeName = (name) => (name ?? '').toString().trim()
const normalizeLanguage = (language) => (language ?? '').toString().trim() || 'nl'
const getGameLanguage = (game) => normalizeLanguage(game?.language)

const keyOf = (c): string => `${c.pack}:${c.card_id}`
const rand = (max) => Math.floor(Math.random() * max)
const generateLobbyCode = () => String(Math.floor(10000 + Math.random() * 90000))
const createUniqueLobbyCode = (games) => {
    let code = generateLobbyCode()
    while (games.has(code)) {
        code = generateLobbyCode()
    }
    return code
}
const DEFAULT_CARD_NAME_POOL = [
    'Alex',
    'Sam',
    'Jamie',
    'Taylor',
    'Jordan',
    'Riley',
    'Morgan',
    'Casey',
    'Robin',
    'Avery',
]
const countNameSlots = (text) => (text?.match(/:name/g) ?? []).length
const buildCardNamePool = (game) => {
    const playerNames = (game?.players ?? [])
        .map((player) => normalizeName(player?.name))
        .filter(Boolean)

    return playerNames.length ? playerNames : DEFAULT_CARD_NAME_POOL
}
const pickRandomLobbyNames = (pool, count) =>
    Array.from({ length: count }, () => pool[rand(pool.length)] ?? DEFAULT_CARD_NAME_POOL[0])
const getWhiteCardText = (pack, cardId, language) => getPackCards(pack, language)?.white?.[cardId] ?? ""
const getBlackCardText = (pack, cardId, language) => getPackCards(pack, language)?.black?.[cardId] ?? ""
const buildCardNames = (game, text) => {
    const slotCount = countNameSlots(text)
    if (!slotCount) return []
    const namePool = buildCardNamePool(game)
    return pickRandomLobbyNames(namePool, slotCount)
}

export const ensureLobbySettings = (game) => {
    const settings = normalizeLobbySettings(game?.settings)
    if (game) {
        game.settings = settings
    }
    return settings
}

export const createGame = ({ games, hostId, hostName, language, settings }) => {
    const normalizedHostName = normalizeName(hostName)
    const hostLanguage = normalizeLanguage(language)
    const lobbyId = createUniqueLobbyCode(games)
    const game = {
        lobbyId,
        host: hostId,
        players: [{
            id: hostId,
            name: normalizedHostName,
            ready: false,
            language: hostLanguage,
            white_cards: [],
            eligibleFromRound: 1,
            points: 0,
            pointsLost: 0,
            pointsLostThisRound: 0,
        }],
        language: hostLanguage,
        phase: 'lobby',
        currentRound: 0,
        gameRound: 0,
        czarQueue: [],
        rounds: {},
        selectedPacks: [],
        settings: normalizeLobbySettings(settings),

    }
    games.set(lobbyId, game)
    return game
}

const getEligibleFromRound = (game) => {
    const activeRoundPhases = new Set(['board', 'czar', 'czar-result'])
    const currentRound = Number(game?.currentRound) || 0
    if (activeRoundPhases.has(game?.phase) && currentRound > 0) {
        return currentRound + 1
    }
    return 1
}

const getPlayerEligibleFromRound = (player) => Number(player?.eligibleFromRound) || 1
const isPlayerEligibleForRound = (player, roundNumber) =>
    getPlayerEligibleFromRound(player) <= (Number(roundNumber) || 0)


export const prepareGame = async ({ games, lobbyId }) => {
    const game = games.get(lobbyId)
    if (!game) return { error: "not_found" }
    ensureLobbySettings(game)

    if (!game.selectedPacks || !game.selectedPacks.length) {
        game.selectedPacks = getPacks().map(p => p.id)
    }

    // Reset the round engine. Turns (game.rounds) are created lazily as we go,
    // because the total number of turns depends on how many game rounds are
    // configured AND how many players are in the lobby each game round.
    game.rounds = {}
    game.currentRound = 0
    game.gameRound = 0
    game.czarQueue = []

    games.set(lobbyId, game)

    // 3) Deal initial hands
    const dealRes = await givePlayersWhiteCards({
        games,
        lobbyId,
        handSize: 5,
        uniquePerGame: true,
    })
    if (dealRes && 'error' in dealRes) return dealRes

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

    const poolRes = buildWhitePool(game, getGameLanguage(game))
    if (poolRes.error) return poolRes
    const { packIds, cardsByPack } = poolRes

    const used = uniquePerGame ? buildUsedWhiteSet(game) : null

    for (const player of game.players) {
        player.white_cards = player.white_cards ?? []

        while (player.white_cards.length < handSize) {
            const localUsed = new Set<string>(player.white_cards.map(keyOf))

            const picked = pickFairWhiteCard({
                packIds,
                cardsByPack,
                used,
                localUsed,
            })
            if (!picked) return { error: "not_enough_white_cards" }

            const text = getWhiteCardText(picked.pack, picked.card_id, getGameLanguage(game))
            const names = buildCardNames(game, text)
            player.white_cards.push(names.length ? { ...picked, names } : { ...picked })
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

    const poolRes = buildWhitePool(game, getGameLanguage(game))
    if (poolRes.error) return poolRes
    const { packIds, cardsByPack } = poolRes

    const used = uniquePerGame ? buildUsedWhiteSet(game) : null
    const localUsed = new Set<string>(player.white_cards.map(keyOf))

    const picked = pickFairWhiteCard({
        packIds,
        cardsByPack,
        used,
        localUsed,
    })
    if (!picked) return { error: "not_enough_white_cards" }

    const text = getWhiteCardText(picked.pack, picked.card_id, getGameLanguage(game))
    const names = buildCardNames(game, text)
    const card = names.length ? { ...picked, names } : { ...picked }

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
        white_cards: [],
        eligibleFromRound: getEligibleFromRound(game),
        points: 0,
        pointsLost: 0,
        pointsLostThisRound: 0,
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

export const setPlayerLanguage = ({ games, lobbyId, socketId, language }) => {
    const game = games.get(lobbyId)
    if (!game) return { error: 'not_found' }

    const player = game.players.find(p => p.id === socketId)
    if (!player) return { error: 'player_not_found' }

    player.language = normalizeLanguage(language)
    games.set(lobbyId, game)

    return { game, player }
}

export const updateLobbySettings = ({ games, lobbyId, settings }) => {
    const game = games.get(lobbyId)
    if (!game) return { error: 'not_found' }

    const currentSettings = ensureLobbySettings(game)
    const nextSettings = normalizeLobbySettings({
        ...currentSettings,
        ...(settings ?? {}),
    })

    game.settings = nextSettings
    games.set(lobbyId, game)

    return { game, settings: nextSettings }
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

    if (to === Phase.STARTING && (game.players?.length ?? 0) < 2) {
        return { error: 'not_enough_players' }
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

const ensureRoundEngineState = (game) => {
    if (typeof game.gameRound !== 'number') game.gameRound = 0
    if (!Array.isArray(game.czarQueue)) game.czarQueue = []
}

// The set of players that will each be czar once during a game round.
// Snapshotted when a game round starts, so players who join mid-round are
// excluded from the current game round and only join the next one.
const buildCzarQueueForGameRound = (game) => (game.players ?? []).map((p) => p.id)

/**
 * Decides the czar/turn for the next step of the game.
 * One "game round" = every player in the snapshot has been czar once.
 * `settings.roundCount` controls how many game rounds are played.
 *
 * Mutates game.gameRound / game.czarQueue. Returns:
 *  - { done: true } when the game is over (all game rounds completed)
 *  - { done: false, turn, czarId, gameRound } for the next turn to play
 */
export const planNextTurn = ({ games, lobbyId }) => {
    const game = games.get(lobbyId)
    if (!game) return { error: "not_found" }
    const settings = ensureLobbySettings(game)
    ensureRoundEngineState(game)

    // drop any queued czars that have since left
    const presentIds = new Set((game.players ?? []).map((p) => p.id))
    game.czarQueue = game.czarQueue.filter((id) => presentIds.has(id))

    if (game.czarQueue.length === 0) {
        // current game round finished -> start a new one (or end the game)
        if ((Number(game.gameRound) || 0) >= settings.roundCount) {
            games.set(lobbyId, game)
            return { done: true }
        }
        game.gameRound = (Number(game.gameRound) || 0) + 1
        game.czarQueue = buildCzarQueueForGameRound(game)
        if (game.czarQueue.length === 0) {
            games.set(lobbyId, game)
            return { done: true } // no players left
        }
    }

    const czarId = game.czarQueue.shift()
    const turn = (Number(game.currentRound) || 0) + 1
    games.set(lobbyId, game)
    return { done: false, turn, czarId, gameRound: game.gameRound }
}

export const setRound = ({ games, lobbyId, to, czarId = null }) => {
    const game = games.get(lobbyId)
    if (!game) return { error: "not_found" }

    const prepRes = prepareRound({ games, lobbyId, round: to, czarId })
    if (prepRes?.error) return prepRes

    game.currentRound = to
    // reset per-round swap tracking so the scoreboard delta is round-scoped
    game.players?.forEach((p) => { p.pointsLostThisRound = 0 })
    games.set(lobbyId, game)

    return { game }
}

export const prepareRound = ({ games, lobbyId, round, czarId = null }) => {
    const game = games.get(lobbyId)
    if (!game) return { error: "not_found" }

    game.rounds = game.rounds ?? {}
    // turns are created lazily; reuse an existing entry if we're re-running a turn
    const targetRound = game.rounds[round] ?? {
        cardSelector: { player: null, selectedCard: {} },
        blackCard: null,
        playerSelectedCards: [],
    }

    // 1) select the card selector (czar) for this turn
    targetRound.cardSelector = {
        player: czarId ?? pickNextCardSelector(game, round),
        selectedCard: {},
    }

    // 2) random black card from selected packs
    const uniqueBlackCard = pickUniqueRandomBlackCard(game, getGameLanguage(game))
    if (!uniqueBlackCard) return { error: "no_black_cards_left" }

    const blackText = getBlackCardText(uniqueBlackCard.pack, uniqueBlackCard.card_id, getGameLanguage(game))
    const blackNames = buildCardNames(game, blackText)
    targetRound.blackCard = blackNames.length
        ? { ...uniqueBlackCard, names: blackNames }
        : uniqueBlackCard

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

    const player = game.players?.find((p) => p.id === playerId)
    if (!player) return { error: "player_not_found" }
    if (!isPlayerEligibleForRound(player, game.currentRound)) {
        return { error: "player_waiting" }
    }

    const roundNumber = game.currentRound
    const round = game.rounds?.[roundNumber]
    if (!round) return { error: "round_not_found" }

    // only possible in an active round
    if (game.phase !== 'board') return { error: "round_not_active" }

    // should not be the czar
    if (round.cardSelector?.player === playerId) return { error: "card_selector_cannot_select" }

    const selected = player.white_cards?.find((c) => c.pack === card?.pack && c.card_id === card?.card_id) ?? card
    if (!selected) return { error: "card_not_found" }

    round.playerSelectedCards = round.playerSelectedCards ?? []

    // check if the player already has a locked in card
    const selectedCardIndex = round.playerSelectedCards.findIndex((c) => c.playerId === playerId)
    const existingEntry = selectedCardIndex >= 0 ? round.playerSelectedCards[selectedCardIndex] : null
    if (existingEntry?.locked) return { error: "selection_locked" }

    const entry = { playerId, card: selected, locked: false }
    if (selectedCardIndex >= 0) {
        round.playerSelectedCards[selectedCardIndex] = entry
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

    // only possible in an active round
    if (game.phase !== 'board') return { error: "round_not_active" }

    const roundNumber = game.currentRound
    const round = game.rounds?.[roundNumber]
    if (!round) return { error: "round_not_found" }

    const player = game.players?.find((p) => p.id === playerId)
    if (!player) return { error: "player_not_found" }
    if (!isPlayerEligibleForRound(player, game.currentRound)) {
        return { error: "player_waiting" }
    }

    // should not be the czar
    if (round.cardSelector?.player === playerId) return { error: "card_selector_cannot_select" }


    // check if the player already has a locked in card
    const existingEntry = (round.playerSelectedCards ?? []).find((c) => c.playerId === playerId)
    if (existingEntry?.locked) return { error: "selection_locked" }

    round.playerSelectedCards = (round.playerSelectedCards ?? []).filter((c) => c.playerId !== playerId)
    game.rounds[roundNumber] = round
    games.set(lobbyId, game)

    return { game, round, playerSelectedCard: { playerId, card } }
}

/**
 * Swap one card from a player's hand for a freshly dealt one, at the cost of points.
 * Follows the CAH house rule: trading in a card costs one awarded point.
 */
export const swapPlayerCard = async ({ games, lobbyId, playerId, card, handSize = 5, uniquePerGame = true }) => {
    const game = games.get(lobbyId)
    if (!game) return { error: "not_found" }

    // only possible during an active selection round
    if (game.phase !== 'board') return { error: "round_not_active" }

    // card swapping can be disabled via the lobby settings
    if (!ensureLobbySettings(game).cardSwapEnabled) return { error: "swap_disabled" }

    const roundNumber = game.currentRound
    const round = game.rounds?.[roundNumber]
    if (!round) return { error: "round_not_found" }

    const player = game.players?.find((p) => p.id === playerId)
    if (!player) return { error: "player_not_found" }
    if (!isPlayerEligibleForRound(player, game.currentRound)) {
        return { error: "player_waiting" }
    }

    // the card selector (czar) does not play a hand this round
    if (round.cardSelector?.player === playerId) return { error: "card_selector_cannot_select" }

    // a swap costs points; players with too few points cannot swap
    const cost = POINTS_CARD_SWAP_COST
    if ((Number(player.points) || 0) < cost) return { error: "not_enough_points" }

    // the card must be in the player's current hand
    player.white_cards = player.white_cards ?? []
    const idx = player.white_cards.findIndex((c) => c.pack === card?.pack && c.card_id === card?.card_id)
    if (idx < 0) return { error: "card_not_found" }

    // the card that is currently played/selected this round cannot be swapped
    const selectedEntry = (round.playerSelectedCards ?? []).find((c) => c.playerId === playerId)
    if (selectedEntry?.card && selectedEntry.card.pack === card.pack && selectedEntry.card.card_id === card.card_id) {
        return { error: "card_in_play" }
    }

    // remove the card and charge the player
    const [removed] = player.white_cards.splice(idx, 1)
    player.points = (Number(player.points) || 0) - cost
    player.pointsLost = (Number(player.pointsLost) || 0) + cost
    player.pointsLostThisRound = (Number(player.pointsLostThisRound) || 0) + cost
    games.set(lobbyId, game)

    // deal a replacement so the player keeps a full hand
    const dealRes: any = await givePlayerOneWhiteCard({ games, lobbyId, playerId, uniquePerGame, maxHandSize: handSize })
    if (dealRes?.error) return { error: dealRes.error }

    const updatedGame = games.get(lobbyId)
    const updatedPlayer = updatedGame?.players?.find((p) => p.id === playerId)
    return { game: updatedGame, player: updatedPlayer, removed, newCard: dealRes?.card ?? null }
}

export const lockPlayerSelection = ({ games, lobbyId, playerId }) => {
    const game = games.get(lobbyId)
    if (!game) return { error: "not_found" }

    // only possible in an active round
    if (game.phase !== 'board') return { error: "round_not_active" }


    const roundNumber = game.currentRound
    const round = game.rounds?.[roundNumber]
    if (!round) return { error: "round_not_found" }

    const player = game.players?.find((p) => p.id === playerId)
    if (!player) return { error: "player_not_found" }
    if (!isPlayerEligibleForRound(player, game.currentRound)) {
        return { error: "player_waiting" }
    }
    // should not be the czar
    if (round.cardSelector?.player === playerId) return { error: "card_selector_cannot_select" }


    const selectedCardIndex = (round.playerSelectedCards ?? []).findIndex((c) => c.playerId === playerId)
    if (selectedCardIndex < 0) return { error: "selection_not_found" }

    round.playerSelectedCards[selectedCardIndex] = { ...round.playerSelectedCards[selectedCardIndex], locked: true }

    game.rounds[roundNumber] = round
    games.set(lobbyId, game)
    return { game, round }
}

export const areAllNonSelectorPlayersSelected = (game) => {
    if (!game) return false
    if (game.phase !== 'board') return false

    const round = game.rounds?.[game.currentRound]
    if (!round) return false

    const selectorId = round.cardSelector?.player
    const eligiblePlayers = (game.players ?? []).filter(
        (p) => p.id !== selectorId && isPlayerEligibleForRound(p, game.currentRound)
    )
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
    const missingPlayers = (game.players ?? []).filter(
        (p) => p.id !== selectorId && !selectedIds.has(p.id) && isPlayerEligibleForRound(p, game.currentRound)
    )

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

export const givePlayerHand = async ({ games, lobbyId, playerId, handSize = 5, uniquePerGame = true }) => {
    const game = games.get(lobbyId)
    if (!game) return { error: "not_found" }

    game.players = game.players ?? []
    const player = game.players.find((p) => p.id === playerId)
    if (!player) return { error: "player_not_found" }

    player.white_cards = player.white_cards ?? []
    if (player.white_cards.length >= handSize) {
        return { game, player }
    }

    const poolRes = buildWhitePool(game, getGameLanguage(game))
    if (poolRes.error) return poolRes
    const { packIds, cardsByPack } = poolRes

    const used = uniquePerGame ? buildUsedWhiteSet(game) : null

    while (player.white_cards.length < handSize) {
        const localUsed = new Set<string>(player.white_cards.map(keyOf))
        const picked = pickFairWhiteCard({
            packIds,
            cardsByPack,
            used,
            localUsed,
        })
        if (!picked) return { error: "not_enough_white_cards" }

        const text = getWhiteCardText(picked.pack, picked.card_id, getGameLanguage(game))
        const names = buildCardNames(game, text)
        player.white_cards.push(names.length ? { ...picked, names } : { ...picked })
        if (uniquePerGame) used.add(keyOf(picked))
    }

    games.set(lobbyId, game)
    return { game, player }
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
    const winner = game.players?.find((p) => p.id === match.playerId)
    if (winner) {
        const previous = Number(winner.points) || 0
        winner.points = previous + POINTS_CZAR_PICKED
    }
    const czar = game.players?.find((p) => p.id === playerId)
    if (czar) {
        const previous = Number(czar.points) || 0
        czar.points = previous + POINTS_CZAR_SELECT
    }
    games.set(lobbyId, game)

    return { game, round, selected: match }
}

// The "audience" that may rate the czar's pick: everyone except the czar.
const getRatingAudience = (game, czarId) =>
    (game?.players ?? []).filter((p) => p.id !== czarId)

/**
 * Records an audience thumbs up/down vote on the czar's chosen card.
 * Only valid during czar-result while a rating is active and unresolved.
 */
export const recordCzarRatingVote = ({ games, lobbyId, playerId, vote }) => {
    if (vote !== 'up' && vote !== 'down') return { error: 'invalid_vote' }

    const game = games.get(lobbyId)
    if (!game) return { error: 'not_found' }
    if (game.phase !== 'czar-result') return { error: 'invalid_phase' }

    const round = game.rounds?.[game.currentRound]
    const rating = round?.czarRating
    if (!rating?.active) return { error: 'rating_not_active' }
    if (rating.resolved) return { error: 'rating_resolved' }

    const czarId = round.cardSelector?.player
    if (playerId === czarId) return { error: 'czar_cannot_vote' }

    const player = game.players?.find((p) => p.id === playerId)
    if (!player) return { error: 'player_not_found' }
    if (rating.votes[playerId]) return { error: 'already_voted' }

    rating.votes[playerId] = vote
    const values = Object.values(rating.votes)
    rating.up = values.filter((v) => v === 'up').length
    rating.down = values.filter((v) => v === 'down').length

    const audience = getRatingAudience(game, czarId)
    const allVoted = audience.length > 0 && audience.every((p) => rating.votes[p.id])

    games.set(lobbyId, game)
    return { game, round, up: rating.up, down: rating.down, allVoted }
}

/**
 * Resolves the czar rating: a strict majority of thumbs up awards the czar a
 * bonus on top of their base point. Ties and majority-down award no bonus.
 */
export const resolveCzarRating = ({ games, lobbyId }) => {
    const game = games.get(lobbyId)
    if (!game) return { error: 'not_found' }

    const round = game.rounds?.[game.currentRound]
    const rating = round?.czarRating
    if (!rating) return { error: 'no_rating' }
    if (rating.resolved) return { alreadyResolved: true }

    const { up, down } = rating
    const result = up > down ? 'win' : down > up ? 'lose' : 'tie'
    const bonus = result === 'win' ? POINTS_CZAR_RATING_BONUS : 0
    const czarId = round.cardSelector?.player

    if (bonus > 0 && czarId) {
        const czar = game.players?.find((p) => p.id === czarId)
        if (czar) czar.points = (Number(czar.points) || 0) + bonus
    }

    rating.active = false
    rating.resolved = true
    rating.result = result
    rating.bonus = bonus
    games.set(lobbyId, game)

    return { game, round, result, up, down, bonus, czarId }
}

const resetPlayerForLobby = (player) => ({
    ...player,
    ready: false,
    white_cards: [],
    eligibleFromRound: 1,
    points: 0,
    pointsLost: 0,
    pointsLostThisRound: 0,
})

export const resetGameForLobby = ({ games, lobbyId }) => {
    const game = games.get(lobbyId)
    if (!game) return { error: "not_found" }

    game.settings = ensureLobbySettings(game)
    game.currentRound = null
    game.gameRound = 0
    game.czarQueue = []
    game.rounds = null
    game.selectedPacks = []
    game.players = (game.players ?? []).map(resetPlayerForLobby)

    games.set(lobbyId, game)
    return { game }
}
