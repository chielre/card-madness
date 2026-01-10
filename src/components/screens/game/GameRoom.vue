<script setup lang="ts">
import { computed, ref, watch, nextTick, onBeforeUnmount, onMounted } from 'vue'
import gsap from 'gsap'
import { useLobbyStore } from '@/store/LobbyStore'

import LobbyScreen from '@/components/screens/game/Lobby.vue'
import IntroScreen from '@/components/screens/game/Intro.vue'
import BoardScreen from '@/components/screens/game/Board.vue'

const lobby = useLobbyStore()

const showLobbyScreen = computed(() => ['lobby', 'starting', 'intro'].includes(lobby.phase))
const showIntroScreen = computed(() => lobby.phase === 'intro')
const showBoardScreen = computed(() => ['intro', 'board'].includes(lobby.phase))

const LobbyScreenRef = ref<InstanceType<typeof LobbyScreen> | null>(null)
const IntroScreenRef = ref<InstanceType<typeof IntroScreen> | null>(null)
const BoardScreenRef = ref<InstanceType<typeof BoardScreen> | null>(null)


let introAnimationTl: gsap.core.Timeline | null = null




const introPhaseAnimation = async () => {
    await nextTick()
    resetIntroPhaseAnimation()


    introAnimationTl = gsap.timeline()
        .call(() => {
            // prepare lobby to animate
            LobbyScreenRef.value?.closeReadyModal()
        })
        .to(LobbyScreenRef.value?.$el, { y: -120, autoAlpha: 0, display: "none", duration: 2, ease: 'power2.out' }, 0)
        .call(() => { IntroScreenRef.value?.runIntroAnimation() })
        .fromTo(
            BoardScreenRef.value?.$el,
            { autoAlpha: 0 },
            { autoAlpha: 1, duration: 0.8, ease: 'power2.out' },
            22)
        .call(() => { BoardScreenRef.value?.runIntroAnimation() })



}

const resetIntroPhaseAnimation = () => {

}

watch(
    () => lobby.phase,
    (phase) => {
        console.log(showLobbyScreen, showIntroScreen, showBoardScreen)
        if (phase === 'starting') {
            LobbyScreenRef.value?.openReadyModal();
        } else if (phase === 'intro') {
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
