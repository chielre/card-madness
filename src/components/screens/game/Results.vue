<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue"
import gsap from "gsap"
import { CustomEase } from "gsap/CustomEase"
import PersonIcon from "vue-material-design-icons/Account.vue"
import ThumbUp from "vue-material-design-icons/ThumbUp.vue"
import ThumbDown from "vue-material-design-icons/ThumbDown.vue"

import { resolveBlackCard, resolveWhiteCards } from "@/utils/cards"
import { useLobbyStore } from "@/store/LobbyStore"
import { useAudioStore } from "@/store/AudioStore"
import BaseButton from "@/components/ui/BaseButton.vue"

gsap.registerPlugin(CustomEase)

const lobby = useLobbyStore()
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
const selectedCardsResolved = computed<string[]>(() => {
  const cards = selectedEntry.value?.cards ?? []
  if (!cards.length) return []
  try {
    return resolveWhiteCards(cards).map((c) => c.text)
  } catch {
    return []
  }
})
const hasSelectedCards = computed(() => selectedCardsResolved.value.length > 0)

const canStartNextRound = computed(() =>
  lobby.phase === "czar-result" && lobby.getCurrentPlayerIsCzar()
)

let blackCardContainerEl: HTMLElement | null = null
let blackCardFrontEl: HTMLElement | null = null
let whiteCardEl: HTMLElement | null = null
let whiteCardSetSize = 1
let whiteCardBackEl: HTMLElement | null = null
let czarResultOutroTl: gsap.core.Timeline | null = null
let blackCardTypingFrame: number | null = null
let czarResultStarting = false

const showCzarResultButton = ref(false)

const ratingBarFillRef = ref<HTMLElement | null>(null)
const ratingUiVisible = ref(false)

const ratingVerdictRef = ref<HTMLElement | null>(null)
const ratingVerdictFillRef = ref<HTMLElement | null>(null)
const ratingVerdictVisible = ref(false)

const isCzar = computed(() => lobby.getCurrentPlayerIsCzar())
const ratingUp = computed(() => lobby.czarRating.up)
const ratingDown = computed(() => lobby.czarRating.down)
const hasRated = computed(() => lobby.hasCurrentPlayerRated())
const ratingVerdictLabel = computed(() => {
  switch (lobby.czarRating.result) {
    case "win": return "Grappig!"
    case "lose": return "Niet grappig"
    case "tie": return "Gelijkspel"
    default: return ""
  }
})

let mergedCardsForScore: HTMLElement[] = []
let scoreboardShiftXVal = 0
let scoreboardOffsetVal = 240
let ratingCountdownFrame: number | null = null
let scoreboardSequenceStarted = false
const ratingStickerEls: HTMLElement[] = []

type ScoreboardEntry = {
  id: string
  name: string
  oldPoints: number
  newPoints: number
  pointsDelta: number
  displayPoints: number
  isCzar: boolean
  isWinner: boolean
  pointsLostThisRound: number
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

function formatDelta(delta: number) {
  return `${delta > 0 ? "+" : "−"}${Math.abs(delta)} pts`
}

function getRoundPointDelta(playerId: string) {
  const winnerId = selectedEntry.value?.playerId ?? null
  const czarId = lobby.getCurrentCzar()?.id ?? null
  let delta = 0
  if (winnerId && playerId === winnerId) delta += POINTS_CZAR_PICKED
  if (czarId && playerId === czarId) {
    delta += POINTS_CZAR_SELECT
    if (lobby.czarRating.resolved) delta += lobby.czarRating.bonus
  }
  return delta
}

function buildScoreboardEntries() {
  const czarId = lobby.getCurrentCzar()?.id ?? ""
  const winnerId = selectedEntry.value?.playerId ?? null
  const fallbackSnapshot = new Map(lobby.players.map((player) => [player.id, Number(player.points) || 0]))
  const snapshot = roundPointsSnapshot.value.size ? roundPointsSnapshot.value : fallbackSnapshot
  const entries = lobby.players.map((player) => {
    const lost = Number(player.pointsLostThisRound) || 0
    const award = getRoundPointDelta(player.id)
    const snapPoints = snapshot.get(player.id) ?? (Number(player.points) || 0)
    const oldPoints = snapPoints + lost
    const pointsDelta = award - lost
    const newPoints = snapPoints + award
    return {
      id: player.id,
      name: player.name,
      oldPoints,
      newPoints,
      pointsDelta,
      displayPoints: oldPoints,
      isCzar: player.id === czarId,
      isWinner: Boolean(winnerId && player.id === winnerId),
      pointsLostThisRound: lost,
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
    .filter((entry) => entry.pointsDelta !== 0)
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
  const faces = selectedCardsResolved.value
  const n = Math.max(1, faces.length)
  whiteCardSetSize = n
  const cardHtml = (face: string) => `
    <div class="card-flip czar-whitecard-card">
      <div class="madness-card card-white card-responsive card-back card-flip-back" aria-hidden="true"></div>
      <div class="madness-card card-white card-responsive card-flip-front">${face}</div>
    </div>`
  const el = document.createElement("div")
  el.className = "czar-whitecard-clone"
  el.innerHTML = (faces.length ? faces : [""]).map(cardHtml).join("")
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
    transformStyle: "preserve-3d",
  })
  document.body.appendChild(el)
  el.querySelectorAll<HTMLElement>(".czar-whitecard-card").forEach((cf) => {
    cf.style.position = "absolute"
    cf.style.inset = "0"
    cf.style.transformStyle = "preserve-3d"
    const back = cf.querySelector(".card-flip-back") as HTMLElement | null
    const front = cf.querySelector(".card-flip-front") as HTMLElement | null
    for (const face of [back, front]) {
      if (!face) continue
      face.style.position = "absolute"
      face.style.inset = "0"
      face.style.transformStyle = "preserve-3d"
      face.style.backfaceVisibility = "hidden"
    }
    if (back) back.style.transform = "rotateY(180deg)"
    if (front) front.style.transform = "rotateY(0deg)"
  })
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

function typeBlackCardAnswer(answerHtml: string, durationMs: number) {
  clearBlackCardTyping()
  const wrap = setBlackCardHtml(blackCardEmptyHtml.value)
  if (!wrap) return
  const placeholders = getAnswerTextsFromHtml(blackCardEmptyHtml.value)
  const answerEls = Array.from(wrap.querySelectorAll<HTMLElement>(".card-answer"))
  const texts = getAnswerTextsFromHtml(answerHtml)
  if (!answerEls.length) return

  const slots = answerEls.map((el, i) => {
    const text = texts[i] || ""
    el.textContent = placeholders[i] ?? ""
    return { el, text }
  })

  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs)
    slots.forEach(({ el, text }) => {
      el.textContent = text.slice(0, Math.floor(text.length * t))
    })
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
  endRatingUi()
  clearRatingStickers()
  ratingVerdictVisible.value = false
  scoreboardSequenceStarted = false
  mergedCardsForScore = []

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
  const hasWhiteCard = hasSelectedCards.value
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

  mergedCardsForScore = mergedCards
  scoreboardShiftXVal = scoreboardShiftX
  scoreboardOffsetVal = scoreboardOffset

  transitionEls.value.forEach((el, idx) => {
    tl.fromTo(
      el,
      { scale: 0 },
      { scale: 1.3, duration: 3, ease: "readyBounce" },
      0 + [0, 0.3, 0.4, 0.5][idx]
    )
  })

  const driftX = Math.max(rect.width * 1.8)

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
    .call(() => onRevealComplete(), [], scoreboardStart)

  czarResultStarting = false
}

/**
 * Called once the chosen-card reveal has finished. When the server has started
 * an audience rating for this round we show the thumbs UI and wait for the
 * result; otherwise we drop straight into the scoreboard as before.
 */
function onRevealComplete() {
  if (lobby.czarRating.active && !lobby.czarRating.resolved) {
    beginRatingUi()
    return
  }
  playScoreboardSequence()
}

/** Slides the cards aside and reveals the animated scoreboard + next button. */
function playScoreboardSequence() {
  if (scoreboardSequenceStarted) return
  scoreboardSequenceStarted = true
  fadeOutRatingStickers()
  const tl = gsap.timeline()
  if (mergedCardsForScore.length) {
    tl.to(mergedCardsForScore, { x: -scoreboardShiftXVal, duration: 0.45, ease: "power2.out" }, 0)
  }
  if (czarResultPlayerRef.value) {
    tl.to(czarResultPlayerRef.value, { x: -scoreboardShiftXVal, duration: 0.45, ease: "power2.out" }, 0)
  }
  tl.call(() => {
    scoreboardOffsetX.value = scoreboardOffsetVal
    startScoreboardAnimation()
  }, [], 0.1)
  tl.call(() => {
    showCzarResultButton.value = true
  }, [], 0.1)
  tl.call(() => showRatingVerdict(), [], 0.5)
  tl.fromTo(
    czarNextRoundButton.value,
    { y: 60, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, duration: 0.5, ease: "power2.out" },
    1.1
  )
}

function positionRatingVerdict() {
  const el = ratingVerdictRef.value
  const target = blackCardContainerEl
  if (!el || !target) return
  const rect = target.getBoundingClientRect()
  gsap.set(el, {
    top: rect.top - 52,
    left: rect.left + rect.width / 2,
    xPercent: -50,
    width: Math.round(rect.width),
  })
}

function showRatingVerdict() {
  const total = lobby.czarRating.up + lobby.czarRating.down
  if (!lobby.czarRating.resolved || total <= 0) return
  ratingVerdictVisible.value = true
  nextTick(() => {
    positionRatingVerdict()
    const pct = (lobby.czarRating.up / total) * 100
    if (ratingVerdictFillRef.value) {
      gsap.fromTo(ratingVerdictFillRef.value, { width: "0%" }, { width: `${pct}%`, duration: 0.7, ease: "power2.out" })
    }
    if (ratingVerdictRef.value) {
      gsap.fromTo(ratingVerdictRef.value, { autoAlpha: 0, y: -10 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" })
    }
  })
}

function stopRatingCountdown() {
  if (ratingCountdownFrame !== null) {
    cancelAnimationFrame(ratingCountdownFrame)
    ratingCountdownFrame = null
  }
}

function startRatingCountdown() {
  stopRatingCountdown()
  const fill = ratingBarFillRef.value
  if (!fill) return
  const durationMs = lobby.czarRating.durationMs || 30000
  const expiresAt = lobby.czarRating.expiresAt || (Date.now() + durationMs)

  const step = () => {
    const remaining = Math.max(0, expiresAt - Date.now())
    const pct = Math.max(0, Math.min(1, remaining / durationMs))
    fill.style.width = `${pct * 100}%`
    if (remaining > 0 && ratingUiVisible.value && !lobby.czarRating.resolved) {
      ratingCountdownFrame = requestAnimationFrame(step)
    } else {
      ratingCountdownFrame = null
    }
  }
  step()
}

function beginRatingUi() {
  ratingUiVisible.value = true
  nextTick(() => {
    startRatingCountdown()
  })
}

function endRatingUi() {
  ratingUiVisible.value = false
  stopRatingCountdown()
}

function clearRatingStickers() {
  ratingStickerEls.splice(0).forEach((el) => el.remove())
}

function fadeOutRatingStickers() {
  const els = ratingStickerEls.splice(0)
  if (!els.length) return
  gsap.to(els, {
    autoAlpha: 0,
    scale: 0.6,
    duration: 0.35,
    ease: "power2.in",
    onComplete: () => els.forEach((el) => el.remove()),
  })
}

function spawnRatingSticker(vote: "up" | "down") {
  const target = blackCardContainerEl
  if (!target) return
  const rect = target.getBoundingClientRect()
  const el = document.createElement("div")
  el.className = `czar-rating-sticker czar-rating-sticker--${vote}`
  el.textContent = vote === "up" ? "👍" : "👎"
  const padX = rect.width * 0.18
  const padY = rect.height * 0.18
  const x = rect.left + padX + Math.random() * (rect.width - padX * 2)
  const y = rect.top + padY + Math.random() * (rect.height - padY * 2)
  Object.assign(el.style, {
    position: "fixed",
    left: `${x}px`,
    top: `${y}px`,
    zIndex: "90",
    pointerEvents: "none",
  })
  document.body.appendChild(el)
  ratingStickerEls.push(el)

  const rot = gsap.utils.random(-22, 22)
  gsap.fromTo(
    el,
    { y: -window.innerHeight * 0.45, autoAlpha: 0, scale: 1.7, rotate: rot * 2 },
    { y: 0, autoAlpha: 1, scale: 1, rotate: rot, duration: 0.6, ease: "bounce.out" }
  )
  audioStore.playPop()
}

function castRatingVote(vote: "up" | "down") {
  if (!lobby.canCurrentPlayerRate() || hasRated.value) return
  void lobby.submitCzarRatingVote(vote)
}

function startCzarResultOutroAnimation() {
  ratingVerdictVisible.value = false
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
  await lobby.requestNextRound()
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

watch(
  () => lobby.czarRatingVotedTick,
  (tick) => {
    if (!tick) return
    const vote = lobby.lastCzarRatingVote?.vote
    if (!vote) return
    spawnRatingSticker(vote)
  }
)

watch(
  () => lobby.czarRatingResolvedTick,
  (tick) => {
    if (!tick) return
    if (lobby.phase !== "czar-result") return
    endRatingUi()
    playScoreboardSequence()
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
  stopRatingCountdown()
  clearRatingStickers()
  ratingUiVisible.value = false
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
              <div
                :ref="(el) => setScoreValueRef(el, entry.id)"
                class="text-xl font-black tabular-nums"
                :title="entry.isCzar ? 'De czar krijgt altijd 1 punt voor het kiezen van een kaart.' : undefined"
              >
                {{ entry.displayPoints }} pts
              </div>
              <div
                v-if="entry.pointsDelta !== 0"
                :ref="(el) => setScoreAwardRef(el, entry.id)"
                class="absolute -right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 text-xs font-black uppercase border-2 border-b-4 border-black rounded-md opacity-0"
                :class="entry.pointsDelta > 0 ? 'bg-black text-white' : 'bg-red-500 text-white'"
                :title="entry.pointsLostThisRound > 0 ? 'Er is deze ronde een kaart gewisseld (−1 punt verrekend).' : undefined"
              >
                {{ formatDelta(entry.pointsDelta) }}
              </div>
            </li>
          </ul>
        </div>
      </div>

      <div v-show="ratingVerdictVisible" ref="ratingVerdictRef" class="czar-rating-verdict fixed z-[84] pointer-events-none opacity-0">
        <div class="flex items-center justify-between text-white font-black text-sm mb-1 px-1 drop-shadow">
          <span class="flex items-center gap-1"><ThumbUp :size="16" /> {{ ratingUp }}</span>
          <span class="uppercase tracking-wide">{{ ratingVerdictLabel }}</span>
          <span class="flex items-center gap-1"><ThumbDown :size="16" /> {{ ratingDown }}</span>
        </div>
        <div class="czar-rating-meter">
          <div ref="ratingVerdictFillRef" class="czar-rating-meter__fill"></div>
        </div>
      </div>

      <div v-show="ratingUiVisible" class="fixed left-1/2 bottom-28 -translate-x-1/2 z-[85] flex flex-col items-center gap-3">
        <template v-if="!isCzar">
          <div class="text-white font-black text-lg drop-shadow">Was de CZAR juist?</div>
          <div class="flex items-center gap-6">
            <button
              v-show="!hasRated || lobby.czarRating.myVote === 'up'"
              type="button"
              class="czar-rating-btn czar-rating-btn--up"
              :disabled="hasRated"
              @click="castRatingVote('up')"
            >
              <ThumbUp :size="42" />
            </button>
            <button
              v-show="!hasRated || lobby.czarRating.myVote === 'down'"
              type="button"
              class="czar-rating-btn czar-rating-btn--down"
              :disabled="hasRated"
              @click="castRatingVote('down')"
            >
              <ThumbDown :size="42" />
            </button>
          </div>
        </template>
        <template v-else>
          <div class="flex items-center gap-4 bg-black/50 px-5 py-3 rounded-xl text-white font-black text-lg">
            <span>Het publiek beoordeelt je keuze…</span>
            <span class="flex items-center gap-2">
              <ThumbUp :size="20" /> {{ ratingUp }}
              <ThumbDown :size="20" /> {{ ratingDown }}
            </span>
          </div>
        </template>

        <div class="czar-rating-bar w-72 pointer-events-none">
          <div ref="ratingBarFillRef" class="czar-rating-bar__fill"></div>
        </div>
      </div>

      <div v-show="canStartNextRound && showCzarResultButton" ref="czarNextRoundButton" class="fixed left-1/2 bottom-12 -translate-x-1/2 z-[80] pointer-events-auto">
        <BaseButton size="lg" @click="onNextRoundClick">Volgende ronde</BaseButton>
      </div>

    </section>
  </div>
</template>
