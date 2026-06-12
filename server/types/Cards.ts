export type PackId = string
export type CardId = number

export interface BaseCard {
    pack: PackId
    card_id: CardId
}

export interface WhiteCard extends BaseCard {
    names?: string[]
}

export interface BlackCard extends BaseCard {
    names?: string[]
}

export interface PlayerSelectedCardEntry {
    playerId: string
    /** Ordered set of white cards, one per :answer slot in the round's black card. */
    cards: WhiteCard[]
    locked?: boolean
}

export interface CardSelector {
    player: string | null
    selectedCard: PlayerSelectedCardEntry | Record<string, never>
}
