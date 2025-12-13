<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useLobbyStore } from '@/store/LobbyStore'
import { useAudioStore } from '@/store/AudioStore'
import { useConnectionStore } from '@/store/ConnectionStore'

import Tabs from "@/components/Tabs.vue"
import Tab from "@/components/Tab.vue"
import ToggleSwitch from "@/components/ui/ToggleSwitch.vue"
import BaseButton from "@/components/ui/BaseButton.vue"

import packs from '@/assets/packs/packs.json'

import { playCue } from '@/audio/cues'

const currentMusicPackId = ref<string | null>(null)
const infoPackId = ref<string | null>(null)
const props = defineProps<{
    players: { id: string; name: string }[]
}>()

// fallback op store zodat component zelfstandig kan werken
const lobby = useLobbyStore()
const audio = useAudioStore()
const connection = useConnectionStore()
const selectedPackIds = computed(() => lobby.selectedPacks)
const isHost = computed(() => connection.getSocketSafe()?.id === lobby.host)

// beelden uit bg-map eager inladen zodat de json ernaar kan verwijzen
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

const resolvedPacks = computed(() =>
    packs.map((pack) => {
        const bgKey = `/src/assets/images/packs/bg/${pack.style.background}`
        const logoKey = `/src/assets/images/packs/${pack.style.logo}`
        const partnerKey = `/src/assets/images/packs/partner_logos/${pack.style.partner_logo}`
        const musicFile = pack.music || pack.style.music || ''
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

watch(selectedPackIds, () => syncPackSelection(), { immediate: true })

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

</script>

<template>

    <div>
        <div class="flex justify-between items-center gap-4">

            <h1 class="text-4xl font-bold text-white">Lobby: {{ lobby.lobbyId }} </h1>
            <div class="border-4 border-b-8 border-black bg-white text-xl text-black font-black px-3 rounded-full">{{ players.length }} players</div>

        </div>
        <div class="grid grid-cols-9 gap-6 mt-8">

            <!-- player list-->
            <div class=" bg-white border-4 border-b-8 rounded-xl border-black p-4 col-span-2">
                <ul class="space-y-2">
                    <li v-for="player in (props.players?.length ? props.players : lobby.players)" :key="player.id" class="flex items-center gap-4 text-black text-2xl font-bold p-4 rounded-xl even:bg-gray-100">
                        <span class="inline-block w-6 h-6 border-4 border-white outline-3 outline-gray-600 rounded-full bg-green-500"></span>
                        <span>{{ player.name }}</span>
                        <span v-if="player.id === lobby.host" class="ml-auto text-lg font-black px-2 py-1 rounded-full bg-yellow-300 text-black border-4 border-b-8 border-black">
                            Host
                        </span>
                        <span v-else-if="player.id === connection.getSocketSafe()?.id" class="ml-auto text-lg font-black px-2 py-1 rounded-full bg-gray-200 text-black  border-4 border-b-8 border-black">
                            You
                        </span>
                    </li>
                </ul>
            </div>

            <!-- card decks -->
            <div class=" col-span-5  bg-white border-4 border-b-8 rounded-xl border-black p-4 transition-all">
                <div class="grid grid-cols-3 gap-4">
                    <button v-for="pack in resolvedPacks" :key="pack.id" type="button" @click="selectPack(pack.id)" :disabled="!isHost" class="h-[340px] relative bg-black rounded-xl border-4 border-black p-8 overflow-hidden text-left transition transform hover:-translate-y-1 active:scale-95  disabled:cursor-not-allowed" :class="selectedPackIds.includes(pack.id) ? 'scale-95 ring-8 ring-yellow-400/50' : ''" :style="{ backgroundImage: `linear-gradient(to bottom, ${pack.style.gradient_from}, ${pack.style.gradient_to})` }">

                        <div type="button" class="absolute top-1 right-1 w-8 h-8 rounded-full border-2 border-white bg-black/60 hover:bg-black text-white text-lg flex items-center justify-center" @click.stop="showPackInfo(pack.id)">
                            i
                        </div>

                        <div class="absolute inset-0 bg-center bg-repeat opacity-60 pointer-events-none" :style="{ backgroundImage: `url(${pack.bgUrl})`, backgroundSize: '200px' }"></div>
                        <div class="relative text-white font-bold flex flex-col h-full items-center justify-between w-full">


                            <div class="relative">
                                <img width="180" :src="pack.logoUrl" class=" select-none" alt="">
                                <img v-if="pack.extension.base_pack" width="120" src="../../../assets/images/pack_extended.png" class=" absolute bottom-2 right-0 -rotate-12" alt="">
                                <img v-if="pack.nsfw" width="60" src="../../../assets/images/pack_nsfw.png" class=" absolute bottom-2 left-3 rotate-12" alt="">
                            </div>

                            <div class="text-outline-black">
                                {{ pack.extension.extension_subject ?? '' }}

                            </div>


                            <div v-if="pack.partnerUrl" class="flex gap-4 items-center">
                                <img class="" width="75" src="../../../assets/images/logo.png" alt="">
                                <img class="" width="75" :src="pack.partnerUrl" alt="">
                            </div>

                            <div v-else>
                                <img class="" width="100" src="../../../assets/images/logo.png" alt="">
                            </div>



                        </div>
                    </button>
                </div>
            </div>


            <!-- lobby settings -->
            <div class="col-span-2  bg-white border-4 border-b-8 rounded-xl border-black p-6 text-black overflow-scroll-y max-h-full">


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


    </div>
</template>
