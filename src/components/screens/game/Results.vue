<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue"
import gsap from "gsap"
import { CustomEase } from "gsap/CustomEase"
import PersonIcon from "vue-material-design-icons/Account.vue"

import { resolveBlackCard, resolveWhiteCards } from "@/utils/cards"
import { useLobbyStore } from "@/store/LobbyStore"
import { useConnectionStore } from "@/store/ConnectionStore"
import { useAudioStore } from "@/store/AudioStore"
import BaseButton from "@/components/ui/BaseButton.vue"

gsap.registerPlugin(CustomEase)

const lobby = useLobbyStore()
const connection = useConnectionStore()
const audioStore = useAudioStore()

const czarResultPlayerRef = ref<HTMLElement | null>(null)
const czarNextRoundButton = ref<HTMLElement | null>(null)
const resultsVisible = ref(false)

const transitionEl1 = ref<HTMLElement | null>(null)
const transitionEl2 = ref<HTMLElement | null>(null)
const transitionEl3 = ref<HTMLElement | null>(null)
const transitionEl4 = ref<HTMLElement | null>(null)

const transitionEls = computed(() => [transitionEl1.value, transitionEl2.value, transitionEl3.value, transitionEl4.value].filter(Boolean) as HTMLElement[])
const blackCardHtml = computed(() => lobby.getCurrentBlackCardHtml() || "...")
const blackCardEmptyHtml = computed(() => {
  const blackCard = lobby.currentRound?.blackCard
  if (!blackCard) return blackCardHtml.value || "..."
  try {
    return resolveBlackCard(blackCard).text
  } catch {
    return blackCardHtml.value || "..."
  }
})
const selectedEntry = computed(() => lobby.currentRound?.cardSelector?.selectedCard ?? null)
const selectedCzarPlayerId = computed(() => selectedEntry.value?.playerId ?? null)
const selectedCzarPlayer = computed(() => lobby.players.find((p) => p.id === selectedCzarPlayerId.value) ?? null)
const selectedCardHtml = computed(() => {
  const card = selectedEntry.value?.card
  if (!card) return ""
  try {
    return resolveWhiteCards([card])[0]?.text ?? ""
  } catch {
    return ""
  }
})

const canStartNextRound = computed(() =>
  lobby.phase === "czar-result" && lobby.getCurrentPlayerIsCzar()
)

let blackCardContainerEl: HTMLElement | null = null
let blackCardFrontEl: HTMLElement | null = null
let whiteCardEl: HTMLElement | null = null
let whiteCardBackEl: HTMLElement | null = null
let czarResultOutroTl: gsap.core.Timeline | null = null
let blackCardTypingFrame: number | null = null
let czarResultStarting = false

const showCzarResultButton = ref(false)

type ScoreboardEntry = {
  id: string
  name: string
  oldPoints: number
  newPoints: number
  pointsDelta: number
  displayPoints: number
  isCzar: boolean
  isWinner: boolean
}

const scoreboardWrapRef = ref<HTMLElement | null>(null)
const scoreboardVisible = ref(false)
const scoreboardOffsetX = ref(240)
const scoreboardEntries = ref<ScoreboardEntry[]>([])

const scoreRowRefs = new Map<string, HTMLElement>()
const scoreValueRefs = new Map<string, HTMLElement>()
const scoreAwardRefs = new Map<string, HTMLElement>()

const roundPointsSnapshot = ref(new Map<string, number>())

const POINTS_CZAR_PICKED = 5
const POINTS_CZAR_SELECT = 1

let scoreboardTl: gsap.core.Timeline | null = null
let scoreboardReorderRunning = false

function cleanupCzarResultElements() {
  if (blackCardContainerEl) {
    blackCardContainerEl.remove()
    blackCardContainerEl = null
    blackCardFrontEl = null
  }
  if (whiteCardEl) {
    whiteCardEl.remove()
    whiteCardEl = null
  }
  if (whiteCardBackEl) {
    whiteCardBackEl.remove()
    whiteCardBackEl = null
  }
}

function setScoreRowRef(el: Element | null, id: string) {
  if (!id) return
  if (el) {
    scoreRowRefs.set(id, el as HTMLElement)
  } else {
    scoreRowRefs.delete(id)
  }
}

function setScoreValueRef(el: Element | null, id: string) {
  if (!id) return
  if (el) {
    scoreValueRefs.set(id, el as HTMLElement)
  } else {
    scoreValueRefs.delete(id)
  }
}

function setScoreAwardRef(el: Element | null, id: string) {
  if (!id) return
  if (el) {
    scoreAwardRefs.set(id, el as HTMLElement)
  } else {
    scoreAwardRefs.delete(id)
  }
}

function sortEntriesByPoints(entries: ScoreboardEntry[], key: "oldPoints" | "newPoints") {
  return [...entries].sort((a, b) => {
    const diff = b[key] - a[key]
    if (diff !== 0) return diff
    return a.name.localeCompare(b.name)
  })
}

function getRoundPointDelta(playerId: string) {
  const winnerId = selectedEntry.value?.playerId ?? null
  const czarId = lobby.getCurrentCzar()?.id ?? null
  let delta = 0
  if (winnerId && playerId === winnerId) delta += POINTS_CZAR_PICKED
  if (czarId && playerId === czarId) delta += POINTS_CZAR_SELECT
  return delta
}

function buildScoreboardEntries() {
  const czarId = lobby.getCurrentCzar()?.id ?? ""
  const winnerId = selectedEntry.value?.playerId ?? null
  const fallbackSnapshot = new Map(lobby.players.map((player) => [player.id, Number(player.points) || 0]))
  const snapshot = roundPointsSnapshot.value.size ? roundPointsSnapshot.value : fallbackSnapshot
  const entries = lobby.players.map((player) => {
    const oldPoints = snapshot.get(player.id) ?? (Number(player.points) || 0)
    const pointsDelta = getRoundPointDelta(player.id)
    const newPoints = oldPoints + pointsDelta
    return {
      id: player.id,
      name: player.name,
      oldPoints,
      newPoints,
      pointsDelta,
      displayPoints: oldPoints,
      isCzar: player.id === czarId,
      isWinner: Boolean(winnerId && player.id === winnerId),
    }
  })

  return sortEntriesByPoints(entries, "oldPoints")
}

function createPointsCountTimeline(entry: ScoreboardEntry) {
  const pointsEl = scoreValueRefs.get(entry.id)
  const tl = gsap.timeline()
  const counter = { value: entry.oldPoints }
  const duration = entry.newPoints === entry.oldPoints ? 0.25 : 0.85

  tl.to(counter, {
    value: entry.newPoints,
    duration,
    ease: "power1.out",
    onUpdate: () => {
      entry.displayPoints = Math.round(counter.value)
    },
    onComplete: () => {
      entry.displayPoints = entry.newPoints
    },
  })

  if (pointsEl) {
    tl.to(pointsEl, { scale: 1.25, duration: 0.2, ease: "power2.out" }, 0)
    tl.to(pointsEl, { scale: 1, duration: 0.35, ease: "bounce.out" }, 0.2)
  }

  return tl
}

async function animateScoreboardReorder(onDone?: () => void) {
  if (scoreboardReorderRunning) return
  scoreboardReorderRunning = true

  const beforeRects = new Map<string, DOMRect>()
  scoreboardEntries.value.forEach((entry) => {
    const el = scoreRowRefs.get(entry.id)
    if (el) beforeRects.set(entry.id, el.getBoundingClientRect())
  })

  scoreboardEntries.value = sortEntriesByPoints(scoreboardEntries.value, "newPoints")
  await nextTick()

  const tl = gsap.timeline({
    onComplete: () => {
      scoreboardReorderRunning = false
      onDone?.()
    },
  })

  scoreboardEntries.value.forEach((entry, index) => {
    const el = scoreRowRefs.get(entry.id)
    const before = beforeRects.get(entry.id)
    if (!el || !before) return
    const after = el.getBoundingClientRect()
    const deltaY = before.top - after.top
    if (!deltaY) return

    gsap.set(el, { y: deltaY, zIndex: 2 })
    tl.to(
      el,
      { y: 0, duration: 0.7, ease: "power3.out", clearProps: "zIndex" },
      index * 0.08
    )
    tl.fromTo(
      el,
      { scale: 1.03 },
      { scale: 1, duration: 0.45, ease: "power2.out" },
      index * 0.08
    )
  })
  if (!tl.getChildren().length) {
    scoreboardReorderRunning = false
    onDone?.()
  }
  return tl
}

function animateScoreAwards() {
  const awards = scoreboardEntries.value
    .filter((entry) => entry.pointsDelta > 0)
    .map((entry) => scoreAwardRefs.get(entry.id))
    .filter(Boolean) as HTMLElement[]
  if (!awards.length) return

  gsap.set(awards, { autoAlpha: 1 })
  gsap.fromTo(
    awards,
    { scale: 0.7, y: -6, rotate: -6 },
    { scale: 1, y: 0, rotate: 0, duration: 0.6, ease: "elastic.out(1, 0.5)", stagger: 0.1 }
  )
}

function startScoreboardAnimation() {
  scoreboardTl?.kill()
  scoreboardTl = null

  scoreboardEntries.value = buildScoreboardEntries()
  scoreboardVisible.value = true

  nextTick(() => {
    const wrap = scoreboardWrapRef.value
    if (!wrap) return

    gsap.set(wrap, { autoAlpha: 0, y: 24 })
    scoreboardTl = gsap.timeline()
      .to(wrap, { autoAlpha: 1, y: 0, duration: 0.45, ease: "power2.out" })

    const czarId = lobby.getCurrentCzar()?.id ?? ""
    const czarEntry = scoreboardEntries.value.find((entry) => entry.id === czarId)
    const otherEntries = scoreboardEntries.value.filter((entry) => entry.id !== czarId)
    const countOrder = czarEntry ? [czarEntry, ...otherEntries] : otherEntries

    countOrder.forEach((entry) => {
      scoreboardTl?.add(createPointsCountTimeline(entry), "+=0.12")
    })
    scoreboardTl?.call(() => {
      animateScoreboardReorder(() => animateScoreAwards())
    })
  })
}

function resetScoreboardAnimation() {
  scoreboardTl?.kill()
  scoreboardTl = null
  scoreboardVisible.value = false
  scoreboardEntries.value = []
  scoreRowRefs.clear()
  scoreValueRefs.clear()
  scoreAwardRefs.clear()
  scoreboardReorderRunning = false
  roundPointsSnapshot.value = new Map()
}

function positionCzarResultPlayer() {
  const el = czarResultPlayerRef.value
  if (!el) return

  const target = blackCardContainerEl
  if (!target) return

  const rect = target.getBoundingClientRect()
  const top = rect.bottom + 16
  const left = rect.left + rect.width / 2
  gsap.set(el, { top, left, xPercent: -50 })
}

function setBlackCardHtml(html: string) {
  if (!blackCardFrontEl) return null
  blackCardFrontEl.innerHTML = ""
  const wrap = document.createElement("div")
  wrap.className = "czar-blackcard-text"
  wrap.innerHTML = html
  Object.assign(wrap.style, {
    position: "relative",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
  })
  blackCardFrontEl.appendChild(wrap)
  return wrap
}

function createBlackCard() {
  const container = document.createElement("div")
  container.className = "czar-blackcard-clone"
  Object.assign(container.style, {
    position: "fixed",
    left: "0",
    top: "0",
    margin: "0",
    zIndex: "80",
    transformOrigin: "center",
    pointerEvents: "none",
    overflow: "hidden",
    display: "block",
    visibility: "hidden",
    opacity: "1",
  })

  const back = document.createElement("div")
  back.className = "madness-card card-white card-back"
  Object.assign(back.style, {
    position: "absolute",
    inset: "0",
    zIndex: "0",
    transform: "rotateY(180deg)",
    backfaceVisibility: "hidden",
  })

  const front = document.createElement("div")
  front.className = "madness-card card-black card-anim"
  Object.assign(front.style, {
    position: "relative",
    zIndex: "1",
    backfaceVisibility: "hidden",
  })

  container.appendChild(back)
  container.appendChild(front)
  document.body.appendChild(container)

  blackCardContainerEl = container
  blackCardFrontEl = front
  setBlackCardHtml(blackCardEmptyHtml.value)
  return container
}

function createWhiteCard() {
  const el = document.createElement("div")
  el.className = "card-flip czar-whitecard-clone"
  el.innerHTML = `
    <div class="madness-card card-white card-back card-flip-back" aria-hidden="true"></div>
    <div class="madness-card card-white card-flip-front">${selectedCardHtml.value}</div>
  `
  Object.assign(el.style, {
    position: "fixed",
    left: "0px",
    top: "0px",
    width: "0px",
    height: "0px",
    margin: "0",
    zIndex: "70",
    transformOrigin: "center",
    pointerEvents: "none",
  })
  document.body.appendChild(el)
  el.querySelectorAll(".madness-card").forEach((card) => {
    const cardEl = card as HTMLElement
    cardEl.style.width = "100%"
    cardEl.style.height = "100%"
  })
  const back = el.querySelector(".card-flip-back") as HTMLElement | null
  const front = el.querySelector(".card-flip-front") as HTMLElement | null
  if (back && front) {
    back.style.transformStyle = "preserve-3d"
    front.style.transformStyle = "preserve-3d"
    back.style.backfaceVisibility = "hidden"
    front.style.backfaceVisibility = "hidden"
    back.style.transform = "rotateY(180deg)"
    front.style.transform = "rotateY(0deg)"
  }
  whiteCardEl = el
  return el
}

function createWhiteCardBack() {
  const el = document.createElement("div")
  el.className = "czar-whitecard-back"
  el.innerHTML = `<div class="madness-card card-white card-back" aria-hidden="true"></div>`
  Object.assign(el.style, {
    position: "fixed",
    left: "0px",
    top: "0px",
    width: "0px",
    height: "0px",
    margin: "0",
    zIndex: "60",
    transformOrigin: "center",
    pointerEvents: "none",
  })
  document.body.appendChild(el)
  const cardEl = el.querySelector(".madness-card") as HTMLElement | null
  if (cardEl) {
    cardEl.style.width = "100%"
    cardEl.style.height = "100%"
  }
  whiteCardBackEl = el
  return el
}

function layoutBlackCard(container: HTMLElement) {
  if (!blackCardFrontEl) return null
  const frontRect = blackCardFrontEl.getBoundingClientRect()
  container.style.width = `${Math.round(frontRect.width) || 200}px`
  container.style.height = `${Math.round(frontRect.height) || 300}px`
  blackCardFrontEl.style.position = "absolute"
  blackCardFrontEl.style.inset = "0"
  container.style.left = `${Math.round((window.innerWidth - container.offsetWidth) / 2)}px`
  container.style.top = `${Math.round((window.innerHeight - container.offsetHeight) / 2)}px`
  container.style.visibility = "visible"
  return container.getBoundingClientRect()
}

function setCardRect(el: HTMLElement | null, rect: DOMRect) {
  if (!el) return
  el.style.left = `${rect.left}px`
  el.style.top = `${rect.top}px`
  el.style.width = `${rect.width}px`
  el.style.height = `${rect.height}px`
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
  const wrap = setBlackCardHtml(blackCardEmptyHtml.value)
  if (!wrap) return
  const placeholderText = getAnswerTextFromHtml(blackCardEmptyHtml.value)
  const answerEl = wrap.querySelector(".card-answer") as HTMLElement | null
  const text = getAnswerTextFromHtml(answerHtml)
  if (!answerEl) return
  if (!text) return

  const total = text.length
  answerEl.textContent = placeholderText
  const start = performance.now()
  let lastCount = 0

  const step = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs)
    const count = Math.floor(total * t)
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
  cleanupCzarResultElements()
  resetScoreboardAnimation()

  if (transitionEls.value.length) gsap.set(transitionEls.value, { clearProps: "all" })
  if (czarResultPlayerRef.value) gsap.set(czarResultPlayerRef.value, { clearProps: "all" })

  showCzarResultButton.value = false
}

async function startCzarResultAnimation() {
  if (czarResultStarting) return

  resultsVisible.value = true
  czarResultStarting = true
  await nextTick()

  roundPointsSnapshot.value = new Map(
    lobby.players.map((player) => [player.id, Number(player.points) || 0])
  )

  czarResultOutroTl?.kill()
  czarResultOutroTl = null

  cleanupCzarResultElements()
  const card = createBlackCard()
  const rect = layoutBlackCard(card)
  if (!rect) {
    czarResultStarting = false
    return
  }
  const hasWhiteCard = Boolean(selectedCardHtml.value)
  const whiteCard = hasWhiteCard ? createWhiteCard() : null
  const whiteBackCard = createWhiteCardBack()

  setCardRect(card, rect)
  setCardRect(whiteCard, rect)
  setCardRect(whiteBackCard, rect)

  const mergedCards = whiteBackCard ? [card, whiteBackCard] : [card]
  gsap.set(card, {
    autoAlpha: 0,
    transformPerspective: 1200,
    transformStyle: "preserve-3d",
    backfaceVisibility: "hidden",
  })
  if (whiteBackCard) {
    gsap.set(whiteBackCard, {
      autoAlpha: 0,
      transformPerspective: 1200,
      transformStyle: "preserve-3d",
      backfaceVisibility: "visible",
    })
  }
  if (whiteCard) {
    gsap.set(whiteCard, { transformPerspective: 1200, transformStyle: "preserve-3d" })
  }

  CustomEase.create("readyBounce", "0.18,1.4,0.35,1")
  audioStore.playWrapCzarOnce()

  const tl = gsap.timeline()
  const scaleUp = Math.max(1.1, Math.min(1.45, Math.min(window.innerWidth / 950, window.innerHeight / 760)))
  const settleScale = Math.max(1.05, scaleUp - 0.2)
  const sharedRotate = -4
  const introRotate = gsap.utils.random(-5, 5)
  const hasWhiteCardIntro = Boolean(whiteCard)
  const gap = Math.round(rect.width * 0.5)
  const offset = hasWhiteCardIntro ? Math.round(rect.width / 2 + gap / 2) : 0
  const scoreboardShiftX = Math.round(Math.min(Math.max(rect.width * 0.35, 120), 200))
  const scoreboardOffset = Math.round(Math.min(Math.max(rect.width * 0.75, 200), window.innerWidth * 0.3))

  transitionEls.value.forEach((el, idx) => {
    tl.fromTo(
      el,
      { scale: 0 },
      { scale: 1.3, duration: 3, ease: "readyBounce" },
      0 + [0, 0.3, 0.4, 0.5][idx]
    )
  })

  const driftX = Math.max(rect.width * 1.8)

  // Cards inside screen
  tl.fromTo(
    mergedCards,
    { x: -driftX, rotateY: -65, rotate: introRotate, scale: 1.05, autoAlpha: 0 },
    {
      x: -offset,
      rotateY: 0,
      rotate: gsap.utils.random(-5, 5),
      scale: scaleUp * 1.05,
      autoAlpha: 1,
      duration: 1,
      ease: "power3.inOut",
    },
    1
  )
  if (whiteCard) {
    tl.fromTo(
      whiteCard,
      { x: driftX, rotate: -introRotate, scale: 1.05, autoAlpha: 0 },
      {
        x: offset,
        rotate: gsap.utils.random(-5, 5),
        scale: scaleUp * 1.05,
        autoAlpha: 1,
        duration: 1,
        ease: "power3.inOut",
      },
      1
    )
  }

  tl.to(
    mergedCards,
    { scale: settleScale, duration: 0.6, ease: "readyBounce" },
    2
  )
  if (whiteCard) {
    tl.to(
      whiteCard,
      { scale: settleScale, duration: 0.6, ease: "readyBounce" },
      2
    )
  }

  if (whiteCard) {
    tl.to(
      mergedCards,
      {
        x: 0,
        z: 8,
        rotate: sharedRotate,
        duration: 0.4,
        ease: "power2.inOut",
      },
      2.6
    ).to(
      whiteCard,
      {
        x: 0,
        z: -8,
        rotate: sharedRotate,
        duration: 0.4,
        ease: "power2.inOut",
      },
      2.6
    )
  }

  const spinStart = 3.05
  const spinDuration = 4
  const spinEnd = spinStart + spinDuration
  const typeDurationMs = 3000
  const spinSwapAt = spinStart + typeDurationMs / 1000
  const spinEase = "power3.inOut"
  const spinTargets = whiteCard ? [...mergedCards, whiteCard] : mergedCards
  const scoreboardStart = spinEnd + 1.05

  tl.to(
    spinTargets,
    { rotateY: 1800, duration: spinDuration, ease: spinEase },
    spinStart
  )
    .to(
      spinTargets,
      { y: -60, duration: spinDuration, ease: "sine.out" },
      spinStart
    )
    .call(() => {
      typeBlackCardAnswer(blackCardHtml.value, typeDurationMs)
    }, [], spinStart + 1)
    .call(() => {
      clearBlackCardTyping()
      setBlackCardHtml(blackCardHtml.value)
    }, [], spinSwapAt)
    .call(() => {
      if (whiteCardEl) gsap.set(whiteCardEl, { autoAlpha: 0 })
    }, [], spinEnd + 0.05)
    .to(
      mergedCards,
      { y: 0, rotate: 1, duration: 0.35, ease: "power4.in" },
      spinEnd + 0.15
    )
    .call(() => playCzarResultShine(card), [], spinEnd + 0.55)

  tl.call(() => positionCzarResultPlayer(), [], spinEnd + 0.6)
    .fromTo(
      czarResultPlayerRef.value,
      { y: 60, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.5, ease: "power2.out", delay: 0.2 },
      spinEnd + 0.65
    )
    .to(
      mergedCards,
      {
        x: -scoreboardShiftX,
        duration: 0.45,
        ease: "power2.out",
      },
      scoreboardStart
    )
    .to(
      czarResultPlayerRef.value,
      {
        x: -scoreboardShiftX,
        duration: 0.45,
        ease: "power2.out",
      },
      scoreboardStart
    )
    .call(() => {
      scoreboardOffsetX.value = scoreboardOffset
      startScoreboardAnimation()
    }, [], scoreboardStart + 0.1)
    .call(() => {
      showCzarResultButton.value = true
    }, [], spinEnd + 0.65)
    .fromTo(
      czarNextRoundButton.value,
      { y: 60, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.5, ease: "power2.out", delay: 0.2 },
      spinEnd + 2.35
    )

  czarResultStarting = false
}

function startCzarResultOutroAnimation() {
  const original = blackCardContainerEl
  const outroTargets = original ? (whiteCardBackEl ? [original, whiteCardBackEl] : [original]) : null

  czarResultOutroTl?.kill()
  czarResultOutroTl = gsap.timeline({
    onComplete: () => {
      resetCzarResultAnimation()
    },
  })

  if (czarResultPlayerRef.value) czarResultOutroTl.to(czarResultPlayerRef.value, { y: 20, autoAlpha: 0, duration: 0.25, ease: "power2.in" }, 0)
  if (czarNextRoundButton.value) czarResultOutroTl.to(czarNextRoundButton.value, { y: 20, autoAlpha: 0, duration: 0.25, ease: "power2.in" }, 0)
  if (scoreboardWrapRef.value) czarResultOutroTl.to(scoreboardWrapRef.value, { y: 20, autoAlpha: 0, duration: 0.3, ease: "power2.in" }, 0)

  if (transitionEls.value.length) {

    transitionEls.value.forEach((el, idx) => {
      czarResultOutroTl?.to(
        el,
        { scale: 0, duration: .5, ease: "power2.inOut" },
        0 + [0.3, 0.2, 0.1, 0][idx]
      )
    })
  }

  if (outroTargets) {
    czarResultOutroTl.to(
      outroTargets,
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

  czarResultOutroTl.call(() => {
    resultsVisible.value = false

  }, [], 2)
}

async function onNextRoundClick() {
  if (!canStartNextRound.value) return
  const socket = await connection.ensureSocket()
  socket.emit("round:next", { lobbyId: lobby.lobbyId })
}

defineExpose({
  startCzarResultAnimation,
  startCzarResultOutroAnimation,
  resetCzarResultAnimation,
})

watch(
  () => lobby.phase,
  (phase, prev) => {
    if (phase === "czar-result") {
      if (czarResultStarting || blackCardContainerEl) return
      nextTick(() => startCzarResultAnimation())
      return
    }
    if (prev === "czar-result") {
      czarResultStarting = false
    }
  }
)

onBeforeUnmount(() => {
  czarResultOutroTl?.kill()
  czarResultOutroTl = null
  scoreboardTl?.kill()
  scoreboardTl = null
  clearBlackCardTyping()
  cleanupCzarResultElements()
  scoreRowRefs.clear()
  scoreValueRefs.clear()
  scoreAwardRefs.clear()
  scoreboardEntries.value = []
  scoreboardVisible.value = false
  resultsVisible.value = false
  showCzarResultButton.value = false
  czarResultStarting = false
})
</script>

<template>
  <div class="fixed inset-0" v-if="resultsVisible">
    <section class="relative min-h-screen flex items-center justify-center px-8">
      <div ref="transitionEl1" class="fixed aspect-square scale-0 translate-[-50%,-50%] bg-pink-300/70 z-10 w-screen rounded-full"></div>
      <div ref="transitionEl2" class="fixed aspect-square scale-0 translate-[-50%,-50%] bg-green-300/70 z-10 w-screen rounded-full"></div>
      <div ref="transitionEl3" class="fixed aspect-square scale-0 translate-[-50%,-50%] bg-blue-300/70 z-10 w-screen rounded-full"></div>
      <div ref="transitionEl4" class="fixed aspect-square scale-0 translate-[-50%,-50%] bg-purple-800 z-10 w-screen rounded-full"></div>

      <div v-show="lobby.phase === 'czar-result'" ref="czarResultPlayerRef" class="fixed opacity-0 z-20 pointer-events-none">
        <div class="text-2xl flex items-center gap-3 font-bold text-white">
          <template v-if="selectedCzarPlayer?.id === lobby.getCurrentPlayer()?.id">
            <span>czar</span>
            <div class="flex gap-2 bg-white border-3 text-lg border-purple-950 border-b-6 px-3 py-2 rounded-xl text-purple-950 font-black">
              <PersonIcon />
              {{ lobby.getCurrentCzar()?.name ?? "A player" }}
            </div>
            koos jou kaart!
          </template>

          <template v-else>
            <span>czar</span>
            <div class="flex gap-2 bg-white border-3 text-lg border-purple-950 border-b-6 px-3 py-2 rounded-xl text-purple-950 font-black">
              <PersonIcon />
              {{ lobby.getCurrentCzar()?.name ?? "A player" }}
            </div>
            koos de kaart van
            <div class="flex gap-2 bg-white border-3 text-lg border-purple-950 border-b-6 px-3 py-2 rounded-xl text-purple-950 font-black">
              <PersonIcon />
              {{ selectedCzarPlayer?.name ?? "A player" }}
            </div>
          </template>
        </div>
      </div>

      <div
        v-show="scoreboardVisible"
        ref="scoreboardWrapRef"
        class="fixed left-1/2 top-1/2 z-30 w-[360px] max-w-[80vw] -translate-y-1/2 translate-x-[var(--scoreboard-offset)] opacity-0 pointer-events-none"
        :style="{ '--scoreboard-offset': `${scoreboardOffsetX}px` }"
      >
        <div class="bg-white/95 border-4 border-b-8 border-black rounded-2xl p-4 text-black shadow-[0_18px_30px_rgba(0,0,0,0.35)]">
          <div class="text-lg font-black uppercase tracking-wide">Scoreboard</div>
          <ul class="mt-3 space-y-2">
            <li
              v-for="entry in scoreboardEntries"
              :key="entry.id"
              :ref="(el) => setScoreRowRef(el, entry.id)"
              class="relative flex items-center justify-between gap-4 rounded-xl border-2 border-b-4 border-black px-4 py-3"
              :class="entry.isWinner ? 'bg-yellow-100 border-yellow-500' : 'bg-white'"
            >
              <div class="flex items-center gap-2">
                <span v-if="entry.isCzar" class="px-2 py-0.5 text-xs font-black uppercase bg-yellow-300 border-2 border-b-4 border-black rounded-md">
                  czar
                </span>
                <span v-if="entry.isWinner" class="px-2 py-0.5 text-xs font-black uppercase bg-green-300 border-2 border-b-4 border-black rounded-md">
                  winner
                </span>
                <span class="text-lg font-black">{{ entry.name }}</span>
              </div>
              <div :ref="(el) => setScoreValueRef(el, entry.id)" class="text-xl font-black tabular-nums">
                {{ entry.displayPoints }} pts
              </div>
              <div
                v-if="entry.pointsDelta > 0"
                :ref="(el) => setScoreAwardRef(el, entry.id)"
                class="absolute -right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 text-xs font-black uppercase bg-black text-white border-2 border-b-4 border-black rounded-md opacity-0"
              >
                +{{ entry.pointsDelta }} pts
              </div>
            </li>
          </ul>
        </div>
      </div>

      <div v-show="canStartNextRound && showCzarResultButton" ref="czarNextRoundButton" class="fixed left-1/2 bottom-12 -translate-x-1/2 z-[80] pointer-events-auto">
        <BaseButton size="lg" @click="onNextRoundClick">Volgende ronde</BaseButton>
      </div>

    </section>
  </div>
</template>
