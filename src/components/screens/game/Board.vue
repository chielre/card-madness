<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import gsap from "gsap"
import { CustomEase } from "gsap/CustomEase"
import { Sortable } from "@shopify/draggable"

import { resolveBlackCard, resolveWhiteCards } from "@/utils/cards"
import PersonIcon from "vue-material-design-icons/Account.vue"

import { useLobbyStore } from "@/store/LobbyStore"
import { useConnectionStore } from "@/store/ConnectionStore"
import { useAudioStore } from "@/store/AudioStore"
import { useUiStore } from '@/store/UiStore'

import CountdownTimer from "../../../components/CountdownTimer.vue"
import BaseButton from "../../../components/ui/BaseButton.vue"

gsap.registerPlugin(CustomEase)

const lobby = useLobbyStore()
const audioStore = useAudioStore()
const connection = useConnectionStore()
const ui = useUiStore()


/* ---------- refs ---------- */
const timerRef = ref<InstanceType<typeof CountdownTimer> | null>(null)
const timerWrapRef = ref<HTMLElement | null>(null)
const handRef = ref<HTMLElement | null>(null)
const playRef = ref<HTMLElement | null>(null)
const boardGridRef = ref<HTMLElement | null>(null)
const sortableRef = ref<Sortable | null>(null)

const transitionEl1 = ref<HTMLElement | null>(null)
const transitionEl2 = ref<HTMLElement | null>(null)
const transitionEl3 = ref<HTMLElement | null>(null)
const transitionEl4 = ref<HTMLElement | null>(null)

const BlackCardRef = ref<HTMLElement | null>(null)
const BlackCardGhostRef = ref<HTMLElement | null>(null)
const czarResultPlayerRef = ref<HTMLElement | null>(null)
const czarNextRoundButton = ref<HTMLElement | null>(null)

/* ---------- computed ---------- */
const currentPlayerCards = computed(() => lobby.getCurrentPlayerCards())
const isCurrentPlayerCardSelector = computed(() => lobby.getCurrentPlayerIsCardSelector())
const isBoardPhase = computed(() => lobby.phase === "board")
const isCzarPhase = computed(() => lobby.phase === "czar")
const isCzarResultPhase = computed(() => lobby.phase === "czar-result")
const isRevealPhase = computed(() => isCzarPhase.value || isCzarResultPhase.value)
const isRoundActive = computed(() => isBoardPhase.value && lobby.roundStartedTick > lobby.roundTimeoutTick)

const canCzarSelect = computed(() => isCzarPhase.value && isCurrentPlayerCardSelector.value)
const canStartNextRound = computed(() => isCzarResultPhase.value && isCurrentPlayerCardSelector.value)

const useEmptyBlackCard = ref(false)
const blackCardHtml = computed(() => lobby.getCurrentBlackCardHtml() || "...")
const blackCardDisplayHtml = computed(() =>
    useEmptyBlackCard.value ? blackCardEmptyHtml.value : blackCardHtml.value
)
const blackCardEmptyHtml = computed(() => {
    const blackCard = lobby.currentRound?.blackCard
    if (!blackCard) return blackCardHtml.value || "..."
    try {
        return resolveBlackCard(blackCard).text
    } catch {
        return blackCardHtml.value || "..."
    }
})
const selectedCzarCardPlayerId = computed(() => lobby.currentRound?.cardSelector?.selectedCard?.playerId ?? null)
const selectedCzarPlayer = computed(() => lobby.players.find((p) => p.id === selectedCzarCardPlayerId.value) ?? null)

const showDebugPhaseButtons = computed(() => {
    const stage = (import.meta as any).env?.STAGE
    const devButtons = (import.meta as any).env?.DEV_PHASE_BUTTONS
    return stage === "development" && String(devButtons) === "1"
})

const selectedCards = computed(() => {
    const entries = isRevealPhase.value
        ? (lobby.currentRound?.playerSelectedCards ?? [])
        : (lobby.currentRound?.playerSelectedCards ?? []).filter(
            (entry) => entry.playerId !== lobby.getCurrentPlayer()?.id
        )

    if (!entries.length) return []
    if (!isRevealPhase.value) return entries.map((entry) => ({ ...entry, resolved: null }))

    if (entries.some((entry) => !entry.card)) return entries.map((entry) => ({ ...entry, resolved: null }))

    const resolved = resolveWhiteCards(entries.map((entry) => entry.card))
    return entries.map((entry, idx) => ({ ...entry, resolved: resolved[idx] }))
})

/* ---------- selection lock (5s undo window) ---------- */
const CARD_LOCK_WINDOW_MS = 10000
const pendingCardState = ref(new Map<string, { status: "pending" | "locked" }>())
const pendingCardTimers = new Map<string, ReturnType<typeof setTimeout>>()

const getCurrentPlayerId = () => lobby.getCurrentPlayer()?.id ?? null

function setPendingState(playerId: string, status: "pending" | "locked" | null) {
    const next = new Map(pendingCardState.value)
    if (!status) next.delete(playerId)
    else next.set(playerId, { status })
    pendingCardState.value = next
}

function isCardPending(playerId: string) {
    const state = pendingCardState.value.get(playerId)
    return state?.status === "pending"
}

function isCardLocked(playerId: string) {
    const state = pendingCardState.value.get(playerId)
    if (state?.status === "locked") return true
    return !!lobby.currentRound?.playerSelectedCards?.find(
        (entry) => entry.playerId === playerId && entry.locked
    )
}

function ensurePendingRing(el: HTMLElement, durationMs: number) {
    if (el.querySelector(".card-pending-ring")) return
    const ring = document.createElement("div")
    ring.className = "card-pending-ring"
    ring.innerHTML =
        '<svg viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden="true"><rect x="2" y="2" width="96" height="146" rx="10" ry="10"></rect></svg>'
    ring.style.setProperty("--pending-duration", `${durationMs}ms`)
    el.appendChild(ring)
}

function removePendingRing(el: HTMLElement) {
    const ring = el.querySelector(".card-pending-ring")
    if (ring) ring.remove()
}

function getPendingCardEls(playerId: string) {
    const els: HTMLElement[] = []
    const currentId = getCurrentPlayerId()
    if (playerId === currentId) {
        const playCard = playRef.value?.querySelector(".draggable-card") as HTMLElement | null
        if (playCard) els.push(playCard)
    }
    const boardCard = boardGridRef.value?.querySelector(
        `[data-selected-player-id="${playerId}"]`
    ) as HTMLElement | null
    if (boardCard) els.push(boardCard)
    return els
}

function applyPendingVisuals(playerId: string, durationMs: number) {
    getPendingCardEls(playerId).forEach((el) => {
        el.classList.add("card-pending")
        ensurePendingRing(el, durationMs)
    })
}

function clearPendingVisuals(playerId: string) {
    const currentId = getCurrentPlayerId()
    if (currentId && playerId === currentId) {
        const removeLocalPending = (root: HTMLElement | null) => {
            if (!root) return
            root.querySelectorAll(".card-pending").forEach((el) => {
                el.classList.remove("card-pending")
                removePendingRing(el as HTMLElement)
            })
        }
        removeLocalPending(handRef.value)
        removeLocalPending(playRef.value)
    }
    getPendingCardEls(playerId).forEach((el) => {
        el.classList.remove("card-pending")
        removePendingRing(el)
    })
}

function wobbleTable() {
    if (!boardGridRef.value) return
    gsap.killTweensOf(boardGridRef.value)
    gsap.timeline()
        .to(boardGridRef.value, { rotateZ: 1.2, duration: 0.08, ease: "power2.out" })
        .to(boardGridRef.value, { rotateZ: -1, duration: 0.12, ease: "power2.inOut" })
        .to(boardGridRef.value, { rotateZ: 0.7, duration: 0.12, ease: "power2.inOut" })
        .to(boardGridRef.value, { rotateZ: 0, duration: 0.16, ease: "power2.out" })
}

function slamSelectedCard(playerId: string) {
    const els = getPendingCardEls(playerId)
    const target = els[0]
    if (!target) return

    gsap.killTweensOf(target)
    gsap.timeline()
        .to(target, { scale: 1.08, rotateZ: gsap.utils.random(-4, 4), duration: 0.18, ease: "power2.out" })
        .to(target, { y: 12, scale: 1.02, rotateZ: gsap.utils.random(-2, 2), duration: 0.15, ease: "power2.in" })
        .to(target, { y: 0, scale: 1, rotateZ: 0, duration: 0.2, ease: "power2.out" })

    wobbleTable()
}

function startPendingSelection(playerId: string, durationMs = CARD_LOCK_WINDOW_MS) {
    if (!playerId) return
    if (isCardPending(playerId)) return
    const existing = pendingCardTimers.get(playerId)
    if (existing) clearTimeout(existing)

    setPendingState(playerId, "pending")
    nextTick(() => applyPendingVisuals(playerId, durationMs))

    const timeout = setTimeout(() => {
        pendingCardTimers.delete(playerId)
        setPendingState(playerId, "locked")
        clearPendingVisuals(playerId)
        nextTick(() => slamSelectedCard(playerId))
    }, durationMs)

    pendingCardTimers.set(playerId, timeout)
}

function clearPendingSelection(playerId: string) {
    const timeout = pendingCardTimers.get(playerId)
    if (timeout) clearTimeout(timeout)
    pendingCardTimers.delete(playerId)
    setPendingState(playerId, null)
    clearPendingVisuals(playerId)
}

function resetPendingSelections() {
    Array.from(pendingCardTimers.values()).forEach((timer) => clearTimeout(timer))
    pendingCardTimers.clear()
    pendingCardState.value.forEach((_value, key) => clearPendingVisuals(key))
    pendingCardState.value = new Map()
}

/* ---------- transitions DRY ---------- */
const transitionEls = computed(
    () =>
        [transitionEl1.value, transitionEl2.value, transitionEl3.value, transitionEl4.value].filter(
            Boolean
        ) as HTMLElement[]
)

/* ---------- timer (fixed czar 17s hidden) ---------- */
const timerMode = ref<"round" | "czar">("round")
const timerVisible = ref(true)

const CZAR_TIMER_HIDE_SECONDS = 17
let timerStartTimeout: ReturnType<typeof setTimeout> | null = null

const timerPhases = new Set(["board", "czar"])
const shouldShowTimer = computed(() => timerPhases.has(lobby.phase))

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
    if (!lobby.roundStartedTick) return
    const { remainingSeconds } = getRemainingSeconds(lobby.roundTimerExpiresAt, lobby.roundTimerDurationMs)
    if (remainingSeconds <= 0) return
    timerMode.value = "round"
    timerRef.value?.start(remainingSeconds)
}

function startCzarTimer() {
    if (!lobby.roundStartedTick) return
    if (lobby.phaseTimerPhase !== "czar") return

    const durationMs = lobby.phaseTimerDurationMs ?? 0
    const expiresAt = lobby.phaseTimerExpiresAt ?? 0
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

    if (lobby.phase === "board") {
        setTimerVisibility(true)
        startRoundTimer()
        return
    }

    if (lobby.phase === "czar") startCzarTimer()
}

/* ---------- board helpers ---------- */
function syncPlaySlotState() {
    if (!playRef.value) return
    const hasCard = !!playRef.value.querySelector(".draggable-card")
    if (!hasCard) playRef.value.classList.remove("has-card")
    playRef.value.classList.toggle("has-card", hasCard)
}

function setCardPlacement(el: HTMLElement, inPlay: boolean) {
    if (inPlay) {
        el.classList.remove("card-sm")
        el.classList.add("card-responsive")
        el.style.setProperty("position", "absolute")
        el.style.setProperty("left", "50%")
        el.style.setProperty("top", "50%")
        el.style.setProperty("transform", "translate(-50%, -50%)")
        el.style.removeProperty("--p-tx")
        el.style.removeProperty("--p-ty")
        el.style.removeProperty("--p-rot")
        return
    }
    el.classList.remove("card-responsive")
    el.classList.add("card-sm")
    el.style.removeProperty("position")
    el.style.removeProperty("left")
    el.style.removeProperty("top")
    el.style.removeProperty("transform")
}

function clearPlaySlot() {
    if (!playRef.value) return
    playRef.value.querySelectorAll(".draggable-card").forEach((el) => el.remove())
    syncPlaySlotState()
}

/* ---------- czar flip ---------- */
const CZAR_FLIP_DELAY_MS = 350
let czarFlipTimeout: ReturnType<typeof setTimeout> | null = null
let pendingCzarReveal = false
let czarRevealRetryTimeout: ReturnType<typeof setTimeout> | null = null

function playCzarFlip() {
    if (!boardGridRef.value) return
    const cards = Array.from(boardGridRef.value.querySelectorAll(".card-flip")) as HTMLElement[]
    if (!cards.length) return

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
}

function scheduleCzarFlip() {
    if (czarFlipTimeout) clearTimeout(czarFlipTimeout)
    czarFlipTimeout = setTimeout(() => {
        czarFlipTimeout = null
        playCzarFlip()
    }, CZAR_FLIP_DELAY_MS)
}

function playCzarShuffle() {
    if (!boardGridRef.value) return
    const cards = Array.from(boardGridRef.value.querySelectorAll(".card-flip")) as HTMLElement[]
    if (!cards.length) return

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
    if (!boardGridRef.value) {
        scheduleCzarRevealRetry()
        return
    }
    const cards = Array.from(boardGridRef.value.querySelectorAll(".card-flip")) as HTMLElement[]
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

/* ---------- drag and drop (priming + sortable) ---------- */
const DRAG_DISTANCE = 120
const MAX_TRANSLATE = 14
const MAX_ROTATE = 12
const LIFT_Y = -10
const FOLLOW_FACTOR = 0.55

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
const hypot = (x: number, y: number) => Math.sqrt(x * x + y * y)

const drag = { source: null as HTMLElement | null, mirror: null as HTMLElement | null, startInPlay: false }

let lastPointerX = 0
let lastPointerY = 0

let primingEl: HTMLElement | null = null
let startX = 0
let startY = 0
let activePointerId: number | null = null
let captured = false

function applyPriming(el: HTMLElement, dx: number, dy: number) {
    const tx = clamp(dx * FOLLOW_FACTOR, -MAX_TRANSLATE, MAX_TRANSLATE)
    const ty = LIFT_Y + clamp(dy * FOLLOW_FACTOR, -MAX_TRANSLATE, MAX_TRANSLATE)

    const strength = clamp(hypot(dx, dy) / DRAG_DISTANCE, 0, 1)
    const rot = clamp((dx / DRAG_DISTANCE) * MAX_ROTATE, -MAX_ROTATE, MAX_ROTATE) * strength

    el.style.setProperty("--p-tx", `${tx}px`)
    el.style.setProperty("--p-ty", `${ty}px`)
    el.style.setProperty("--p-rot", `${rot}deg`)
}

function clearPrimingStyles(el: HTMLElement) {
    el.classList.remove("drag--priming")
    el.style.removeProperty("--p-tx")
    el.style.removeProperty("--p-ty")
    el.style.removeProperty("--p-rot")
}

function detachPrimingListeners() {
    window.removeEventListener("pointermove", onPointerMove, true)
    window.removeEventListener("pointerup", onPointerUp, true)
    window.removeEventListener("pointercancel", onPointerUp, true)
    window.removeEventListener("blur", onPointerUp, true)
}

function cleanupPriming() {
    if (!primingEl) return
    clearPrimingStyles(primingEl)

    if (captured && activePointerId !== null) {
        try {
            primingEl.releasePointerCapture(activePointerId)
        } catch { }
    }

    primingEl = null
    activePointerId = null
    captured = false
}

function resetDragState() {
    drag.source?.classList.remove("drag--source")
    drag.mirror?.classList.remove("drag--mirror")
    drag.source = null
    drag.mirror = null
    drag.startInPlay = false
    playRef.value?.classList.remove("play-slot--over")
    cleanupPriming()
    detachPrimingListeners()
}

function onPointerMove(e: PointerEvent) {
    if (!primingEl) return
    applyPriming(primingEl, e.clientX - startX, e.clientY - startY)
}

function onPointerUp() {
    cleanupPriming()
    detachPrimingListeners()
}

function onPointerDown(e: PointerEvent) {
    if (!isBoardPhase.value) return
    if (lobby.getCurrentPlayerIsCardSelector()) return
    const el = (e.target as HTMLElement | null)?.closest?.(".draggable-card") as HTMLElement | null
    if (!el) return
    const currentId = getCurrentPlayerId()
    if (currentId && playRef.value?.contains(el) && isUnselectBlocked(currentId)) return
    if (e.button !== 0 && e.pointerType === "mouse") return

    if (e.pointerType !== "mouse") e.preventDefault()

    cleanupPriming()
    detachPrimingListeners()

    primingEl = el
    startX = e.clientX
    startY = e.clientY
    activePointerId = e.pointerId

    primingEl.classList.add("drag--priming")
    applyPriming(primingEl, 0, 0)

    if (e.pointerType !== "mouse") {
        try {
            primingEl.setPointerCapture(e.pointerId)
            captured = true
        } catch { }
    }

    window.addEventListener("pointermove", onPointerMove, true)
    window.addEventListener("pointerup", onPointerUp, true)
    window.addEventListener("pointercancel", onPointerUp, true)
    window.addEventListener("blur", onPointerUp, true)
}

function getPointerPosition(evt: any) {
    const clientX = evt?.sensorEvent?.clientX
    const clientY = evt?.sensorEvent?.clientY
    if (typeof clientX === "number" && typeof clientY === "number") {
        lastPointerX = clientX
        lastPointerY = clientY
    }
    return { x: lastPointerX, y: lastPointerY }
}

function isOverPlaySlot(x: number, y: number) {
    if (!playRef.value) return false
    const elements = document.elementsFromPoint(x, y)
    return elements.some((el) => el === playRef.value || playRef.value!.contains(el))
}

function getCardFromEl(el: HTMLElement) {
    const pack = el.dataset.pack
    const cardId = el.dataset.cardId
    if (!pack || !cardId) return null
    return (
        lobby.getCurrentPlayerCards().find((c) => c.pack === pack && String(c.card_id) === String(cardId)) ??
        null
    )
}

function emitCardFromElement(el: HTMLElement, action: "selected" | "unselected") {
    const card = getCardFromEl(el)
    if (!card) return
    if (action === "selected") lobby.queueSelectedCard(card)
    else lobby.queueUnselectedCard(card)
}

function isUnselectBlocked(playerId: string | null) {
    if (!playerId) return false
    return isCardLocked(playerId)
}

/* ---------- selected card animation ---------- */
function getPlayDropPosition() {
    const gridEl = boardGridRef.value
    const playEl = playRef.value
    if (!gridEl || !playEl) return null

    const gridRect = gridEl.getBoundingClientRect()
    const playRect = playEl.getBoundingClientRect()

    const x = playRect.left - gridRect.left + playRect.width + 24
    const y = playRect.top - gridRect.top + playRect.height / 2 - 120
    return { x, y, gridEl }
}

function spawnSelectedCardAnim(cardText: string, action: "selected" | "unselected", playerId?: string) {
    const pos = getPlayDropPosition()
    if (!pos) return
    const currentId = getCurrentPlayerId()
    if (action === "unselected" && playerId && currentId && playerId === currentId) return

    if (action === "selected" && playerId) {
        const target = pos.gridEl.querySelector(`[data-selected-player-id="${playerId}"]`) as HTMLElement | null
        if (!target) return

        gsap.fromTo(
            target,
            { y: -220, rotateZ: gsap.utils.random(-12, 12), rotateX: 55, opacity: 0 },
            { y: 0, rotateZ: gsap.utils.random(-6, 6), rotateX: 0, opacity: 1, duration: 0.8, ease: "power2.out" }
        )
        return
    }

    if (action === "unselected" && playerId) {
        const target = pos.gridEl.querySelector(`[data-selected-player-id="${playerId}"]`) as HTMLElement | null
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

/* ---------- actions ---------- */
function onCzarCardSelect(entry: { playerId: string; card: any }) {
    if (!canCzarSelect.value) return
    lobby.queueCzarSelectedEntry(entry)
}

async function onNextRoundClick() {
    if (!canStartNextRound.value) return
    const socket = await connection.ensureSocket()
    socket.emit("round:next", { lobbyId: lobby.lobbyId })
}

async function onDebugNextPhase() {
    if (!showDebugPhaseButtons.value) return
    const socket = await connection.ensureSocket()
    const phase = lobby.phase
    const nextMap: Record<string, string> = {
        lobby: "starting",
        starting: "intro",
        intro: "board",
        board: "czar",
        czar: "czar-result",
        "czar-result": "board",
        results: "lobby",
    }
    const nextPhase = nextMap[phase]
    if (!nextPhase) return
    socket.emit("room:phase-set", { lobbyId: lobby.lobbyId, phase: nextPhase })
}

async function onDebugNextRound() {
    if (!showDebugPhaseButtons.value) return
    const socket = await connection.ensureSocket()
    socket.emit("round:next", { lobbyId: lobby.lobbyId })
}

/* ---------- czar result animations ---------- */
let blackCardCloneEl: HTMLElement | null = null
let whiteCardCloneEl: HTMLElement | null = null
let czarResultOutroTl: gsap.core.Timeline | null = null
let newBlackCardCloneEl: HTMLElement | null = null
let blackCardTypingFrame: number | null = null
const pendingNewBlackCardIntro = ref(false)

const showCzarResultButton = ref(false)

function positionCzarResultPlayer() {
    const el = czarResultPlayerRef.value
    if (!el) return

    const target = blackCardCloneEl ?? BlackCardRef.value
    if (!target) return

    const rect = target.getBoundingClientRect()
    const bottom = rect.height - 100
    const left = rect.left + rect.width / 2
    gsap.set(el, { bottom, left, xPercent: -50 })
}

function setBlackCardCloneHtml(html: string) {
    if (!blackCardCloneEl) return null
    blackCardCloneEl.innerHTML = ""
    const wrap = document.createElement("div")
    wrap.className = "czar-blackcard-text"
    wrap.innerHTML = html
    Object.assign(wrap.style, {
        position: "relative",
        width: "100%",
        height: "100%",
        pointerEvents: "none",
    })
    blackCardCloneEl.appendChild(wrap)
    return wrap
}

function getAnswerTextFromHtml(html: string) {
    const tmp = document.createElement("div")
    tmp.innerHTML = html
    const answerEl = tmp.querySelector(".card-answer") as HTMLElement | null
    return (answerEl?.innerText || answerEl?.textContent || "").trim()
}

function clearBlackCardTyping() {
    if (blackCardTypingFrame !== null) {
        cancelAnimationFrame(blackCardTypingFrame)
        blackCardTypingFrame = null
    }
}

function typeBlackCardAnswer(answerHtml: string, durationMs: number) {
    clearBlackCardTyping()
    const wrap = setBlackCardCloneHtml(blackCardEmptyHtml.value)
    if (!wrap) return
    const answerEl = wrap.querySelector(".card-answer") as HTMLElement | null
    const text = getAnswerTextFromHtml(answerHtml)
    if (!answerEl) return
    if (!text) return

    const total = text.length
    const start = performance.now()
    let lastCount = 0

    const step = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs)
        const count = Math.max(1, Math.ceil(total * t))
        if (count !== lastCount) {
            answerEl.textContent = text.slice(0, count)
            lastCount = count
        }
        if (t < 1) {
            blackCardTypingFrame = requestAnimationFrame(step)
        } else {
            blackCardTypingFrame = null
        }
    }

    blackCardTypingFrame = requestAnimationFrame(step)
}

function playCzarResultShine(target: HTMLElement | null) {
    if (!target) return
    const textWrap = target.querySelector(".czar-blackcard-text") as HTMLElement | null
    if (!textWrap) return
    const overlay = document.createElement("div")
    overlay.innerHTML = textWrap.innerHTML
    Object.assign(overlay.style, {
        position: "absolute",
        inset: "0",
        color: "transparent",
        background:
            "linear-gradient(120deg, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 45%, rgba(255,255,255,0) 80%)",
        backgroundSize: "200% 100%",
        backgroundPosition: "0% 50%",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        pointerEvents: "none",
        mixBlendMode: "screen",
        opacity: "0",
    })
    textWrap.appendChild(overlay)
    gsap.fromTo(
        overlay,
        { backgroundPosition: "-140% 50%", opacity: 0 },
        {
            duration: 1.3,
            ease: "power2.inOut",
            keyframes: [
                { backgroundPosition: "-140% 50%", opacity: 0 },
                { backgroundPosition: "120% 50%", opacity: 1 },
                { backgroundPosition: "240% 50%", opacity: 0 },
            ],
            onComplete: () => overlay.remove(),
        }
    )
}

function resetCzarResultAnimation() {
    czarResultOutroTl?.kill()
    czarResultOutroTl = null
    clearBlackCardTyping()

    if (BlackCardRef.value) gsap.set(BlackCardRef.value, { clearProps: "all", autoAlpha: 1 })
    if (BlackCardGhostRef.value) gsap.set(BlackCardGhostRef.value, { clearProps: "all", opacity: 0 })

    if (blackCardCloneEl) {
        blackCardCloneEl.remove()
        blackCardCloneEl = null
    }
    if (whiteCardCloneEl) {
        whiteCardCloneEl.remove()
        whiteCardCloneEl = null
    }
    if (newBlackCardCloneEl) {
        newBlackCardCloneEl.remove()
        newBlackCardCloneEl = null
    }

    if (transitionEls.value.length) gsap.set(transitionEls.value, { clearProps: "all" })
    if (czarResultPlayerRef.value) gsap.set(czarResultPlayerRef.value, { clearProps: "all" })

    showCzarResultButton.value = false
    pendingNewBlackCardIntro.value = false
    useEmptyBlackCard.value = false
}

async function startCzarResultAnimation() {
    useEmptyBlackCard.value = true
    await nextTick()

    const card = BlackCardRef.value
    const ghost = BlackCardGhostRef.value
    if (!card || !ghost) return

    czarResultOutroTl?.kill()
    czarResultOutroTl = null
    pendingNewBlackCardIntro.value = false

    gsap.set(ghost, { opacity: 0 })

    const rect = card.getBoundingClientRect()
    blackCardCloneEl = card.cloneNode(true) as HTMLElement
    setBlackCardCloneHtml(blackCardEmptyHtml.value)
    Object.assign(blackCardCloneEl.style, {
        position: "fixed",
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        margin: "0",
        zIndex: "80",
        transformOrigin: "center",
        pointerEvents: "none",
        overflow: "hidden",
        display: "block",
        visibility: "visible",
        opacity: "1",
    })
    blackCardCloneEl.classList.add("czar-blackcard-clone")
    document.body.appendChild(blackCardCloneEl)
    gsap.set(blackCardCloneEl, { autoAlpha: 1 })

    const selectedId = selectedCzarCardPlayerId.value
    const selectedFront = selectedId
        ? (boardGridRef.value?.querySelector(
            `[data-selected-player-id="${selectedId}"] .card-flip-front`
        ) as HTMLElement | null)
        : null
    if (whiteCardCloneEl) {
        whiteCardCloneEl.remove()
        whiteCardCloneEl = null
    }
    if (selectedFront) {
        const startLeft = window.innerWidth + rect.width * 0.4
        const startTop = rect.top
        whiteCardCloneEl = document.createElement("div")
        whiteCardCloneEl.className = "card-flip czar-whitecard-clone"
        whiteCardCloneEl.innerHTML = `
            <div class="madness-card card-white card-back card-flip-back" aria-hidden="true"></div>
            <div class="madness-card card-white card-flip-front">${selectedFront.innerHTML}</div>
        `
        Object.assign(whiteCardCloneEl.style, {
            position: "fixed",
            left: `${startLeft}px`,
            top: `${startTop}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            margin: "0",
            zIndex: "59",
            transformOrigin: "center",
            pointerEvents: "none",
        })
        whiteCardCloneEl.classList.add("czar-whitecard-clone")
        document.body.appendChild(whiteCardCloneEl)

        whiteCardCloneEl.querySelectorAll(".madness-card").forEach((el) => {
            const cardEl = el as HTMLElement
            cardEl.style.width = "100%"
            cardEl.style.height = "100%"
        })
    }

    gsap.set(card, { autoAlpha: 0, pointerEvents: "none" })

    CustomEase.create("cardBounce", "0.18,1.4,0.35,1")
    audioStore.playWrapCzarOnce()

    const tl = gsap.timeline()

    // circles DRY
    transitionEls.value.forEach((el, idx) => {
        tl.fromTo(
            el,
            { scale: 0 },
            { scale: 1.3, duration: 3, ease: "readyBounce" },
            0 + [0, 0.3, 0.4, 0.5][idx]
        )
    })

    const hasWhiteCard = Boolean(whiteCardCloneEl)
    const gap = Math.round(rect.width * 0.12)
    const offset = hasWhiteCard ? Math.round(rect.width / 2 + gap / 2) : 0

    gsap.set(blackCardCloneEl, {
        transformPerspective: 1200,
        transformStyle: "preserve-3d",
        backfaceVisibility: "hidden",
    })
    if (whiteCardCloneEl) {
        gsap.set(whiteCardCloneEl, { transformPerspective: 1200, transformStyle: "preserve-3d" })
        const whiteBack = whiteCardCloneEl.querySelector(".card-flip-back") as HTMLElement | null
        const whiteFront = whiteCardCloneEl.querySelector(".card-flip-front") as HTMLElement | null
        if (whiteBack && whiteFront) {
            gsap.set([whiteBack, whiteFront], { transformStyle: "preserve-3d", backfaceVisibility: "hidden" })
            gsap.set(whiteBack, { rotateY: 180, autoAlpha: 1, zIndex: 1 })
            gsap.set(whiteFront, { rotateY: 0, autoAlpha: 1, zIndex: 2 })
        }
    }

    tl.to(
        blackCardCloneEl,
        {
            left: "50%",
            top: "50%",
            xPercent: -50,
            yPercent: -50,
            x: -offset,
            rotate: gsap.utils.random(-5, 5),
            scale: 1.6,
            duration: 1,
            ease: "power3.inOut",
        },
        1
    )

    if (hasWhiteCard && whiteCardCloneEl) {
        tl.to(
            whiteCardCloneEl,
            {
                left: "50%",
                top: "50%",
                xPercent: -50,
                yPercent: -50,
                x: offset,
                rotate: gsap.utils.random(-5, 5),
                scale: 1.6,
                width: rect.width,
                height: rect.height,
                duration: 1,
                ease: "power3.inOut",
            },
            1
        )
    }

    tl.to(
        blackCardCloneEl,
        { scale: 1.3, rotate: gsap.utils.random(-4, 4), duration: 0.6, ease: "readyBounce" },
        2
    )
    if (hasWhiteCard && whiteCardCloneEl) {
        tl.to(
            whiteCardCloneEl,
            { scale: 1.3, rotate: gsap.utils.random(-4, 4), duration: 0.6, ease: "readyBounce" },
            2
        )
    }

    const spinStart = 3.05
    const spinDuration = 4
    const spinEnd = spinStart + spinDuration
    const typeDurationMs = 3000
    const spinSwapAt = spinStart + typeDurationMs / 1000
    const spinEase = "power3.inOut"

    if (hasWhiteCard && whiteCardCloneEl) {
        tl.to(
            blackCardCloneEl,
            {
                x: 0,
                z: 8,
                rotate: gsap.utils.random(-3, 3),
                duration: 0.4,
                ease: "power2.inOut",
            },
            2.6
        )
            .to(
                whiteCardCloneEl,
                {
                    x: 0,
                    z: -8,
                    rotate: gsap.utils.random(-3, 3),
                    duration: 0.4,
                    ease: "power2.inOut",
                },
                2.6
            )
            .to(
                [blackCardCloneEl, whiteCardCloneEl],
                { rotateY: 1800, duration: spinDuration, ease: spinEase },
                spinStart
            )
            .to(
                [blackCardCloneEl, whiteCardCloneEl],
                { y: -60, duration: spinDuration, ease: "sine.out" },
                spinStart
            )
            .call(() => {
                typeBlackCardAnswer(blackCardHtml.value, typeDurationMs)
            }, [], spinStart + 1)
            .call(
                () => {
                    clearBlackCardTyping()
                    setBlackCardCloneHtml(blackCardHtml.value)
                },
                [],
                spinSwapAt
            )
            .call(
                () => {
                    if (whiteCardCloneEl) gsap.set(whiteCardCloneEl, { autoAlpha: 0 })
                },
                [],
                spinEnd + 0.05
            )
            .to(
                blackCardCloneEl,
                { y: 0, duration: 0.35, ease: "power4.in" },
                spinEnd + 0.15
            )
            .call(() => playCzarResultShine(blackCardCloneEl), [], spinEnd + 0.55)
    } else {
        tl.to(
            blackCardCloneEl,
            { rotateY: 1800, duration: spinDuration, ease: spinEase },
            spinStart
        )
            .to(
                blackCardCloneEl,
                { y: -60, duration: spinDuration, ease: "sine.out" },
                spinStart
            )
            .call(() => {
                typeBlackCardAnswer(blackCardHtml.value, typeDurationMs)
            }, [], spinStart + 1)
            .call(() => {
                clearBlackCardTyping()
                setBlackCardCloneHtml(blackCardHtml.value)
            }, [], spinSwapAt)
            .to(
                blackCardCloneEl,
                { y: 0, duration: 0.35, ease: "power4.in" },
                spinEnd + 0.15
            )
            .call(() => playCzarResultShine(blackCardCloneEl), [], spinEnd + 0.55)
    }

    tl.call(() => positionCzarResultPlayer(), [], spinEnd + 0.6)
        .fromTo(
            czarResultPlayerRef.value,
            { y: 60, autoAlpha: 0 },
            { y: 0, autoAlpha: 1, duration: 0.5, ease: "power2.out", delay: 0.2 },
            spinEnd + 0.65
        )
        .call(() => {
            showCzarResultButton.value = true
        }, [], spinEnd + 0.65)
        .fromTo(
            czarNextRoundButton.value,
            { y: 60, autoAlpha: 0 },
            { y: 0, autoAlpha: 1, duration: 0.5, ease: "power2.out", delay: 0.2 },
            spinEnd + 2.35
        )
}

function startCzarResultOutroAnimation() {
    const ghost = BlackCardGhostRef.value
    const original = BlackCardRef.value
    if (!ghost || !original) {
        resetCzarResultAnimation()
        return
    }

    czarResultOutroTl?.kill()
    czarResultOutroTl = gsap.timeline({
        onComplete: () => {
            resetCzarResultAnimation()
            pendingNewBlackCardIntro.value = true
        },
    })

    if (czarResultPlayerRef.value) czarResultOutroTl.to(czarResultPlayerRef.value, { y: 20, autoAlpha: 0, duration: 0.25, ease: "power2.in" }, 0)
    if (czarNextRoundButton.value) czarResultOutroTl.to(czarNextRoundButton.value, { y: 20, autoAlpha: 0, duration: 0.25, ease: "power2.in" }, 0)

    if (transitionEls.value.length) {
        czarResultOutroTl.to(transitionEls.value, { scale: 0, duration: 0.6, ease: "power2.inOut", stagger: 0.05 }, 0)
    }

    if (!blackCardCloneEl) {
        resetCzarResultAnimation()
        return
    }

    czarResultOutroTl.to(
        blackCardCloneEl,
        {
            y: -window.innerHeight * 0.9,
            rotate: gsap.utils.random(-12, 12),
            scale: 0.9,
            duration: 0.6,
            ease: "power2.in",
        },
        0
    )
}

function animateNextBlackCardIn() {
    const card = BlackCardRef.value
    if (!card) return

    if (newBlackCardCloneEl) {
        newBlackCardCloneEl.remove()
        newBlackCardCloneEl = null
    }

    const rect = card.getBoundingClientRect()
    newBlackCardCloneEl = card.cloneNode(true) as HTMLElement
    Object.assign(newBlackCardCloneEl.style, {
        position: "fixed",
        left: `-${Math.round(rect.width)}px`,
        top: `${Math.round(window.innerHeight * 0.2)}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        margin: "0",
        zIndex: "60",
        transformOrigin: "center",
    })
    document.body.appendChild(newBlackCardCloneEl)
    gsap.set(card, { autoAlpha: 0 })

    gsap.timeline({
        onComplete: () => {
            if (newBlackCardCloneEl) {
                newBlackCardCloneEl.remove()
                newBlackCardCloneEl = null
            }
            gsap.set(card, { autoAlpha: 1 })
        },
    })
        .to(newBlackCardCloneEl, {
            left: `${Math.round(window.innerWidth + rect.width)}px`,
            rotate: gsap.utils.random(-8, 8),
            duration: 0.9,
            ease: "power2.inOut",
        })
        .to(
            newBlackCardCloneEl,
            {
                left: rect.left,
                top: rect.top,
                rotate: gsap.utils.random(-4, 4),
                y: -18,
                duration: 0.7,
                ease: "power2.out",
            },
            ">-0.15"
        )
        .to(
            newBlackCardCloneEl,
            {
                y: 0,
                duration: 0.25,
                ease: "power3.in",
            },
            ">-0.05"
        )
}

/* ---------- expose ---------- */
const runIntroAnimation = () => { }

/* ---------- watchers (DRY) ---------- */
watch(
    () => lobby.currentRound,
    (round) => {
        if (!round) return
        if (pendingNewBlackCardIntro.value && lobby.phase === "board") {
            pendingNewBlackCardIntro.value = false
            nextTick(() => animateNextBlackCardIn())
        }
    }
)

watch(
    () => shouldShowTimer.value,
    (show) => setTimerVisibility(show),
    { immediate: true }
)

watch(
    () => [
        lobby.phase,
        lobby.roundStartedTick,
        lobby.roundTimerExpiresAt,
        lobby.roundTimerDurationMs,
        lobby.phaseTimerPhase,
        lobby.phaseTimerExpiresAt,
        lobby.phaseTimerDurationMs,
    ],
    () => refreshTimer(),
    { immediate: true }
)

watch(
    () => lobby.roundStartedTick,
    (tick) => {
        if (!tick) return
        if (!playRef.value) return
        playRef.value.querySelectorAll(".draggable-card").forEach((el) => el.remove())
        syncPlaySlotState()
        resetPendingSelections()
        resetDragState()
        if (lobby.phase === "board" && !pendingNewBlackCardIntro.value) {
            nextTick(() => animateNextBlackCardIn())
        }
    }
)

watch(
    () => selectedCards.value.length,
    () => {
        if (!isCzarPhase.value) return
        nextTick(() => tryStartCzarReveal())
    }
)

watch(
    () => lobby.phase,
    (phase, prev) => {
        if (phase === prev) return

        if (phase !== "board") resetPendingSelections()

        switch (phase) {
            case "czar":
                if (lobby.roundStartedTick > 0) {
                    audioStore.playWrapOnce()
                    clearPlaySlot()
                    pendingCzarReveal = true
                    nextTick(() => tryStartCzarReveal())
                }
                break

            case "czar-result":
                resetTimer()
                startCzarResultAnimation()
                break

            default:
                if (prev === "czar-result" && phase === "board") {
                    startCzarResultOutroAnimation()
                } else {
                    resetCzarResultAnimation()
                }
                break
        }
    }
)

watch(
    () => lobby.selectedCardAnimTick,
    (tick) => {
        if (!tick) return
        const cardText = lobby.lastSelectedCard?.card?.text ?? ""
        const action = (lobby.lastSelectedCard?.action ?? "selected") as "selected" | "unselected"
        const playerId = lobby.lastSelectedCard?.playerId
        if (playerId) {
            if (action === "selected" && lobby.phase === "board") {
                const durationMs = lobby.selectionLockDurationMs || CARD_LOCK_WINDOW_MS
                const expiresAt = lobby.selectionLockExpiresAt
                const remainingMs = expiresAt ? Math.max(0, expiresAt - Date.now()) : durationMs
                startPendingSelection(playerId, remainingMs)
            }
            if (action === "unselected") clearPendingSelection(playerId)
        }
        if (action === "selected") nextTick(() => spawnSelectedCardAnim(cardText, action, playerId))
        else spawnSelectedCardAnim(cardText, action, playerId)
    }
)

/* ---------- mount/unmount ---------- */
onMounted(() => {
    if (timerWrapRef.value && !shouldShowTimer.value) {
        setTimerVisibility(false)
        timerVisible.value = false
    }
})

onMounted(() => {
    if (!handRef.value || !playRef.value) return

    handRef.value.addEventListener("pointerdown", onPointerDown)
    playRef.value.addEventListener("pointerdown", onPointerDown)

    const sortable = new Sortable([handRef.value, playRef.value], {
        draggable: ".draggable-card",
        distance: DRAG_DISTANCE,
        mirror: { constrainDimensions: true, appendTo: document.body },
    })

    sortable.on("drag:start", (evt: any) => {
        if (!isBoardPhase.value || lobby.getCurrentPlayerIsCardSelector()) {
            evt.cancel()
            return
        }

        const currentId = getCurrentPlayerId()
        if (currentId && isUnselectBlocked(currentId)) {
            evt.cancel()
            return
        }

        if (playRef.value) {
            const source = evt.source as HTMLElement
            if (currentId && source && playRef.value.contains(source) && isUnselectBlocked(currentId)) {
                evt.cancel()
                return
            }
        }
        audioStore.playPop()

        cleanupPriming()
        detachPrimingListeners()

        drag.source = evt.source as HTMLElement
        drag.source.classList.add("drag--source")
        drag.startInPlay = playRef.value ? playRef.value.contains(drag.source) : false
    })

    sortable.on("drag:move", (evt: any) => {
        const { x, y } = getPointerPosition(evt)
        if (playRef.value) {
            const overPlay = isOverPlaySlot(x, y)
            playRef.value.classList.toggle("play-slot--over", overPlay)
        }
    })

    sortable.on("sortable:sort", (evt: any) => {
        if (!playRef.value) return
        if (evt.overContainer !== playRef.value) return

        const source = evt.dragEvent?.source as HTMLElement | undefined
        if (!source || playRef.value.contains(source)) return

        const playCards = playRef.value.querySelectorAll(".draggable-card")
        if (playCards.length > 0) evt.cancel()
    })

    sortable.on("mirror:created", (evt: any) => {
        drag.mirror = evt.mirror as HTMLElement
        drag.mirror.classList.add("drag--mirror")
    })

    sortable.on("drag:stop", (evt: any) => {
        if (playRef.value && handRef.value && drag.source) {
            const { x, y } = getPointerPosition(evt)
            const overPlay = isOverPlaySlot(x, y)
            const wasInPlay = drag.startInPlay
            const currentId = getCurrentPlayerId()
            const unselectBlocked = currentId ? isUnselectBlocked(currentId) : false
            const shouldUnselect = wasInPlay && !overPlay && !unselectBlocked

            if (wasInPlay && unselectBlocked && !overPlay) {
                playRef.value.appendChild(drag.source)
                setCardPlacement(drag.source, true)
            } else if (overPlay) {
                const existing = playRef.value.querySelector(".draggable-card")
                if (existing && existing !== drag.source) {
                    setCardPlacement(drag.source, false)
                    handRef.value.appendChild(drag.source)
                    resetDragState()
                    syncPlaySlotState()
                    return
                }
                playRef.value.appendChild(drag.source)
                setCardPlacement(drag.source, true)
                emitCardFromElement(drag.source, "selected")
                if (currentId) {
                    const durationMs = lobby.selectionLockDurationMs || CARD_LOCK_WINDOW_MS
                    startPendingSelection(currentId, durationMs)
                }
            } else {
                if (playRef.value.contains(drag.source)) {
                    setCardPlacement(drag.source, false)
                    handRef.value.appendChild(drag.source)
                }
                if (shouldUnselect) {
                    emitCardFromElement(drag.source, "unselected")
                    if (currentId) clearPendingSelection(currentId)
                }
            }
        }

        playRef.value?.classList.remove("play-slot--over")
        resetDragState()
        syncPlaySlotState()
    })

    sortableRef.value = sortable
    syncPlaySlotState()
})

onBeforeUnmount(() => {
    sortableRef.value?.destroy()

    handRef.value?.removeEventListener("pointerdown", onPointerDown)
    playRef.value?.removeEventListener("pointerdown", onPointerDown)

    clearTimerTimeout()

    if (czarFlipTimeout) {
        clearTimeout(czarFlipTimeout)
        czarFlipTimeout = null
    }
    if (czarRevealRetryTimeout) {
        clearTimeout(czarRevealRetryTimeout)
        czarRevealRetryTimeout = null
    }

    resetCzarResultAnimation()
    resetDragState()
    resetPendingSelections()
})

defineExpose({ runIntroAnimation })
</script>

<template>
    <div class="flex justify-center items-center">
        <div ref="transitionEl1" class="fixed aspect-square scale-0 translate-[-50%,-50%] bg-pink-300/70 z-10 w-screen rounded-full"></div>
        <div ref="transitionEl2" class="fixed aspect-square scale-0 translate-[-50%,-50%] bg-green-300/70 z-10 w-screen rounded-full"></div>
        <div ref="transitionEl3" class="fixed aspect-square scale-0 translate-[-50%,-50%] bg-blue-300/70 z-10 w-screen rounded-full"></div>
        <div ref="transitionEl4" class="fixed aspect-square scale-0 translate-[-50%,-50%] bg-purple-800 z-10 w-screen rounded-full"></div>

        <div>
            <!-- timer -->
            <div class="absolute top-0 w-screen px-8 left-[50%] translate-x-[-50%] flex justify-between z-30">
                <div class="p-4 flex-1 flex items-center">
                    <img class="" width="150" src="../../../assets/images/logo.png" alt="" />
                </div>

                <div ref="timerWrapRef" class="bg-[#2b0246] px-16 py-4 rounded-b-4xl border-2 border-black border-t-0">
                    <CountdownTimer ref="timerRef" :initial-seconds="240" :auto-start="false" :mode="timerMode" />
                </div>

                <div class="p-4 flex-1 flex items-center justify-end gap-4">
                    <BaseButton size="md" color="pink" @click="ui.openSettings" icon="Cog"></BaseButton>
                    <BaseButton size="md" color="pink" icon="Logout"></BaseButton>
                </div>
            </div>

            <!-- players -->
            <div class="absolute left-0 top-[50%] translate-y-[-50%] flex gap-2">
                <div class="bg-white border-4 border-b-8 border-l-0 rounded-xl rounded-l-none border-black p-2 text-black">
                    <ul class="space-y-2">
                        <li v-for="player in lobby.players" :key="player.id" class="group flex justify-between items-center gap-4 text-black text-xl font-bold p-2 rounded-xl even:bg-gray-100">
                            <div class="flex items-center gap-4">
                                <div class="inline-block flex-1 w-4 h-4 border-3 border-white outline-2 outline-black bg-green-500 rounded-full"></div>
                                <div>{{ player.name }}</div>
                            </div>

                            <div v-if="lobby.isPlayerCardSelector(player.id)" class="text-xs font-bold px-2 py-1 rounded-full bg-yellow-300 text-black border-2 border-b-4 border-black">
                                Card Czar
                            </div>
                        </li>
                    </ul>
                </div>
            </div>

            <div class="flex items-center">
                <div class="pr-10 bg-white border-2 border-b-5 rounded-xl border-black p-6 text-black">
                    <div class="relative">
                        <div ref="BlackCardGhostRef" class="madness-card card-black card-anim invisible pointer-events-none select-none" v-html="blackCardDisplayHtml"></div>
                        <div class="absolute inset-0">
                            <div ref="BlackCardRef" class="madness-card card-black card-anim" v-html="blackCardDisplayHtml"></div>
                        </div>
                    </div>
                </div>

                <div ref="boardGridRef" class="-ml-6 bg-[#2b0246] grid grid-cols-5 gap-8 w-3xl border-4 backdrop-blur-sm rounded-xl border-black p-6 transition-all" style="position: relative; perspective: 1200px">
                    <div v-show="isRoundActive && !isCurrentPlayerCardSelector" class="play-zone">
                        <div ref="playRef" class="play-slot">
                            <div class="madness-card card-white card-responsive play-slot-mirror" aria-hidden="true"></div>
                            <div class="play-placeholder border-3 border-dashed border-white/60 rounded-xl text-white/70 px-6 py-8 text-center text-sm">
                                Sleep hier je kaart
                            </div>
                        </div>
                    </div>

                    <div v-for="entry in selectedCards" :key="entry.playerId" class="card-flip card-responsive" :class="{
                        'card-selectable': canCzarSelect,
                        'card-selected': selectedCzarCardPlayerId === entry.playerId,
                    }" :data-selected-player-id="entry.playerId" @click="onCzarCardSelect(entry)">
                        <div class="madness-card card-white card-responsive card-back card-flip-back" aria-hidden="true"></div>
                        <div class="madness-card card-white card-responsive card-flip-front" v-html="isRevealPhase ? entry.resolved?.text : ''"></div>
                    </div>
                </div>
            </div>

            <div class="absolute bottom-0 left-0 right-0 flex justify-center">
                <div v-show="isRoundActive" ref="handRef" class="hand-deck z-10 relative" :class="{ 'hand-deck--active': isRoundActive, 'hand-deck--czar': isCurrentPlayerCardSelector }">
                    <div v-for="(white_card, index) in currentPlayerCards" :key="`${white_card.pack}-${white_card.card_id}-${index}`" class="madness-card card-white card-sm draggable-card" :data-pack="white_card.pack" :data-card-id="white_card.card_id" v-html="white_card.text"></div>

                    <div v-if="isCurrentPlayerCardSelector" class="hand-czar-banner">Jij bent de Card Czar</div>
                </div>
            </div>

            <div v-show="isCzarResultPhase" ref="czarResultPlayerRef" class="fixed opacity-0 z-20 pointer-events-none">
                <div class="text-2xl flex items-center gap-3 font-bold text-white">
                    <template v-if="selectedCzarPlayer?.id === lobby.getCurrentPlayer()?.id">
                        <span>czar</span>
                        <div class="flex gap-2 bg-white border-3 text-lg border-purple-950 border-b-6 px-3 py-2 rounded-xl text-purple-950 font-black">
                            <PersonIcon />
                            {{ lobby.getCurrentCardSelector()?.name ?? "A player" }}
                        </div>
                        koos jou kaart!
                    </template>

                    <template v-else>
                        <span>czar</span>
                        <div class="flex gap-2 bg-white border-3 text-lg border-purple-950 border-b-6 px-3 py-2 rounded-xl text-purple-950 font-black">
                            <PersonIcon />
                            {{ lobby.getCurrentCardSelector()?.name ?? "A player" }}
                        </div>
                        koos de kaart van
                        <div class="flex gap-2 bg-white border-3 text-lg border-purple-950 border-b-6 px-3 py-2 rounded-xl text-purple-950 font-black">
                            <PersonIcon />
                            {{ selectedCzarPlayer?.name ?? "A player" }}
                        </div>
                    </template>
                </div>
            </div>

            <div v-show="canStartNextRound" ref="czarNextRoundButton" class="fixed left-1/2 bottom-12 -translate-x-1/2 z-[80] pointer-events-auto">
                <BaseButton size="lg" @click="onNextRoundClick">Volgende ronde</BaseButton>
            </div>

            <div v-if="showDebugPhaseButtons" class="fixed bottom-6 right-6 z-[90] flex flex-col gap-3 pointer-events-auto">
                <BaseButton size="md" @click="onDebugNextPhase">Debug: Next phase</BaseButton>
                <BaseButton size="md" @click="onDebugNextRound" :disabled="!isCzarResultPhase">Debug: Next round</BaseButton>
            </div>
        </div>
    </div>
</template>
