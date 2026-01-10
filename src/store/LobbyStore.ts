import { defineStore } from 'pinia'
import { useConnectionStore } from './ConnectionStore'

type Player = { id: string; name: string; ready?: boolean }

const normalizePlayer = (player: Player) => ({
    ...player,
    ready: !!player.ready,
})

export const useLobbyStore = defineStore('lobby', {
    state: () => ({
        lobbyId: '',
        players: [] as { id: string; name: string; ready: boolean }[],
        selectedPacks: [] as string[],
        host: '' as string,
        phase: 'lobby' as string,
        phaseTimeoutTick: 0,
    }),

    actions: {

        addPlayer(player: Player) {
            if (!this.players.find((p) => p.id === player.id)) {
                this.players.push(normalizePlayer(player))
            }
        },

        removePlayer(id: string) {
            this.players = this.players.filter((p) => p.id !== id)
        },

        updatePlayer(id: string, data: Partial<{ name: string; ready: boolean }>) {
            const player = this.players.find(p => p.id === id)
            if (!player) return

            Object.assign(player, data)
        },

        setPhase(phase: string) {
            this.phase = phase
        },

        async createLobby(hostName: string, language?: string) {
            const conn = useConnectionStore()
            const { lobbyId, selectedPacks } = await conn.emitWithAck<{ lobbyId: string; selectedPacks: string[] }>('room:create', { hostName, language })

            this.lobbyId = lobbyId
            this.selectedPacks = selectedPacks
        },

        async joinLobby(code: string, name: string, language?: string) {

            const conn = useConnectionStore()
            const res = await conn.emitWithAck<{
                lobbyId: string
                players?: Player[]
                error?: string
                selectedPacks?: string[]
                host?: string
            }>(
                'room:join',
                { roomId: code, name, language }
            )
            if (res.error) return res

            this.lobbyId = res.lobbyId
            this.players = (res.players ?? []).map(normalizePlayer)
            this.selectedPacks = res.selectedPacks ?? []
            this.host = res.host ?? ''

            return res
        },

        async fetchState(roomId: string) {
            const conn = useConnectionStore()
            const res = await conn.emitWithAck<{
                lobbyId: string
                players?: Player[]
                error?: string
                selectedPacks?: string[]
                host?: string
            }>('room:state', { roomId })

            if (res.error) return res

            this.lobbyId = res.lobbyId
            this.players = (res.players ?? []).map(normalizePlayer)
            this.selectedPacks = res.selectedPacks ?? []
            this.host = res.host ?? ''
            return res
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

        async setReady(roomId: string, ready = true) {
            const conn = useConnectionStore()
            const res = await conn.emitWithAck<{ ok?: boolean; error?: string }>('player:ready', {
                roomId,
                ready,
            })

            if (!res.error) {
                const socketId = conn.getSocketSafe()?.id
                if (socketId) {
                    this.updatePlayer(socketId, { ready })
                }
            }

            return res
        },

        getCurrentPlayer() {
            const conn = useConnectionStore()
            const socketId = conn.getSocketSafe()?.id
            if (!socketId) return null

            return this.players.find((p) => p.id === socketId) ?? null
        },

        getCurrentPlayerIsHost(): boolean {
            const conn = useConnectionStore()
            const socketId = conn.getSocketSafe()?.id
            if (!socketId) return false

            return socketId === this.host
        },

        getCurrentPlayerOrFail() {
            if (!this.getCurrentPlayer()) {
                throw new Error('Current player is not set')
            }
            return this.getCurrentPlayer()
        },

        markPhaseTimeout() {
            this.phaseTimeoutTick += 1
        }

    },
})
