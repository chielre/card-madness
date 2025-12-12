import { defineStore } from 'pinia'
import { useConnectionStore } from './ConnectionStore'

export const useLobbyStore = defineStore('lobby', {
    state: () => ({
        lobbyId: '',
        players: [] as { id: string; name: string }[],
        selectedPacks: [] as string[],
        host: '' as string,
    }),

    actions: {
        async createLobby(name: string) {
            const conn = useConnectionStore()

            const { lobbyId, selectedPacks, host } = await conn.emitWithAck<{ lobbyId: string; selectedPacks: string[]; host: string }>('room:create', { name })
            this.lobbyId = lobbyId
            this.selectedPacks = selectedPacks
            this.host = host

        },

        async joinLobby(code: string, name: string) {

            const conn = useConnectionStore()
            const res = await conn.emitWithAck<{
                lobbyId: string
                players?: { id: string; name: string }[]
                error?: string
                selectedPacks?: string[]
                host?: string
            }>(
                'room:join',
                { roomId: code, name }
            )
            if (res.error) return res

            this.lobbyId = res.lobbyId
            this.players = res.players ?? []
            this.selectedPacks = res.selectedPacks ?? []
            this.host = res.host ?? ''

            return res
        },

        async fetchState(roomId: string) {
            const conn = useConnectionStore()
            const res = await conn.emitWithAck<{
                lobbyId: string
                players?: { id: string; name: string }[]
                error?: string
                selectedPacks?: string[]
                host?: string
            }>('room:state', { roomId })

            if (res.error) return res

            this.lobbyId = res.lobbyId
            this.players = res.players ?? []
            this.selectedPacks = res.selectedPacks ?? []
            this.host = res.host ?? ''
            return res
        },

        addPlayer(player: { id: string; name: string }) {
            if (!this.players.find((p) => p.id === player.id)) {
                this.players.push(player)
            }
        },

        removePlayer(id: string) {
            this.players = this.players.filter((p) => p.id !== id)
        },

        async leaveLobby(roomId: string) {
            const conn = useConnectionStore()
            const res = await conn.emitWithAck<{ ok?: boolean; error?: string }>('room:leave', { roomId })
            if (!res.error) {
                this.players = this.players.filter((p) => p.id !== conn.getSocketSafe()?.id)
            }
            return res
        },

        async setSelectedPacks(roomId: string, packs: string[]) {
            const conn = useConnectionStore()
            this.selectedPacks = packs
            const socket = await conn.ensureSocket()
            socket.emit('packs:update', { roomId, packs })
        },

        
    },
})
