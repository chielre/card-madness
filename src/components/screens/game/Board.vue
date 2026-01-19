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

import BaseButton from "../../../components/ui/BaseButton.vue"

const lobby = useLobbyStore()
const audioStore = useAudioStore()
const ui = useUiStore()


const handRef = ref<HTMLElement | null>(null)
const playRef = ref<HTMLElement | null>(null)
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
    if (e.button !== 0 && e.pointerType === "mouse") return

    if (!lobby.canCurrentPlayerPlayCard()) return

    const el = (e.target as HTMLElement | null)?.closest?.(".draggable-card") as HTMLElement | null
    if (!el) return
    const currentId = currentPlayerId.value

    if (currentId && playRef.value?.contains(el) && isUnselectBlocked(currentId)) return
    if (currentId && playRef.value?.contains(el) && isBoardPhase.value && !isCardLocked(currentId)) {
        lobby.requestLockBoost(currentId)
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

function getCardFromEl(el: HTMLElement) {
    const pack = el.dataset.pack
    const cardId = el.dataset.cardId
    if (!pack || !cardId) return null
    return lobby.getCurrentPlayerWhiteCard(pack, cardId)
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
let newBlackCardCloneEl: HTMLElement | null = null
let blackCardTypingFrame: number | null = null

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

function typeBlackCardAnswerText(targetText: string, durationMs: number) {
    if (!BlackCardRef.value) return
    if (!czarRevealReady.value) return
    clearBlackCardTyping()

    BlackCardRef.value.innerHTML = blackCardTemplateHtml.value
    const answerEl = BlackCardRef.value.querySelector(".card-answer") as HTMLElement | null
    if (!answerEl) return

    const placeholderText = getAnswerTextFromHtml(blackCardTemplateHtml.value)
    const currentAnswer = answerEl.textContent ?? placeholderText
    const fromText = targetText ? placeholderText : currentAnswer
    const toText = targetText || placeholderText
    answerEl.textContent = fromText || placeholderText

    const start = performance.now()
    const step = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs)
        const count = Math.floor(fromText.length + (toText.length - fromText.length) * t)
        if (toText.length >= fromText.length) {
            answerEl.textContent = toText.slice(0, count)
        } else {
            answerEl.textContent = fromText.slice(0, count)
        }
        if (t < 1) {
            blackCardTypingFrame = requestAnimationFrame(step)
        } else {
            blackCardTypingFrame = null
        }
    }

    blackCardTypingFrame = requestAnimationFrame(step)
}

function getHoverAnswerText(playerId: string) {
    const entry = lobby.getSelectedEntryForPlayerId(playerId)
    if (!entry?.resolved?.text) return ""

    const blackCard = lobby.currentRound?.blackCard
    if (!blackCard) return ""

    try {
        const full = resolveBlackCard(blackCard, entry.resolved.text).text
        return getAnswerTextFromHtml(full)
    } catch {
        return ""
    }
}

function startCzarHoverTyping(playerId: string | null) {
    if (!isCzarPhase.value) return
    if (!czarRevealReady.value) return
    if (playerId === czarHoverPlayerId) return
    czarHoverPlayerId = playerId
    if (!playerId) {
        typeBlackCardAnswerText("", CZAR_HOVER_TYPE_MS)
        return
    }
    const answerText = getHoverAnswerText(playerId)
    typeBlackCardAnswerText(answerText, CZAR_HOVER_TYPE_MS)
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
            const durationMs = lobby.selectionLockDurationMs || CARD_LOCK_WINDOW_MS
            const expiresAt = lobby.selectionLockExpiresAt
            const remainingMs = expiresAt ? Math.max(0, expiresAt - Date.now()) : durationMs
            startPendingSelection(playerId, remainingMs)
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
            const currentId = currentPlayerId.value
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

                <BoardTimer :phase="lobby.phase" :round-started-tick="lobby.roundStartedTick" :round-timer-expires-at="lobby.roundTimerExpiresAt" :round-timer-duration-ms="lobby.roundTimerDurationMs" :phase-timer-phase="lobby.phaseTimerPhase" :phase-timer-expires-at="lobby.phaseTimerExpiresAt" :phase-timer-duration-ms="lobby.phaseTimerDurationMs" />

                <div class="p-4 flex-1 flex items-center justify-end gap-4">
                    <BaseButton size="md" color="pink" @click="ui.openSettings" icon="Cog"></BaseButton>
                    <BaseButton size="md" color="pink" icon="Logout" @click="lobby.confirmLeaveLobby"></BaseButton>
                </div>
            </div>

            <PlayerList />

            <div ref="boardAreaRef" class="flex items-center">
                <div class="pr-10 bg-white border-2 border-b-5 rounded-xl border-black p-6 text-black">
                    <div class="relative">
                        <div ref="BlackCardRef" class="madness-card card-black card-anim" v-html="blackCardHtml"></div>
                    </div>
                </div>

                <div ref="boardGridRef" class="-ml-6 bg-[#2b0246] grid grid-cols-5 gap-8 w-3xl border-4 backdrop-blur-sm rounded-xl border-black p-6 transition-all" style="position: relative; perspective: 1200px">
                    <div v-show="isRoundActive && !isCurrentPlayerCzar && !isWaitingForRound" class="play-zone">
                        <div ref="playRef" class="play-slot">
                            <div class="madness-card card-white card-responsive play-slot-mirror" aria-hidden="true"></div>
                            <div class="play-placeholder border-3 border-dashed border-white/60 rounded-xl text-white/70 px-6 py-8 text-center text-sm">
                                Sleep hier je kaart
                            </div>
                        </div>
                    </div>

                    <SelectedCardsGrid :is-card-locked="isCardLocked" :play-ref="playRef" :board-grid-ref="boardGridRef" @reveal-ready="onCzarRevealReady" @reveal-start="onCzarRevealStart" />
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
