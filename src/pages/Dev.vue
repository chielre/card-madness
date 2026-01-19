<script setup lang="ts">
import { computed, onMounted, watch } from "vue"
import { useConnectionStore } from "@/store/ConnectionStore"
import { useLobbyStore } from "@/store/LobbyStore"
import GameRoomScreen from "@/components/screens/Game.vue"

const connection = useConnectionStore()
const lobby = useLobbyStore()

const isDev = computed(() => (import.meta as any).env?.STAGE === "development")

function seedLobby(hostId: string) {
    lobby.lobbyId = "DEV01"
    lobby.host = hostId
    lobby.phase = "lobby"
    lobby.players = [
        { id: hostId, name: "Dev Host", ready: true, white_cards: [] },
        { id: "dev-1", name: "Player One", ready: false, white_cards: [] },
        { id: "dev-2", name: "Player Two", ready: true, white_cards: [] },
        { id: "dev-3", name: "Player Three", ready: false, white_cards: [] },
    ]
    lobby.selectedPacks = []
}

function trySeed() {
    const hostId = connection.socketId ?? "dev-host"
    seedLobby(hostId)
}

onMounted(() => {
    if (!isDev.value) return
    if (!connection.socketId) {
        watch(
            () => connection.socketId,
            (id) => {
                if (id) seedLobby(id)
            },
            { immediate: true }
        )
    } else {
        trySeed()
    }
})
</script>

<template>
    <GameRoomScreen v-if="isDev" />
</template>
