import { nanoid } from 'nanoid'

export const createGame = ({ games, hostId, name }) => {
    const lobbyId = nanoid(6)
    const game = {
        lobbyId,
        host: hostId,
        players: [{ id: hostId, name, ready: false }],
        phase: 'lobby',
        selectedPacks: [],
    }
    games.set(lobbyId, game)
    return game
}

export const joinGame = ({ games, roomId, player }) => {
    const game = games.get(roomId)
    if (!game) return null
    game.players.push(player)
    games.set(roomId, game)
    return game
}

export const leaveGame = ({ games, roomId, socketId }) => {
    const game = games.get(roomId)
    if (!game) return null

    game.players = game.players.filter(p => p.id !== socketId)

    if (game.players.length === 0) {
        games.delete(roomId)
        return { deleted: true, game: null }
    }

    // host overdragen
    if (game.host === socketId) {
        game.host = game.players[0]?.id
        games.set(roomId, game)
        return { deleted: false, hostChangedTo: game.host, game }
    }

    games.set(roomId, game)
    return { deleted: false, game }
}

export const setReady = ({ games, roomId, socketId, ready }) => {
    const game = games.get(roomId)
    if (!game) return { error: 'not_found' }
    const player = game.players.find(p => p.id === socketId)
    if (!player) return { error: 'player_not_found' }
    player.ready = !!ready
    games.set(roomId, game)
    return { game, player }
}

export const updatePacks = ({ games, roomId, packs }) => {
    const game = games.get(roomId)
    if (!game) return null
    game.selectedPacks = Array.isArray(packs) ? packs : []
    games.set(roomId, game)
    return game
}

export const setPhase = ({ games, roomId, to }) => {
    const game = games.get(roomId)
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
    games.set(roomId, game)
    return { game }
}
