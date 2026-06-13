<script setup lang="ts">
import { watch, onMounted, computed, ref } from 'vue'
import { useConnectionStore } from '@/store/ConnectionStore'
import { useAudioStore } from '@/store/AudioStore'
import { useLobbyStore } from '@/store/LobbyStore'

import SettingsModal from '@/components/modals/SettingsModal.vue'
import ConfirmModal from '@/components/modals/ConfirmModal.vue'

import LoadingPage from '@/components/screens/app/Loading.vue'
import IntroSplash from '@/components/screens/app/IntroSplash.vue'
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
const introCompleted = ref(false)
const isPreloadingAudio = ref(false)
const preloadProgress = ref(0)
const preloadTotal = ref(1)

const shouldSkipMusicPreload = computed(() => {
    const stage = (import.meta as any).env?.STAGE
    const skipPreload = (import.meta as any).env?.DEV_SKIP_MUSIC_PRELOAD
    return stage === 'development' && String(skipPreload) === '1'
})
const shouldSkipMakerIntro = computed(() =>
    String((import.meta as any).env?.SKIP_MAKER_INTRO) === '1'
)
const showIntro = computed(() =>
    !shouldSkipMusicPreload.value &&
    !firstInteracted.value &&
    (!introCompleted.value || isConnecting.value || isConnected.value)
)

const enableAudioSession = () => {
    firstInteracted.value = true
    isPreloadingAudio.value = false
    watch(() => hasJoined.value, (joined) => {
        if (!isConnected.value) return

        if (joined) audio.playLobby()
        else audio.playMain()
    },
        { immediate: true }
    )
}

const onFirstInteraction = async () => {
    if (firstInteracted.value || isPreloadingAudio.value) return
    if (shouldSkipMusicPreload.value) {
        enableAudioSession()
        return
    }
    isPreloadingAudio.value = true
    preloadProgress.value = 0
    preloadTotal.value = 1

    await audio.preloadAllAudioWithProgress((loaded, total) => {
        preloadProgress.value = loaded
        preloadTotal.value = total || 1
    })

    enableAudioSession()

}

onMounted(() => {
    if (shouldSkipMusicPreload.value) {
        watch(() => isConnected.value, (connected) => {
            if (!connected) return
            if (firstInteracted.value || isPreloadingAudio.value) return
            enableAudioSession()
        }, { immediate: true })
    }
    connection.connect()
})
</script>

<template>
    <IntroSplash
        v-if="showIntro"
        :is-connecting="isConnecting"
        :is-connected="isConnected"
        :is-preloading-audio="isPreloadingAudio"
        :preload-progress="preloadProgress"
        :preload-total="preloadTotal"
        :skip-maker-intro="shouldSkipMakerIntro"
        @complete="introCompleted = true"
        @play="onFirstInteraction"
    />
    <LoadingPage v-else-if="isConnecting" />
    <ConnectionError v-else-if="!isConnecting && !isConnected" />

    <main v-else class="flex-1 min-h-screen overflow-hidden">
        <RouterView />
        <SettingsModal />
        <ConfirmModal />

    </main>



</template>
