<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import gsap from "gsap"

import CountdownTimer from "@/components/CountdownTimer.vue"

const props = defineProps<{
  phase: string
  roundStartedTick: number
  roundTimerExpiresAt: number
  roundTimerDurationMs: number
  phaseTimerPhase: string
  phaseTimerExpiresAt: number
  phaseTimerDurationMs: number
}>()

const timerRef = ref<InstanceType<typeof CountdownTimer> | null>(null)
const timerWrapRef = ref<HTMLElement | null>(null)

const timerMode = ref<"round" | "czar">("round")
const timerVisible = ref(true)

const CZAR_TIMER_HIDE_SECONDS = 17
let timerStartTimeout: ReturnType<typeof setTimeout> | null = null

const timerPhases = new Set(["board", "czar"])
const shouldShowTimer = computed(() => timerPhases.has(props.phase))

function clearTimerTimeout() {
  if (!timerStartTimeout) return
  clearTimeout(timerStartTimeout)
  timerStartTimeout = null
}

function resetTimer() {
  timerRef.value?.pause()
  timerRef.value?.reset(0)
}

function getRemainingSeconds(expiresAt?: number, durationMs?: number) {
  const now = Date.now()
  const remainingMs = expiresAt ? Math.max(0, expiresAt - now) : Math.max(0, durationMs ?? 0)
  return { now, remainingMs, remainingSeconds: Math.ceil(remainingMs / 1000) }
}

function setTimerVisibility(show: boolean) {
  if (!timerWrapRef.value) return
  if (show === timerVisible.value) return
  timerVisible.value = show

  gsap.killTweensOf(timerWrapRef.value)

  if (show) {
    gsap.set(timerWrapRef.value, { pointerEvents: "auto" })
    gsap.fromTo(
      timerWrapRef.value,
      { y: -140, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.4, ease: "power2.out" }
    )
  } else {
    gsap.to(timerWrapRef.value, {
      y: -140,
      autoAlpha: 0,
      duration: 0.35,
      ease: "power2.in",
      onComplete: () => gsap.set(timerWrapRef.value, { pointerEvents: "none" }),
    })
  }
}

function startRoundTimer() {
  if (!props.roundStartedTick) return
  const { remainingSeconds } = getRemainingSeconds(props.roundTimerExpiresAt, props.roundTimerDurationMs)
  if (remainingSeconds <= 0) return
  timerMode.value = "round"
  timerRef.value?.start(remainingSeconds)
}

function startCzarTimer() {
  if (!props.roundStartedTick) return
  if (props.phaseTimerPhase !== "czar") return

  const durationMs = props.phaseTimerDurationMs ?? 0
  const expiresAt = props.phaseTimerExpiresAt ?? 0
  if (!durationMs || !expiresAt) return

  const { now } = getRemainingSeconds(expiresAt, durationMs)

  const startAt = expiresAt - durationMs
  const showAt = startAt + CZAR_TIMER_HIDE_SECONDS * 1000

  if (now < showAt) {
    setTimerVisibility(false)
    resetTimer()

    const delayMs = Math.max(0, showAt - now)
    timerStartTimeout = setTimeout(() => {
      timerStartTimeout = null
      const { remainingSeconds } = getRemainingSeconds(expiresAt, durationMs)
      if (remainingSeconds <= 0) return
      timerMode.value = "czar"
      setTimerVisibility(true)
      timerRef.value?.start(remainingSeconds)
    }, delayMs)

    return
  }

  const { remainingSeconds } = getRemainingSeconds(expiresAt, durationMs)
  if (remainingSeconds <= 0) return
  timerMode.value = "czar"
  setTimerVisibility(true)
  timerRef.value?.start(remainingSeconds)
}

function refreshTimer() {
  clearTimerTimeout()
  resetTimer()

  if (!shouldShowTimer.value) {
    setTimerVisibility(false)
    return
  }

  if (props.phase === "board") {
    setTimerVisibility(true)
    startRoundTimer()
    return
  }

  if (props.phase === "czar") startCzarTimer()
}

watch(
  () => [
    props.phase,
    props.roundStartedTick,
    props.roundTimerExpiresAt,
    props.roundTimerDurationMs,
    props.phaseTimerPhase,
    props.phaseTimerExpiresAt,
    props.phaseTimerDurationMs,
  ],
  () => refreshTimer(),
  { immediate: true }
)

onMounted(() => {
  if (timerWrapRef.value && !shouldShowTimer.value) {
    setTimerVisibility(false)
    timerVisible.value = false
  }
})

onBeforeUnmount(() => {
  clearTimerTimeout()
})
</script>

<template>
  <div ref="timerWrapRef" class="bg-[#2b0246] px-16 py-4 rounded-b-4xl border-2 border-black border-t-0">
    <CountdownTimer ref="timerRef" :initial-seconds="240" :auto-start="false" :mode="timerMode" />
  </div>
</template>
