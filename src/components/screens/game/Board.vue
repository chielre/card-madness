<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import gsap from "gsap"
import { Sortable } from "@shopify/draggable"

import { resolveBlackCard } from "@/utils/cards"

import { useLobbyStore } from "@/store/LobbyStore"
import { useAudioStore } from "@/store/AudioStore"
import { useUiStore } from '@/store/UiStore'

// CHECK config
import CzarCursor from "@/components/game/CzarCursor.vue"
import { CZAR_HOVER_TYPE_MS } from "@/components/game/czarCursorConfig"

import BoardTimer from "@/components/game/BoardTimer.vue"

// CHECK config
import SelectedCardsGrid from "@/components/game/SelectedCardsGrid.vue"
import { usePendingSelections } from "@/components/game/usePendingSelections"
import PlayerList from "@/components/game/PlayerList.vue"
import TrashCan from "vue-material-design-icons/TrashCan.vue"

import BaseButton from "../../../components/ui/BaseButton.vue"

const lobby = useLobbyStore()
const audioStore = useAudioStore()
const ui = useUiStore()


const handRef = ref<HTMLElement | null>(null)
const playRef = ref<HTMLElement | null>(null)
const trashRef = ref<HTMLElement | null>(null)
const boardGridRef = ref<HTMLElement | null>(null)
const boardAreaRef = ref<HTMLElement | null>(null)
const sortableRef = ref<Sortable | null>(null)
const BlackCardRef = ref<HTMLElement | null>(null)
const czarCursorComponentRef = ref<InstanceType<typeof CzarCursor> | null>(null)


const currentPlayerId = computed(() => lobby.getCurrentPlayerId())
const currentPlayerCards = computed(() => lobby.getCurrentPlayerWhiteCards())
const isCurrentPlayerCzar = computed(() => lobby.getCurrentPlayerIsCzar())
const isBoardPhase = computed(() => lobby.phase === "board")
const isCzarPhase = computed(() => lobby.phase === "czar")
const isRoundActive = computed(() => isBoardPhase.value && lobby.roundStartedTick > lobby.roundTimeoutTick)
const isWaitingForRound = computed(() => lobby.isCurrentPlayerWaitingForRound())

// trash / swap zone: visible while the player is an active card-player this round,
// but only usable (drops accepted) when they can afford the swap cost.
const showTrash = computed(() => lobby.isCardSwapEnabled() && isRoundActive.value && !isCurrentPlayerCzar.value && !isWaitingForRound.value)
const canSwapCard = computed(() => lobby.canCurrentPlayerSwapCard())

const blackCardHtml = computed(() => lobby.getCurrentBlackCardHtml() || "...")
const blackCardTemplateHtml = computed(() => {
    const blackCard = lobby.currentRound?.blackCard
    if (!blackCard) return blackCardHtml.value || "..."
    try {
        return resolveBlackCard(blackCard).text
    } catch {
        return blackCardHtml.value || "..."
    }
})

const CARD_LOCK_WINDOW_MS = 10000
const LOCK_BOOST_PULSE_MS = 220

let czarHoverPlayerId: string | null = null
const czarRevealReady = ref(false)


const {
    isCardPending,
    isCardLocked,
    startPendingSelection,
    refreshPendingSelection,
    clearPendingSelection,
    resetPendingSelections,
    pulsePendingCard,
} = usePendingSelections({
    lobby,
    handRef,
    playRef,
    boardGridRef,
    getCurrentPlayerId: () => currentPlayerId.value,
    cardLockWindowMs: CARD_LOCK_WINDOW_MS,
    lockBoostPulseMs: LOCK_BOOST_PULSE_MS,
})

/* ---------- play set (one drop slot per :answer of the black card) ---------- */
// Number of white cards the player must play this round = the black card's answer count.
const answerCount = computed(() => lobby.getCurrentBlackCardAnswerCount())

function slotEls(): HTMLElement[] {
    if (!playRef.value) return []
    return Array.from(playRef.value.querySelectorAll<HTMLElement>(".play-slot"))
}
function slotCardEl(slot: HTMLElement): HTMLElement | null {
    return slot.querySelector<HTMLElement>(".draggable-card")
}
function playCardEls(): HTMLElement[] {
    // cards in slot order (so the set keeps the answer order)
    return slotEls()
        .map((slot) => slotCardEl(slot))
        .filter((el): el is HTMLElement => !!el)
}
function slotForPoint(x: number, y: number): HTMLElement | null {
    const els = document.elementsFromPoint(x, y)
    for (const slot of slotEls()) {
        if (els.some((el) => el === slot || slot.contains(el))) return slot
    }
    return null
}
function firstEmptySlot(): HTMLElement | null {
    return slotEls().find((slot) => !slotCardEl(slot)) ?? null
}
function isSetComplete() {
    const slots = slotEls()
    return slots.length > 0 && slots.every((slot) => !!slotCardEl(slot))
}
function orderedPlacedCards() {
    return playCardEls()
        .map((el) => getCardFromEl(el))
        .filter((c): c is NonNullable<typeof c> => !!c)
}
function setKeyOf(cards: { pack: string; card_id: number | string }[]) {
    return cards.map((c) => `${c.pack}:${c.card_id}`).join("|")
}
// the composition of the set most recently sent to the server (null = nothing submitted)
let lastEmittedSetKey: string | null = null

function clearPlayOverState() {
    if (!playRef.value) return
    playRef.value.classList.remove("play-set--over")
    playRef.value.querySelectorAll(".play-slot").forEach((s) => s.classList.remove("play-slot--over"))
}

/* ---------- board helpers ---------- */
function syncPlaySlotState() {
    if (!playRef.value) return
    slotEls().forEach((slot) => slot.classList.toggle("is-filled", !!slotCardEl(slot)))
}

// Guarantee a clean play-set DOM after a drag: Sortable can leave a card as a stray
// direct child of the play-set or briefly double up a slot. Any card that is not the
// single occupant of a slot is sent back to the hand, so slot occupancy (and therefore
// the placeholders + isSetComplete) always reflects reality.
function normalizePlayArea() {
    if (!playRef.value || !handRef.value) return
    Array.from(playRef.value.children).forEach((child) => {
        const el = child as HTMLElement
        if (el.classList?.contains("draggable-card")) {
            setCardPlacement(el, false)
            handRef.value!.appendChild(el)
        }
    })
    slotEls().forEach((slot) => {
        const cards = Array.from(slot.querySelectorAll(".draggable-card")) as HTMLElement[]
        cards.slice(1).forEach((extra) => {
            setCardPlacement(extra, false)
            handRef.value!.appendChild(extra)
        })
    })
}

function setCardPlacement(el: HTMLElement, inPlay: boolean) {
    el.classList.toggle("card-responsive", inPlay)
    el.classList.toggle("card-sm", !inPlay)
    el.style.removeProperty("--p-tx")
    el.style.removeProperty("--p-ty")
    el.style.removeProperty("--p-rot")

    if (inPlay) {
        // pin the card to fill its slot exactly (inline beats any card sizing rule)
        el.style.setProperty("transform", "none")
        el.style.setProperty("position", "absolute")
        el.style.setProperty("left", "0")
        el.style.setProperty("top", "0")
        el.style.setProperty("right", "0")
        el.style.setProperty("bottom", "0")
        el.style.setProperty("width", "100%")
        el.style.setProperty("height", "100%")
        el.style.setProperty("margin", "0")
        el.style.setProperty("aspect-ratio", "auto")
    } else {
        el.style.removeProperty("transform")
        el.style.removeProperty("position")
        el.style.removeProperty("left")
        el.style.removeProperty("top")
        el.style.removeProperty("right")
        el.style.removeProperty("bottom")
        el.style.removeProperty("width")
        el.style.removeProperty("height")
        el.style.removeProperty("margin")
        el.style.removeProperty("aspect-ratio")
    }
}

function clearPlaySlot() {
    if (!playRef.value) return
    playRef.value.querySelectorAll(".draggable-card").forEach((el) => el.remove())
    lastEmittedSetKey = null
    syncPlaySlotState()
}

// Sync the server to the actual slot state after any drag:
//  - set complete & changed  -> submit the set + (re)start the lock timer
//  - set incomplete & was submitted -> retract it + stop the lock timer
// Runs in both directions so removing a card always cancels the selection.
function reconcileSet() {
    const currentId = currentPlayerId.value
    if (!currentId) return
    if (isCardLocked(currentId)) return

    if (isSetComplete()) {
        const placed = orderedPlacedCards()
        const key = setKeyOf(placed)
        if (key === lastEmittedSetKey) return
        lastEmittedSetKey = key
        lobby.queueSelectedCards(placed)
        const durationMs = lobby.selectionLockDurationMs || CARD_LOCK_WINDOW_MS
        startPendingSelection(currentId, durationMs)
        return
    }

    // not complete: if we had a submitted set, take it back
    if (lastEmittedSetKey !== null) {
        lastEmittedSetKey = null
        const placed = orderedPlacedCards()
        lobby.queueUnselectedCard(placed[0] ?? ({ pack: "", card_id: -1 } as any))
        clearPendingSelection(currentId)
    }
}

function findOwnCardEl(card: { pack: string; card_id: number | string }): HTMLElement | null {
    const sel = `.draggable-card[data-pack="${card.pack}"][data-card-id="${card.card_id}"]`
    return (playRef.value?.querySelector(sel) as HTMLElement | null)
        ?? (handRef.value?.querySelector(sel) as HTMLElement | null)
}

// The server rejected our take-back (the set locked the instant before we grabbed
// it, or the round advanced). We already pulled the card back into the hand, so put
// the authoritative set back into the play slots and re-lock it locally.
function handleUnselectRejected(tick: number) {
    if (!tick) return
    if (lobby.phase !== "board") return
    const currentId = currentPlayerId.value
    if (!currentId || !playRef.value) return

    const entry = lobby.currentRound?.playerSelectedCards?.find((e) => e.playerId === currentId)
    const cards = entry?.cards ?? []
    if (!cards.length) return

    const slots = slotEls()
    cards.forEach((card, i) => {
        const slot = slots[i]
        if (!slot) return
        const el = findOwnCardEl(card)
        if (!el) return
        slot.appendChild(el)
        setCardPlacement(el, true)
    })
    lastEmittedSetKey = setKeyOf(cards)
    syncPlaySlotState()

    if (entry?.locked) clearPendingSelection(currentId)
}

function onCzarRevealReady(ready: boolean) {
    czarRevealReady.value = ready
}

function onCzarRevealStart() {
    czarRevealReady.value = false
    czarCursorComponentRef.value?.clearHover()
    startCzarHoverTyping(null)
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
// the play-slot a card was lifted from (null when dragged from the hand)
let dragOriginSlot: HTMLElement | null = null

let lastPointerX = 0
let lastPointerY = 0

let primingEl: HTMLElement | null = null
let startX = 0
let startY = 0
let activePointerId: number | null = null
let captured = false
// A press on your own pending card may be either a tap (to lock it faster) or the
// start of a drag to pull it back out. We only fire the lock-boost on a genuine tap
// (pointerup without a drag) — otherwise grabbing the card to remove it would boost
// (and could re-lock) the very set you are retracting.
let boostCandidateId: string | null = null

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
    clearPlayOverState()
    trashRef.value?.classList.remove("trash-zone--over")
    cleanupPriming()
    detachPrimingListeners()
}

function onPointerMove(e: PointerEvent) {
    if (!primingEl) return
    applyPriming(primingEl, e.clientX - startX, e.clientY - startY)
}

function onPointerUp(e?: Event) {
    // a genuine tap (no drag started) on your own pending set: lock it faster
    if (boostCandidateId && e?.type === "pointerup") {
        lobby.requestLockBoost(boostCandidateId)
    }
    boostCandidateId = null
    cleanupPriming()
    detachPrimingListeners()
}

function onPointerDown(e: PointerEvent) {
    if (e.button !== 0 && e.pointerType === "mouse") return

    if (!lobby.canCurrentPlayerPlayCard()) return

    const el = (e.target as HTMLElement | null)?.closest?.(".draggable-card") as HTMLElement | null
    if (!el) return
    const currentId = currentPlayerId.value

    if (currentId && playRef.value?.contains(el) && isUnselectBlocked(currentId)) return
    boostCandidateId = null
    if (currentId && playRef.value?.contains(el) && isBoardPhase.value && !isCardLocked(currentId)) {
        // remember the candidate; the boost only fires if this press ends as a tap
        boostCandidateId = currentId
    }

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



function isOverPlaySlot(x: number, y: number) {
    if (!playRef.value) return false
    const elements = document.elementsFromPoint(x, y)
    return elements.some((el) => el === playRef.value || playRef.value!.contains(el))
}

function isOverTrash(x: number, y: number) {
    if (!trashRef.value) return false
    const elements = document.elementsFromPoint(x, y)
    return elements.some((el) => el === trashRef.value || trashRef.value!.contains(el))
}

function animateCardToTrash(sourceEl: HTMLElement, x: number, y: number) {
    if (!trashRef.value) return
    const rect = sourceEl.getBoundingClientRect()
    const startLeft = Number.isFinite(x) ? x - rect.width / 2 : rect.left
    const startTop = Number.isFinite(y) ? y - rect.height / 2 : rect.top
    const trashRect = trashRef.value.getBoundingClientRect()

    const clone = sourceEl.cloneNode(true) as HTMLElement
    clone.classList.remove("drag--source", "drag--mirror", "drag--priming")
    Object.assign(clone.style, {
        position: "fixed",
        left: `${startLeft}px`,
        top: `${startTop}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        margin: "0",
        zIndex: "70",
        pointerEvents: "none",
    })
    document.body.appendChild(clone)

    const targetX = trashRect.left + trashRect.width / 2 - (startLeft + rect.width / 2)
    const targetY = trashRect.top + trashRect.height / 2 - (startTop + rect.height / 2)

    gsap.timeline({ onComplete: () => clone.remove() })
        .to(clone, {
            x: targetX,
            y: targetY,
            scale: 0.15,
            autoAlpha: 0,
            rotate: gsap.utils.random(-40, 40),
            duration: 0.45,
            ease: "power2.in",
        })

    audioStore.playPop()
}

function getCardFromEl(el: HTMLElement) {
    const pack = el.dataset.pack
    const cardId = el.dataset.cardId
    if (!pack || !cardId) return null
    return lobby.getCurrentPlayerWhiteCard(pack, cardId)
}

function isUnselectBlocked(playerId: string | null) {
    if (!playerId) return false
    return isCardLocked(playerId)
}

/* ---------- selected card animation ---------- */
let newBlackCardCloneEl: HTMLElement | null = null
let blackCardTypingFrame: number | null = null

function getAnswerTextsFromHtml(html: string): string[] {
    const tmp = document.createElement("div")
    tmp.innerHTML = html
    return Array.from(tmp.querySelectorAll(".card-answer")).map(
        (el) => ((el as HTMLElement).innerText || el.textContent || "").trim()
    )
}

function clearBlackCardTyping() {
    if (blackCardTypingFrame !== null) {
        cancelAnimationFrame(blackCardTypingFrame)
        blackCardTypingFrame = null
    }
}

// Types every :answer span on the black card towards its target text in parallel.
function typeBlackCardAnswerTexts(targetTexts: string[], durationMs: number) {
    if (!BlackCardRef.value) return
    if (!czarRevealReady.value) return
    clearBlackCardTyping()

    BlackCardRef.value.innerHTML = blackCardTemplateHtml.value
    const answerEls = Array.from(BlackCardRef.value.querySelectorAll<HTMLElement>(".card-answer"))
    if (!answerEls.length) return

    const placeholders = getAnswerTextsFromHtml(blackCardTemplateHtml.value)
    const hasTargets = targetTexts.some((t) => !!t)

    const slots = answerEls.map((el, i) => {
        const placeholder = placeholders[i] ?? ""
        const target = targetTexts[i] ?? ""
        const fromText = (hasTargets ? placeholder : (el.textContent ?? placeholder)) || placeholder
        const toText = target || placeholder
        el.textContent = fromText
        return { el, fromText, toText }
    })

    const start = performance.now()
    const step = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs)
        slots.forEach(({ el, fromText, toText }) => {
            const count = Math.floor(fromText.length + (toText.length - fromText.length) * t)
            el.textContent = toText.length >= fromText.length ? toText.slice(0, count) : fromText.slice(0, count)
        })
        if (t < 1) {
            blackCardTypingFrame = requestAnimationFrame(step)
        } else {
            blackCardTypingFrame = null
        }
    }

    blackCardTypingFrame = requestAnimationFrame(step)
}

function getHoverAnswerTexts(playerId: string): string[] {
    const entry = lobby.getSelectedEntryForPlayerId(playerId)
    const resolved = entry?.resolved
    if (!resolved || !resolved.length) return []

    const blackCard = lobby.currentRound?.blackCard
    if (!blackCard) return []

    try {
        const full = resolveBlackCard(blackCard, resolved.map((r) => r?.text ?? "")).text
        return getAnswerTextsFromHtml(full)
    } catch {
        return []
    }
}

function startCzarHoverTyping(playerId: string | null) {
    if (!isCzarPhase.value) return
    if (!czarRevealReady.value) return
    if (playerId === czarHoverPlayerId) return
    czarHoverPlayerId = playerId
    if (!playerId) {
        typeBlackCardAnswerTexts([], CZAR_HOVER_TYPE_MS)
        return
    }
    typeBlackCardAnswerTexts(getHoverAnswerTexts(playerId), CZAR_HOVER_TYPE_MS)
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
        left: `${Math.round(rect.left)}px`,
        top: `${Math.round(rect.top)}px`,
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
        .set(newBlackCardCloneEl, {
            y: window.innerHeight - rect.top + rect.height + 40,
            rotate: gsap.utils.random(-8, 8),
        })
        .to(newBlackCardCloneEl, {
            y: -10,
            duration: 0.6,
            ease: "power2.out",
        })
        .to(newBlackCardCloneEl, {
            y: 0,
            rotate: gsap.utils.random(-3, 3),
            duration: 0.22,
            ease: "power2.in",
        })
}

/* ---------- watchers ---------- */
function handleRoundStarted(tick: number) {
    if (!tick) return
    if (!playRef.value) return
    playRef.value.querySelectorAll(".draggable-card").forEach((el) => el.remove())
    lastEmittedSetKey = null
    syncPlaySlotState()
    resetPendingSelections()
    resetDragState()
    if (lobby.phase === "board") nextTick(() => animateNextBlackCardIn())
}

function handlePhaseChange(phase: string, prev: string) {
    if (phase === prev) return

    if (phase !== "board") resetPendingSelections()

    if (phase === "czar") {
        czarRevealReady.value = false
    } else {
        czarCursorComponentRef.value?.clearHover()
        startCzarHoverTyping(null)
    }

    if (phase === "czar" && lobby.roundStartedTick > 0) {
        audioStore.playWrapOnce()
        clearPlaySlot()
    }
}

function handleSelectedCardAnim(tick: number) {
    if (!tick) return
    const action = (lobby.lastSelectedCard?.action ?? "selected") as "selected" | "unselected"
    const playerId = lobby.lastSelectedCard?.playerId
    const isSync = !!lobby.lastSelectedCard?.sync
    if (playerId) {
        if (action === "selected" && lobby.phase === "board") {
            // Ignore a stale, in-flight selection echo for our own set after we have
            // already retracted it locally (lastEmittedSetKey === null): otherwise the
            // late broadcast would revive a timer for a set that is no longer down.
            const isSelf = playerId === currentPlayerId.value
            const staleSelfEcho = isSelf && !isSync && lastEmittedSetKey === null
            if (!staleSelfEcho) {
                // Authoritative server values: full window for the progress bar total,
                // remaining time (expiresAt - now) for the live countdown. This overrides
                // the optimistic window started locally in reconcileSet().
                const durationMs = lobby.selectionLockDurationMs || CARD_LOCK_WINDOW_MS
                const expiresAt = lobby.selectionLockExpiresAt
                const remainingMs = expiresAt ? Math.max(0, expiresAt - Date.now()) : durationMs
                startPendingSelection(playerId, remainingMs, durationMs)
            }
        }
        if (action === "unselected") clearPendingSelection(playerId)
    }
    if (isSync) return
}

function handleSelectionLockBoost(tick: number) {
    if (!tick) return
    const payload = lobby.lastSelectionLockBoost
    if (!payload?.playerId) return
    if (isCardLocked(payload.playerId)) return
    // never revive our own timer from a late boost echo once we have retracted the set
    if (payload.playerId === currentPlayerId.value && lastEmittedSetKey === null) return
    const remainingMs = payload.selectionLockExpiresAt
        ? Math.max(0, payload.selectionLockExpiresAt - Date.now())
        : Math.max(0, payload.selectionLockDurationMs ?? 0)
    if (remainingMs <= 0) return
    refreshPendingSelection(payload.playerId, remainingMs)
    nextTick(() => pulsePendingCard(payload.playerId))
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

watch(() => lobby.roundStartedTick, handleRoundStarted)
watch(() => lobby.phase, handlePhaseChange)
watch(() => lobby.selectedCardAnimTick, handleSelectedCardAnim)
watch(() => lobby.selectionLockBoostTick, handleSelectionLockBoost)
watch(() => lobby.unselectRejectedTick, handleUnselectRejected)


/* ---------- mount/unmount ---------- */
onMounted(() => {
    if (!handRef.value || !playRef.value) return

    handRef.value.addEventListener("pointerdown", onPointerDown, true)
    playRef.value.addEventListener("pointerdown", onPointerDown, true)

    const sortable = new Sortable([handRef.value, playRef.value], {
        draggable: ".draggable-card",
        distance: DRAG_DISTANCE,
        mirror: { constrainDimensions: true, appendTo: document.body },
    })

    sortable.on("drag:start", (evt: any) => {
        // this press became a drag, not a tap -> cancel the pending lock-boost
        boostCandidateId = null

        if (!lobby.canCurrentPlayerPlayCard()) {
            evt.cancel(); return
        }

        const currentId = currentPlayerId.value
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
        dragOriginSlot = drag.source.closest(".play-slot") as HTMLElement | null
    })

    sortable.on("drag:move", (evt: any) => {
        const { x, y } = getPointerPosition(evt)
        if (playRef.value) {
            const targetSlot = slotForPoint(x, y)
            slotEls().forEach((slot) => slot.classList.toggle("play-slot--over", slot === targetSlot))
        }
        if (trashRef.value) {
            const overTrash = isOverTrash(x, y)
            trashRef.value.classList.toggle("trash-zone--over", overTrash && !drag.startInPlay && canSwapCard.value)
        }
    })

    // we place cards into slots manually on drop; don't let Sortable reflow the play row
    sortable.on("sortable:sort", (evt: any) => {
        if (!playRef.value) return
        if (evt.overContainer === playRef.value) evt.cancel()
    })

    sortable.on("mirror:created", (evt: any) => {
        drag.mirror = evt.mirror as HTMLElement
        drag.mirror.classList.add("drag--mirror")
    })

    sortable.on("drag:stop", (evt: any) => {
        if (playRef.value && handRef.value && drag.source) {

            const { x, y } = getPointerPosition(evt)
            const overTrash = isOverTrash(x, y)
            const targetSlot = slotForPoint(x, y)   // the specific slot under the pointer, if any
            const wasInPlay = drag.startInPlay
            const currentId = currentPlayerId.value
            const unselectBlocked = currentId ? isUnselectBlocked(currentId) : false

            const returnToHand = () => {
                setCardPlacement(drag.source!, false)
                handRef.value!.appendChild(drag.source!)
            }

            // drop a hand card on the trash to swap it for a new one (costs a point)
            if (overTrash && !targetSlot && !wasInPlay && canSwapCard.value) {
                const card = getCardFromEl(drag.source)
                if (card) {
                    returnToHand()
                    animateCardToTrash(drag.source, x, y)
                    lobby.queueSwapCard(card)
                    clearPlayOverState()
                    trashRef.value?.classList.remove("trash-zone--over")
                    resetDragState()
                    syncPlaySlotState()
                    return
                }
            }

            if (wasInPlay && unselectBlocked) {
                // the set is locked: keep the card in play (snap to its slot or the first empty one)
                const slot = (drag.source.closest(".play-slot") as HTMLElement | null) ?? firstEmptySlot()
                if (slot) {
                    slot.appendChild(drag.source)
                    setCardPlacement(drag.source, true)
                }
            } else if (wasInPlay) {
                // A played card was dragged. Reposition it only if it was dropped onto a
                // DIFFERENT slot (swapping with whatever sits there); dropping it back on
                // its own slot or anywhere else removes it from the set. This guarantees
                // that "drag a card out" actually empties its slot -> the placeholder
                // returns and the set becomes incomplete (so the lock timer resets).
                if (targetSlot && targetSlot !== dragOriginSlot) {
                    const occupant = slotCardEl(targetSlot)
                    if (occupant && occupant !== drag.source && dragOriginSlot) {
                        dragOriginSlot.appendChild(occupant)
                        setCardPlacement(occupant, true)
                    }
                    targetSlot.appendChild(drag.source)
                    setCardPlacement(drag.source, true)
                } else {
                    returnToHand()
                }
            } else if (targetSlot) {
                // a hand card dropped onto a slot: place there, or shift to the first empty slot if taken
                const occupant = slotCardEl(targetSlot)
                if (!occupant || occupant === drag.source) {
                    targetSlot.appendChild(drag.source)
                    setCardPlacement(drag.source, true)
                } else {
                    const empty = firstEmptySlot()
                    if (empty) {
                        empty.appendChild(drag.source)
                        setCardPlacement(drag.source, true)
                    } else {
                        returnToHand()   // set is full
                    }
                }
            } else {
                // dropped anywhere that is not a slot -> remove the card from the set
                if (playRef.value.contains(drag.source)) returnToHand()
            }
        }

        clearPlayOverState()
        resetDragState()
    })

    // Slot bookkeeping must run on drag:stopped, NOT drag:stop. Shopify Draggable drags
    // a CLONE and keeps the real node hidden in its original slot, only relocating it
    // AFTER the drag:stop listeners run. So at drag:stop a card pulled out of a slot is
    // still (invisibly) in that slot: reconcileSet would see the set as complete and
    // never emit the take-back, and the placeholder would stay hidden over an empty slot.
    // By drag:stopped the real node has reached its final slot/hand, so occupancy is true.
    sortable.on("drag:stopped", () => {
        normalizePlayArea()
        // sync the server to whatever ended up in the slots (submit, re-submit, or retract)
        reconcileSet()
        syncPlaySlotState()
    })

    sortableRef.value = sortable
    syncPlaySlotState()
})

onBeforeUnmount(() => {
    sortableRef.value?.destroy()

    handRef.value?.removeEventListener("pointerdown", onPointerDown, true)
    playRef.value?.removeEventListener("pointerdown", onPointerDown, true)


    resetDragState()
    resetPendingSelections()
})

</script>

<template>
    <div class="flex justify-center items-center">
        <CzarCursor ref="czarCursorComponentRef" :board-area-ref="boardAreaRef" :board-grid-ref="boardGridRef" :black-card-ref="BlackCardRef" :czar-reveal-ready="czarRevealReady" @hover-change="startCzarHoverTyping" />

        <div>
            <!-- timer -->
            <div class="absolute top-0 w-screen px-8 left-[50%] translate-x-[-50%] flex justify-between z-30">
                <div class="p-4 flex-1 flex items-center">
                    <img class="" width="150" src="../../../assets/images/logo.png" alt="" />
                </div>

                <BoardTimer :phase="lobby.phase" :round-started-tick="lobby.roundStartedTick" :round-timer-expires-at="lobby.roundTimerExpiresAt" :round-timer-duration-ms="lobby.roundTimerDurationMs" :phase-timer-phase="lobby.phaseTimerPhase" :phase-timer-expires-at="lobby.phaseTimerExpiresAt" :phase-timer-duration-ms="lobby.phaseTimerDurationMs" :round-count="lobby.settings.roundCount" :game-round="lobby.currentGameRound" />

                <div class="p-4 flex-1 flex items-center justify-end gap-4">
                    <BaseButton size="md" color="pink" @click="ui.openSettings" icon="Cog"></BaseButton>
                    <BaseButton size="md" color="pink" icon="Logout" @click="lobby.confirmLeaveLobby"></BaseButton>
                </div>
            </div>

            <PlayerList />

            <div ref="boardAreaRef" class="relative flex items-center">
                <div class="pr-10 bg-white border-2 border-b-5 rounded-xl border-black p-6 text-black">
                    <div class="relative">
                        <div ref="BlackCardRef" class="madness-card card-black card-anim" v-html="blackCardHtml"></div>
                    </div>
                </div>

                <div ref="boardGridRef" class="-ml-6 bg-[#4a1a7a] grid grid-cols-5 gap-8 w-3xl border-4 backdrop-blur-sm rounded-xl border-black p-6 transition-all" style="position: relative; perspective: 1200px">
                    <div v-show="isRoundActive && !isCurrentPlayerCzar && !isWaitingForRound" class="play-zone" :class="`play-zone--count-${answerCount}`">
                        <div ref="playRef" class="play-set" :class="`play-set--count-${answerCount}`">
                            <div v-for="i in answerCount" :key="i" class="play-slot" :data-slot-index="i - 1">
                                <div class="play-placeholder border-3 border-dashed border-white/60 rounded-xl text-white/70 px-4 py-8 text-center text-sm">
                                    {{ answerCount > 1 ? `Sleep kaart ${i}` : 'Sleep hier je kaart' }}
                                </div>
                            </div>
                        </div>
                    </div>

                    <SelectedCardsGrid :is-card-locked="isCardLocked" :play-ref="playRef" :board-grid-ref="boardGridRef" @reveal-ready="onCzarRevealReady" @reveal-start="onCzarRevealStart" />
                </div>

                <div v-show="showTrash" ref="trashRef" class="trash-zone absolute left-full top-1/2 ml-8" :class="{ 'trash-zone--disabled': !canSwapCard }" :title="canSwapCard ? 'Sleep een kaart hierheen om te wisselen (−1 punt)' : 'Je hebt minimaal 1 punt nodig om te wisselen'">
                    <TrashCan :size="44" />
                    <span class="trash-zone__label">Wissel<br />−1 punt</span>
                </div>
            </div>

            <div class="absolute bottom-0 left-0 right-0 flex justify-center">
                <div v-show="isRoundActive" ref="handRef" class="hand-deck z-10 relative" :class="{ 'hand-deck--active': isRoundActive, 'hand-deck--czar': isCurrentPlayerCzar }">
                    <div v-for="(white_card, index) in currentPlayerCards" :key="`${white_card.pack}-${white_card.card_id}-${index}`" class="madness-card card-white card-sm draggable-card" :data-pack="white_card.pack" :data-card-id="white_card.card_id" v-html="white_card.text"></div>

                    <div v-if="isCurrentPlayerCzar" class="hand-czar-banner">Jij bent de Card Czar</div>
                    <div v-if="isWaitingForRound" class="hand-czar-banner">Je doet mee vanaf de volgende ronde</div>
                </div>
            </div>

        </div>
    </div>
</template>
