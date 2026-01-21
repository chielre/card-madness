import { defineStore } from 'pinia'
import { useConnectionStore } from './ConnectionStore'
import { resolveBlackCard, resolveWhiteCards } from "@/utils/cards"
import router from '@/router'
import { useUiStore } from './UiStore'

type WhiteCard = {
    pack: string,
    card_id: number,
    name?: string,
    names?: string[],
    text?: string,
}

type Player = {
    id: string
    name: string,
    language?: string,
    white_cards: WhiteCard[],
    ready?: boolean
    eligibleFromRound?: number
    points?: number
}

type RoundState = {
    cardSelector: {
        player: string | null
        selectedCard: any
    }
    blackCard: any
    playerSelectedCards: { playerId: string; card?: WhiteCard | null; locked?: boolean }[]
}

export type SelectedCardEntry = {
    playerId: string
    card?: WhiteCard | null
    locked?: boolean
    resolved?: { text?: string }
}

type Game = {
    lobbyId: string,
    host: string,
    players: Player[],
    phase: string,
    selectedPacks: [],
    config?: {
        lockBoostCooldownMs?: number,
    },
    currentRound?: RoundState | null,
    currentRoundNumber?: number,
    phaseTimerPhase?: string,
    phaseTimerDurationMs?: number,
    phaseTimerExpiresAt?: number,
    roundTimerDurationMs?: number,
    roundTimerExpiresAt?: number,
    error?: string
}

const normalizePlayer = (player: Player) => ({
    ...player,
    ready: !!player.ready,
    points: Number(player.points) || 0,
})

export const useLobbyStore = defineStore('lobby', {
    state: () => ({
        lobbyId: '',
        players: [] as Player[],
        selectedPacks: [] as string[],
        host: '' as string,
        phase: 'lobby' as string,
        phaseTimeoutTick: 0,
        phaseTimerPhase: '',
        phaseTimerDurationMs: 0,
        phaseTimerExpiresAt: 0,
        currentRound: null as RoundState | null,
        currentRoundNumber: 0,
        roundStartedTick: 0,
        roundTimerDurationMs: 0,
        roundTimerExpiresAt: 0,
        roundTimeoutTick: 0,
        pendingSelectedCard: null as WhiteCard | null,
        pendingSelectedCardTick: 0,
        pendingUnselectedCard: null as WhiteCard | null,
        pendingUnselectedCardTick: 0,
        pendingCzarSelectedEntry: null as { playerId: string; card: WhiteCard } | null,
        pendingCzarSelectedTick: 0,
        lastSelectedCard: null as { playerId: string; card?: WhiteCard | null; action: 'selected' | 'unselected'; sync?: boolean } | null,
        selectedCardAnimTick: 0,
        selectionLockDurationMs: 10000,
        selectionLockExpiresAt: 0,
        lastSelectionLockBoost: null as { playerId: string; selectionLockDurationMs?: number; selectionLockExpiresAt?: number } | null,
        selectionLockBoostTick: 0,
        czarCursor: null as { playerId?: string; x: number; y: number; visible?: boolean } | null,
        czarCursorTick: 0,
        config: {
            lockBoostCooldownMs: 120,
        },
        lockBoostLastAt: new Map<string, number>()

    }),

    actions: {
        getCurrentSocketId(): string | null {
            return useConnectionStore().getSocketSafe()?.id ?? null
        },
        getCurrentPlayer(): Player | null {
            const conn = useConnectionStore()
            const socketId = conn.getSocketSafe()?.id
            if (!socketId) return null

            return this.getPlayer(socketId) ?? null
        },
        getCurrentPlayerId(): string | null {
            return this.getCurrentSocketId()
        },
        getCurrentPlayerOrFail(): Player | Error {
            const player = this.getCurrentPlayer()
            if (!player) throw new Error('Current player is not set')

            return player
        },
        getCurrentPlayerWhiteCards(): WhiteCard[] {
            const player = this.getCurrentPlayer();
            if (!player) return []

            return resolveWhiteCards(player.white_cards ?? [])
        },
        getCurrentPlayerWhiteCard(pack: string, cardId: number | string): WhiteCard | null {
            return this.getCurrentPlayerWhiteCards()
                .find(c => c.pack === pack && String(c.card_id) === String(cardId)) ?? null
        },
        getCurrentPlayerIsHost(): boolean {
            const socketId = this.getCurrentSocketId()
            if (!socketId) return false

            return socketId === this.host
        },
        isCurrentPlayerWaitingForRound(): boolean {
            const p = this.getCurrentPlayer()
            if (!p || !this.currentRoundNumber) return false
            if (!['board', 'czar'].includes(this.phase)) return false
            const eligibleFromRound = Number(p.eligibleFromRound) || 1
            return eligibleFromRound > this.currentRoundNumber
        },
        isCurrentPlayerEligibleForRound(): boolean {
            return !this.isCurrentPlayerWaitingForRound()
        },
        getCurrentCzar(): Player | null {
            const id = this.currentRound?.cardSelector?.player
            if (!id) return null

            return this.players.find(p => p.id === id) ?? null
        },
        canCurrentPlayerPlayCard(): boolean {
            return this.phase === 'board'
                && !this.getCurrentPlayerIsCzar()
                && !this.isCurrentPlayerWaitingForRound()
        },
        canCurrentPlayerKickPlayer(playerId: string) {
            return this.getCurrentPlayerIsHost() && playerId !== this.getCurrentPlayerId()
        },
        isPlayerCzar(playerId: string): boolean {
            return playerId === this.currentRound?.cardSelector?.player
        },
        getCurrentPlayerIsCzar(): boolean {
            const socketId = this.getCurrentSocketId()
            if (!socketId) return false

            return this.isPlayerCzar(socketId)
        },

        addPlayer(player: Player) {
            if (this.playerExists(player.id)) return;

            this.players.push(normalizePlayer(player))
        },
        removePlayer(id: string) {
            if (!this.playerExists(id)) return;

            this.players = this.players.filter((p) => p.id !== id)
        },
        updatePlayer(id: string, data: Partial<{ name: string; ready: boolean; points: number }>) {
            const player = this.getPlayer(id)
            if (!player) return

            Object.assign(player, data)
        },

        getPlayer(id: string): Player | null {
            return this.players.find(p => p.id === id) ?? null
        },
        playerExists(id: string): boolean {
            return this.getPlayer(id) !== null
        },
        setPhase(phase: string) {
            this.phase = phase
        },
        async createLobby(hostName: string, language?: string) {
            const conn = useConnectionStore()
            const res = await conn.emitWithAck<{ lobbyId?: string; selectedPacks?: string[]; error?: string }>('room:create', { hostName, language })
            if (res?.error) return res

            this.lobbyId = res.lobbyId ?? ''
            this.selectedPacks = res.selectedPacks ?? []
            return res
        },

        applyServerState(res: Game) {
            if (!res) return
            this.lobbyId = res.lobbyId ?? this.lobbyId
            this.players = (res.players ?? []).map(normalizePlayer)
            this.selectedPacks = res.selectedPacks ?? []
            this.host = res.host ?? ''
            this.phase = res.phase ?? this.phase
            if (res.config?.lockBoostCooldownMs != null) {
                this.config.lockBoostCooldownMs = res.config.lockBoostCooldownMs
            }

            if (typeof res.currentRoundNumber === 'number') {
                this.currentRoundNumber = res.currentRoundNumber
            }
            if (res.currentRound !== undefined) {
                this.currentRound = res.currentRound ?? null
            }

            if (res.phaseTimerPhase !== undefined || res.phaseTimerDurationMs !== undefined || res.phaseTimerExpiresAt !== undefined) {
                this.setPhaseTimer(res.phaseTimerPhase, res.phaseTimerDurationMs, res.phaseTimerExpiresAt)
            }
            if (res.roundTimerDurationMs !== undefined || res.roundTimerExpiresAt !== undefined) {
                this.setRoundTimer(res.roundTimerDurationMs, res.roundTimerExpiresAt)
            }

            if (
                this.roundStartedTick === 0
                && this.currentRoundNumber > 0
                && ['board', 'czar', 'czar-result'].includes(this.phase)
            ) {
                this.markRoundStarted()
            }
        },

        async joinLobby(code: string, name: string, language?: string) {
            const conn = useConnectionStore()
            const res = await conn.emitWithAck<Game>('room:join', { lobbyId: code, name, language })
            if (res.error) return res

            this.applyServerState(res)
            return res
        },

        async fetchState(lobbyId: string) {
            const conn = useConnectionStore()
            const res = await conn.emitWithAck<Game>('room:state', { lobbyId })
            if (res.error) return res

            this.applyServerState(res)
            return res
        },



        async leaveLobby(lobbyId: string) {
            const conn = useConnectionStore()
            const res = await conn.emitWithAck<{ ok?: boolean; error?: string }>('room:leave', { lobbyId })
            if (!res.error) {
                this.players = this.players.filter((p) => p.id !== conn.getSocketSafe()?.id)
            }
            return res
        },
        async confirmLeaveLobby() {
            const ui = useUiStore()
            const confirmed = await ui.confirmActionAsync({
                title: 'Lobby verlaten?',
                message: 'Weet je zeker dat je de lobby wilt verlaten?',
                confirmText: 'Verlaten',
                cancelText: 'Blijven',
                destructive: true,
            })

            if (!confirmed) return false

            if (this.lobbyId) {
                await this.leaveLobby(this.lobbyId)
            }
            router.replace({ name: 'main' })
            return true
        },

        async kickPlayer(lobbyId: string, playerId: string) {
            const conn = useConnectionStore()
            return conn.emitWithAck<{ ok?: boolean; error?: string }>('room:kick', { lobbyId, playerId })
        },

        async setSelectedPacks(lobbyId: string, packs: string[]) {
            const conn = useConnectionStore()
            this.selectedPacks = packs
            const socket = await conn.ensureSocket()
            socket.emit('packs:update', { lobbyId, packs })
        },

        async setReady(lobbyId: string, ready = true) {
            const conn = useConnectionStore()
            const res = await conn.emitWithAck<{ ok?: boolean; error?: string }>('player:ready', {
                lobbyId,
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



        getCurrentBlackCardHtml(): string | null {
            const blackCard = this.currentRound?.blackCard
            if (!blackCard) return null
            const selectedEntry = this.currentRound?.cardSelector?.selectedCard
            try {
                let answerHtml: string | undefined
                if (selectedEntry?.card) {
                    const resolved = resolveWhiteCards([selectedEntry.card])
                    answerHtml = resolved[0]?.text
                }
                return resolveBlackCard(blackCard, answerHtml).text
            } catch {
                return null
            }
        },

        getSelectedEntriesForBoard(): SelectedCardEntry[] {
            const entries = this.phase === 'czar'
                ? (this.currentRound?.playerSelectedCards ?? [])
                : (this.currentRound?.playerSelectedCards ?? []).filter(
                    (entry) => entry.playerId !== this.getCurrentPlayer()?.id
                )

            if (!entries.length) return []
            if (this.phase !== 'czar') return entries.map((entry) => ({ ...entry, resolved: null }))

            if (entries.some((entry) => !entry.card)) {
                return entries.map((entry) => ({ ...entry, resolved: null }))
            }

            const resolved = resolveWhiteCards(entries.map((entry) => entry.card as WhiteCard))
            return entries.map((entry, idx) => ({ ...entry, resolved: resolved[idx] }))
        },

        getSelectedEntryForPlayerId(playerId: string | null): SelectedCardEntry | null {
            if (!playerId) return null
            return this.getSelectedEntriesForBoard().find((entry) => entry.playerId === playerId) ?? null
        },



        markPhaseTimeout() {
            this.phaseTimeoutTick += 1
        },

        setPhaseTimer(phase?: string, durationMs?: number, expiresAt?: number) {
            this.phaseTimerPhase = phase ?? ''
            this.phaseTimerDurationMs = durationMs ?? 0
            this.phaseTimerExpiresAt = expiresAt ?? 0
        },

        setCurrentRound(round: RoundState | null) {
            this.currentRound = round
        },

        setCurrentRoundNumber(roundNumber?: number | null) {
            if (typeof roundNumber === 'number') {
                this.currentRoundNumber = roundNumber
            } else if (roundNumber === null) {
                this.currentRoundNumber = 0
            }
        },

        setRoundTimer(durationMs?: number, expiresAt?: number) {
            this.roundTimerDurationMs = durationMs ?? 0
            this.roundTimerExpiresAt = expiresAt ?? 0
        },

        markRoundStarted() {
            this.roundStartedTick += 1
        },

        markRoundTimeout() {
            this.roundTimeoutTick += 1
        },


        setCurrentPlayerCards(cards: WhiteCard[]) {
            const player = this.getCurrentPlayer()
            if (!player) return
            player.white_cards = cards ?? []
        },

        queueSelectedCard(card: WhiteCard) {
            this.pendingSelectedCard = card
            this.pendingSelectedCardTick += 1
        },

        queueUnselectedCard(card: WhiteCard) {
            this.pendingUnselectedCard = card
            this.pendingUnselectedCardTick += 1
        },

        clearPendingSelectedCard() {
            this.pendingSelectedCard = null
        },

        clearPendingUnselectedCard() {
            this.pendingUnselectedCard = null
        },

        queueCzarSelectedEntry(entry: { playerId: string; card: WhiteCard }) {
            this.pendingCzarSelectedEntry = entry
            this.pendingCzarSelectedTick += 1
        },

        clearPendingCzarSelectedEntry() {
            this.pendingCzarSelectedEntry = null
        },

        recordPlayerSelectedCard(payload: { playerId: string; card?: WhiteCard | null; selectionLockDurationMs?: number; selectionLockExpiresAt?: number; sync?: boolean }) {
            if (this.currentRound) {
                const list = this.currentRound.playerSelectedCards ?? []
                const idx = list.findIndex((c) => c.playerId === payload.playerId)
                const prevCard = idx >= 0 ? list[idx]?.card : null
                const prevLocked = idx >= 0 ? list[idx]?.locked : false
                const nextEntry = { playerId: payload.playerId, card: payload.card ?? prevCard ?? null, locked: prevLocked }
                if (idx >= 0) {
                    list[idx] = nextEntry
                } else {
                    list.push(nextEntry)
                }
                this.currentRound.playerSelectedCards = list
            }
            this.lastSelectedCard = { playerId: payload.playerId, card: payload.card ?? null, action: 'selected', sync: payload.sync }
            this.selectedCardAnimTick += 1
            if (typeof payload.selectionLockDurationMs === 'number') {
                this.selectionLockDurationMs = payload.selectionLockDurationMs
            }
            if (typeof payload.selectionLockExpiresAt === 'number') {
                this.selectionLockExpiresAt = payload.selectionLockExpiresAt
            }
        },

        recordPlayerUnselectedCard(payload: { playerId: string; card?: WhiteCard | null }) {
            if (this.currentRound) {
                const list = this.currentRound.playerSelectedCards ?? []
                const next = list.filter((c) => c.playerId !== payload.playerId)
                this.currentRound.playerSelectedCards = next
            }
            this.lastSelectedCard = { playerId: payload.playerId, card: payload.card ?? null, action: 'unselected' }
            this.selectedCardAnimTick += 1
        },
        recordPlayerCardLocked(payload: { playerId: string }) {
            if (!this.currentRound) return
            const list = this.currentRound.playerSelectedCards ?? []
            const idx = list.findIndex((c) => c.playerId === payload.playerId)
            if (idx < 0) return
            list[idx] = { ...list[idx], locked: true }
            this.currentRound.playerSelectedCards = list
        },
        recordSelectionLockBoost(payload: { playerId: string; selectionLockDurationMs?: number; selectionLockExpiresAt?: number }) {
            this.lastSelectionLockBoost = payload
            this.selectionLockBoostTick += 1
        },
        recordCzarCursor(payload: { playerId?: string; x: number; y: number; visible?: boolean }) {
            this.czarCursor = payload
            this.czarCursorTick += 1
        },
        requestLockBoost(playerId: string) {
            if (!this.lobbyId) return
            if (this.phase !== 'board') return
            if (this.getCurrentPlayerIsCzar()) return

            const now = Date.now()
            const lastBoost = this.lockBoostLastAt.get(playerId) ?? 0
            if (now - lastBoost < (this.config?.lockBoostCooldownMs ?? 0)) return
            this.lockBoostLastAt.set(playerId, now)

            const conn = useConnectionStore()
            const socket = conn.getSocketSafe()
            if (!socket) return
            socket.emit("player:card-lock-boost", { lobbyId: this.lobbyId, playerId })
        },
        async checkLobbyExists(lobbyId: string): Promise<boolean> {
            const code = String(lobbyId ?? '')
            if (!code) return false

            const conn = useConnectionStore()
            const res = await conn.emitWithAck<Game>('room:state', { lobbyId: code })

            if (res?.error) return false

            this.applyServerState(res)
            return true
        },

        goToGame(lobbyId: string) {
            const code = String(lobbyId ?? '')
            return router.push({ name: 'game', params: { id: code } })
        },

    },
})
