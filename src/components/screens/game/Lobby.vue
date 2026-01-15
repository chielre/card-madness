<script setup lang="ts">
import { computed, ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { useLobbyStore } from '@/store/LobbyStore'
import { useAudioStore } from '@/store/AudioStore'
import { useConnectionStore } from '@/store/ConnectionStore'

import { resolvePacks } from "@/utils/packs"

import Close from 'vue-material-design-icons/Close.vue';


import Tabs from "@/components/Tabs.vue"
import Tab from "@/components/Tab.vue"
import ToggleSwitch from "@/components/ui/ToggleSwitch.vue"
import BaseButton from "@/components/ui/BaseButton.vue"
import CardPack from '@/components/CardPack.vue'

import ReadyListModal from '@/components/screens/game/ReadyListModal.vue'
import PackInfoModal from '@/components/screens/game/PackInfoModal.vue'

const lobby = useLobbyStore()
const audio = useAudioStore()
const connection = useConnectionStore()

const readyModalRef = ref<InstanceType<typeof ReadyListModal> | null>(null)
const packInfoModalRef = ref<InstanceType<typeof PackInfoModal> | null>(null)
const lobbyRootRef = ref<HTMLElement | null>(null)
const currentMusicPackId = ref<string | null>(null)

const selectedPackIds = computed(() => lobby.selectedPacks)
const resolvedPacks = computed(() => resolvePacks())

const selectPack = (packId: string) => {
    if (!lobby.getCurrentPlayerIsHost()) return

    const exists = selectedPackIds.value.includes(packId)
    const next = exists
        ? selectedPackIds.value.filter((id) => id !== packId)
        : [...selectedPackIds.value, packId]

    lobby.setSelectedPacks(lobby.lobbyId, next)
}

const syncPackSelection = () => {
    const activeId = selectedPackIds.value.at(-1) ?? null

    if (!activeId) {
        currentMusicPackId.value = null
        audio.playLobby()
        return
    }

}

const startGame = async () => {
    if (!lobby.getCurrentPlayerIsHost() && lobby.lobbyId != 'TEST01') return
    await connection.emitWithAck('room:phase-set', { lobbyId: lobby.lobbyId, phase: 'starting' })
}

const openPackInfo = (packId: string) => {
    packInfoModalRef.value?.open(packId)
}

const openReadyModal = () => {
    readyModalRef.value?.open()
}

const closeReadyModal = () => {
    readyModalRef.value?.reset()
}

const canKickPlayer = (playerId: string) =>
    lobby.getCurrentPlayerIsHost() && playerId !== connection.getSocketSafe()?.id

const kickPlayer = async (playerId: string) => {
    if (!canKickPlayer(playerId)) return
    await lobby.kickPlayer(lobby.lobbyId, playerId)
}

watch(selectedPackIds, () => syncPackSelection(), { immediate: true })


watch(
    () => lobby.phaseTimeoutTick,
    () => {
        readyModalRef.value?.reset()
    }
)

defineExpose({ openReadyModal, closeReadyModal })

</script>

<template>
    <section ref="lobbyRootRef">
        <div class="flex justify-between items-center gap-4">

            <h1 class="text-4xl font-bold text-white">Lobby: {{ lobby.lobbyId }} </h1>
            <div class="border-4 border-b-8 border-black bg-white text-xl text-black font-black px-3 rounded-full">{{ lobby.players.length }} players</div>

        </div>
        <div class="flex gap-6 mt-8">

            <!-- player list-->
            <div class="w-100 bg-white border-4 border-b-8 rounded-xl border-black p-4">
                <ul class="space-y-2">
                    <li v-for="player in lobby.players" :key="player.id" class="group flex justify-between items-center gap-4 text-black text-2xl font-bold p-4 rounded-xl even:bg-gray-100">
                        <div class="flex items-center gap-4">
                            <div class="inline-block w-6 h-6 border-3 border-white outline-3 outline-black bg-green-500 rounded-full"></div>
                            <div>{{ player.name }}</div>
                        </div>
                        <div class="flex items-center gap-4 ">
                            <div class="flex gap-4 opacity-0 group-hover:opacity-100">
                                <button
                                    v-if="canKickPlayer(player.id)"
                                    type="button"
                                    class="flex items-center justify-center w-10 h-10 hover:bg-gray-200 rounded-lg"
                                    @click.stop="kickPlayer(player.id)"
                                >
                                    <Close />
                                </button>
                            </div>
                            <div v-if="player.id === lobby.host" class="text-sm font-black px-2 py-1 rounded-full bg-yellow-300 text-black border-4 border-b-8 border-black">
                                Host
                            </div>
                            <div v-else-if="player.id === connection.getSocketSafe()?.id" class="text-sm font-black px-2 py-1 rounded-full bg-gray-200 text-black  border-4 border-b-8 border-black">
                                You
                            </div>

                        </div>

                    </li>
                </ul>
            </div>

            <!-- card decks -->
            <div class="bg-black/50 backdrop-blur-sm rounded-xl border-black p-4 transition-all">

                <div class="grid grid-cols-4 gap-3">
                    <CardPack v-for="pack in resolvedPacks" :pack="pack" :key="pack.id" :selected="selectedPackIds.includes(pack.id)" @click="selectPack(pack.id)" @show-info="openPackInfo" />
                </div>
            </div>


            <!-- lobby settings -->
            <div class="w-100 flex flex-col gap-4">

                <div class=" bg-white border-4 border-b-8 rounded-xl border-black p-6 text-black overflow-scroll-y max-h-full">
                    <Tabs>
                        <Tab name="lobby" label="Lobby">
                            <div class="space-y-6">
                                <div class="flex flex-col gap-4 items-start">
                                    <div>
                                        <h2 class="font-bold text-xl">Lobby blijft open</h2>
                                        <p class="mt-2">Spelers kunnen blijven joinen nadat de game is gestart. Wel zo handig als iemand er uit donderd.</p>
                                    </div>
                                    <!-- <ToggleSwitch class="mt-2" name="sound-toggle2" /> -->
                                </div>
                            </div>
                        </Tab>

                        <Tab name="game" label="Game">
                            <div class="space-y-6">
                                <div class="flex flex-col gap-4 items-start">
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <h2 class="font-bold text-xl">Personaliseer kaarten</h2>
                                            <div class="font-bold border-2 border-b-4 rounded-full px-2 py-0.5 text-xs">Onze keuze</div>
                                        </div>

                                        <p class="mt-2">Gebruik namen van spelers in deze lobby in beschikbare kaarten. Om je game een vleugje persoonlijkheid te geven!</p>
                                    </div>
                                    <!-- <ToggleSwitch class="mt-2" name="sound-toggle" /> -->
                                </div>
                                <div class="flex flex-col gap-4 items-start">
                                    <div>
                                        <h2 class="font-bold text-xl">Scoreboard</h2>
                                        <p class="mt-2">Laat een scoreboard voor, na en tijdens een spel zien. Beetje competitie kan geen kwaad! Toch?</p>
                                    </div>
                                    <!-- <ToggleSwitch class="mt-2" name="sound-toggle2" /> -->
                                </div>
                            </div>
                        </Tab>
                    </Tabs>

                </div>


                <div v-if="lobby.getCurrentPlayerIsHost() || lobby.lobbyId == 'TEST01'">
                    <BaseButton size="lg" @click="startGame">Start game</BaseButton>

                </div>
            </div>

        </div>


        <PackInfoModal ref="packInfoModalRef" />
        <ReadyListModal ref="readyModalRef" />



    </section>
</template>
