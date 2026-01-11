<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import gsap from "gsap"
import { CustomEase } from "gsap/CustomEase"

import { Sortable, Plugins } from "@shopify/draggable"

import { resolveWhiteCards } from "@/utils/cards"


import { useLobbyStore } from '@/store/LobbyStore'
import { useConnectionStore } from '@/store/ConnectionStore'
import { useAudioStore } from "@/store/AudioStore"

import CountdownTimer from "../../../components/CountdownTimer.vue"
import BaseButton from "../../../components/ui/BaseButton.vue"

const lobby = useLobbyStore()
const audioStore = useAudioStore()
const connection = useConnectionStore()

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
const czarResultButtonTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

const selectedCards = computed(() => {
    const entries = isRevealPhase.value
        ? (lobby.currentRound?.playerSelectedCards ?? [])
        : (lobby.currentRound?.playerSelectedCards ?? []).filter((entry) => entry.playerId !== lobby.getCurrentPlayer()?.id)

    if (!entries.length) return []
    if (!isRevealPhase.value) return entries.map((entry) => ({ ...entry, resolved: null }))

    if (entries.some((entry) => !entry.card)) {
        return entries.map((entry) => ({ ...entry, resolved: null }))
    }
    const resolved = resolveWhiteCards(entries.map((entry) => entry.card))
    return entries.map((entry, idx) => ({ ...entry, resolved: resolved[idx] }))
})

const currentPlayerCards = computed(() => lobby.getCurrentPlayerCards())
const isRoundActive = computed(() => isBoardPhase.value && lobby.roundStartedTick > lobby.roundTimeoutTick)
const isCurrentPlayerCardSelector = computed(() => lobby.getCurrentPlayerIsCardSelector())
const isBoardPhase = computed(() => lobby.phase === 'board')
const isCzarPhase = computed(() => lobby.phase === 'czar')
const isCzarResultPhase = computed(() => lobby.phase === 'czar-result')
const isRevealPhase = computed(() => isCzarPhase.value || isCzarResultPhase.value)
const canCzarSelect = computed(() => isCzarPhase.value && isCurrentPlayerCardSelector.value)
const canStartNextRound = computed(() => isCzarResultPhase.value && isCurrentPlayerCardSelector.value)
const showDebugPhaseButtons = computed(() => {
    const stage = (import.meta as any).env?.STAGE
    const devButtons = (import.meta as any).env?.DEV_PHASE_BUTTONS
    return stage === 'development' && String(devButtons) === '1'
})

let blackCardCloneEl: HTMLElement | null = null
let czarResultOutroTl: gsap.core.Timeline | null = null
let newBlackCardCloneEl: HTMLElement | null = null
const pendingNewBlackCardIntro = ref(false)
let czarFlipTimeout: ReturnType<typeof setTimeout> | null = null

const timerMode = ref<'round' | 'czar'>('round')
const CZAR_TIMER_DELAY_SECONDS = 17
const CZAR_FLIP_DELAY_MS = 900
let czarTimerStartTimeout: ReturnType<typeof setTimeout> | null = null
const blackCardHtml = computed(() => lobby.getCurrentBlackCardHtml() || '...')
const selectedCzarCardPlayerId = computed(() => lobby.currentRound?.cardSelector?.selectedCard?.playerId ?? null)
const selectedCzarPlayer = computed(() => lobby.players.find((p) => p.id === selectedCzarCardPlayerId.value) ?? null)
const showCzarResultButton = ref(false)
const timerVisible = ref(true)

const timerPhases = new Set(['board', 'czar'])
const shouldShowTimer = computed(() => timerPhases.has(lobby.phase))

function resetTimer() {
    timerRef.value?.pause()
    timerRef.value?.reset(0)
}

function getRemainingSeconds(expiresAt: number, durationMs: number) {
    const now = Date.now()
    const remainingMs = expiresAt
        ? Math.max(0, expiresAt - now)
        : Math.max(0, durationMs)
    return { remainingMs, remainingSeconds: Math.ceil(remainingMs / 1000) }
}

function startRoundTimer() {
    if (!lobby.roundStartedTick) return
    const { remainingSeconds } = getRemainingSeconds(lobby.roundTimerExpiresAt, lobby.roundTimerDurationMs)
    if (!remainingSeconds) return
    timerMode.value = 'round'
    timerRef.value?.start(remainingSeconds)
}

function startCzarTimer() {
    if (!lobby.roundStartedTick) return
    if (lobby.phaseTimerPhase !== 'czar') return
    const { remainingMs, remainingSeconds } = getRemainingSeconds(lobby.phaseTimerExpiresAt, lobby.phaseTimerDurationMs)
    if (!remainingSeconds) return

    const totalSeconds = lobby.phaseTimerDurationMs ? Math.ceil(lobby.phaseTimerDurationMs / 1000) : 0
    const displaySeconds = totalSeconds ? Math.max(0, totalSeconds - CZAR_TIMER_DELAY_SECONDS) : 0

    if (displaySeconds && remainingSeconds > displaySeconds) {
        const delayMs = Math.max(0, remainingMs - displaySeconds * 1000)
        czarTimerStartTimeout = setTimeout(() => {
            const { remainingSeconds: seconds } = getRemainingSeconds(lobby.phaseTimerExpiresAt, remainingMs - delayMs)
            if (!seconds) return
            timerMode.value = 'czar'
            timerRef.value?.start(seconds)
        }, delayMs)
    } else {
        timerMode.value = 'czar'
        timerRef.value?.start(remainingSeconds)
    }
}

function refreshTimer() {
    if (czarTimerStartTimeout) {
        clearTimeout(czarTimerStartTimeout)
        czarTimerStartTimeout = null
    }

    resetTimer()

    if (!shouldShowTimer.value) return

    if (lobby.phase === 'board') {
        startRoundTimer()
        return
    }

    if (lobby.phase === 'czar') {
        startCzarTimer()
    }
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

function syncPlaySlotState() {
    if (!playRef.value) return
    const hasCard = !!playRef.value.querySelector(".draggable-card")
    playRef.value.classList.toggle("has-card", hasCard)
}

function setCardPlacement(el: HTMLElement, inPlay: boolean) {
    if (inPlay) {
        el.classList.remove("card-sm")
        el.classList.add("card-responsive")
        return
    }
    el.classList.remove("card-responsive")
    el.classList.add("card-sm")
}

function clearPlaySlot() {
    if (!playRef.value) return
    playRef.value.querySelectorAll(".draggable-card").forEach((el) => el.remove())
    syncPlaySlotState()
}

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
    if (czarFlipTimeout) {
        clearTimeout(czarFlipTimeout)
        czarFlipTimeout = null
    }
    czarFlipTimeout = setTimeout(() => {
        czarFlipTimeout = null
        playCzarFlip()
    }, CZAR_FLIP_DELAY_MS)
}

/* ---------- Drag and drop ---------- */
const DRAG_DISTANCE = 120
const MAX_TRANSLATE = 14
const MAX_ROTATE = 12
const LIFT_Y = -10
const FOLLOW_FACTOR = 0.55

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
const hypot = (x: number, y: number) => Math.sqrt(x * x + y * y)

const drag = {
    source: null as HTMLElement | null,
    mirror: null as HTMLElement | null,
}

let lastPointerX = 0
let lastPointerY = 0

let primingEl: HTMLElement | null = null
let startX = 0
let startY = 0
let activePointerId: number | null = null
let captured = false

function applyPriming(el: HTMLElement, dx: number, dy: number) {
    // kleine follow + vaste lift
    const tx = clamp(dx * FOLLOW_FACTOR, -MAX_TRANSLATE, MAX_TRANSLATE)
    const ty = LIFT_Y + clamp(dy * FOLLOW_FACTOR, -MAX_TRANSLATE, MAX_TRANSLATE)

    // SYMMETRISCH: rotatie puur op dx
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
        try { primingEl.releasePointerCapture(activePointerId) } catch { }
    }

    primingEl = null
    activePointerId = null
    captured = false
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
    if (e.button !== 0 && e.pointerType === "mouse") return

    // Alleen op touch preventDefault (anders verdwijnt je click)
    if (e.pointerType !== "mouse") e.preventDefault()

    cleanupPriming()
    detachPrimingListeners()

    primingEl = el
    startX = e.clientX
    startY = e.clientY
    activePointerId = e.pointerId

    primingEl.classList.add("drag--priming")
    applyPriming(primingEl, 0, 0)

    // Alleen capture op touch/stylus (bij mouse vaak niet nodig en kan click gedoe geven)
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

function emitSelectedCardFromElement(el: HTMLElement) {
    const pack = el.dataset.pack
    const cardId = el.dataset.cardId
    if (!pack || !cardId) return

    const card = lobby.getCurrentPlayerCards().find((c) => c.pack === pack && String(c.card_id) === String(cardId))
    if (!card) return

    lobby.queueSelectedCard(card)
}

function emitUnselectedCardFromElement(el: HTMLElement) {
    const pack = el.dataset.pack
    const cardId = el.dataset.cardId
    if (!pack || !cardId) return

    const card = lobby.getCurrentPlayerCards().find((c) => c.pack === pack && String(c.card_id) === String(cardId))
    if (!card) return

    lobby.queueUnselectedCard(card)
}

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

    if (action === "selected" && playerId) {
        const target = pos.gridEl.querySelector(`[data-selected-player-id="${playerId}"]`) as HTMLElement | null
        if (!target) return

        gsap.fromTo(
            target,
            { y: -220, rotateZ: gsap.utils.random(-12, 12), rotateX: 55, opacity: 0 },
            {
                y: 0,
                rotateZ: gsap.utils.random(-6, 6),
                rotateX: 0,
                opacity: 1,
                duration: 0.8,
                ease: "power2.out",
            }
        )
        return
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
        { y: 0, rotateZ: gsap.utils.random(-12, 12), rotateX: 0, opacity: 1 },
        {
            y: -220,
            rotateZ: gsap.utils.random(-18, 18),
            rotateX: 35,
            opacity: 0,
            duration: 0.6,
            ease: "power2.out",
            onComplete: () => el.remove(),
        }
    )
}

function onCzarCardSelect(entry: { playerId: string; card: any }) {
    if (!canCzarSelect.value) return
    lobby.queueCzarSelectedEntry(entry)
}

async function onNextRoundClick() {
    if (!canStartNextRound.value) return
    const socket = await connection.ensureSocket()
    socket.emit('round:next', { lobbyId: lobby.lobbyId })
}

async function onDebugNextPhase() {
    if (!showDebugPhaseButtons.value) return
    const socket = await connection.ensureSocket()
    const phase = lobby.phase
    const nextMap: Record<string, string> = {
        lobby: 'starting',
        starting: 'intro',
        intro: 'board',
        board: 'czar',
        czar: 'czar-result',
        'czar-result': 'board',
        results: 'lobby',
    }
    const nextPhase = nextMap[phase]
    if (!nextPhase) return
    socket.emit('room:phase-set', { lobbyId: lobby.lobbyId, phase: nextPhase })
}

async function onDebugNextRound() {
    if (!showDebugPhaseButtons.value) return
    const socket = await connection.ensureSocket()
    socket.emit('round:next', { lobbyId: lobby.lobbyId })
}


async function startCzarResultAnimation() {
    await nextTick()

    const card = BlackCardRef.value
    const ghost = BlackCardGhostRef.value
    if (!card || !ghost) return

    czarResultOutroTl?.kill()
    czarResultOutroTl = null


    // zorg dat ghost dezelfde plek/size “reserveert”
    gsap.set(ghost, { opacity: 0 })

    // maak clone voor fixed animatie
    const rect = card.getBoundingClientRect()
    blackCardCloneEl = card.cloneNode(true) as HTMLElement
    blackCardCloneEl.style.position = "fixed"
    blackCardCloneEl.style.left = `${rect.left}px`
    blackCardCloneEl.style.top = `${rect.top}px`
    blackCardCloneEl.style.width = `${rect.width}px`
    blackCardCloneEl.style.height = `${rect.height}px`
    blackCardCloneEl.style.margin = "0"
    blackCardCloneEl.style.zIndex = "60"
    blackCardCloneEl.style.transformOrigin = "center"
    blackCardCloneEl.classList.add("czar-blackcard-clone")

    document.body.appendChild(blackCardCloneEl)

    // verberg originele kaart (ghost houdt ruimte)
    gsap.set(card, { autoAlpha: 0, pointerEvents: "none" })
    CustomEase.create("cardBounce", "0.18,1.4,0.35,1")
    audioStore.playWrapCzarOnce()

    gsap.timeline()
        .fromTo(transitionEl1.value,
            { scale: 0 },
            {
                scale: 1.3,
                duration: 3,

                ease: "readyBounce",

            },
            0
        )
        .fromTo(transitionEl2.value,
            { scale: 0 },
            {
                scale: 1.3,
                duration: 3,

                ease: "readyBounce",

            },
            0.3
        )
        .fromTo(transitionEl3.value,
            { scale: 0 },
            {
                scale: 1.3,
                duration: 3,

                ease: "readyBounce",

            },
            0.4
        )
        .fromTo(transitionEl4.value,
            { scale: 0 },
            {
                scale: 1.3,
                duration: 3,

                ease: "readyBounce",

            },
            0.5
        )
        .to(blackCardCloneEl,

            {
                left: "50%",
                top: "50%",
                xPercent: -50,
                yPercent: -50,
                rotate: gsap.utils.random(-5, 5),

                scale: 1.6,
                duration: 1,
                ease: "power3.inOut",
            }, 1)
        .to(blackCardCloneEl,

            {
                scale: 1.3,
                rotate: gsap.utils.random(-5, 5),
                duration: 1,
                ease: "readyBounce",
            }, 2)

        .call(() => positionCzarResultPlayer(), [], 3.9)
        .fromTo(
            czarResultPlayerRef.value,
            { y: 60, autoAlpha: 0 },
            { y: 0, autoAlpha: 1, duration: 0.5, ease: "power2.out", delay: 0.2 }, 4)
        .call(() => {
            showCzarResultButton.value = true
        }, [], 4)
        .fromTo(
            czarNextRoundButton.value,
            { y: 60, autoAlpha: 0 },
            { y: 0, autoAlpha: 1, duration: 0.5, ease: "power2.out", delay: 0.2 }, 6)

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

    if (czarResultPlayerRef.value) {
        czarResultOutroTl.to(czarResultPlayerRef.value, { y: 20, autoAlpha: 0, duration: 0.25, ease: "power2.in" }, 0)
    }
    if (czarNextRoundButton.value) {
        czarResultOutroTl.to(czarNextRoundButton.value, { y: 20, autoAlpha: 0, duration: 0.25, ease: "power2.in" }, 0)
    }

    const transitionEls = [transitionEl1.value, transitionEl2.value, transitionEl3.value, transitionEl4.value].filter(Boolean) as HTMLElement[]
    if (transitionEls.length) {
        czarResultOutroTl.to(transitionEls, { scale: 0, duration: 0.6, ease: "power2.inOut", stagger: 0.05 }, 0)
    }

    if (!blackCardCloneEl) {
        resetCzarResultAnimation()
        return
    }

    czarResultOutroTl.to(blackCardCloneEl, {
        y: -window.innerHeight * 0.9,
        rotate: gsap.utils.random(-12, 12),
        scale: 0.9,
        duration: 0.6,
        ease: "power2.in",
    }, 0)
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
    newBlackCardCloneEl.style.position = "fixed"
    newBlackCardCloneEl.style.left = `-${Math.round(rect.width)}px`
    newBlackCardCloneEl.style.top = `${Math.round(window.innerHeight * 0.2)}px`
    newBlackCardCloneEl.style.width = `${rect.width}px`
    newBlackCardCloneEl.style.height = `${rect.height}px`
    newBlackCardCloneEl.style.margin = "0"
    newBlackCardCloneEl.style.zIndex = "60"
    newBlackCardCloneEl.style.transformOrigin = "center"

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
        .to(newBlackCardCloneEl, {
            left: rect.left,
            top: rect.top,
            rotate: gsap.utils.random(-4, 4),
            duration: 0.7,
            ease: "power2.out",
        }, ">-0.15")
}

function positionCzarResultPlayer() {
    const el = czarResultPlayerRef.value
    if (!el) return

    const target = blackCardCloneEl ?? BlackCardRef.value
    if (!target) return

    const rect = target.getBoundingClientRect()
    const top = rect.top - 120
    const left = rect.left + rect.width / 2

    gsap.set(el, { top, left, xPercent: -50, yPercent: -100 })
}

function resetCzarResultAnimation() {
    czarResultOutroTl?.kill()
    czarResultOutroTl = null
    if (BlackCardRef.value) {
        gsap.set(BlackCardRef.value, { clearProps: "all", autoAlpha: 1 })
    }
    if (BlackCardGhostRef.value) {
        gsap.set(BlackCardGhostRef.value, { clearProps: "all", opacity: 0 })
    }

    if (blackCardCloneEl) {
        blackCardCloneEl.remove()
        blackCardCloneEl = null
    }
    if (newBlackCardCloneEl) {
        newBlackCardCloneEl.remove()
        newBlackCardCloneEl = null
    }

    const transitionEls = [transitionEl1.value, transitionEl2.value, transitionEl3.value, transitionEl4.value].filter(Boolean) as HTMLElement[]
    if (transitionEls.length) {
        gsap.set(transitionEls, { clearProps: "all" })
    }

    if (czarResultPlayerRef.value) {
        gsap.set(czarResultPlayerRef.value, { clearProps: "all" })
    }

    showCzarResultButton.value = false

}

const runIntroAnimation = () => {

}

watch(
    () => lobby.currentRound,
    (round) => {
        if (!round) return
        if (pendingNewBlackCardIntro.value && lobby.phase === 'board') {
            pendingNewBlackCardIntro.value = false
            nextTick(() => animateNextBlackCardIn())
        }
        console.log(`Round updated ${round?.blackCard?.text ?? ''}`)
    }
)

watch(
    () => shouldShowTimer.value,
    (show) => {
        setTimerVisibility(show)
    },
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
    () => {
        refreshTimer()
    },
    { immediate: true }
)

onMounted(() => {
    if (!timerWrapRef.value) return
    if (!shouldShowTimer.value) {
        gsap.set(timerWrapRef.value, { y: -140, autoAlpha: 0, pointerEvents: "none" })
        timerVisible.value = false
    }
})

watch(
    () => lobby.roundStartedTick,
    (tick) => {
        if (!tick) return
        if (playRef.value) {
            playRef.value.querySelectorAll(".draggable-card").forEach((el) => el.remove())
            syncPlaySlotState()
        }
    }
)

watch(
    () => lobby.phase,
    (phase, prev) => {
        if (phase !== prev && phase === 'czar' && lobby.roundStartedTick > 0) {
            audioStore.playWrapOnce()
            clearPlaySlot()
            nextTick(() => scheduleCzarFlip())
        }
    }
)

watch(
    () => lobby.phase,
    (phase, prev) => {
        if (phase === prev) return
        if (phase !== 'czar-result') return
        resetTimer()
        startCzarResultAnimation()
    }
)

watch(
    () => lobby.phase,
    (phase, prev) => {
        if (phase === prev) return
        if (phase !== 'czar-result') {
            if (prev === 'czar-result' && phase === 'board') {
                startCzarResultOutroAnimation()
                return
            }
            resetCzarResultAnimation()
        }
    }
)

watch(
    () => lobby.selectedCardAnimTick,
    (tick) => {
        if (!tick) return
        const cardText = lobby.lastSelectedCard?.card?.text ?? ''
        const action = lobby.lastSelectedCard?.action ?? 'selected'
        const playerId = lobby.lastSelectedCard?.playerId
        if (action === 'selected') {
            nextTick(() => spawnSelectedCardAnim(cardText, action, playerId))
        } else {
            spawnSelectedCardAnim(cardText, action, playerId)
        }
    }
)
watch(
    () => lobby.players,
    (players) => {
        if (!players) return
        console.log(`players updated ${players}`)
    },
    { deep: true }
)



onMounted(() => {

    if (!handRef.value || !playRef.value) return
    handRef.value.addEventListener("pointerdown", onPointerDown)
    playRef.value.addEventListener("pointerdown", onPointerDown)

    const sortable = new Sortable([handRef.value, playRef.value], {
        draggable: ".draggable-card",
        distance: DRAG_DISTANCE,
        plugins: [Plugins.SortAnimation],
        mirror: { constrainDimensions: true, appendTo: document.body },
    })

    sortable.on("drag:start", (evt: any) => {
        if (!isBoardPhase.value || lobby.getCurrentPlayerIsCardSelector()) {
            evt.cancel()
            return
        }
        audioStore.playPop();

        cleanupPriming()
        detachPrimingListeners()

        drag.source = evt.source as HTMLElement
        drag.source.classList.add("drag--source")
    })

    sortable.on("drag:move", (evt: any) => {
        getPointerPosition(evt)
    })

    sortable.on("sortable:sort", (evt: any) => {
        if (!playRef.value) return
        if (evt.overContainer !== playRef.value) return

        const source = evt.dragEvent?.source as HTMLElement | undefined
        if (!source || playRef.value.contains(source)) return

        const playCards = playRef.value.querySelectorAll(".draggable-card")
        if (playCards.length > 0) {
            evt.cancel()
        }
    })

    sortable.on("mirror:created", (evt: any) => {
        drag.mirror = evt.mirror as HTMLElement
        drag.mirror.classList.add("drag--mirror")
    })

    sortable.on("drag:stop", (evt: any) => {
        if (playRef.value && handRef.value && drag.source) {
            const { x, y } = getPointerPosition(evt)
            const overPlay = isOverPlaySlot(x, y)
            const wasInPlay = playRef.value.contains(drag.source)

            if (overPlay) {
                const existing = playRef.value.querySelector(".draggable-card")
                if (existing && existing !== drag.source) {
                    setCardPlacement(existing as HTMLElement, false)
                    handRef.value.appendChild(existing)
                }
                playRef.value.appendChild(drag.source)
                setCardPlacement(drag.source, true)
                emitSelectedCardFromElement(drag.source)
            } else {
                if (playRef.value.contains(drag.source)) {
                    setCardPlacement(drag.source, false)
                    handRef.value.appendChild(drag.source)
                }
                if (wasInPlay && !playRef.value.contains(drag.source)) {
                    emitUnselectedCardFromElement(drag.source)
                }
            }
        }

        drag.source?.classList.remove("drag--source")
        drag.mirror?.classList.remove("drag--mirror")
        drag.source = null
        drag.mirror = null

        // safety cleanup
        cleanupPriming()
        detachPrimingListeners()
        syncPlaySlotState()
    })

    sortableRef.value = sortable
    syncPlaySlotState()
    // timerRef.value?.start(50)
})

onBeforeUnmount(() => {
    sortableRef.value?.destroy()

    handRef.value?.removeEventListener("pointerdown", onPointerDown)
    playRef.value?.removeEventListener("pointerdown", onPointerDown)

    if (czarTimerStartTimeout) {
        clearTimeout(czarTimerStartTimeout)
        czarTimerStartTimeout = null
    }
    if (czarFlipTimeout) {
        clearTimeout(czarFlipTimeout)
        czarFlipTimeout = null
    }
    resetCzarResultAnimation()

    cleanupPriming()
    detachPrimingListeners()
})

defineExpose({ runIntroAnimation })
</script>


<template>
    <div class="flex justify-center items-center">


        <div ref="transitionEl1" class="fixed aspect-square  scale-0 translate-[-50%,-50%] bg-pink-300/70 z-10 w-screen rounded-full"></div>
        <div ref="transitionEl2" class="fixed aspect-square scale-0 translate-[-50%,-50%] bg-green-300/70 z-10 w-screen rounded-full"></div>
        <div ref="transitionEl3" class="fixed aspect-square scale-0 translate-[-50%,-50%] bg-blue-300/70 z-10 w-screen rounded-full"></div>
        <div ref="transitionEl4" class="fixed aspect-square scale-0 translate-[-50%,-50%] bg-purple-800 z-10 w-screen rounded-full"></div>

        <div>

            <!-- timer -->
            <div ref="timerWrapRef" class="absolute top-0 w-screen left-[50%] translate-x-[-50%] flex justify-between ">
                <div class="p-4 flex-1 flex items-center"> <img class="logo" width="150" src="../../../assets/images/logo.png" alt=""> </div>
                <div class="bg-[#2b0246] px-16 py-4 rounded-b-4xl border-2 border-black border-t-0">
                    <CountdownTimer ref="timerRef" :initial-seconds="240" :auto-start="false" :mode="timerMode" />
                </div>
                <div class="p-4 flex-1 flex items-center justify-end gap-3">
                    <BaseButton size="md" icon="Music"> </BaseButton>
                    <BaseButton size="md" icon="Logout"> </BaseButton>
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
                            <div v-if="lobby.isPlayerCardSelector(player.id)" class="text-xs font-bold px-2 py-1 rounded-full bg-yellow-300 text-black border-2 border-b-4 border-black"> Card Czar </div>
                        </li>

                    </ul>
                </div>
            </div>


            <div class="flex items-center">
                <div class="pr-10 bg-white border-2 border-b-5 rounded-xl border-black p-6 text-black">
                    <div class="relative ">
                        <div ref="BlackCardGhostRef" class="madness-card card-black card-anim invisible pointer-events-none select-none" v-html="blackCardHtml"></div>
                        <div class="absolute inset-0">
                            <div ref="BlackCardRef" class="madness-card card-black card-anim " v-html="blackCardHtml"></div>
                        </div>
                    </div>
                </div>
                <div ref="boardGridRef" class="-ml-6 bg-[#2b0246]  grid grid-cols-5 gap-8 w-3xl border-4 backdrop-blur-sm rounded-xl border-black p-6 transition-all" style="position: relative; perspective: 1200px;">
                    <div v-show="isRoundActive" class="play-zone ">
                        <div ref="playRef" class="play-slot">
                            <div class="madness-card card-white card-responsive play-slot-mirror" aria-hidden="true"></div>
                            <div class="play-placeholder border-3 border-dashed border-white/60 rounded-xl text-white/70 px-6 py-8 text-center text-sm"> Sleep hier je kaart </div>
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
            <div class="absolute bottom-0 left-0 right-0 flex justify-center ">
                <div v-show="isRoundActive" ref="handRef" class="hand-deck z-10 relative" :class="{ 'hand-deck--active': isRoundActive, 'hand-deck--czar': isCurrentPlayerCardSelector }">
                    <div v-for="(white_card, index) in currentPlayerCards" class="madness-card card-white card-sm draggable-card" :data-pack="white_card.pack" :data-card-id="white_card.card_id" v-html="white_card.text"></div>
                    <div v-if="isCurrentPlayerCardSelector" class="hand-czar-banner">Jij bent de Card Czar</div>

                </div>
            </div>

            <div v-show="isCzarResultPhase /* && selectedCzarPlayer */" ref="czarResultPlayerRef" class="fixed opacity-0 z-20 pointer-events-none">
                <div class="text-2xl font-bold text-white">
                    Czar
                    <span class="bg-white border-3 text-lg border-purple-950 border-b-6 px-3 py-2 rounded-xl text-purple-950 font-black"> {{ lobby.getCurrentCardSelector()?.name ?? 'A player' }}</span>
                    koos de kaart van
                    <span class="bg-white border-3 text-lg border-purple-950 border-b-6 px-3 py-2 rounded-xl text-purple-950 font-black"> {{ selectedCzarPlayer?.name ?? 'A player' }}</span>
                </div>
            </div>

            <div v-show="canStartNextRound" ref="czarNextRoundButton" class="fixed left-1/2 bottom-12 -translate-x-1/2 z-[80] pointer-events-auto">
                <BaseButton size="lg" @click="onNextRoundClick">Volgende ronde</BaseButton>
            </div>

            <div v-if="showDebugPhaseButtons" class="fixed top-6 right-6 z-[90] flex flex-col gap-3 pointer-events-auto">
                <BaseButton size="md" @click="onDebugNextPhase">Debug: Next phase</BaseButton>
                <BaseButton size="md" @click="onDebugNextRound" :disabled="!isCzarResultPhase">Debug: Next round</BaseButton>
            </div>
        </div>
    </div>
</template>
