<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useConnectionStore } from '@/store/ConnectionStore'
import { useLobbyStore } from '@/store/LobbyStore'
import { useAudioStore } from '@/store/AudioStore'

// Screens (optioneel te gebruiken)
import JoinScreen from '@/components/screens/game/Join.vue'
import GameRoomScreen from '@/components/screens/game/GameRoom.vue'


const route = useRoute()
const router = useRouter()
const connection = useConnectionStore()
const lobby = useLobbyStore()
const audio = useAudioStore()

const nameInput = ref('')
const isLoading = ref(true)
const errorMessage = ref('')


let readyMap = new Map<string, boolean>()
let readyMapInitialized = false

let socket = connection.getSocketSafe()

const roomId = route.params.id as string

const players = computed(() => lobby.players)
const hasJoined = computed(() => {
    if (!socket) return false
    return !!players.value.find((p) => p.id === socket?.id)
})

const normalizePlayers = (playerList: { id: string; name: string; ready?: boolean }[]) => playerList.map((p) => ({ ...p, ready: !!p.ready }))

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
        const res = await lobby.fetchState(roomId)
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
        const res = await lobby.joinLobby(roomId, nameInput.value.trim())
        if ((res as any)?.error === 'not_found') return roomNotFound()
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
    console.log(`New lobby host: ${payload.hostId}`);
}


/*-----------------------------------
Game player events
*/
const handlePlayerReady = (payload: { id: string; ready: boolean }) => {
    lobby.updatePlayer(payload.id, { ready: payload.ready })
    console.log(`Player ready: ${payload.id}`);


}
const handlePlayerJoined = (payload: { id: string; name: string; ready?: boolean }) => {
    lobby.addPlayer(payload)
    console.log(`New player joined: ${payload.name}`);

}
const handlePlayerLeft = (payload: { id: string; players?: { id: string; name: string; ready?: boolean }[] }) => {
    if (payload.players) {
        lobby.players = normalizePlayers(payload.players)
    } else {
        lobby.removePlayer(payload.id)
        console.log(`Player left: ${payload.id}`);

    }
}



/*-----------------------------------
Game socket events
*/

const handleGamePhaseChange = (payload: { phase: string }) => {
    if (payload.phase) {
        lobby.setPhase(payload.phase)
    }
    console.log(`New game phase: ${payload.phase}`);
}
const handleGamePhaseTimeout = (payload: { phase: string }) => {
    if (payload.phase) {
        lobby.markPhaseTimeout()
    }
    console.log(`Phase timeout: ${payload.phase}`);

}



onMounted(async () => {
    await loadPlayers()
    if (!socket) return
    socket.on('room:player-joined', handlePlayerJoined)
    socket.on('room:player-left', handlePlayerLeft)
    socket.on('room:player-ready', handlePlayerReady)
    socket.on('room:players-changed', handlePlayersUpdated)
    socket.on('room:phase-changed', handleGamePhaseChange)
    socket.on('room:phase-timeout', handleGamePhaseTimeout)

    socket.on('packs:updated', handlePacksUpdated)
})

onBeforeUnmount(() => {
    // laat de server weten dat we de lobby verlaten als we weg navigeren
    lobby.leaveLobby(roomId)

    if (!socket) return
    socket.off('room:player-joined', handlePlayerJoined)
    socket.off('room:player-left', handlePlayerLeft)
    socket.off('room:player-ready', handlePlayerReady)
    socket.off('room:players-changed', handlePlayersUpdated)
    socket.off('room:phase-changed', handleGamePhaseChange)
    socket.off('room:phase-timeout', handleGamePhaseTimeout)
    socket.off('packs:updated', handlePacksUpdated)
})
</script>

<template>
    <div class="page-main min-h-screen flex justify-center items-center px-8">
        <div class="w-[1920px]">

            <div class="bg-noise"></div>
            <div class="bg-grid"></div>

            <JoinScreen v-if="!hasJoined && !isLoading" :room-id="roomId" v-model:name-input="nameInput" :error-message="errorMessage" :players="players" @join="joinWithName" />



            <GameRoomScreen v-else-if="hasJoined && !isLoading" />
        </div>
    </div>
</template>
