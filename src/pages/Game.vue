<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useConnectionStore } from '@/store/ConnectionStore'
import { useLobbyStore } from '@/store/LobbyStore'
import { useAudioStore } from '@/store/AudioStore'
import { useUiStore } from '@/store/UiStore'

// Screens (optioneel te gebruiken)
import JoinScreen from '@/components/screens/Join.vue'
import GameRoomScreen from '@/components/screens/GameRoom.vue'


const route = useRoute()
const router = useRouter()
const connection = useConnectionStore()
const lobby = useLobbyStore()
const audio = useAudioStore()
const ui = useUiStore()

const nameInput = ref('')
const isLoading = ref(true)
const errorMessage = ref('')


let readyMap = new Map<string, boolean>()
let readyMapInitialized = false

let socket = connection.getSocketSafe()

const lobbyId = route.params.id as string

const players = computed(() => lobby.players)
const hasJoined = computed(() => {
    if (!socket) return false
    return !!players.value.find((p) => p.id === socket?.id)
})

const normalizePlayers = (playerList: { id: string; name: string; ready?: boolean; points?: number }[]) =>
    playerList.map((p) => ({ ...p, ready: !!p.ready, points: Number(p.points) || 0 }))

const roomNotFound = () => {
    return router.replace({
        name: 'main',
        state: { error: 'room_not_found' }
    })
}

const updateReadyMap = (players: { id: string; ready?: boolean }[]) => {
    readyMap = new Map(players.map((p) => [p.id, !!p.ready]))
    readyMapInitialized = true
}

const loadPlayers = async () => {
    try {
        socket = await connection.ensureSocket()
        const res = await lobby.fetchState(lobbyId)
        if (res?.error === 'not_found') return roomNotFound()
        updateReadyMap(lobby.players)
    } catch (e) {
        errorMessage.value = e instanceof Error ? e.message : 'Kon spelers niet laden'
    } finally {
        isLoading.value = false
    }
}

const joinWithName = async () => {
    if (!nameInput.value.trim()) return
    try {
        const res = await lobby.joinLobby(lobbyId, nameInput.value.trim())
        if ((res as any)?.error === 'not_found') return roomNotFound()
        if ((res as any)?.error === 'name_too_long') {
            errorMessage.value = 'Naam mag maximaal 25 tekens zijn.'
            return
        }
        errorMessage.value = ''
    } catch (e) {
        errorMessage.value = e instanceof Error ? e.message : 'Kon niet joinen'
    }
}

/*-----------------------------------
Game room events
*/
const handlePacksUpdated = (payload: { packs: string[] }) => {
    lobby.selectedPacks = payload.packs
}
const handlePlayersUpdated = (payload: { id: string; players: { id: string; name: string; ready?: boolean }[] }) => {
    if (payload.players) {
        const nextPlayers = normalizePlayers(payload.players)
        if (!readyMapInitialized) {
            updateReadyMap(nextPlayers)
        } else {
            nextPlayers.forEach((player) => {
                const wasReady = readyMap.get(player.id) ?? false
                const isReady = !!player.ready
                if (!wasReady && isReady) {
                    audio.playReadySwoosh()
                }
            })
            updateReadyMap(nextPlayers)
        }
        lobby.players = nextPlayers
    }
}

const handleRoomHostUpdated = (payload: { hostId: string }) => {
    lobby.host = payload.hostId
}

const handleRoomKicked = (payload: { lobbyId?: string }) => {
    if (payload?.lobbyId && payload.lobbyId !== lobbyId) return
    ui.confirmAction({
        title: 'Je bent gekickt',
        message: 'De lobby host heeft je gekickt. Je kan niet meer verder spelen.',
        confirmText: 'Ok',
        cancelText: 'Sluiten',
    })
    router.replace({ name: 'main' })
}

/*-----------------------------------
Game player events
*/
const handlePlayerReady = (payload: { id: string; ready: boolean }) => {
    lobby.updatePlayer(payload.id, { ready: payload.ready })


}
const handlePlayerJoined = (payload: { id: string; name: string; ready?: boolean; points?: number }) => {
    lobby.addPlayer(payload)

}
const handlePlayerLeft = (payload: { id: string; players?: { id: string; name: string; ready?: boolean }[] }) => {
    if (payload.players) {
        lobby.players = normalizePlayers(payload.players)
    } else {
        lobby.removePlayer(payload.id)

    }
}



/*-----------------------------------
Game socket events
*/

const handleGamePhaseChange = (payload: { phase: string }) => {
    if (payload.phase) {
        lobby.setPhase(payload.phase)
    }
}
const handleGamePhaseTimer = (payload: { phase: string; durationMs?: number; expiresAt?: number }) => {
    if (!payload?.phase) return
    lobby.setPhaseTimer(payload.phase, payload.durationMs, payload.expiresAt)
}
const handleGamePhaseTimeout = (payload: { phase: string }) => {
    if (payload.phase) {
        lobby.markPhaseTimeout()
    }

}


/*-----------------------------------
Board socket events
*/

const handleBoardRoundUpdated = (payload: { currentRound: any; roundNumber?: number | null }) => {
    lobby.setCurrentRound(payload.currentRound)
    if (payload.roundNumber === null) lobby.setCurrentRoundNumber(null)
    else if (typeof payload.roundNumber === 'number') lobby.setCurrentRoundNumber(payload.roundNumber)
}

const handleBoardRoundStarted = (payload: { currentRound: any; roundNumber?: number | null; durationMs?: number; expiresAt?: number }) => {
    lobby.setCurrentRound(payload.currentRound)
    if (payload.roundNumber === null) lobby.setCurrentRoundNumber(null)
    else if (typeof payload.roundNumber === 'number') lobby.setCurrentRoundNumber(payload.roundNumber)
    lobby.setRoundTimer(payload.durationMs, payload.expiresAt)
    lobby.markRoundStarted()
    audio.playRoundLoop()
}

const handleBoardRoundTimeout = (payload: { round: string }) => {
    if (payload.round) {
        lobby.markRoundTimeout()
    }

}

const handleBoardPlayerCardSelected = (payload: { playerId: string; card?: any; sync?: boolean }) => {
    lobby.recordPlayerSelectedCard(payload)
}

const handleBoardPlayerCardUnselected = (payload: { playerId: string; card?: any }) => {
    lobby.recordPlayerUnselectedCard(payload)
}

const handleBoardPlayerCardLocked = (payload: { playerId: string }) => {
    lobby.recordPlayerCardLocked(payload)
}
const handleBoardPlayerCardLockBoost = (payload: { playerId: string; selectionLockDurationMs?: number; selectionLockExpiresAt?: number }) => {
    lobby.recordSelectionLockBoost(payload)
}
const handleCzarCursorUpdate = (payload: { playerId?: string; x: number; y: number; visible?: boolean }) => {
    lobby.recordCzarCursor(payload)
}


/*-----------------------------------
Player socket updates
*/
const handlePlayerCardsUpdated = (payload: { cards: any }) => {
    lobby.setCurrentPlayerCards(payload.cards)
}


onMounted(async () => {
    await loadPlayers()
    if (!socket) return
    socket.on('room:player-joined', handlePlayerJoined)
    socket.on('room:player-left', handlePlayerLeft)
    socket.on('room:player-ready', handlePlayerReady)
    socket.on('room:player-cards-updated', handlePlayerCardsUpdated)

    socket.on('room:players-changed', handlePlayersUpdated)
    socket.on('room:phase-changed', handleGamePhaseChange)
    socket.on('room:phase-timer', handleGamePhaseTimer)
    socket.on('room:phase-timeout', handleGamePhaseTimeout)
    socket.on('room:kicked', handleRoomKicked)

    socket.on('packs:updated', handlePacksUpdated)

    socket.on('board:round-updated', handleBoardRoundUpdated)
    socket.on('board:round-started', handleBoardRoundStarted)
    socket.on('board:round-timeout', handleBoardRoundTimeout)
    socket.on('board:player-card-selected', handleBoardPlayerCardSelected)
    socket.on('board:player-card-unselected', handleBoardPlayerCardUnselected)
    socket.on('board:player-card-locked', handleBoardPlayerCardLocked)
    socket.on('board:player-card-lock-boost', handleBoardPlayerCardLockBoost)
    socket.on('czar:cursor-update', handleCzarCursorUpdate)


})

onBeforeUnmount(() => {
    // laat de server weten dat we de lobby verlaten als we weg navigeren
    lobby.leaveLobby(lobbyId)

    if (!socket) return
    socket.off('room:player-joined', handlePlayerJoined)
    socket.off('room:player-left', handlePlayerLeft)
    socket.off('room:player-ready', handlePlayerReady)
    socket.off('player:player-cards-updated', handlePlayerCardsUpdated)

    socket.off('room:players-changed', handlePlayersUpdated)
    socket.off('room:phase-changed', handleGamePhaseChange)
    socket.off('room:phase-timer', handleGamePhaseTimer)
    socket.off('room:phase-timeout', handleGamePhaseTimeout)
    socket.off('room:kicked', handleRoomKicked)

    socket.off('packs:updated', handlePacksUpdated)

    socket.off('board:round-updated', handleBoardRoundUpdated)
    socket.off('board:round-started', handleBoardRoundStarted)
    socket.off('board:player-card-selected', handleBoardPlayerCardSelected)
    socket.off('board:player-card-unselected', handleBoardPlayerCardUnselected)
    socket.off('board:player-card-locked', handleBoardPlayerCardLocked)
    socket.off('board:player-card-lock-boost', handleBoardPlayerCardLockBoost)
    socket.off('czar:cursor-update', handleCzarCursorUpdate)
})

watch(
    () => lobby.pendingSelectedCardTick,
    (tick) => {
        if (!tick || !socket) return
        const card = lobby.pendingSelectedCard
        if (!card) return
        socket.emit('player:card-selected', { lobbyId, card })
        lobby.clearPendingSelectedCard()
    }
)

watch(
    () => lobby.pendingUnselectedCardTick,
    (tick) => {
        if (!tick || !socket) return
        const card = lobby.pendingUnselectedCard
        if (!card) return
        socket.emit('player:card-unselected', { lobbyId, card })
        lobby.clearPendingUnselectedCard()
    }
)

watch(
    () => lobby.pendingCzarSelectedTick,
    (tick) => {
        if (!tick || !socket) return
        const entry = lobby.pendingCzarSelectedEntry
        if (!entry) return
        socket.emit('czar:card-selected', { lobbyId, entry })
        lobby.clearPendingCzarSelectedEntry()
    }
)
</script>

<template>
    <div class="page-main min-h-screen flex justify-center items-center px-8">
        <div class="w-[1920px]">

            <div class="bg-noise"></div>
            <div class="bg-grid"></div>

            <JoinScreen v-if="!hasJoined && !isLoading" :lobby-id="lobbyId" v-model:name-input="nameInput" :error-message="errorMessage" :players="players" @join="joinWithName" />

            <GameRoomScreen v-else-if="hasJoined && !isLoading" />
        </div>
    </div>
</template>
