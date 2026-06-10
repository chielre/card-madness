import type { BlackCard, CardSelector, PlayerSelectedCardEntry } from './Cards.js'
import type { RoomPlayer } from './Player.js'

export type Phase =
    | 'lobby'
    | 'starting'
    | 'intro'
    | 'board'
    | 'czar'
    | 'czar-result'
    | 'results'

export interface CzarRatingState {
    active: boolean
    votes: Record<string, 'up' | 'down'>
    up: number
    down: number
    resolved: boolean
    result?: 'win' | 'lose' | 'tie'
    bonus?: number
    durationMs?: number
    expiresAt?: number
}

export interface RoundState {
    cardSelector: CardSelector
    blackCard: BlackCard | null
    playerSelectedCards: PlayerSelectedCardEntry[]
    czarRating?: CzarRatingState
}

export interface LobbySettings {
    keepLobbyOpen: boolean
    roundTimeMs: number
    czarPickTimeMs: number
    roundCount: number
    cardSwapEnabled: boolean
    czarRatingEnabled: boolean
    czarRatingTimeMs: number
}

export interface Room {
    lobbyId: string
    host: string
    players: RoomPlayer[]
    language?: string
    phase: Phase
    currentRound: number
    /** Current game round (1..settings.roundCount): one game round = everyone has been czar once */
    gameRound: number
    /** Player ids still waiting to be czar in the current game round (snapshot, mid-game joiners excluded) */
    czarQueue: string[]
    rounds: Record<number, RoundState>
    selectedPacks: string[]
    settings: LobbySettings
}
