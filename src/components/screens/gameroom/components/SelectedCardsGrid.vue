<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue"
import gsap from "gsap"
import { useLobbyStore } from "@/store/LobbyStore"

type SelectedEntry = {
  playerId: string
  card?: any
  resolved?: { text?: string }
}

const props = defineProps<{
  entries: SelectedEntry[]
  isCardLocked: (playerId: string) => boolean
}>()

const emit = defineEmits<{
  (event: "reveal-ready", ready: boolean): void
  (event: "reveal-start"): void
}>()

const lobby = useLobbyStore()
const gridRef = ref<HTMLElement | null>(null)

const isCzarPhase = computed(() => lobby.phase === "czar")
const isCzarResultPhase = computed(() => lobby.phase === "czar-result")
const isRevealPhase = computed(() => isCzarPhase.value || isCzarResultPhase.value)
const isBoardPhase = computed(() => lobby.phase === "board")
const isCurrentPlayerCardSelector = computed(() => lobby.getCurrentPlayerIsCardSelector())
const canCzarSelect = computed(() => isCzarPhase.value && isCurrentPlayerCardSelector.value)
const selectedCzarCardPlayerId = computed(() => lobby.currentRound?.cardSelector?.selectedCard?.playerId ?? null)

const CZAR_FLIP_DELAY_MS = 350
let czarFlipTimeout: ReturnType<typeof setTimeout> | null = null
let czarRevealReadyTimeout: ReturnType<typeof setTimeout> | null = null
let czarRevealRetryTimeout: ReturnType<typeof setTimeout> | null = null
let pendingCzarReveal = false
const czarRevealReady = ref(false)

function setCzarRevealReady(value: boolean) {
  if (czarRevealReady.value === value) return
  czarRevealReady.value = value
  emit("reveal-ready", value)
}

function onCzarCardSelect(entry: SelectedEntry) {
  if (!canCzarSelect.value) return
  lobby.queueCzarSelectedEntry(entry as { playerId: string; card: any })
}

function requestLockBoost(playerId: string) {
  if (!isBoardPhase.value) return
  if (props.isCardLocked(playerId)) return
  lobby.requestLockBoost(playerId)
}

function onPendingCardBoostPointerDown(e: PointerEvent, playerId: string) {
  if (!playerId) return
  if (e.button !== 0 && e.pointerType === "mouse") return
  if (e.pointerType !== "mouse") e.preventDefault()
  requestLockBoost(playerId)
}

function playCzarFlip() {
  if (!gridRef.value) return
  const cards = Array.from(gridRef.value.querySelectorAll(".card-flip")) as HTMLElement[]
  if (!cards.length) return

  if (czarRevealReadyTimeout) {
    clearTimeout(czarRevealReadyTimeout)
    czarRevealReadyTimeout = null
  }
  setCzarRevealReady(false)

  cards.forEach((card, index) => {
    const back = card.querySelector(".card-flip-back") as HTMLElement | null
    const front = card.querySelector(".card-flip-front") as HTMLElement | null
    if (!back || !front) return

    gsap.killTweensOf([card, back, front])
    gsap.set([back, front], { transformStyle: "preserve-3d", backfaceVisibility: "hidden" })
    gsap.set(card, { transformStyle: "preserve-3d", rotateX: 0 })
    gsap.set(back, { rotateY: 0, autoAlpha: 1, zIndex: 2 })
    gsap.set(front, { rotateY: -180, autoAlpha: 0, zIndex: 1 })

    gsap.timeline({ delay: index * 0.08 })
      .to(card, { y: -18, rotateX: 10, duration: 0.2, ease: "power2.out" }, 0)
      .to(back, { rotateY: 180, autoAlpha: 0, duration: 0.45, ease: "power2.inOut" }, 0.05)
      .to(front, { rotateY: 0, autoAlpha: 1, duration: 0.5, ease: "power2.inOut" }, 0.1)
      .to(card, { y: 0, rotateX: 0, duration: 0.35, ease: "power2.inOut" }, 0.25)
  })

  const totalCards = cards.length
  const lastDelay = (totalCards - 1) * 0.08
  const totalDuration = lastDelay + 0.25 + 0.35
  czarRevealReadyTimeout = setTimeout(() => {
    czarRevealReadyTimeout = null
    setCzarRevealReady(true)
  }, Math.ceil(totalDuration * 1000))
}

function scheduleCzarFlip() {
  if (czarFlipTimeout) clearTimeout(czarFlipTimeout)
  czarFlipTimeout = setTimeout(() => {
    czarFlipTimeout = null
    playCzarFlip()
  }, CZAR_FLIP_DELAY_MS)
}

function playCzarShuffle() {
  if (!gridRef.value) return null
  const cards = Array.from(gridRef.value.querySelectorAll(".card-flip")) as HTMLElement[]
  if (!cards.length) return null

  const orderedCards = [...cards]
  gsap.set(orderedCards, { x: 0, y: 0 })
  orderedCards.sort((a, b) => {
    const ra = a.getBoundingClientRect()
    const rb = b.getBoundingClientRect()
    if (ra.top !== rb.top) return ra.top - rb.top
    return ra.left - rb.left
  })
  const rects = orderedCards.map((card) => card.getBoundingClientRect())
  const deltas = rects.map((rect, idx) => {
    const next = rects[(idx + 1) % rects.length]
    return { x: next.left - rect.left, y: next.top - rect.top }
  })

  gsap.killTweensOf(orderedCards)
  const tl = gsap.timeline()
  const cycles = 2
  const moveDuration = 0.45
  const resetDuration = 0.4
  const stagger = 0.05

  for (let cycle = 0; cycle < cycles; cycle += 1) {
    orderedCards.forEach((card, idx) => {
      const delta = deltas[idx]
      const yNudge = idx % 2 === 0 ? -6 : 6
      tl.to(
        card,
        {
          x: delta.x,
          y: delta.y + yNudge,
          duration: moveDuration,
          ease: "power2.inOut",
        },
        cycle * (moveDuration + resetDuration) + idx * stagger
      )
    })
    orderedCards.forEach((card, idx) => {
      const yNudge = idx % 2 === 0 ? 4 : -4
      tl.to(
        card,
        {
          x: 0,
          y: yNudge,
          duration: resetDuration,
          ease: "power2.out",
        },
        cycle * (moveDuration + resetDuration) + moveDuration + idx * stagger
      )
    })
  }
  orderedCards.forEach((card, idx) => {
    tl.to(
      card,
      {
        x: 0,
        y: 0,
        duration: 0.3,
        ease: "power2.out",
      },
      cycles * (moveDuration + resetDuration) + idx * 0.02
    )
  })

  const targetSeconds = 3
  const duration = tl.duration()
  if (duration > 0) {
    tl.timeScale(duration / targetSeconds)
  }
  return tl
}

function scheduleCzarRevealRetry() {
  if (czarRevealRetryTimeout) return
  czarRevealRetryTimeout = setTimeout(() => {
    czarRevealRetryTimeout = null
    tryStartCzarReveal()
  }, 120)
}

function tryStartCzarReveal() {
  if (!pendingCzarReveal) return
  if (!isCzarPhase.value) return
  setCzarRevealReady(false)
  emit("reveal-start")
  if (!gridRef.value) {
    scheduleCzarRevealRetry()
    return
  }
  const cards = Array.from(gridRef.value.querySelectorAll(".card-flip")) as HTMLElement[]
  if (!cards.length) {
    scheduleCzarRevealRetry()
    return
  }

  pendingCzarReveal = false
  const tl = playCzarShuffle()
  if (tl) {
    tl.eventCallback("onComplete", () => scheduleCzarFlip())
  } else {
    scheduleCzarFlip()
  }
}

watch(
  () => props.entries.length,
  () => {
    if (!isCzarPhase.value) return
    nextTick(() => tryStartCzarReveal())
  }
)

watch(
  () => lobby.phase,
  (phase, prev) => {
    if (phase === prev) return
    if (phase === "czar") {
      setCzarRevealReady(false)
      if (lobby.roundStartedTick > 0) {
        pendingCzarReveal = true
        nextTick(() => tryStartCzarReveal())
      }
    } else {
      pendingCzarReveal = false
      setCzarRevealReady(false)
    }
  }
)

onBeforeUnmount(() => {
  if (czarFlipTimeout) {
    clearTimeout(czarFlipTimeout)
    czarFlipTimeout = null
  }
  if (czarRevealReadyTimeout) {
    clearTimeout(czarRevealReadyTimeout)
    czarRevealReadyTimeout = null
  }
  if (czarRevealRetryTimeout) {
    clearTimeout(czarRevealRetryTimeout)
    czarRevealRetryTimeout = null
  }
})
</script>

<template>
  <div ref="gridRef" class="contents">
    <div
      v-for="entry in props.entries"
      :key="entry.playerId"
      class="card-flip card-responsive"
      :class="{
        'card-selectable': canCzarSelect,
        'card-selected': selectedCzarCardPlayerId === entry.playerId,
      }"
      :data-selected-player-id="entry.playerId"
      @click="onCzarCardSelect(entry)"
      @pointerdown="onPendingCardBoostPointerDown($event, entry.playerId)"
    >
      <div class="card-flip-inner">
        <div class="madness-card card-white card-responsive card-back card-flip-back" aria-hidden="true"></div>
        <div class="madness-card card-white card-responsive card-flip-front" v-html="isRevealPhase ? entry.resolved?.text : ''"></div>
      </div>
    </div>
  </div>
</template>
