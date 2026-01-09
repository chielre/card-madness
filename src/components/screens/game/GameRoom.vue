<script setup lang="ts">
import { computed, ref, watch, nextTick, onBeforeUnmount } from 'vue'
import gsap, { random } from 'gsap'
import { useLobbyStore } from '@/store/LobbyStore'
import { useAudioStore } from '@/store/AudioStore'
import { useConnectionStore } from '@/store/ConnectionStore'

import Close from 'vue-material-design-icons/Close.vue';


import Tabs from "@/components/Tabs.vue"
import Tab from "@/components/Tab.vue"
import ToggleSwitch from "@/components/ui/ToggleSwitch.vue"
import BaseButton from "@/components/ui/BaseButton.vue"
import ReadyListModal from '@/components/screens/game/ReadyListModal.vue'
import CardPack from '@/components/CardPack.vue'

import packs from '@/assets/packs/packs.json'

import { playCue } from '@/audio/cues'

const readyModalRef = ref<InstanceType<typeof ReadyListModal> | null>(null)
const lobbyRootRef = ref<HTMLElement | null>(null)
const introOverlayRef = ref<HTMLElement | null>(null)
const introPacksRef = ref<HTMLElement | null>(null)
const introBurstRef = ref<HTMLElement | null>(null)
const introFallRef = ref<HTMLElement | null>(null)
const gameRoomRef = ref<HTMLElement | null>(null)
const currentMusicPackId = ref<string | null>(null)
const infoPackId = ref<string | null>(null)
const props = defineProps<{
    players: { id: string; name: string; ready?: boolean }[]
}>()

// fallback op store zodat component zelfstandig kan werken
const lobby = useLobbyStore()
const audio = useAudioStore()
const connection = useConnectionStore()
const selectedPackIds = computed(() => lobby.selectedPacks)
const isHost = computed(() => connection.getSocketSafe()?.id === lobby.host)
const socketId = computed(() => connection.getSocketSafe()?.id ?? '')
const playerList = computed(() => (props.players?.length ? props.players : lobby.players))
const showLobbyScreen = computed(() => ['lobby', 'starting', 'intro'].includes(lobby.phase))
const showIntroScreen = computed(() => lobby.phase === 'intro')
const showGameScreen = computed(() => ['intro', 'choosing', 'results'].includes(lobby.phase))
let introTl: gsap.core.Timeline | null = null
let fallTl: gsap.core.Timeline | null = null

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
const introPacks = computed(() => {
    if (!selectedPackIds.value.length) return resolvedPacks.value
    const selected = new Set(selectedPackIds.value)
    return resolvedPacks.value.filter((pack) => selected.has(pack.id))
})

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

const getIntroPackElements = () =>
    Array.from(introPacksRef.value?.querySelectorAll<HTMLElement>('[data-pack-id]') ?? [])

const clearIntroBurst = () => {
    if (!introBurstRef.value) return
    gsap.killTweensOf(introBurstRef.value.querySelectorAll('*'))
    introBurstRef.value.innerHTML = ''
}

const clearIntroFalls = () => {
    if (fallTl) {
        fallTl.kill()
        fallTl = null
    }
    if (!introFallRef.value) return
    gsap.killTweensOf(introFallRef.value.querySelectorAll('*'))
    introFallRef.value.innerHTML = ''
}

const resetIntroAnimation = () => {
    if (introTl) {
        introTl.kill()
        introTl = null
    }

    if (lobbyRootRef.value) {
        gsap.set(lobbyRootRef.value, { clearProps: 'transform,opacity' })
    }
    const introPacks = getIntroPackElements()
    if (introPacks.length) {
        gsap.set(introPacks, { clearProps: 'transform,opacity,will-change,transform-style,backface-visibility,transition' })
    }
    clearIntroBurst()
    clearIntroFalls()
    if (gameRoomRef.value) {
        gsap.set(gameRoomRef.value, { clearProps: 'transform,opacity' })
    }
}

const spawnBurstCards = (packEls: HTMLElement[]) => {
    if (!introBurstRef.value) return 0
    clearIntroBurst()

    const burstLayer = introBurstRef.value
    const cardVariants = ['card-white', 'card-black', 'card-back']
    const cardWidth = 160
    const cardHeight = 220

    const burstDuration = 4
    const spawnInterval = 0.04
    const packStartGap = 0.7

    packEls.forEach((packEl, packIndex) => {
        const rect = packEl.getBoundingClientRect()
        const originX = rect.left + rect.width / 2
        const originY = rect.top + rect.height / 2
        const packDelay = packIndex * packStartGap
        const totalSpawns = Math.floor(burstDuration / spawnInterval)

        for (let i = 0; i < totalSpawns; i += 1) {
            const card = document.createElement('div')
            const variant = cardVariants[i % cardVariants.length]
            card.className = `madness-card ${variant} intro-burst-card`
            card.textContent = variant === 'card-white' ? '...' : ''
            card.style.position = 'absolute'
            card.style.width = `${cardWidth}px`
            card.style.height = `${cardHeight}px`
            card.style.left = '0'
            card.style.top = '0'
            card.style.zIndex = '1'
            card.style.transformStyle = 'preserve-3d'
            card.style.backfaceVisibility = 'hidden'
            burstLayer.appendChild(card)

            const startX = originX - cardWidth / 2
            const startY = originY - cardHeight / 2
            const dx = gsap.utils.random(-90, 90)
            const endY = startY - window.innerHeight - gsap.utils.random(200, 400)
            const rotate = gsap.utils.random(-25, 25)
            const delay = packDelay + i * spawnInterval

            gsap.fromTo(
                card,
                {
                    x: startX,
                    y: startY,
                    z: 0,
                    scale: 0.6,
                    rotationX: 0,
                    rotationY: 0,
                    autoAlpha: 1,
                },
                {
                    x: startX + dx,
                    y: endY,
                    z: gsap.utils.random(120, 260),
                    scale: 1,
                    autoAlpha: 0.5,
                    rotate,
                    rotationX: gsap.utils.random(-22, 22),
                    rotationY: gsap.utils.random(-22, 22),
                    duration: 1,
                    ease: 'power2.out',
                    delay,
                    force3D: true,
                    onComplete: () => card.remove(),
                }
            )
        }
    })

    return packEls.length * burstDuration
}

const spawnBurstForPack = (packEl: HTMLElement) => {
    return spawnBurstCards([packEl])
}

const startFallingCards = (duration: number, delay = 0) => {
    if (!introFallRef.value) return
    clearIntroFalls()

    const fallLayer = introFallRef.value
    const cardVariants = ['card-white', 'card-black', 'card-back']
    const cardWidth = 140
    const cardHeight = 200
    const spawnEvery = 0.15

    fallTl = gsap.timeline({ repeat: -1, delay })
    fallTl.call(() => {
        const card = document.createElement('div')
        const variant = gsap.utils.random(cardVariants)
        card.className = `madness-card ${variant} intro-fall-card`
        card.textContent = variant === 'card-white' ? '...' : ''
        card.style.position = 'absolute'
        card.style.width = `${cardWidth}px`
        card.style.height = `${cardHeight}px`
        card.style.left = '0'
        card.style.top = '0'
        card.style.zIndex = '0'
        card.style.transformStyle = 'preserve-3d'
        card.style.backfaceVisibility = 'hidden'
        fallLayer.appendChild(card)

        const startX = gsap.utils.random(0, window.innerWidth - cardWidth)
        const startY = -cardHeight - 20
        const endY = window.innerHeight + cardHeight + 40
        const drift = gsap.utils.random(-120, 120)
        const rotate = gsap.utils.random(-25, 25)

        gsap.fromTo(
            card,
            {
                x: startX,
                y: startY,
                z: gsap.utils.random(120, 220),
                rotationX: gsap.utils.random(-35, 35),
                rotationY: gsap.utils.random(-35, 35),
                rotate: gsap.utils.random(-40, 40),
                autoAlpha: 1,
            },
            {
                x: startX + drift,
                y: endY,
                z: gsap.utils.random(-60, 80),
                rotate,
                rotationX: gsap.utils.random(-25, 25),
                rotationY: gsap.utils.random(-25, 25),
                autoAlpha: 0.7,
                duration: gsap.utils.random(1, 3),
                ease: 'power1.in',
                force3D: true,
                onComplete: () => card.remove(),
            }
        )
    })
    fallTl.to({}, { duration: spawnEvery })

    gsap.delayedCall(duration + delay, () => {
        if (introFallRef.value) {
            gsap.to(introFallRef.value, { autoAlpha: 0, duration: 0.6, ease: 'power1.out' })
        }
        clearIntroFalls()
    })
}

const runIntroAnimation = async () => {
    await nextTick()
    resetIntroAnimation()

    const packEls = getIntroPackElements()
    if (!lobbyRootRef.value || !introOverlayRef.value || packEls.length === 0) return
    const flyOutX = packEls.map((el) => {
        const rect = el.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const dir = centerX < window.innerWidth / 2 ? -1 : 1
        return dir * (window.innerWidth + 600)
    })
    const heroPack = gsap.utils.random(packEls)
    const heroIndex = heroPack ? packEls.indexOf(heroPack) : -1
    const heroFlyOutX = heroIndex >= 0 ? flyOutX[heroIndex] : 0
    const heroRect = heroPack?.getBoundingClientRect()
    const heroOffsetX = heroRect ? window.innerWidth / 2 - (heroRect.left + heroRect.width / 2) : 0
    const heroOffsetY = heroRect ? window.innerHeight / 2 - (heroRect.top + heroRect.height / 2) : 0
    const heroScale = heroPack && heroRect
        ? Math.max(window.innerWidth / heroRect.width, window.innerHeight / heroRect.height) * 1.2
        : 6
    gsap.set(introOverlayRef.value, { perspective: 1200 })
    if (introPacksRef.value) {
        gsap.set(introPacksRef.value, { transformStyle: 'preserve-3d' })
    }
    gsap.set(packEls, {
        willChange: 'transform,opacity',
        transformOrigin: '50% 50%',
        transformStyle: 'preserve-3d',
        backfaceVisibility: 'hidden',
        transition: 'none',
        force3D: true,
    })
    if (heroPack) {
        gsap.set(packEls.filter((el) => el !== heroPack), { zIndex: 10 })
        gsap.set(heroPack, { zIndex: 30 })
    }

    introTl = gsap
        .timeline()
        .to(lobbyRootRef.value, { y: -120, autoAlpha: 0, duration: 2, ease: 'power2.out' }, 0)
        .fromTo(
            packEls,
            { y: 80, scale: 0.9, autoAlpha: 0 },
            {
                y: 0,
                scale: 1,
                autoAlpha: 1,
                duration: 1.5,
                ease: 'power2.out',
                stagger: 0.1,
                force3D: true,
            },
            3
        )
        .to(
            packEls,
            {
                x: (_index: number, el: HTMLElement) => {
                    const rect = el.getBoundingClientRect()
                    const centerX = rect.left + rect.width / 2
                    return window.innerWidth / 2 - centerX
                },
                y: (_index: number, el: HTMLElement) => {
                    const rect = el.getBoundingClientRect()
                    const centerY = rect.top + rect.height / 2
                    return window.innerHeight / 2 - centerY
                },
                rotationZ: () => gsap.utils.random(-8, 8),
                duration: 1,
                ease: 'power2.inOut',
                stagger: 0.05,
            },
            4
        )
        .to(
            packEls,
            {
                x: () => `+=${gsap.utils.random(-5, 5)}`,
                y: () => `+=${gsap.utils.random(-5, 5)}`,
                duration: 0.1,
                ease: 'power1.inOut',
                yoyo: true,
                repeat: 75,
                repeatRefresh: true,
            },
            6
        )
        .to(
            packEls,
            {
                scale: 1.5,
                duration: 6,
                ease: 'power2.inOut',
            },
            8
        )
        .to(
            packEls,
            {
                scale: 1,
                duration: 1,
                ease: 'power2.inOut',
            },
            14
        )
        .call(() => {
            const middlePack = packEls[Math.floor(packEls.length / 2)]
            const total = middlePack ? spawnBurstForPack(middlePack) : 0
            if (total) startFallingCards(3.5, 0.5)
        }, [], 14.5)
        .to(
            packEls,
            {
                x: () => `+=${gsap.utils.random(-8, 8)}`,
                y: () => `+=${gsap.utils.random(-8, 8)}`,
                scale: () => `${gsap.utils.random(1, 1.001)}`,
                duration: 0.1,
                ease: 'power1.inOut',
                yoyo: true,
                repeat: 30,
                repeatRefresh: true,
            },
            14.5
        )
        .to(
            heroPack,
            {
                scale: heroScale,
                x: heroOffsetX,
                y: heroOffsetY,
                z: 320,
                rotationX: -8,
                duration: 2,
                ease: 'power2.inOut',
                transformOrigin: '50% 50%',
                willChange: 'transform',
                force3D: true,
            },
            17
        )

        .to(
            packEls.filter((el) => el !== heroPack),
            {
                autoAlpha: 0,
                duration: 0.6,
                ease: 'power1.out',
            },
            17
        )

        .to(
            heroPack,
            {
                x: heroFlyOutX,
                z: 0,
                rotationX: 0,
                duration: 1,
                ease: 'power2.in',
                transformOrigin: '50% 50%',
                force3D: true,
                onComplete: () => {
                    clearIntroFalls()
                },
            },
            18.1
        )
        .fromTo(
            gameRoomRef.value,
            { y: 60, autoAlpha: 0 },
            { y: 0, autoAlpha: 1, duration: 0.8, ease: 'power2.out' },
            19
        )
}

watch(
    () => lobby.phase,
    (phase) => {
        if (phase === 'starting') {
            openReadyModal();

        } else if (phase === 'intro') {
            readyModalRef.value?.reset()
            audio.PlayIntroGame();
            runIntroAnimation()
        } else {
            resetIntroAnimation()
        }
    }
)

watch(
    () => lobby.phaseTimeoutTick,
    () => {
        readyModalRef.value?.reset()
    }
)

onBeforeUnmount(() => {
    resetIntroAnimation()
})

</script>

<template>

    <section v-show="showLobbyScreen" ref="lobbyRootRef">
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

    <section v-show="showIntroScreen" ref="introOverlayRef" class="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
        <div ref="introFallRef" class="absolute inset-0 z-0"></div>
        <div ref="introBurstRef" class="absolute inset-0 z-10"></div>
        <div ref="introPacksRef" class="grid grid-cols-4 gap-6 relative z-20">
            <CardPack v-for="pack in introPacks" :pack="pack" :key="pack.id" :selected="false" />
        </div>
    </section>
    <section v-show="showGameScreen" ref="gameRoomRef" class="fixed inset-0 z-30 pointer-events-none opacity-0">
        Test 123
    </section>
</template>
