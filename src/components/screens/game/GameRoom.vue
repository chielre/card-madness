<script setup lang="ts">
import { computed, ref, watch, nextTick, onBeforeUnmount, onMounted } from 'vue'
import gsap from 'gsap'
import { useLobbyStore } from '@/store/LobbyStore'

import LobbyScreen from '@/components/screens/game/Lobby.vue'
import IntroScreen from '@/components/screens/game/Intro.vue'
import BoardScreen from '@/components/screens/game/Board.vue'

const lobby = useLobbyStore()

const showLobbyScreen = computed(() => ['lobby', 'starting'].includes(lobby.phase) || (lobby.phase === 'intro' && !shouldSkipIntro.value))
const showIntroScreen = computed(() => lobby.phase === 'intro' && !shouldSkipIntro.value)
const showBoardScreen = computed(() => ['intro', 'board', 'czar', 'czar-result'].includes(lobby.phase))

const LobbyScreenRef = ref<InstanceType<typeof LobbyScreen> | null>(null)
const IntroScreenRef = ref<InstanceType<typeof IntroScreen> | null>(null)
const BoardScreenRef = ref<InstanceType<typeof BoardScreen> | null>(null)


let introAnimationTl: gsap.core.Timeline | null = null

const shouldSkipIntro = computed(() => {
    const stage = (import.meta as any).env?.STAGE
    const playIntro = (import.meta as any).env?.DEV_PLAY_INTRO
    return stage === 'development' && String(playIntro) === '0'
})




const introPhaseAnimation = async () => {
    await nextTick()
    resetIntroPhaseAnimation()


    introAnimationTl = gsap.timeline()
        .call(() => {
            // prepare lobby to animate
            LobbyScreenRef.value?.closeReadyModal()
        })
        .to(LobbyScreenRef.value?.$el, { y: -120, autoAlpha: 0, display: "none", duration: 2, ease: 'power2.out' }, 0)
        .call(() => { IntroScreenRef.value?.runIntroAnimation() }, [], 0)
        .fromTo(
            BoardScreenRef.value?.$el,
            { autoAlpha: 0 },
            { autoAlpha: 1, duration: 0.8, ease: 'power2.out' },
            18)
        .call(() => { BoardScreenRef.value?.runIntroAnimation() }, [], 18)



}

const resetIntroPhaseAnimation = () => {

}

watch(
    () => lobby.phase,
    (phase) => {
        if (phase === 'starting') {
            LobbyScreenRef.value?.openReadyModal();
        } else if (phase === 'intro') {
            if (shouldSkipIntro.value) return
            introPhaseAnimation()
        }

        console.log('gameroom: phase changed to' + phase)
    }
)

onMounted(() => {
})

</script>s

<template>
    <div>
        <LobbyScreen v-show="showLobbyScreen" ref="LobbyScreenRef" />
        <IntroScreen v-show="showIntroScreen" ref="IntroScreenRef" />
        <BoardScreen v-show="showBoardScreen" ref="BoardScreenRef" />
    </div>

</template>
