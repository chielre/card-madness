<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import gsap from 'gsap'
import { useLobbyStore } from '@/store/LobbyStore'

import LobbyScreen from '@/components/screens/game/Lobby.vue'
import IntroScreen from '@/components/screens/game/Intro.vue'
import BoardScreen from '@/components/screens/game/Board.vue'
import ResultsScreen from '@/components/screens/game/Results.vue'
import FinalResultsScreen from '@/components/screens/game/FinalResults.vue'
import DebugControls from '@/components/game/DebugControls.vue'

const lobby = useLobbyStore()

const showLobbyScreen = computed(() => ['lobby', 'starting'].includes(lobby.phase) || (lobby.phase === 'intro' && !shouldSkipIntro.value))
const showIntroScreen = computed(() => lobby.phase === 'intro' && !shouldSkipIntro.value)
const showBoardScreen = computed(() => ['intro', 'board', 'czar'].includes(lobby.phase))
const showCzarResultsScreen = computed(() => lobby.phase === 'czar-result')
const showResultsScreen = computed(() => lobby.phase === 'results')

const LobbyScreenRef = ref<InstanceType<typeof LobbyScreen> | null>(null)
const IntroScreenRef = ref<InstanceType<typeof IntroScreen> | null>(null)
const BoardScreenRef = ref<InstanceType<typeof BoardScreen> | null>(null)
const ResultsScreenRef = ref<InstanceType<typeof ResultsScreen> | null>(null)


let introAnimationTl: gsap.core.Timeline | null = null

const shouldSkipIntro = computed(() => {
    const stage = (import.meta as any).env?.STAGE
    const skipIntro = (import.meta as any).env?.DEV_SKIP_INTRO
    return stage === 'development' && String(skipIntro) === '1'
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

    }
)

watch(
    () => lobby.phase,
    (phase, prev) => {
        if (phase === prev) return

        if (phase === 'czar-result') {
            nextTick(() => {
                ResultsScreenRef.value?.startCzarResultAnimation()
            })
            return
        }

        if (prev === 'czar-result' && phase === 'board') {
            nextTick(() => {
                ResultsScreenRef.value?.startCzarResultOutroAnimation()
            })
            return
        }

        if (prev === 'czar-result') {
            ResultsScreenRef.value?.resetCzarResultAnimation()
        }
    },
    { flush: 'post' }
)

</script>

<template>
    <div>
        <LobbyScreen v-show="showLobbyScreen" ref="LobbyScreenRef" />
        <IntroScreen v-show="showIntroScreen" ref="IntroScreenRef" />
        <BoardScreen v-show="showBoardScreen" ref="BoardScreenRef" />
        <ResultsScreen v-show="showCzarResultsScreen" ref="ResultsScreenRef" />
        <FinalResultsScreen v-show="showResultsScreen" />
        <DebugControls />
    </div>

</template>
