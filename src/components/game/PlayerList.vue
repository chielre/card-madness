<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import gsap from "gsap"
import Close from "vue-material-design-icons/Close.vue"

import { useLobbyStore } from "@/store/LobbyStore"

const lobby = useLobbyStore()

const listWrapRef = ref<HTMLElement | null>(null)
const listRef = ref<HTMLElement | null>(null)
const czarTokenRef = ref<HTMLElement | null>(null)
const listVisible = ref(true)

const currentCzarId = computed(() => lobby.currentRound?.cardSelector?.player ?? null)

const listPhases = new Set(["board", "czar", "czar-result"])
const shouldShowList = computed(() => listPhases.has(lobby.phase))
const displayPlayers = computed(() => {
  return [...lobby.players].sort((a, b) => {
    const diff = (b.points ?? 0) - (a.points ?? 0)
    if (diff !== 0) return diff
    return a.name.localeCompare(b.name)
  })
})

const selectedPlayerIds = computed(() => {
  const entries = lobby.currentRound?.playerSelectedCards ?? []
  return new Set(entries.map((entry) => entry.playerId))
})

function playerHasCardSelected(player: { id: string; eligibleFromRound?: number }) {
  if (lobby.phase !== "board") return false
  if (lobby.isPlayerCzar(player.id)) return false
  return true
}

function getPlayerStatusClass(player: { id: string; eligibleFromRound?: number }) {
  if (lobby.isPlayerCzar(player.id)) return "bg-yellow-500"

  if (!playerHasCardSelected(player)) return "bg-gray-400"
  return selectedPlayerIds.value.has(player.id) ? "bg-green-500" : "bg-gray-400"
}

function setListVisibility(show: boolean) {
  if (!listWrapRef.value) return
  if (show === listVisible.value) return
  listVisible.value = show

  gsap.killTweensOf(listWrapRef.value)

  if (show) {
    gsap.set(listWrapRef.value, { pointerEvents: "auto" })
    gsap.fromTo(
      listWrapRef.value,
      { x: -60, autoAlpha: 0 },
      { x: 0, autoAlpha: 1, duration: 0.4, ease: "power2.out" }
    )
  } else {
    gsap.to(listWrapRef.value, {
      x: -60,
      autoAlpha: 0,
      duration: 0.35,
      ease: "power2.in",
      onComplete: () => gsap.set(listWrapRef.value, { pointerEvents: "none" }),
    })
  }
}

function getCzarTokenTarget() {
  if (!listRef.value || !currentCzarId.value) return null
  return listRef.value.querySelector(`[data-player-dot="${currentCzarId.value}"]`) as HTMLElement | null
}

function placeCzarToken(animate = false) {
  const tokenEl = czarTokenRef.value
  const listEl = listRef.value
  const tokenTargetEl = getCzarTokenTarget()
  if (!tokenEl || !listEl || !tokenTargetEl) return

  const targetRect = tokenTargetEl.getBoundingClientRect()
  const tokenRect = tokenEl.getBoundingClientRect()

  const listRect = listEl.getBoundingClientRect()
  const targetX = targetRect.right - listRect.left + 8
  const targetY = targetRect.top - listRect.top + targetRect.height / 2

  gsap.set(tokenEl, { xPercent: 0, yPercent: -50 })
  if (!animate) {
    gsap.set(tokenEl, { x: targetX, y: targetY, rotate: 0 })
    return
  }

  gsap.killTweensOf(tokenEl)
  gsap.set(tokenEl, { y: targetY, rotate: 0 })

  gsap.timeline()
    .to(tokenEl, { x: targetX - 28, duration: 0.2, ease: "power1.inOut" })
    .to(tokenEl, { x: targetX + (tokenRect.width - 16), duration: 0.4, ease: "power2.inOut" }, 1)
    .to(tokenEl, { x: targetX, duration: 0.2, ease: "power2.inOut" }, 2)
}

function handleResize() {
  placeCzarToken(false)
}

async function kickPlayer(playerId: string) {
  if (!lobby.canCurrentPlayerKickPlayer(playerId)) return
  await lobby.kickPlayer(lobby.lobbyId, playerId)
}

watch(
  () => lobby.phase,
  () => {
    if (!shouldShowList.value) {
      setListVisibility(false)
      return
    }
    setListVisibility(true)
  },
  { immediate: true }
)

watch(
  () => lobby.players.map((player) => player.id),
  () => nextTick(() => placeCzarToken(false)),
  { immediate: true }
)

let hasPlacedCzar = false
watch(
  () => currentCzarId.value,
  (nextId, prevId) => {
    if (!nextId) return
    nextTick(() => placeCzarToken(hasPlacedCzar && nextId !== prevId))
    hasPlacedCzar = true
  },
  { immediate: true }
)

watch(
  () => lobby.players.length,
  () => nextTick(() => placeCzarToken(false))
)

onMounted(() => {
  if (listWrapRef.value && !shouldShowList.value) {
    setListVisibility(false)
    listVisible.value = false
  }

  window.addEventListener("resize", handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize)
})
</script>

<template>
  <div ref="listWrapRef" class="absolute left-0 top-[50%] translate-y-[-50%] flex gap-2">
    <div v-show="currentCzarId" ref="czarTokenRef" class="czar-token ">
      CZAR
    </div>
    <div ref="listRef" class="relative bg-white border-4 border-b-8 border-l-0 rounded-xl rounded-l-none border-black p-2 text-black z-10">


      <ul class="space-y-2">
        <li v-for="player in displayPlayers" :key="player.id" class="group flex justify-between items-center gap-4 text-black text-xl font-bold p-2 rounded-xl even:bg-gray-100">
          <div class="flex items-center gap-4">
            <div class="inline-block w-4 h-4 border-3 border-white outline-2 outline-black rounded-full" :class="getPlayerStatusClass(player)" :data-player-dot="player.id"></div>
            <div>{{ player.name }}</div>
          </div>

          <div class="flex items-center gap-3">
            <button v-if="lobby.canCurrentPlayerKickPlayer(player.id)" type="button" class="flex items-center justify-center w-7 h-7 hover:bg-gray-200 rounded-lg" @click.stop="kickPlayer(player.id)">
              <Close />
            </button>
            <div class="text-xs font-black px-2 py-1 rounded-full bg-purple-200 text-purple-900 border-2 border-b-4 border-black">
              {{ player.points ?? 0 }} pts
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
