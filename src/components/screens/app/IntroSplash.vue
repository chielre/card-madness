<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { gsap } from 'gsap'
import BaseButton from '@/components/ui/BaseButton.vue'
import makerLogo from '@/assets/images/maker-logo.svg?raw'
import cardMadnessLogo from '@/assets/images/logo.png'

const props = withDefaults(defineProps<{
    isConnecting?: boolean
    isConnected?: boolean
    isPreloadingAudio?: boolean
    preloadProgress?: number
    preloadTotal?: number
    skipMakerIntro?: boolean
}>(), {
    isConnecting: false,
    isConnected: false,
    isPreloadingAudio: false,
    preloadProgress: 0,
    preloadTotal: 1,
    skipMakerIntro: false,
})

const emit = defineEmits<{
    (e: 'complete'): void
    (e: 'play'): void
}>()

const typedText = 'Trying to make something cool ' + '\u{1F680}'

const introStack = ref<HTMLElement | null>(null)
const logoWrapper = ref<HTMLElement | null>(null)
const logoSvg = ref<HTMLElement | null>(null)
const tagline = ref<HTMLElement | null>(null)
const gameScene = ref<HTMLElement | null>(null)
const gameLogo = ref<HTMLElement | null>(null)
const controls = ref<HTMLElement | null>(null)

const sceneReady = ref(false)
const controlsAnimatedIn = ref(false)

const controlsVisible = computed(() =>
    sceneReady.value && (props.isConnecting || props.isConnected || props.isPreloadingAudio)
)

const preloadPercent = computed(() => {
    const total = props.preloadTotal || 1
    return Math.round((props.preloadProgress / total) * 100)
})

const animateControlsIn = () => {
    if (!controls.value || controlsAnimatedIn.value || !controlsVisible.value) return

    controlsAnimatedIn.value = true
    gsap.fromTo(controls.value, {
        autoAlpha: 0,
        y: 20,
        scale: 0.96,
    }, {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: 0.45,
        ease: 'power2.out',
    })
}

watch(controlsVisible, (visible) => {
    if (visible) animateControlsIn()
})

onMounted(async () => {
    await nextTick()

    const stack = introStack.value
    const wrapper = logoWrapper.value
    const svgRoot = logoSvg.value?.querySelector('svg')
    const logoPath = logoSvg.value?.querySelector('path')
    const taglineElement = tagline.value
    const scene = gameScene.value
    const sceneLogo = gameLogo.value
    const controlsElement = controls.value

    if (!stack || !wrapper || !svgRoot || !logoPath || !taglineElement || !scene || !sceneLogo || !controlsElement) return

    const pathLength = (logoPath as SVGPathElement).getTotalLength()
    const typingState = { length: 0 }

    gsap.set(wrapper, {
        scale: 0.35,
        autoAlpha: 0,
        transformOrigin: '50% 50%',
    })

    gsap.set(svgRoot, {
        overflow: 'visible',
    })

    gsap.set(logoPath, {
        strokeDasharray: pathLength,
        strokeDashoffset: pathLength,
        fillOpacity: 0,
        strokeOpacity: 1,
    })

    gsap.set(taglineElement, {
        autoAlpha: 1,
    })

    gsap.set(scene, {
        autoAlpha: 0,
    })

    gsap.set(sceneLogo, {
        autoAlpha: 0,
        y: -120,
        scale: 0.92,
        transformOrigin: '50% 50%',
    })

    gsap.set(controlsElement, {
        autoAlpha: 0,
        y: 20,
    })

    taglineElement.textContent = ''

    if (props.skipMakerIntro) {
        gsap.set(stack, {
            autoAlpha: 0,
            pointerEvents: 'none',
        })
        gsap.set(scene, {
            autoAlpha: 1,
        })
        gsap.set(sceneLogo, {
            autoAlpha: 1,
            y: 0,
            scale: 1,
        })

        sceneReady.value = true
        emit('complete')
        animateControlsIn()
        return
    }

    const timeline = gsap.timeline()

    timeline
        .to(wrapper, {
            autoAlpha: 1,
            scale: 1,
            duration: 1.9,
            ease: 'power3.out',
        })
        .to(logoPath, {
            strokeDashoffset: 0,
            duration: 1.9,
            ease: 'power2.out',
        }, '<')
        .to(logoPath, {
            fillOpacity: 1,
            duration: 0.45,
            ease: 'power1.inOut',
        }, '-=0.45')
        .to(typingState, {
            length: typedText.length,
            duration: 1.8,
            ease: `steps(${typedText.length})`,
            onUpdate: () => {
                taglineElement.textContent = typedText.slice(0, Math.floor(typingState.length))
            },
        }, '-=0.1')
        .to(stack, {
            scale: 1.055,
            duration: 0.28,
            ease: 'power2.out',
            transformOrigin: '50% 50%',
        })
        .to(stack, {
            scale: 0.62,
            y: 18,
            autoAlpha: 0,
            filter: 'blur(10px)',
            duration: 0.62,
            ease: 'power3.in',
            transformOrigin: '50% 50%',
        })
        .to(scene, {
            autoAlpha: 1,
            duration: 0.7,
            ease: 'power2.out',
        }, '<+0.03')
        .to(sceneLogo, {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.8,
            ease: 'back.out(1.2)',
            onComplete: () => {
                sceneReady.value = true
                emit('complete')
                animateControlsIn()
            },
        }, '<+0.12')
})
</script>

<template>
    <section class="intro-page">
        <div ref="gameScene" class="intro-game-scene" aria-hidden="true">
            <div class="intro-game-gradient"></div>
            <div class="intro-game-grid"></div>
            <div class="intro-game-noise"></div>
        </div>

        <div class="intro-content">
            <div class="intro-main-stack">
                <div class="intro-game-logo-shell">
                    <img ref="gameLogo" class="intro-game-logo" :src="cardMadnessLogo" alt="Card Madness logo">
                </div>

                <div
                    ref="controls"
                    class="intro-controls"
                    :class="{ 'pointer-events-none': !controlsVisible }"
                >
                    <p v-if="!isConnected && isConnecting" class="intro-status">
                        Connecting...
                    </p>

                    <div v-else-if="isConnected" class="intro-preload">
                        <BaseButton size="lg" :disabled="isPreloadingAudio" @click="emit('play')">
                            {{ isPreloadingAudio ? 'Loading audio...' : 'Play' }}
                        </BaseButton>

                        <div v-if="isPreloadingAudio" class="intro-progress">
                            <div class="intro-progress-bar">
                                <div class="intro-progress-fill" :style="{ width: `${preloadPercent}%` }"></div>
                            </div>
                            <div class="intro-progress-label">
                                {{ preloadPercent }}%
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div ref="introStack" class="intro-stack">
            <div ref="logoWrapper" class="intro-logo-shell">
                <div ref="logoSvg" class="intro-logo" v-html="makerLogo"></div>
            </div>

            <p ref="tagline" class="intro-tagline"></p>
        </div>
    </section>
</template>

<style scoped>
.intro-page {
    position: relative;
    min-height: 100vh;
    overflow: hidden;
    background: #000;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
}

.intro-game-scene {
    position: absolute;
    inset: 0;
    overflow: hidden;
}

.intro-game-gradient,
.intro-game-grid,
.intro-game-noise {
    position: absolute;
    inset: 0;
}

.intro-game-gradient {
    background: linear-gradient(20deg, #5c0672, #570191, #330191);
}

.intro-game-grid {
    background: url('../../../assets/images/grid.png') repeat 0 0;
    background-size: 150px;
    animation: intro-grid-scroll 10s linear infinite;
    opacity: 0.95;
}

.intro-game-noise {
    inset: -50%;
    background: url('../../../assets/images/noise-transparent.png') repeat 0 0;
    background-size: 800px;
    opacity: 0.7;
    animation: intro-noise-shift .2s infinite;
}

.intro-content {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
}

.intro-main-stack {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    width: min(100%, 32rem);
    text-align: center;
}

.intro-game-logo-shell {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
}

.intro-game-logo {
    width: min(78vw, 19rem);
    filter: drop-shadow(0 18px 24px rgba(0, 0, 0, 0.28));
}

.intro-controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    min-height: 7rem;
    width: 100%;
}

.intro-preload {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
}

.intro-status {
    font-size: 0.95rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-align: center;
}

.intro-progress {
    width: min(20rem, 80vw);
}

.intro-progress-bar {
    height: 0.75rem;
    border-radius: 9999px;
    border: 2px solid #000;
    background: #fff;
    overflow: hidden;
}

.intro-progress-fill {
    height: 100%;
    background: #000;
    transition: width 160ms ease;
}

.intro-progress-label {
    margin-top: 0.5rem;
    text-align: center;
    color: #fff;
    font-weight: 700;
}

.intro-stack {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.875rem;
    width: 100%;
    padding: 2rem;
}

.intro-logo {
    width: min(70vw, 28rem);
    filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.18));
}

.intro-logo-shell {
    display: flex;
    align-items: center;
    justify-content: center;
}

.intro-logo :deep(svg) {
    display: block;
    width: 100%;
    height: auto;
}

.intro-tagline {
    min-height: 1.5em;
    font-size: clamp(1rem, 1.4vw, 1.15rem);
    letter-spacing: 0.01em;
    text-align: center;
    white-space: nowrap;
}

@media (max-width: 640px) {
    .intro-logo {
        width: min(82vw, 20rem);
    }

    .intro-game-logo {
        width: min(72vw, 15rem);
    }

    .intro-tagline {
        white-space: normal;
        line-height: 1.5;
    }
}

@keyframes intro-grid-scroll {
    100% {
        background-position: 150px 150px;
    }
}

@keyframes intro-noise-shift {
    0% {
        transform: translate(0, 0);
    }

    10% {
        transform: translate(-5%, -5%);
    }

    20% {
        transform: translate(-10%, 5%);
    }

    30% {
        transform: translate(5%, -10%);
    }

    40% {
        transform: translate(-5%, 15%);
    }

    50% {
        transform: translate(-10%, 5%);
    }

    60% {
        transform: translate(15%, 0);
    }

    70% {
        transform: translate(0, 10%);
    }

    80% {
        transform: translate(-15%, 0);
    }

    90% {
        transform: translate(10%, 5%);
    }

    100% {
        transform: translate(5%, 0);
    }
}
</style>
