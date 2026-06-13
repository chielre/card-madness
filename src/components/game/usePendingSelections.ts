import { nextTick, ref } from "vue"
import type { Ref } from "vue"
import gsap from "gsap"

type PendingConfig = {
  lobby: {
    currentRound?: { playerSelectedCards?: { playerId: string; locked?: boolean }[] } | null
  }
  handRef: Ref<HTMLElement | null>
  playRef: Ref<HTMLElement | null>
  boardGridRef: Ref<HTMLElement | null>
  getCurrentPlayerId: () => string | null
  cardLockWindowMs: number
  lockBoostPulseMs: number
}

export function usePendingSelections({
  lobby,
  playRef,
  boardGridRef,
  getCurrentPlayerId,
  cardLockWindowMs,
  lockBoostPulseMs,
}: PendingConfig) {
  const pendingCardState = ref(new Map<string, { status: "pending" | "locked" }>())
  const pendingCardTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const pendingCardTotals = new Map<string, number>()
  const pendingCountdownTimers = new Map<string, ReturnType<typeof setInterval>>()
  const pendingCountdownExpiresAt = new Map<string, number>()
  const pendingProgressTweens = new WeakMap<HTMLElement, gsap.core.Tween>()

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

  function getPendingSetEls(playerId: string): HTMLElement[] {
    const currentId = getCurrentPlayerId()
    if (playerId === currentId) {
      return playRef.value ? [playRef.value] : []
    }
    const remote = boardGridRef.value?.querySelector(
      `.card-set[data-set-player-id="${playerId}"]`
    ) as HTMLElement | null
    return remote ? [remote] : []
  }

  function ensurePendingTimerBadge(el: HTMLElement) {
    let badge = el.querySelector(":scope > .set-pending-timer") as HTMLElement | null
    if (!badge) {
      badge = document.createElement("div")
      badge.className = "set-pending-timer"
      badge.setAttribute("aria-hidden", "true")
      el.appendChild(badge)
    }
    return badge
  }

  function removePendingTimerBadge(el: HTMLElement) {
    const badge = el.querySelector(":scope > .set-pending-timer")
    if (badge) badge.remove()
  }

  function ensurePendingProgressBar(el: HTMLElement) {
    let bar = el.querySelector(":scope > .set-pending-bar") as HTMLElement | null
    if (!bar) {
      bar = document.createElement("div")
      bar.className = "set-pending-bar"
      bar.setAttribute("aria-hidden", "true")
      const fill = document.createElement("div")
      fill.className = "set-pending-bar__fill"
      bar.appendChild(fill)
      el.appendChild(bar)
    }
    return bar
  }

  function removePendingProgressBar(el: HTMLElement) {
    const bar = el.querySelector(":scope > .set-pending-bar")
    if (bar) bar.remove()
  }

  function updatePendingCountdown(playerId: string) {
    const expiresAt = pendingCountdownExpiresAt.get(playerId)
    if (!expiresAt) return
    const remainingMs = Math.max(0, expiresAt - Date.now())
    const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000))
    getPendingSetEls(playerId).forEach((el) => {
      const badge = ensurePendingTimerBadge(el)
      badge.textContent = `${remainingSeconds}s`
    })
  }

  function startPendingCountdown(playerId: string, durationMs: number) {
    const expiresAt = Date.now() + durationMs
    pendingCountdownExpiresAt.set(playerId, expiresAt)
    updatePendingCountdown(playerId)
    const existing = pendingCountdownTimers.get(playerId)
    if (existing) clearInterval(existing)
    const timer = window.setInterval(() => updatePendingCountdown(playerId), 250)
    pendingCountdownTimers.set(playerId, timer)
  }

  function stopPendingCountdown(playerId: string) {
    const timer = pendingCountdownTimers.get(playerId)
    if (timer) clearInterval(timer)
    pendingCountdownTimers.delete(playerId)
    pendingCountdownExpiresAt.delete(playerId)
    getPendingSetEls(playerId).forEach((el) => removePendingTimerBadge(el))
  }

  function startPendingProgress(playerId: string, totalMs: number, remainingMs: number) {
    const progress = totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0
    getPendingSetEls(playerId).forEach((el) => {
      el.style.setProperty("--timer-progress", progress.toFixed(4))
      const existing = pendingProgressTweens.get(el)
      if (existing) existing.kill()
      const tween = gsap.to(el, {
        "--timer-progress": 0,
        duration: Math.max(0.05, remainingMs / 1000),
        ease: "none",
      })
      pendingProgressTweens.set(el, tween)
    })
  }

  function stopPendingProgress(playerId: string) {
    getPendingSetEls(playerId).forEach((el) => {
      const tween = pendingProgressTweens.get(el)
      if (tween) tween.kill()
      pendingProgressTweens.delete(el)
      el.style.removeProperty("--timer-progress")
    })
  }

  function applyPendingVisuals(playerId: string, durationMs: number) {
    const totalMs = pendingCardTotals.get(playerId) ?? durationMs
    pendingCardTotals.set(playerId, totalMs)
    getPendingSetEls(playerId).forEach((el) => {
      el.classList.add("set-pending")
      ensurePendingProgressBar(el)
      ensurePendingTimerBadge(el)
    })
    updatePendingCountdown(playerId)
    startPendingProgress(playerId, totalMs, durationMs)
  }

  function pulsePendingCard(playerId: string) {
    getPendingSetEls(playerId).forEach((el) => {
      el.classList.remove("card-lock-boost")
      void el.offsetWidth
      el.classList.add("card-lock-boost")
      window.setTimeout(() => {
        el.classList.remove("card-lock-boost")
      }, lockBoostPulseMs)
    })
  }

  function clearPendingVisuals(playerId: string) {
    getPendingSetEls(playerId).forEach((el) => {
      el.classList.remove("set-pending")
      removePendingTimerBadge(el)
      removePendingProgressBar(el)
    })
    stopPendingProgress(playerId)
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
    const target = getPendingSetEls(playerId)[0]
    if (!target) return

    gsap.killTweensOf(target)
    gsap.timeline()
      .to(target, { scale: 1.04, duration: 0.18, ease: "power2.out" })
      .to(target, { y: 8, scale: 1.01, duration: 0.15, ease: "power2.in" })
      .to(target, { y: 0, scale: 1, duration: 0.2, ease: "power2.out" })

    wobbleTable()
  }

  function startPendingSelection(
    playerId: string,
    durationMs = cardLockWindowMs,
    totalMs = durationMs
  ) {
    if (!playerId) return
    if (isCardLocked(playerId)) return
    pendingCardTotals.set(playerId, totalMs)
    refreshPendingSelection(playerId, durationMs)
  }

  function refreshPendingSelection(playerId: string, durationMs = cardLockWindowMs) {
    if (!playerId) return
    if (isCardLocked(playerId)) return
    const existing = pendingCardTimers.get(playerId)
    if (existing) clearTimeout(existing)

    setPendingState(playerId, "pending")
    startPendingCountdown(playerId, durationMs)
    nextTick(() => applyPendingVisuals(playerId, durationMs))

    const timeout = setTimeout(() => {
      pendingCardTimers.delete(playerId)
      stopPendingCountdown(playerId)
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
    pendingCardTotals.delete(playerId)
    stopPendingCountdown(playerId)
    setPendingState(playerId, null)
    clearPendingVisuals(playerId)
  }

  function resetPendingSelections() {
    Array.from(pendingCardTimers.values()).forEach((timer) => clearTimeout(timer))
    pendingCardTimers.clear()
    pendingCardTotals.clear()
    pendingCountdownTimers.forEach((timer) => clearInterval(timer))
    pendingCountdownTimers.clear()
    pendingCountdownExpiresAt.clear()
    pendingCardState.value.forEach((_value, key) => clearPendingVisuals(key))
    pendingCardState.value = new Map()
  }

  return {
    isCardPending,
    isCardLocked,
    startPendingSelection,
    refreshPendingSelection,
    clearPendingSelection,
    resetPendingSelections,
    pulsePendingCard,
  }
}
