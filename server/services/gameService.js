import { nanoid } from 'nanoid'
import { getPacks, packExists } from '../utils/packs.js'
import { getCardsByPack, getPackCards, pickUniqueRandomBlackCard, whiteCardExists, blackCardExists } from '../utils/cards.js'

const normalizeName = (name) => (name ?? '').toString().trim()
const normalizeLanguage = (language) => (language ?? '').toString().trim() || 'nl'

export const createGame = ({ games, hostId, hostName, language }) => {
    const normalizedHostName = normalizeName(hostName)
    const hostLanguage = normalizeLanguage(language)
    const lobbyId = nanoid(6)
    const game = {
        lobbyId,
        host: hostId,
        players: [{ id: hostId, name: normalizedHostName, ready: false, language: hostLanguage, white_cards: [] }],
        phase: 'lobby',
        selectedPacks: [],
        card_selector: {
            languageByPlayerId: { [hostId]: hostLanguage },
        },
    }
    games.set(lobbyId, game)
    return game
}

export const joinGame = ({ games, lobbyId, player }) => {
    const game = games.get(lobbyId)
    if (!game) return null

    const nextPlayer = {
        ...player,
        name: normalizeName(player?.name),
        language: normalizeLanguage(player?.language),

        //DEV IF YOU SEE THIS, I FUCKED UP
        white_cards: [
            {
                pack: 'base',
                card_id: 2,
                name: 'Chiel'
            },
            {
                pack: 'base',
                card_id: 1,
                name: 'Chiel'
            },
            {
                pack: 'base',
                card_id: 3,
                name: 'Chiel'
            }
        ]
    }

    game.players.push(nextPlayer)

    if (!game.card_selector) {
        game.card_selector = { languageByPlayerId: {} }
    }
    game.card_selector.languageByPlayerId[nextPlayer.id] = nextPlayer.language
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
        CHOOSING: 'choosing',
        RESULTS: 'results',
    })

    const transitions = {
        [Phase.LOBBY]: new Set([Phase.STARTING]),
        [Phase.STARTING]: new Set([Phase.INTRO]),
        [Phase.INTRO]: new Set([Phase.CHOOSING]),
        [Phase.CHOOSING]: new Set([Phase.RESULTS]),
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

export const hasRound = ({ game, round }) => {
    return !!game.rounds?.[round]
}


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
