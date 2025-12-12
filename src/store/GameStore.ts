// store/gameStore.ts (client)
import { defineStore } from 'pinia'
import {
    Player,
    PlayerId,
    Card,
    CardId,
    RoundState,
    GamePhase,
    GameConfig,
} from '@/game/types'

export const useGameStore = defineStore('game', {
    state: () => ({
        id: '' as string,
        phase: 'lobby' as GamePhase,
        players: [] as Player[],
        currentRound: null as RoundState | null,
    }),
    actions: {
        patchFromServer(payload: any) {
            this.id = payload.id
            this.phase = payload.phase
            this.players = payload.players
            this.currentRound = payload.currentRound
        },
    },
})
