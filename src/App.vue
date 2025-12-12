<script setup lang="ts">
import { watch, onMounted, computed, ref } from 'vue'
import { useConnectionStore } from '@/store/ConnectionStore'
import { useAudioStore } from '@/store/AudioStore'
import { useLobbyStore } from '@/store/LobbyStore'

import BaseButton from '@/components/ui/BaseButton.vue'

import LoadingPage from '@/pages/LoadingPage.vue'
import ConnectionError from '@/pages/ConnectionError.vue'

const connection = useConnectionStore()
const audio = useAudioStore()
const lobby = useLobbyStore()

const isConnecting = computed(() => connection.isConnecting)
const isConnected = computed(() => connection.isConnected)

const hasJoined = computed(() =>
    lobby.players.some((p) => p.id === connection.socketId)
)

let firstInteracted = ref(false)


const onFirstInteraction = async () => {
    if (firstInteracted.value) return
    firstInteracted.value = true

    watch(() => hasJoined.value, (joined) => {
        if (!isConnected.value) return

        if (joined) audio.playLobby()
        else audio.playMain()
    },
        { immediate: true }
    )

    window.removeEventListener('pointerdown', onFirstInteraction)
}

onMounted(() => {
    connection.connect()
    window.addEventListener('pointerdown', onFirstInteraction, { once: true })
})
</script>

<template>

    <!-- Show loading -->
    <LoadingPage v-if="isConnecting" />
    <ConnectionError v-else-if="!isConnecting && !isConnected" />

    <!-- force first interaction for audio api -->
    <div v-else-if="isConnected && !firstInteracted">
        <div class="flex-1 min-h-screen overflow-hidden">
            <div class="page-main min-h-screen flex justify-center items-center">
                <div class="bg-noise"></div>
                <div class="bg-grid"></div>

                <div class="flex flex-col">
                    <img class="logo m-auto" width="300" src="./assets/images/logo.png" alt="">
                    <BaseButton size="lg">Play</BaseButton>
                </div>
            </div>
        </div>
    </div>

    <main v-else class="flex-1 min-h-screen overflow-hidden">
        <RouterView />
    </main>



</template>
