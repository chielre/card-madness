<script setup lang="ts">
import { computed, ref, nextTick, withDefaults, defineProps } from "vue";
import gsap from "gsap";

import { useAudioStore } from '@/store/AudioStore'
import { useLobbyStore } from '@/store/LobbyStore'
const audio = useAudioStore();
const lobby = useLobbyStore();

import BaseButton from "@/components/ui/BaseButton.vue"



import { CustomEase } from 'gsap/CustomEase'
gsap.registerPlugin(CustomEase)

const readyModalWrapper = ref<HTMLElement | null>(null)
const readyModal = ref<HTMLElement | null>(null)
const ReadyText = ref<HTMLElement | null>(null)
let readyScreenVisible = ref(false);
let tl: gsap.core.Timeline | null = null


const setPlayerReady = async () => {
    if (!lobby.lobbyId) return
    await lobby.setReady(lobby.lobbyId)
}

const currentPlayer = computed(() => {
    return lobby.getCurrentPlayerOrFail() ?? null
})


const props = withDefaults(defineProps<{
    players?: { id: string; name: string; ready?: boolean }[]
}>(), {
    players: () => [],
})


const prepareToOpen = async () => {
    // load the audio and send a ready state back
    await audio.readyCountDown('52');

}

const playOutro = (cards: HTMLElement[] | Element[]) => {
    const outroTl = gsap.timeline()
        // overlay
        .fromTo(
            readyModal.value,
            { opacity: 1, scale: 1 },
            { opacity: 0, scale: 0, duration: 1.5, ease: 'readyBounce' },
            0
        )
        .fromTo(
            cards,
            {
                opacity: 1,
                scale: 1,
                y: 0,
                rotate: 0,

            },
            {
                opacity: 0,
                scale: 0.6,
                y: 40,
                duration: 0.8,
                rotate: () => gsap.utils.random(-12, 12),

                ease: 'cardBounce',
                stagger: {
                    each: 0.08,
                    from: 'random',
                },
            },
            0
        )
        .fromTo(
            ReadyText.value,
            { opacity: 0, scale: 0 },
            { opacity: 1, scale: 1, duration: 1.5, ease: 'readyBounce' },
            0
        )

        .to(
            ReadyText.value,
            { opacity: 0, scale: 0, duration: 1, ease: 'readyBounce' },
            1.7
        )


        .fromTo(
            readyModalWrapper.value,
            { opacity: 1 },
            { opacity: 0, duration: 0.1, ease: 'power1.out' },
            2
        )

    outroTl.call(() => {
        ReadyText.value!.textContent = 'Everybody ready?'
        readyScreenVisible.value = false
    }, [], 2.2)
}


const open = async () => {
    readyScreenVisible.value = true;

    await nextTick()
    await audio.readyCountDown('52');



    const cards = gsap.utils.toArray<HTMLElement>('.card-anim')

    CustomEase.create('readyBounce', '0.16,1.45,0.34,1')
    CustomEase.create('cardBounce', '0.18,1.4,0.35,1')

    if (tl) {
        tl.kill()
        tl = null
    }

    tl = gsap.timeline()
        // overlay
        .fromTo(
            readyModalWrapper.value,
            { opacity: 0 },
            { opacity: 1, duration: 0.1, ease: 'power1.out' },
            0
        )

        .fromTo(
            ReadyText.value,
            { opacity: 0, scale: 0 },
            { opacity: 1, scale: 1, duration: 1.5, ease: 'readyBounce' },
            0
        )

        .to(
            ReadyText.value,
            { opacity: 0, scale: 0, duration: 1, ease: 'readyBounce' },
            1.7
        )

        .fromTo(
            readyModal.value,
            { opacity: 0, scale: 0 },
            { opacity: 1, scale: 1, duration: 1.5, ease: 'readyBounce' },
            2
        )

        .fromTo(
            cards,
            {
                opacity: 0,
                scale: 0.6,
                y: 40,
                rotate: () => gsap.utils.random(-12, 12),
            },
            {
                opacity: 1,
                scale: 1,
                y: 0,
                rotate: 0,
                duration: 0.8,
                ease: 'cardBounce',
                stagger: {
                    each: 0.08,
                    from: 'random',
                },
            },
            4
        )

    tl.call(
        () => {
            const pulseTl = gsap.timeline({ repeat: 19 }) // 20x (0–19)

            pulseTl.call(() => {
                const card = gsap.utils.random(cards)

                gsap.fromTo(
                    card,
                    {
                        scale: 1,
                        rotate: 0,
                        y: 0
                    },
                    {
                        scale: 1.08,
                        rotate: gsap.utils.random(-6, 6),
                        duration: 0.18,
                        y: -10,

                        ease: 'power2.out',
                        yoyo: true,
                        repeat: 1,
                    }
                )
            })

            // elke seconde
            pulseTl.to({}, { duration: 1 })
        },
        [],
        6
    )

    tl.call(
        () => {
            const pulseTl = gsap.timeline({ repeat: 2 }) // 20x (0–19)

            pulseTl.call(() => {
                const card = gsap.utils.random(cards)

                gsap.fromTo(
                    card,
                    {
                        scale: 1,
                        rotate: 0,
                        y: 0
                    },
                    {
                        scale: 1.08,
                        rotate: gsap.utils.random(-6, 6),
                        duration: 0.5,
                        y: -10,

                        ease: 'power2.out',
                        yoyo: true,
                        repeat: 1,
                    }
                )
            })

            // elke seconde
            pulseTl.to({}, { duration: 2 })
        },
        [],
        26
    )

    const pickTwo = () => {
        const shuffled = gsap.utils.shuffle([...cards])
        return shuffled.slice(0, 2)
    }

    tl.call(
        () => {
            const pulseTl = gsap.timeline({ repeat: 14 }) // 20x (0–19)

            pulseTl.call(() => {
                const [a, b] = pickTwo()

                    ;[a, b].forEach((card) => {
                        gsap.fromTo(
                            card,
                            {
                                scale: 1,
                                rotate: 0,
                                y: 0
                            },
                            {
                                scale: 1.08,
                                rotate: gsap.utils.random(-6, 6),
                                duration: 0.18,
                                y: -10,

                                ease: 'power2.out',
                                yoyo: true,
                                repeat: 1,
                            }
                        )
                    })
            })
            // elke seconde
            pulseTl.to({}, { duration: 1 })
        },
        [],
        36
    )

    tl.call(() => {
        ReadyText.value!.textContent = 'Haha, not yet!'
    }, [], 50)

    // reset
    tl.call(() => playOutro(cards), [], 50)
    tl.call(() => {
        tl = null
    }, [], 52)

    audio.playCountDown("52");
}




defineExpose({ open, reset: () => playOutro(gsap.utils.toArray<HTMLElement>('.card-anim')) })

</script>

<template>
    <div v-if="readyScreenVisible" ref="readyModalWrapper" class=" fixed inset-0 z-50 flex items-center justify-center ">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
        <div ref="ReadyText" class="fixed inset-0 scale-0 text-outline-black text-6xl text-white font-black flex items-center justify-center">
            Everybody ready?
        </div>

        <div class="relative">
            <div ref="readyModal" class="z-10 relative bg-white border-4 border-b-8 border-black rounded-2xl max-w-xl w-full mx-4 p-6 text-black shadow-2xl  scale-0">

                <h3 class="text-2xl font-black text-center">Your game is ready</h3>

                <p class="mt-4 text-lg leading-relaxed text-center">Press the button below make to it happen</p>
                <div class="mt-6 justify-between flex items-center bg-gray-50 rounded-xl p-6">
                    <div class=" grid grid-cols-4 items-center gap-4 w-full">
                        <div v-for="player in players" :key="player.id" class="rounded-lg flex items-center justify-center p-4 border-2 border-b-6 truncate" :class="player.ready ? 'bg-green-400 border-green-900 text-green-900' : 'bg-white border-gray-500 text-gray-500'">
                            <div class="font-black">{{ player.name }}</div>
                        </div>
                    </div>


                </div>
                <div class="flex items-center justify-center mt-8">
                    <BaseButton @click="setPlayerReady" v-if="!currentPlayer?.ready">I am ready</BaseButton>


                </div>

            </div>
            <div class="absolute left-0 -top-30 z-0 -rotate-12 ">
                <div class="absolute left-0 top-0">
                    <div class="madness-card card-black card-anim opacity-0">
                        Can ________ hurry up? It takes so long!
                    </div>
                </div>
                <div class="absolute left-20 top-12 rotate-5">
                    <div class="madness-card card-white card-back card-anim opacity-0">
                        This lobby!
                    </div>
                </div>
            </div>

            <div class="absolute right-12 -top-30 z-0 rotate-45 ">
                <div class="absolute left-0 top-0">
                    <div class="madness-card card-black  card-back card-anim opacity-0">
                        lkdsjfkjl
                    </div>
                </div>
                <div class="absolute left-20 top-12 rotate-20">
                    <div class="madness-card card-white card-anim opacity-0">
                        Hello!
                    </div>
                </div>
                <div class="absolute left-20 top-20 rotate-30">
                    <div class="madness-card card-white card-anim opacity-0">
                        Hi, I am a single card. Lets go for a drink ones?
                    </div>
                </div>
            </div>

        </div>

    </div>
</template>
