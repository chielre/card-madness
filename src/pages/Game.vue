<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useConnectionStore } from '@/store/ConnectionStore'
import { useLobbyStore } from '@/store/LobbyStore'

// Screens (optioneel te gebruiken)
import JoinScreen from '@/components/screens/game/Join.vue'
import PlayerListScreen from '@/components/screens/game/PlayerList.vue'

const route = useRoute()
const router = useRouter()
const connection = useConnectionStore()
const lobby = useLobbyStore()

const nameInput = ref('')
const isLoading = ref(true)
const errorMessage = ref('')
let socket = connection.getSocketSafe()

const roomId = route.params.id as string
const players = computed(() => lobby.players)
const hasJoined = computed(() => {
    if (!socket) return false
    return !!players.value.find((p) => p.id === socket.id)
})

const goToError = () => router.replace({ name: 'error', query: { reason: 'room_not_found' } })

const handlePlayerJoined = (payload: { id: string; name: string }) => {
    lobby.addPlayer(payload)
}

const handlePlayerLeft = (payload: { id: string; players?: { id: string; name: string }[] }) => {
    if (payload.players) {
        lobby.players = payload.players
    } else {
        lobby.removePlayer(payload.id)
    }
}

const loadPlayers = async () => {
    try {
        socket = await connection.ensureSocket()
        const res = await lobby.fetchState(roomId)
        if (res?.error === 'not_found') return goToError()
    } catch (e) {
        errorMessage.value = e instanceof Error ? e.message : 'Kon spelers niet laden'
    } finally {
        isLoading.value = false
    }
}

const joinWithName = async () => {
    if (!nameInput.value.trim()) return
    try {
        const res = await lobby.joinLobby(roomId, nameInput.value.trim())
        if ((res as any)?.error === 'not_found') return goToError()
    } catch (e) {
        errorMessage.value = e instanceof Error ? e.message : 'Kon niet joinen'
    }
}

const handlePacksUpdated = (payload: { packs: string[] }) => {
    lobby.selectedPacks = payload.packs
}
const handleRoomHostChanged = (payload: { hostId: string }) => {
    lobby.host = payload.hostId
}


onMounted(async () => {
    await loadPlayers()
    if (!socket) return
    socket.on('room:player-joined', handlePlayerJoined)
    socket.on('room:player-left', handlePlayerLeft)
    socket.on('room:host-changed', handleRoomHostChanged)

    socket.on('packs:updated', handlePacksUpdated)
})

onBeforeUnmount(() => {
    // laat de server weten dat we de lobby verlaten als we weg navigeren
    lobby.leaveLobby(roomId)
    if (!socket) return
    socket.off('room:player-joined', handlePlayerJoined)
    socket.off('room:player-left', handlePlayerLeft)
    socket.off('packs:updated', handlePacksUpdated)
})
</script>

<template>
    <div class="page-main min-h-screen flex justify-center items-center">
        <div class="max-w-3/4">

            <div class="bg-noise"></div>
            <div class="bg-grid"></div>

            <JoinScreen v-if="!hasJoined && !isLoading" :room-id="roomId" v-model:name-input="nameInput" :error-message="errorMessage" :players="players" @join="joinWithName" />

            <PlayerListScreen v-if="hasJoined && !isLoading" :players="players" />
        </div>
    </div>
</template>
