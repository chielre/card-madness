<script setup lang="ts">
import { computed, ref, nextTick, onBeforeUnmount } from "vue"
import gsap from "gsap"
import { CustomEase } from "gsap/CustomEase"

import BaseButton from "@/components/ui/BaseButton.vue"
import { useAudioStore } from "@/store/AudioStore"
import { useLobbyStore } from "@/store/LobbyStore"

gsap.registerPlugin(CustomEase)

// 1x eases registreren
CustomEase.create("readyBounce", "0.16,1.45,0.34,1")
CustomEase.create("cardBounce", "0.18,1.4,0.35,1")

const audio = useAudioStore()
const lobby = useLobbyStore()

const readyModalWrapper = ref<HTMLElement | null>(null)
const readyModal = ref<HTMLElement | null>(null)
const readyTextRef = ref<HTMLElement | null>(null)

const readyScreenVisible = ref(false)

let tl: gsap.core.Timeline | null = null

function killTl() {
    tl?.kill()
    tl = null
}

onBeforeUnmount(() => killTl())

const currentPlayer = computed(() => lobby.getCurrentPlayerOrFail?.() ?? null)

async function setPlayerReady() {
    if (!lobby.lobbyId) return
    await lobby.setReady(lobby.lobbyId)
}

function getCards(): HTMLElement[] {
    if (!readyModalWrapper.value) return []
    return gsap.utils.toArray<HTMLElement>(".card-anim", readyModalWrapper.value)
}

function setReadyText(text: string) {
    if (readyTextRef.value) readyTextRef.value.textContent = text
}

function pulse(
    cards: HTMLElement[],
    opts: { startAt: number; repeats: number; every: number; duration: number; pickTwo?: boolean }
) {
    if (!cards.length) return
    tl?.call(
        () => {
            const pulseTl = gsap.timeline({ repeat: opts.repeats })

            pulseTl.call(() => {
                const chosen = opts.pickTwo
                    ? gsap.utils.shuffle([...cards]).slice(0, 2)
                    : [gsap.utils.random(cards)]

                chosen.forEach((card) => {
                    gsap.fromTo(
                        card,
                        { scale: 1, rotate: 0, y: 0 },
                        {
                            scale: 1.08,
                            rotate: gsap.utils.random(-6, 6),
                            y: -10,
                            duration: opts.duration,
                            ease: "power2.out",
                            yoyo: true,
                            repeat: 1,
                        }
                    )
                })
            })

            pulseTl.to({}, { duration: opts.every })
        },
        [],
        opts.startAt
    )
}

function playOutro(cards: HTMLElement[]) {
    if (!readyModalWrapper.value || !readyModal.value || !readyTextRef.value) return

    killTl()

    tl = gsap
        .timeline()
        .fromTo(
            readyModal.value,
            { opacity: 1, scale: 1 },
            { opacity: 0, scale: 0, duration: 1.5, ease: "readyBounce" },
            0
        )
        .fromTo(
            cards,
            { opacity: 1, scale: 1, y: 0, rotate: 0 },
            {
                opacity: 0,
                scale: 0.6,
                y: 40,
                rotate: () => gsap.utils.random(-12, 12),
                duration: 0.8,
                ease: "cardBounce",
                stagger: { each: 0.08, from: "random" },
            },
            0
        )
        .fromTo(
            readyTextRef.value,
            { opacity: 0, scale: 0 },
            { opacity: 1, scale: 1, duration: 1.5, ease: "readyBounce" },
            0
        )
        .to(readyTextRef.value, { opacity: 0, scale: 0, duration: 1, ease: "readyBounce" }, 1.7)
        .fromTo(readyModalWrapper.value, { opacity: 1 }, { opacity: 0, duration: 0.1 }, 2)
        .call(() => {
            setReadyText("Everybody ready?")
            readyScreenVisible.value = false
            tl = null
        }, [], 2.2)
}

async function open() {
    readyScreenVisible.value = true
    await nextTick()

    if (!readyModalWrapper.value || !readyModal.value || !readyTextRef.value) {
        readyScreenVisible.value = false
        return
    }

    // audio (optioneel async)
    await audio.readyCountDown?.("52")
    audio.playCountDown?.("52")

    const cards = getCards()
    killTl()

    tl = gsap
        .timeline()
        // overlay in
        .fromTo(readyModalWrapper.value, { opacity: 0 }, { opacity: 1, duration: 0.1, ease: "power1.out" }, 0)
        // text intro
        .fromTo(readyTextRef.value, { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 1.5, ease: "readyBounce" }, 0)
        .to(readyTextRef.value, { opacity: 0, scale: 0, duration: 1, ease: "readyBounce" }, 1.7)
        // modal in
        .fromTo(readyModal.value, { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 1.5, ease: "readyBounce" }, 2)
        // cards in
        .fromTo(
            cards,
            { opacity: 0, scale: 0.6, y: 40, rotate: () => gsap.utils.random(-12, 12) },
            {
                opacity: 1,
                scale: 1,
                y: 0,
                rotate: 0,
                duration: 0.8,
                ease: "cardBounce",
                stagger: { each: 0.08, from: "random" },
            },
            4
        )

    // pulses (DRY)
    pulse(cards, { startAt: 6, repeats: 19, every: 1, duration: 0.18 })
    pulse(cards, { startAt: 26, repeats: 2, every: 2, duration: 0.5 })
    pulse(cards, { startAt: 36, repeats: 14, every: 1, duration: 0.18, pickTwo: true })

    tl
        .call(() => setReadyText("Haha, not yet!"), [], 50)
        .call(() => playOutro(cards), [], 50)
        .call(() => {
            tl = null
        }, [], 52)
}

function close() {
    // snelle close: stop animatie en verberg
    const cards = getCards()
    playOutro(cards)
}

function reset() {
    const cards = getCards()
    playOutro(cards)
}

defineExpose({ open, close, reset })
</script>

<template>
    <div v-if="readyScreenVisible" ref="readyModalWrapper" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>

        <div ref="readyTextRef" class="fixed inset-0 scale-0 text-outline-black text-6xl text-white font-black flex items-center justify-center">
            Everybody ready?
        </div>

        <div class="relative">
            <div ref="readyModal" class="z-10 relative bg-white border-4 border-b-8 border-black rounded-2xl max-w-xl w-full mx-4 p-6 text-black shadow-2xl scale-0">
                <h3 class="text-2xl font-black text-center">Your game is ready</h3>

                <p class="mt-4 text-lg leading-relaxed text-center">Press the button below make to it happen</p>

                <div class="mt-6 justify-between flex items-center bg-gray-50 rounded-xl p-6">
                    <div class="grid grid-cols-4 items-center gap-4 w-full">
                        <div v-for="player in lobby.players" :key="player.id" class="rounded-lg flex items-center justify-center p-4 border-2 border-b-6 truncate" :class="player.ready ? 'bg-green-400 border-green-900 text-green-900' : 'bg-white border-gray-500 text-gray-500'">
                            <div class="font-black">{{ player.name }}</div>
                        </div>
                    </div>
                </div>

                <div class="flex items-center justify-center mt-8">
                    <BaseButton @click="setPlayerReady" v-if="!currentPlayer?.ready">I am ready</BaseButton>
                </div>
            </div>

            <!-- Decor cards (scoped onder wrapper, class .card-anim is belangrijk) -->
            <div class="absolute left-0 -top-30 z-0 -rotate-12">
                <div class="absolute left-0 top-0">
                    <div class="madness-card card-black card-anim opacity-0">Can ________ hurry up? It takes so long!</div>
                </div>
                <div class="absolute left-20 top-12 rotate-5">
                    <div class="madness-card card-white card-back card-anim opacity-0">This lobby!</div>
                </div>
            </div>

            <div class="absolute right-12 -top-30 z-0 rotate-45">
                <div class="absolute left-0 top-0">
                    <div class="madness-card card-black card-back card-anim opacity-0">lkdsjfkjl</div>
                </div>
                <div class="absolute left-20 top-12 rotate-20">
                    <div class="madness-card card-white card-anim opacity-0">Hello!</div>
                </div>
                <div class="absolute left-20 top-20 rotate-30">
                    <div class="madness-card card-white card-anim opacity-0">Hi, I am a single card. Lets go for a drink ones?</div>
                </div>
            </div>
        </div>
    </div>
</template>
