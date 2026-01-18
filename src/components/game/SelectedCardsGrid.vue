<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue"
import type { PropType } from "vue"
import gsap from "gsap"
import { useLobbyStore } from "@/store/LobbyStore"
import type { SelectedCardEntry } from "@/store/LobbyStore"

const props = defineProps({
  isCardLocked: { type: Function as PropType<(playerId: string) => boolean>, required: true },
  playRef: { type: Object as PropType<HTMLElement | null>, default: null },
  boardGridRef: { type: Object as PropType<HTMLElement | null>, default: null },
})

const emit = defineEmits<{
  (event: "reveal-ready", ready: boolean): void
  (event: "reveal-start"): void
}>()

const lobby = useLobbyStore()
const gridRef = ref<HTMLElement | null>(null)

const isCzarPhase = computed(() => lobby.phase === "czar")
const isCzarResultPhase = computed(() => lobby.phase === "czar-result")
const isRevealPhase = computed(() => isCzarPhase.value || isCzarResultPhase.value)
const isCurrentPlayerCardSelector = computed(() => lobby.getCurrentPlayerIsCzar())
const canCzarSelect = computed(() => isCzarPhase.value && isCurrentPlayerCardSelector.value)
const selectedCzarCardPlayerId = computed(() => lobby.currentRound?.cardSelector?.selectedCard?.playerId ?? null)
const currentPlayerId = computed(() => lobby.getCurrentPlayer()?.id ?? null)

const selectedEntries = computed<SelectedCardEntry[]>(() => lobby.getSelectedEntriesForBoard())

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

function onCzarCardSelect(entry: SelectedCardEntry) {
  if (!canCzarSelect.value) return
  lobby.queueCzarSelectedEntry(entry as { playerId: string; card: any })
}

function requestLockBoost(playerId: string) {
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

function getGridContainer() {
  if (props.boardGridRef) return props.boardGridRef
  return (gridRef.value?.parentElement ?? gridRef.value) as HTMLElement | null
}

function getPlayDropPosition() {
  const gridEl = getGridContainer()
  const playEl = props.playRef
  if (!gridEl || !playEl) return null

  const gridRect = gridEl.getBoundingClientRect()
  const playRect = playEl.getBoundingClientRect()

  const x = playRect.left - gridRect.left + playRect.width + 24
  const y = playRect.top - gridRect.top + playRect.height / 2 - 120
  return { x, y, gridEl }
}

function spawnSelectedCardAnim(cardText: string, action: "selected" | "unselected", playerId?: string) {
  const gridEl = getGridContainer()
  if (!gridEl) return
  const currentId = currentPlayerId.value
  if (action === "unselected" && playerId && currentId && playerId === currentId) return

  if (action === "selected" && playerId) {
    const target = gridEl.querySelector(`[data-selected-player-id="${playerId}"]`) as HTMLElement | null
    if (!target) return

    gsap.fromTo(
      target,
      { y: -220, rotateZ: gsap.utils.random(-12, 12), rotateX: 55, opacity: 0 },
      { y: 0, rotateZ: gsap.utils.random(-6, 6), rotateX: 0, opacity: 1, duration: 0.8, ease: "power2.out" }
    )
    return
  }

  if (action === "unselected" && playerId) {
    const target = gridEl.querySelector(`[data-selected-player-id="${playerId}"]`) as HTMLElement | null
    if (target) {
      const rect = target.getBoundingClientRect()
      const clone = target.cloneNode(true) as HTMLElement
      Object.assign(clone.style, {
        position: "fixed",
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        margin: "0",
        pointerEvents: "none",
        transformOrigin: "center",
      })
      document.body.appendChild(clone)
      gsap.fromTo(
        clone,
        { y: 0, rotateZ: gsap.utils.random(-6, 6), rotateX: 0, opacity: 1 },
        {
          y: -220,
          rotateZ: gsap.utils.random(-12, 12),
          rotateX: 55,
          opacity: 0,
          duration: 0.8,
          ease: "power2.out",
          onComplete: () => clone.remove(),
        }
      )
      return
    }
  }

  const pos = getPlayDropPosition()
  if (!pos) return
  const el = document.createElement("div")
  el.className = "madness-card card-back"
  el.innerHTML = cardText || "..."
  el.style.position = "absolute"
  el.style.left = `${pos.x}px`
  el.style.top = `${pos.y}px`
  el.style.pointerEvents = "none"
  el.style.transformStyle = "preserve-3d"
  pos.gridEl.appendChild(el)

  gsap.fromTo(
    el,
    { y: 0, rotateZ: gsap.utils.random(-6, 6), rotateX: 0, opacity: 1 },
    {
      y: -220,
      rotateZ: gsap.utils.random(-12, 12),
      rotateX: 55,
      opacity: 0,
      duration: 0.8,
      ease: "power2.out",
      onComplete: () => el.remove(),
    }
  )
}

function handleSelectedCardAnim(tick: number) {
  if (!tick) return
  const cardText = lobby.lastSelectedCard?.card?.text ?? ""
  const action = (lobby.lastSelectedCard?.action ?? "selected") as "selected" | "unselected"
  const playerId = lobby.lastSelectedCard?.playerId
  const isSync = !!lobby.lastSelectedCard?.sync
  if (isSync) return
  if (action === "selected") nextTick(() => spawnSelectedCardAnim(cardText, action, playerId))
  else spawnSelectedCardAnim(cardText, action, playerId)
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
  () => lobby.selectedCardAnimTick,
  handleSelectedCardAnim
)

watch(
  () => selectedEntries.value.length,
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
      v-for="entry in selectedEntries"
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
