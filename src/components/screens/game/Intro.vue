<script setup lang="ts">
import { computed, ref, watch, nextTick, onBeforeUnmount } from 'vue'
import gsap from 'gsap'

import { useLobbyStore } from '@/store/LobbyStore'
import { useAudioStore } from '@/store/AudioStore'

import { resolvePacks } from "@/utils/packs"


import CardPack from '@/components/CardPack.vue'



const lobby = useLobbyStore();
const audio = useAudioStore()

const introOverlayRef = ref<HTMLElement | null>(null)
const introPacksRef = ref<HTMLElement | null>(null)
const introBurstRef = ref<HTMLElement | null>(null)
const introFallRef = ref<HTMLElement | null>(null)

let introTl: gsap.core.Timeline | null = null
let fallTl: gsap.core.Timeline | null = null

const resolvedPacks = computed(() => resolvePacks())
const introPacks = computed(() => {
    const packs = resolvedPacks.value
    if (!lobby.selectedPacks.length) return packs

    const selected = new Set(lobby.selectedPacks)
    return packs.filter((pack) => selected.has(pack.id))
})


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

    const introPacks = getIntroPackElements()
    if (introPacks.length) {
        gsap.set(introPacks, { clearProps: 'transform,opacity,will-change,transform-style,backface-visibility,transition' })
    }
    clearIntroBurst()
    clearIntroFalls()

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
    // if (!lobbyRootRef.value || !introOverlayRef.value || packEls.length === 0) return
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

    audio.playIntroGame();


    introTl = gsap
        .timeline()
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
}


defineExpose({ runIntroAnimation })

</script>

<template>
    <section class="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
        <div ref="introFallRef" class="absolute inset-0 z-0"></div>
        <div ref="introBurstRef" class="absolute inset-0 z-10"></div>
        <div ref="introPacksRef" class="grid grid-cols-4 gap-6 relative z-20">
            <CardPack v-for="pack in introPacks" :pack="pack" :key="pack.id" :selected="false" class="opacity-0" />
        </div>
    </section>
</template>
