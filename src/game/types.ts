// --- Identifiers ------------------------------------------------------------

export type PlayerId = string
export type CardId = string

// --- Cards ------------------------------------------------------------------

export type CardType = 'prompt' | 'answer'

export interface Card {
  id: CardId
  text: string
  type: CardType
}

// --- Players ----------------------------------------------------------------

export interface Player {
  id: PlayerId
  name: string
  hand: CardId[]
  score: number
  isCzar: boolean
  connected: boolean
}

// --- Game phases ------------------------------------------------------------

export type GamePhase =
  | 'lobby'
  | 'dealing'
  | 'submitting'
  | 'judging'
  | 'round_result'
  | 'finished'

// --- Rounds -----------------------------------------------------------------

export interface RoundState {
  roundNumber: number
  promptCardId: CardId | null
  czarId: PlayerId | null
  submissions: Record<PlayerId, CardId>
  winnerPlayerId?: PlayerId
}

// --- Game configuration -----------------------------------------------------

export interface GameConfig {
  handSize: number
  minPlayersToStart: number
  maxScore?: number
}
