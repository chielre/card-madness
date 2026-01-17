import type { WhiteCard } from './Cards.js'

export interface PlayerProfile {
    id: string
    name: string
    language: string
}

export interface RoomPlayer {
    id: string
    name: string
    ready: boolean
    language: string
    white_cards: WhiteCard[]
    eligibleFromRound: number
}
