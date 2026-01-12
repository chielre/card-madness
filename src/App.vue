<script setup lang="ts">
import { watch, onMounted, computed, ref } from 'vue'
import { useRoute } from "vue-router";
import { useConnectionStore } from '@/store/ConnectionStore'
import { useAudioStore } from '@/store/AudioStore'
import { useLobbyStore } from '@/store/LobbyStore'
import { useUiStore } from '@/store/UiStore'

import BaseButton from '@/components/ui/BaseButton.vue'
import SettingsModal from '@/components/modals/SettingsModal.vue'
import ConfirmModal from '@/components/modals/ConfirmModal.vue'

import MenuIcon from 'vue-material-design-icons/Menu.vue';

import LoadingPage from '@/pages/LoadingPage.vue'
import ConnectionError from '@/pages/ConnectionError.vue'

const connection = useConnectionStore()
const audio = useAudioStore()
const lobby = useLobbyStore()
const ui = useUiStore()

const isConnecting = computed(() => connection.isConnecting)
const isConnected = computed(() => connection.isConnected)

const hasJoined = computed(() =>
    lobby.players.some((p) => p.id === connection.socketId)
)



const route = useRoute();
const isDevRoute = computed(() => route.path.startsWith("/dev"));



let firstInteracted = ref(false)
const isPreloadingAudio = ref(false)
const preloadProgress = ref(0)
const preloadTotal = ref(1)


const onFirstInteraction = async () => {
    if (firstInteracted.value || isPreloadingAudio.value) return
    isPreloadingAudio.value = true
    preloadProgress.value = 0
    preloadTotal.value = 1

    await audio.preloadAllAudioWithProgress((loaded, total) => {
        preloadProgress.value = loaded
        preloadTotal.value = total || 1
    })

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

onMounted(() => {



    connection.connect()
    // audio init happens on Play click
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

                <div class="flex flex-col items-center gap-4">
                    <img class="logo m-auto" width="300" src="./assets/images/logo.png" alt="">
                    <BaseButton size="lg" :disabled="isPreloadingAudio" @click="onFirstInteraction">
                        {{ isPreloadingAudio ? 'Loading audio...' : 'Play' }}
                    </BaseButton>
                    <div v-if="isPreloadingAudio" class="w-80">
                        <div class="h-3 rounded-full border-2 border-black bg-white overflow-hidden">
                            <div class="h-full bg-black transition-all" :style="{ width: `${Math.round((preloadProgress / preloadTotal) * 100)}%` }"></div>
                        </div>
                        <div class="mt-2 text-center text-white font-bold">
                            {{ Math.round((preloadProgress / preloadTotal) * 100) }}%
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <main v-else class="flex-1 min-h-screen overflow-hidden">
        <RouterView />
        <SettingsModal />
        <ConfirmModal />

    </main>



</template>
