<script setup lang="ts">
import { computed, onMounted, watch } from "vue"
import { useConnectionStore } from "@/store/ConnectionStore"
import { useLobbyStore } from "@/store/LobbyStore"
import GameRoomScreen from "@/components/screens/Game.vue"

const connection = useConnectionStore()
const lobby = useLobbyStore()

const isDev = computed(() => (import.meta as any).env?.STAGE === "development")

onMounted(() => {
    if (!isDev.value) return
    if (!connection.socketId) {
        watch(
            () => connection.socketId,
            (id) => {
                if (id) lobby.seedDevLobby(id)
            },
            { immediate: true }
        )
    } else {
        lobby.seedDevLobby(connection.socketId ?? "dev-host")
    }
})
</script>

<template>
    <GameRoomScreen v-if="isDev" />
</template>
