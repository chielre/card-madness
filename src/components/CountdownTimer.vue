<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import gsap from 'gsap'
import { useAudioStore } from '@/store/AudioStore'

const props = withDefaults(
    defineProps<{
        initialSeconds?: number
        autoStart?: boolean
    }>(),
    { initialSeconds: 30, autoStart: true }
)

const ENDING_AT = 33
const LAST_SECONDS_AT = 9
const TICK_MS = 1000

const audio = useAudioStore()

const remainingSeconds = ref(Math.max(0, Math.floor(props.initialSeconds)))
const isRunning = ref(false)

let timer: ReturnType<typeof setInterval> | null = null

const bodyRef = ref<HTMLElement | null>(null)
const ringRef = ref<HTMLElement | null>(null)
const colonRef = ref<HTMLElement | null>(null)

const digitRefs = ref<(HTMLElement | null)[]>([null, null, null, null])
const pulseLineRefs = ref<(HTMLElement | null)[]>([])

let ringTween: gsap.core.Tween | null = null
let pulseTween: gsap.core.Tween | null = null
let endingTl: gsap.core.Timeline | null = null

const prevDigits = ref<string[]>([])
const lastSecondsMode = ref(false)
const endingMarkPlayed = ref(false)




const digits = computed(() => {
    const mm = String(Math.floor(remainingSeconds.value / 60)).padStart(2, '0')
    const ss = String(remainingSeconds.value % 60).padStart(2, '0')
    return [mm[0], mm[1], ss[0], ss[1]]
})

const setDigitRef = (index: number) => (el: HTMLElement | null) => {
    digitRefs.value[index] = el
}

const setPulseLineRef = (index: number) => (el: HTMLElement | null) => {
    pulseLineRefs.value[index] = el
}

function start(seconds?: number) {
    if (typeof seconds === 'number') reset(seconds)
    if (timer) return

    isRunning.value = true
    timer = setInterval(() => {
        if (remainingSeconds.value <= 0) return pause()
        remainingSeconds.value -= 1
    }, TICK_MS)
}

function pause() {
    if (!timer) return
    clearInterval(timer)
    timer = null
    isRunning.value = false
}

function stop() {
    pause()
    remainingSeconds.value = 0
}

function reset(seconds: number) {
    remainingSeconds.value = Math.max(0, Math.floor(seconds))
    prevDigits.value = [...digits.value]
    endingMarkPlayed.value = false
    lastSecondsMode.value = false
    endingTl?.kill()
    endingTl = null
    stopPulseLines()
    showAllDigits()
}

function animateChangedDigits() {
    digits.value.forEach((digit, index) => {
        if (prevDigits.value[index] === digit) return
        const el = digitRefs.value[index]
        if (!el) return

        gsap.fromTo(
            el,
            { y: 10, autoAlpha: 0 },
            { y: 0, autoAlpha: 1, duration: 0.2, ease: 'power2.out' }
        )
    })
    prevDigits.value = [...digits.value]
}

function hideNonLastSeconds() {
    const targets = [digitRefs.value[0], digitRefs.value[1], colonRef.value, digitRefs.value[2]].filter(Boolean)
    if (targets.length) gsap.to(targets, { autoAlpha: 0, y: -8, duration: 0.2, ease: 'power2.out' })

    const lastDigit = digitRefs.value[3]
    if (lastDigit) gsap.to(lastDigit, { scale: 1.6, duration: 0.2, ease: 'power2.out' })
}

function showAllDigits() {
    const targets = [digitRefs.value[0], digitRefs.value[1], colonRef.value, digitRefs.value[2], digitRefs.value[3]].filter(Boolean)
    if (targets.length) gsap.to(targets, { autoAlpha: 1, y: 0, duration: 0.2, ease: 'power2.out' })

    const lastDigit = digitRefs.value[3]
    if (lastDigit) gsap.to(lastDigit, { scale: 1, duration: 0.2, ease: 'power2.out' })
}

function startPulseLines() {
    if (pulseTween) return
    const lines = pulseLineRefs.value.filter(Boolean) as HTMLElement[]
    if (!lines.length) return

    pulseTween = gsap.to(lines, {
        autoAlpha: 1,
        scale: () => gsap.utils.random(1.03, 1.08),
        duration: () => gsap.utils.random(0.5, 0.9),
        ease: 'power1.inOut',
        yoyo: true,
        repeat: -1,
        stagger: { each: 0.2, from: 'random' },
    })
}

function stopPulseLines() {
    if (!pulseTween) return
    pulseTween.kill()
    pulseTween = null
    const lines = pulseLineRefs.value.filter(Boolean) as HTMLElement[]
    if (lines.length) gsap.set(lines, { autoAlpha: 0, scale: 1 })
}

function startEndingMark() {
    if (endingMarkPlayed.value) return
    endingMarkPlayed.value = true

    // fire-and-forget
    audio.playCountDown('33')

    const el = bodyRef.value
    if (!el) return

    endingTl?.kill()
    endingTl = gsap.timeline()

    // kleine “ticks”
    const shakes = [
        { t: 0.0, r: 10 },
        { t: 0.5, r: 20 },
        { t: 1.0, r: 30 },
        { t: 1.5, r: 40 },
        { t: 1.9, r: 0 },
    ]
    shakes.forEach(({ t, r }) => endingTl!.to(el, { rotate: r, duration: 0.24, ease: 'power2.out' }, t))

    // pulse block
    endingTl!.fromTo(
        el,
        { scale: 1 },
        { scale: 1.25, duration: 0.25, ease: 'power2.out', yoyo: true, repeat: 5 },
        2
    )

        // spins + bumps (compact)
        ;[
            { t: 7, rotate: 360, dur: 1 },
            { t: 12, rotate: 20, dur: 0.25 },
            { t: 13, rotate: 40, dur: 0.25 },
            { t: 14, rotate: 60, dur: 0.25 },
            { t: 16, rotate: 0, dur: 0.25 },
            { t: 19, rotate: 360, dur: 1 },
        ].forEach((s) => endingTl!.to(el, { rotate: s.rotate, duration: s.dur, ease: 'power2.out' }, s.t))

        // 3x “pop”
        ;[24, 26, 28].forEach((t) => {
            endingTl!.fromTo(
                el,
                { scale: 1 },
                { scale: 1.5, duration: 0.25, ease: 'power2.inOut', yoyo: true, repeat: 1 },
                t
            )
        })

    endingTl!.call(() => gsap.set(el, { clearProps: 'transform' }))
}

watch(
    remainingSeconds,
    (sec) => {
        // digit anim
        animateChangedDigits()

        // last seconds mode
        const shouldLast = sec <= LAST_SECONDS_AT
        if (shouldLast !== lastSecondsMode.value) {
            lastSecondsMode.value = shouldLast
            shouldLast ? hideNonLastSeconds() : showAllDigits()
        }

        // ending effects
        if (sec <= ENDING_AT) {
            startPulseLines()
            startEndingMark()
        } else {
            stopPulseLines()
        }
    },
    { immediate: true }
)

onMounted(() => {
    // init visuals
    const lines = pulseLineRefs.value.filter(Boolean) as HTMLElement[]
    if (lines.length) gsap.set(lines, { autoAlpha: 0 })

    if (ringRef.value) ringTween = gsap.to(ringRef.value, { rotate: 360, duration: 6, ease: 'none', repeat: -1 })

    prevDigits.value = [...digits.value]
    if (props.autoStart) start()
})

onBeforeUnmount(() => {
    pause()
    ringTween?.kill()
    stopPulseLines()
    endingTl?.kill()
})

defineExpose({ start, pause, stop, reset })
</script>


<template>
    <div ref="bodyRef" class="relative w-32 h-32 rounded-full border-4 border-b-8 border-black bg-white shadow-xl flex items-center justify-center">
        <div class="absolute inset-2 rounded-full border-2 border-dashed border-black/40" ref="ringRef"></div>
        <div class="absolute inset-0 -m-6">
            <div :ref="setPulseLineRef(0)" class="absolute inset-0 rounded-full border-2 border-pink-300/70"></div>
            <div :ref="setPulseLineRef(1)" class="absolute inset-3 rounded-full border-2 border-blue-300/70"></div>
            <div :ref="setPulseLineRef(2)" class="absolute inset-6 rounded-full border-2 border-green-300/70"></div>
        </div>


        <div class="relative flex items-center justify-center  text-black text-2xl font-black w-full">
            <span :ref="setDigitRef(0)" :class="lastSecondsMode ? 'absolute' : ''">{{ digits[0] }}</span>
            <span :ref="setDigitRef(1)" :class="lastSecondsMode ? 'absolute' : ''">{{ digits[1] }}</span>
            <span ref="colonRef" class="opacity-60" :class="lastSecondsMode ? 'absolute' : ''">:</span>
            <span :ref="setDigitRef(2)" :class="lastSecondsMode ? 'absolute' : ''">{{ digits[2] }}</span>
            <span :ref="setDigitRef(3)" :class="lastSecondsMode ? 'absolute left-[46%]' : ''">{{ digits[3] }}</span>
        </div>
    </div>
</template>
