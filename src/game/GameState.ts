import {
    Player,
    PlayerId,
    Card,
    CardId,
    RoundState,
    GamePhase,
    GameConfig,
} from './types'

export class GameState {
    readonly id: string
    readonly config: GameConfig

    constructor(id: string, config?: Partial<GameConfig>) {
        this.id = id

        this.config = {
            handSize: config?.handSize ?? 7,
            minPlayersToStart: config?.minPlayersToStart ?? 3,
            maxScore: config?.maxScore,
        }


    }

}
