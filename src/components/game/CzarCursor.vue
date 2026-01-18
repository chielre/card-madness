<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import type { PropType } from "vue"
import gsap from "gsap"

import { useConnectionStore } from "@/store/ConnectionStore"
import { useLobbyStore } from "@/store/LobbyStore"

const props = defineProps({
  boardAreaRef: { type: Object as PropType<HTMLElement | null>, default: null },
  boardGridRef: { type: Object as PropType<HTMLElement | null>, default: null },
  blackCardRef: { type: Object as PropType<HTMLElement | null>, default: null },
  czarRevealReady: { type: Boolean, required: true },
})

const emit = defineEmits<{
  (e: "hover-change", playerId: string | null): void
}>()

const lobby = useLobbyStore()
const connection = useConnectionStore()

const cursorRef = ref<HTMLElement | null>(null)
const cursorVisible = ref(false)
const lastCzarCursor = ref<{ x: number; y: number } | null>(null)
const isCzarPhase = computed(() => lobby.phase === "czar")
const isCurrentPlayerCardSelector = computed(() => lobby.getCurrentPlayerIsCzar())
let czarCursorRaf = 0
let czarCursorPending: { x: number; y: number } | null = null
let czarHoverCard: HTMLElement | null = null
let czarCursorSentVisible = false
let czarCursorHideTimeout: ReturnType<typeof setTimeout> | null = null
let czarCursorHotspot = { x: 0, y: 0 }
let czarCursorHiding = false
let hoverPlayerId: string | null = null

const CZAR_CURSOR_MARGIN_PX = 120
const CZAR_CURSOR_HIDE_DELAY_MS = 140
const CZAR_HOVER_PAD_PX = 60

type CursorRect = { left: number; top: number; width: number; height: number }

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function getAreaRect(el: HTMLElement | null): CursorRect | null {
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (!rect.width || !rect.height) return null
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
}

function mergeRects(a: CursorRect, b: CursorRect): CursorRect {
  const left = Math.min(a.left, b.left)
  const top = Math.min(a.top, b.top)
  const right = Math.max(a.left + a.width, b.left + b.width)
  const bottom = Math.max(a.top + a.height, b.top + b.height)
  return { left, top, width: right - left, height: bottom - top }
}

function getCursorAreaRect(): CursorRect | null {
  const areaRect = getAreaRect(props.boardAreaRef)
  const gridRect = getAreaRect(props.boardGridRef)
  if (areaRect && gridRect) return mergeRects(areaRect, gridRect)
  return areaRect ?? gridRect
}

function refreshCzarCursorHotspot() {
  const cursor = cursorRef.value
  if (!cursor) return
  const pointer = cursor.querySelector(".czar-cursor__pointer") as HTMLElement | null
  if (!pointer) {
    czarCursorHotspot = { x: 0, y: 0 }
    return
  }
  const cursorRect = cursor.getBoundingClientRect()
  const pointerRect = pointer.getBoundingClientRect()
  const pointerTipX = pointerRect.left + pointerRect.width / 2
  const pointerTipY = pointerRect.top + pointerRect.height
  const anchorX = cursorRect.left + cursorRect.width / 2
  const anchorY = cursorRect.top + cursorRect.height / 2
  czarCursorHotspot = { x: anchorX - pointerTipX, y: anchorY - pointerTipY }
}

function isCursorInBounds(x: number, y: number, rect: CursorRect | null = getCursorAreaRect()) {
  if (!rect) return false
  return (
    x >= rect.left - CZAR_CURSOR_MARGIN_PX
    && x <= rect.left + rect.width + CZAR_CURSOR_MARGIN_PX
    && y >= rect.top - CZAR_CURSOR_MARGIN_PX
    && y <= rect.top + rect.height + CZAR_CURSOR_MARGIN_PX
  )
}

function normalizeCursor(x: number, y: number, rect: CursorRect | null = getCursorAreaRect()) {
  if (!rect) return null
  const nx = (x - rect.left) / rect.width
  const ny = (y - rect.top) / rect.height
  return { x: clamp01(nx), y: clamp01(ny) }
}

function denormalizeCursor(pos: { x: number; y: number }, rect: CursorRect | null = getCursorAreaRect()) {
  if (!rect) return null
  return {
    x: Math.round(rect.left + pos.x * rect.width),
    y: Math.round(rect.top + pos.y * rect.height),
  }
}

function setHoverPlayer(next: string | null) {
  if (next === hoverPlayerId) return
  hoverPlayerId = next
  emit("hover-change", next)
}

function clearCzarHover() {
  if (!czarHoverCard) return
  czarHoverCard.classList.remove("czar-card-hover")
  czarHoverCard = null
  setHoverPlayer(null)
}

function getCzarHoverCardAt(x: number, y: number) {
  if (!props.boardGridRef) return null
  const cards = Array.from(props.boardGridRef.querySelectorAll(".card-flip")) as HTMLElement[]
  if (!cards.length) return null
  let best: { card: HTMLElement; dist: number } | null = null
  for (const card of cards) {
    const rect = card.getBoundingClientRect()
    const left = rect.left - CZAR_HOVER_PAD_PX
    const right = rect.right + CZAR_HOVER_PAD_PX
    const top = rect.top - CZAR_HOVER_PAD_PX
    const bottom = rect.bottom + CZAR_HOVER_PAD_PX
    if (x < left || x > right || y < top || y > bottom) continue
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dist = (x - cx) ** 2 + (y - cy) ** 2
    if (!best || dist < best.dist) {
      best = { card, dist }
    }
  }
  return best?.card ?? null
}

function updateCzarHoverAt(x: number, y: number) {
  if (!isCzarPhase.value || !props.czarRevealReady) {
    clearCzarHover()
    return
  }
  const nextCard = getCzarHoverCardAt(x, y)
  if (nextCard === czarHoverCard) return
  clearCzarHover()
  if (nextCard) {
    czarHoverCard = nextCard
    czarHoverCard.classList.add("czar-card-hover")
  }
  const playerId = nextCard?.getAttribute("data-selected-player-id") ?? null
  setHoverPlayer(playerId)
}

function getCzarCursorIntroPosition() {
  if (lastCzarCursor.value) {
    const lastPos = denormalizeCursor(lastCzarCursor.value)
    if (lastPos) return lastPos
  }
  const blackCard = props.blackCardRef
  if (blackCard) {
    const rect = blackCard.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  }
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
}

function setCzarCursorPosition(x: number, y: number) {
  const el = cursorRef.value
  if (!el) return
  gsap.set(el, {
    x: x + czarCursorHotspot.x,
    y: y + czarCursorHotspot.y,
    xPercent: -50,
    yPercent: -50,
  })
  updateCzarHoverAt(x, y)
}

function smoothCzarCursorPosition(x: number, y: number) {
  const el = cursorRef.value
  if (!el) return
  gsap.to(el, {
    x: x + czarCursorHotspot.x,
    y: y + czarCursorHotspot.y,
    duration: 0.14,
    ease: "power2.out",
    onUpdate: () => {
      const cx = Number(gsap.getProperty(el, "x"))
      const cy = Number(gsap.getProperty(el, "y"))
      updateCzarHoverAt(cx - czarCursorHotspot.x, cy - czarCursorHotspot.y)
    },
  })
}

function showCzarCursor() {
  const el = cursorRef.value
  if (!el) return
  const startPos = getCzarCursorIntroPosition()
  cursorVisible.value = true
  czarCursorHiding = false
  gsap.killTweensOf(el)
  el.classList.remove("czar-cursor--out")
  gsap.set(el, { x: startPos.x, y: startPos.y, xPercent: -50, yPercent: -50, scale: 0.2, autoAlpha: 0 })
  gsap.to(el, { scale: 1, autoAlpha: 1, duration: 0.32, ease: "back.out(1.6)" })
  requestAnimationFrame(() => refreshCzarCursorHotspot())
  setNativeCursorHidden(isCurrentPlayerCardSelector.value)
}

function hideCzarCursor(duration = 0.22, unhideNative = false) {
  const el = cursorRef.value
  if (!el) {
    cursorVisible.value = false
    clearCzarHover()
    setNativeCursorHidden(false)
    return
  }
  if (czarCursorHiding) return
  czarCursorHiding = true
  if (unhideNative) setNativeCursorHidden(false)
  gsap.killTweensOf(el)
  el.classList.add("czar-cursor--out")
  gsap.to(el, {
    scale: 0.6,
    autoAlpha: 0,
    duration,
    ease: "power3.in",
    onComplete: () => {
      cursorVisible.value = false
      czarCursorHiding = false
      clearCzarHover()
      setNativeCursorHidden(false)
    },
  })
}

function setNativeCursorHidden(hidden: boolean) {
  document.body.classList.toggle("czar-cursor-hide", hidden)
}

function emitCzarCursorUpdate(pos: { x: number; y: number }, visible = true) {
  const socket = connection.getSocketSafe()
  if (!socket) return
  socket.emit("czar:cursor-update", { lobbyId: lobby.lobbyId, x: pos.x, y: pos.y, visible })
}

function onCzarPointerMove(e: PointerEvent) {
  if (!isCzarPhase.value) return
  if (!isCurrentPlayerCardSelector.value) return
  const rect = getCursorAreaRect()
  if (!rect) return
  const inBounds = isCursorInBounds(e.clientX, e.clientY, rect)
  const normalized = normalizeCursor(e.clientX, e.clientY, rect)
  if (!normalized) return
  if (!inBounds) {
    czarCursorPending = null
    if (!czarCursorHideTimeout) {
      czarCursorHideTimeout = setTimeout(() => {
        czarCursorHideTimeout = null
        if (czarCursorSentVisible) {
          czarCursorSentVisible = false
          emitCzarCursorUpdate(normalized, false)
        }
        if (cursorVisible.value) hideCzarCursor(0.22, true)
      }, CZAR_CURSOR_HIDE_DELAY_MS)
    }
    return
  }
  if (czarCursorHideTimeout) {
    clearTimeout(czarCursorHideTimeout)
    czarCursorHideTimeout = null
  }
  czarCursorPending = normalized
  if (czarCursorRaf) return
  czarCursorRaf = window.requestAnimationFrame(() => {
    czarCursorRaf = 0
    if (!czarCursorPending) return
    const next = czarCursorPending
    czarCursorPending = null
    lastCzarCursor.value = next
    const pos = denormalizeCursor(next, rect)
    if (pos) setCzarCursorPosition(pos.x, pos.y)
    if (!czarCursorSentVisible) {
      czarCursorSentVisible = true
      if (!cursorVisible.value) showCzarCursor()
    }
    emitCzarCursorUpdate(next, true)
  })
}

function startCzarCursorTracking() {
  window.addEventListener("pointermove", onCzarPointerMove, true)
  window.addEventListener("pointerdown", onCzarPointerMove, true)
  czarCursorSentVisible = false
  czarCursorHiding = false
  if (czarCursorHideTimeout) {
    clearTimeout(czarCursorHideTimeout)
    czarCursorHideTimeout = null
  }
}

function stopCzarCursorTracking() {
  window.removeEventListener("pointermove", onCzarPointerMove, true)
  window.removeEventListener("pointerdown", onCzarPointerMove, true)
  if (czarCursorRaf) {
    window.cancelAnimationFrame(czarCursorRaf)
    czarCursorRaf = 0
  }
  czarCursorPending = null
  czarCursorSentVisible = false
  czarCursorHiding = false
  if (czarCursorHideTimeout) {
    clearTimeout(czarCursorHideTimeout)
    czarCursorHideTimeout = null
  }
  clearCzarHover()
  setNativeCursorHidden(false)
}

function onWindowResize() {
  refreshCzarCursorHotspot()
}

watch(
  () => lobby.czarCursorTick,
  () => {
    const payload = lobby.czarCursor
    if (!payload) return
    if (isCurrentPlayerCardSelector.value) return
    if (payload.visible === false) {
      if (cursorVisible.value) hideCzarCursor()
      return
    }
    const rect = getCursorAreaRect()
    if (!rect) return
    lastCzarCursor.value = { x: payload.x, y: payload.y }
    if (!isCzarPhase.value) return
    if (!cursorVisible.value) showCzarCursor()
    const pos = denormalizeCursor(payload, rect)
    if (!pos) return
    smoothCzarCursorPosition(pos.x, pos.y)
  }
)

watch(
  () => [isCzarPhase.value, isCurrentPlayerCardSelector.value],
  ([isCzar, isSelector]) => {
    if (isCzar && isSelector) startCzarCursorTracking()
    else stopCzarCursorTracking()
    if (!isCzar && cursorVisible.value) hideCzarCursor(0.18, true)
    if (cursorVisible.value) setNativeCursorHidden(isCzar && isSelector)
  },
  { immediate: true }
)

watch(
  () => props.czarRevealReady,
  (ready) => {
    if (!ready) clearCzarHover()
  }
)

onMounted(() => {
  window.addEventListener("resize", onWindowResize)
})

onBeforeUnmount(() => {
  stopCzarCursorTracking()
  hideCzarCursor()
  window.removeEventListener("resize", onWindowResize)
})

defineExpose({ clearHover: clearCzarHover })
</script>

<template>
  <div v-show="cursorVisible" ref="cursorRef" class="czar-cursor">
    <span class="czar-cursor__pulse czar-cursor__pulse--one"></span>
    <span class="czar-cursor__pulse czar-cursor__pulse--two"></span>
    <div class="czar-cursor__pointer"></div>
    <div class="czar-cursor__tag">CZAR</div>
  </div>
</template>
