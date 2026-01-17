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

export interface RoundState {
    cardSelector: CardSelector
    blackCard: BlackCard | null
    playerSelectedCards: PlayerSelectedCardEntry[]
}

export interface Room {
    lobbyId: string
    host: string
    players: RoomPlayer[]
    language?: string
    phase: Phase
    currentRound: number
    rounds: Record<number, RoundState>
    selectedPacks: string[]
}
