<script setup lang="ts">
import { computed, ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { useLobbyStore } from '@/store/LobbyStore'
import { useAudioStore } from '@/store/AudioStore'
import { useConnectionStore } from '@/store/ConnectionStore'
import { playCue } from '@/audio/cues'

import packs from '@/assets/packs/packs.json'


import Tabs from "@/components/Tabs.vue"
import Tab from "@/components/Tab.vue"
import ToggleSwitch from "@/components/ui/ToggleSwitch.vue"
import BaseButton from "@/components/ui/BaseButton.vue"
import CardPack from '@/components/CardPack.vue'

import ReadyListModal from '@/components/screens/game/ReadyListModal.vue'

const lobby = useLobbyStore()
const audio = useAudioStore()
const connection = useConnectionStore()


const readyModalRef = ref<InstanceType<typeof ReadyListModal> | null>(null)
const lobbyRootRef = ref<HTMLElement | null>(null)
const currentMusicPackId = ref<string | null>(null)
const infoPackId = ref<string | null>(null)


const props = defineProps<{
    players: { id: string; name: string; ready?: boolean }[]
}>()

const selectedPackIds = computed(() => lobby.selectedPacks)
const isHost = computed(() => connection.getSocketSafe()?.id === lobby.host)
const socketId = computed(() => connection.getSocketSafe()?.id ?? '')
const playerList = computed(() => (props.players?.length ? props.players : lobby.players))
const resolvedPacks = computed(() =>
    packs.map((pack) => {
        const bgKey = `/src/assets/images/packs/bg/${pack.style.background}`
        const logoKey = `/src/assets/images/packs/${pack.style.logo}`
        const partnerKey = `/src/assets/images/packs/partner_logos/${pack.style.partner_logo}`
        const musicFile = pack.style.music || ''
        const musicKey = `/src/assets/audio/${musicFile}`
        return {
            ...pack,
            bgUrl: bgImages[bgKey] ?? '',
            logoUrl: logoImages[logoKey] ?? '',
            partnerUrl: partnerImages[partnerKey] ?? '',
            musicUrl: musicFiles[musicKey] ?? '',
            weight: pack.weight ?? 1,
            description: pack.description ?? '',
        }
    })
)

const bgImages = import.meta.glob('@/assets/images/packs/bg/*.png', {
    eager: true,
    import: 'default',
}) as Record<string, string>

const logoImages = import.meta.glob('@/assets/images/packs/*.png', {
    eager: true,
    import: 'default',
}) as Record<string, string>

const partnerImages = import.meta.glob('@/assets/images/packs/partner_logos/*.png', {
    eager: true,
    import: 'default',
}) as Record<string, string>

const musicFiles = import.meta.glob('@/assets/audio/*.mp3', {
    eager: true,
    import: 'default',
}) as Record<string, string>


const selectPack = (packId: string) => {
    if (!isHost.value) return
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
    playCue()

}


const detailPack = computed(() => resolvedPacks.value.find((p) => p.id === infoPackId.value) || null)

const showPackInfo = (packId: string) => {
    infoPackId.value = packId
    const pack = resolvedPacks.value.find((p) => p.id === packId)
    if (!pack) return

    document.body.style.backgroundImage = `linear-gradient(135deg, ${pack.style.gradient_from}, ${pack.style.gradient_to})`

    if (pack.musicUrl) {
        audio.playCustomOnce(`info:${pack.id}`, pack.musicUrl)
    }
}

const closePackInfo = () => {
    infoPackId.value = null


    // zet background terug naar lobby/selected state
    audio.playLobby()

    const activeId = selectedPackIds.value.at(-1)
    const pack = resolvedPacks.value.find((p) => p.id === activeId)
    if (pack) {
        document.body.style.backgroundImage = `linear-gradient(135deg, ${pack.style.gradient_from}, ${pack.style.gradient_to})`
    } else {
        document.body.style.backgroundImage = ''
    }
}

const startGame = async () => {
    if (!isHost.value && lobby.lobbyId != 'TEST01') return
    await connection.emitWithAck('room:phase-set', { roomId: lobby.lobbyId, phase: 'starting' })
}

const setReady = async () => {
    if (!lobby.lobbyId) return
    const me = lobby.getCurrentPlayer()
    await lobby.setReady(lobby.lobbyId, !(me?.ready ?? false))
}

const openReadyModal = () => {
    readyModalRef.value?.open()
}

watch(selectedPackIds, () => syncPackSelection(), { immediate: true })
watch(
    () => lobby.phase,
    (phase) => {
        if (phase === 'starting') {
            openReadyModal();

        }
    }
)

watch(
    () => lobby.phaseTimeoutTick,
    () => {
        readyModalRef.value?.reset()
    }
)

</script>

<template>
    <section ref="lobbyRootRef">
        <div class="flex justify-between items-center gap-4">

            <h1 class="text-4xl font-bold text-white">Lobby: {{ lobby.lobbyId }} </h1>
            <div class="border-4 border-b-8 border-black bg-white text-xl text-black font-black px-3 rounded-full">{{ players.length }} players</div>

        </div>
        <div class="flex gap-6 mt-8">

            <!-- player list-->
            <div class="w-100 bg-white border-4 border-b-8 rounded-xl border-black p-4">
                <ul class="space-y-2">
                    <li v-for="player in playerList" :key="player.id" class="group flex justify-between items-center gap-4 text-black text-2xl font-bold p-4 rounded-xl even:bg-gray-100">
                        <div class="flex items-center gap-4">
                            <div class="inline-block w-6 h-6 border-3 border-white outline-3 outline-black bg-green-500 rounded-full"></div>
                            <div>{{ player.name }}</div>
                        </div>
                        <div class="flex items-center gap-4 ">
                            <div class="flex gap-4 opacity-0  group-hover:opacity-100">
                                <div class="flex items-center justify-center w-10 h-10 hover:bg-gray-200 rounded-lg">
                                    <Close />
                                </div>

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
                    <CardPack v-for="pack in resolvedPacks" :pack="pack" :key="pack.id" :selected="selectedPackIds.includes(pack.id)" @click="selectPack(pack.id)" @show-info="showPackInfo" />
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
                                    <ToggleSwitch class="mt-2" name="sound-toggle2" />
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
                                    <ToggleSwitch class="mt-2" name="sound-toggle" />
                                </div>
                                <div class="flex flex-col gap-4 items-start">
                                    <div>
                                        <h2 class="font-bold text-xl">Scoreboard</h2>
                                        <p class="mt-2">Laat een scoreboard voor, na en tijdens een spel zien. Beetje competitie kan geen kwaad! Toch?</p>
                                    </div>
                                    <ToggleSwitch class="mt-2" name="sound-toggle2" />
                                </div>
                            </div>
                        </Tab>
                    </Tabs>

                </div>


                <div v-if="isHost || lobby.lobbyId == 'TEST01'">
                    <BaseButton size="lg" @click="startGame">Start game</BaseButton>

                </div>
            </div>

        </div>

        <!-- Info modal -->
        <div v-if="detailPack" class="fixed inset-0 z-50 flex items-center justify-center ">
            <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closePackInfo"></div>
            <div class="relative bg-white border-4 border-b-8 border-black rounded-2xl max-w-xl w-full mx-4 p-6 text-black shadow-2xl">
                <button class="absolute top-3 right-3 w-8 h-8 rounded-full border-2 border-black text-black bg-gray-100 hover:bg-gray-200" @click="closePackInfo">
                    ✕
                </button>
                <div class="text-xs font-black uppercase tracking-wide text-gray-600">Pack info</div>
                <div class="flex gap-4 items-center">

                    <h3 class="text-2xl font-black">{{ detailPack.name }}</h3>
                    <div class=" font-bold border-2 border-b-4 rounded-full px-2 py-0.5 text-xs" v-if="detailPack.nsfw">NSFW</div>
                    <div class=" font-bold border-2 border-b-4 rounded-full px-2 py-0.5 text-xs" v-if="detailPack.extension.base_pack">extension</div>

                </div>
                <p class="mt-6 text-lg leading-relaxed">{{ detailPack.description }}</p>
                <div class="mt-6 justify-between flex items-center bg-gray-50 rounded-xl p-3">
                    <div class=" flex items-center gap-4">
                        <img v-if="detailPack.logoUrl" :src="detailPack.logoUrl" class="w-20 h-20 object-contain" alt="">
                        <div v-if="detailPack.partnerUrl" class="flex gap-4 items-center">
                            <div class="text-sm text-gray-600">
                                In samenwerking met
                            </div>
                            <img class="" width="75" :src="detailPack.partnerUrl" alt="">
                        </div>
                        <div v-else class=" text-gray-600">
                            Pack by <b>{{ detailPack.author ?? 'CardMadness' }}</b>
                        </div>
                    </div>


                </div>
            </div>
        </div>


        <ReadyListModal ref="readyModalRef" :players="playerList" />



    </section>
</template>