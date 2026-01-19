<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue"
import gsap from "gsap"
import { useLobbyStore } from "@/store/LobbyStore"
import { useConnectionStore } from "@/store/ConnectionStore"
import { useAudioStore } from "@/store/AudioStore"
import BaseButton from "@/components/ui/BaseButton.vue"

const lobby = useLobbyStore()
const connection = useConnectionStore()
const audioStore = useAudioStore()

const resultsWrapRef = ref<HTMLElement | null>(null)
const throneFirstRef = ref<HTMLElement | null>(null)
const throneSecondRef = ref<HTMLElement | null>(null)
const throneThirdRef = ref<HTMLElement | null>(null)
const listRef = ref<HTMLElement | null>(null)
const backButtonRef = ref<HTMLElement | null>(null)
const showBackButton = ref(false)

let resultsTl: gsap.core.Timeline | null = null
let backButtonTimer: number | null = null

const sortedPlayers = computed(() => {
  return [...lobby.players].sort((a, b) => {
    const diff = (b.points ?? 0) - (a.points ?? 0)
    if (diff !== 0) return diff
    return a.name.localeCompare(b.name)
  })
})
const showSecondaryThrones = computed(() => sortedPlayers.value.length >= 3)
const firstPlayer = computed(() => sortedPlayers.value[0] ?? null)
const secondPlayer = computed(() => (showSecondaryThrones.value ? sortedPlayers.value[1] : null))
const thirdPlayer = computed(() => (showSecondaryThrones.value ? sortedPlayers.value[2] : null))
const remainingPlayers = computed(() => sortedPlayers.value.slice(showSecondaryThrones.value ? 3 : 1))
const canReturnToLobby = computed(() => lobby.getCurrentPlayerIsHost())

function clearBackButtonTimer() {
  if (backButtonTimer !== null) {
    window.clearTimeout(backButtonTimer)
    backButtonTimer = null
  }
}

function resetResultsAnimation() {
  resultsTl?.kill()
  resultsTl = null
  showBackButton.value = false
  clearBackButtonTimer()
}

function setInitialResultsState() {
  const thrones = [throneFirstRef.value, throneSecondRef.value, throneThirdRef.value].filter(Boolean)
  const listItems = listRef.value ? Array.from(listRef.value.querySelectorAll("li")) : []
  gsap.set(thrones, { autoAlpha: 0, y: 80, scale: 0.96 })
  gsap.set(listItems, { autoAlpha: 0, y: 16 })
  if (backButtonRef.value) gsap.set(backButtonRef.value, { autoAlpha: 0, y: 16 })
}

function startResultsAnimation() {
  resetResultsAnimation()
  setInitialResultsState()

  resultsTl = gsap.timeline()
  if (throneFirstRef.value) {
    resultsTl.fromTo(
      throneFirstRef.value,
      { autoAlpha: 0, y: 120, scale: 0.88, rotate: -6 },
      { autoAlpha: 1, y: 0, scale: 1, rotate: 0, duration: 0.9, ease: "elastic.out(1, 0.55)" },
      0
    )
  }

  if (showSecondaryThrones.value) {
    if (throneSecondRef.value) {
      resultsTl.fromTo(
        throneSecondRef.value,
        { autoAlpha: 0, y: 110, scale: 0.9, rotate: 5 },
        { autoAlpha: 1, y: 0, scale: 1, rotate: 0, duration: 0.8, ease: "elastic.out(1, 0.6)" },
        0.25
      )
    }
    if (throneThirdRef.value) {
      resultsTl.fromTo(
        throneThirdRef.value,
        { autoAlpha: 0, y: 110, scale: 0.9, rotate: -5 },
        { autoAlpha: 1, y: 0, scale: 1, rotate: 0, duration: 0.8, ease: "elastic.out(1, 0.6)" },
        0.35
      )
    }
  }

  const listItems = listRef.value ? Array.from(listRef.value.querySelectorAll("li")) : []
  if (listItems.length) {
    resultsTl.to(
      listItems,
      { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out", stagger: 0.06 },
      showSecondaryThrones.value ? 0.75 : 0.6
    )
  }

  backButtonTimer = window.setTimeout(() => {
    showBackButton.value = true
    nextTick(() => {
      if (backButtonRef.value) {
        gsap.to(backButtonRef.value, { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" })
      }
    })
  }, 5000)
}

async function onReturnToLobby() {
  if (!canReturnToLobby.value) return
  const socket = await connection.ensureSocket()
  socket.emit("room:phase-set", { lobbyId: lobby.lobbyId, phase: "lobby" })
}

watch(
  () => lobby.phase,
  (phase) => {
    if (phase !== "results") {
      resetResultsAnimation()
      return
    }
    audioStore.playGameEnd()
    nextTick(() => startResultsAnimation())
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  resetResultsAnimation()
})
</script>

<template>
  <section class="relative min-h-screen flex items-center justify-center px-8">
    <div ref="resultsWrapRef" class="w-full max-w-6xl mx-auto bg-white border-4 border-b-8 rounded-2xl border-black p-8 text-black">
      <h2 class="text-3xl font-black">Results</h2>
      <p class="mt-2 text-lg">Eindstand van deze game.</p>

      <div
        class="mt-8 grid gap-6 items-end"
        :class="showSecondaryThrones ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1'"
      >
        <div
          v-if="firstPlayer"
          ref="throneFirstRef"
          class="relative bg-yellow-200 border-4 border-b-8 border-black rounded-2xl px-6 py-6 shadow-[0_14px_24px_rgba(0,0,0,0.18)] md:order-2"
        >
          <div class="absolute -top-4 left-4 w-9 h-9 rounded-full bg-black text-white flex items-center justify-center text-lg font-black">1</div>
          <div class="text-sm font-black uppercase text-yellow-900">Winner</div>
          <div class="mt-2 text-2xl font-black">{{ firstPlayer.name }}</div>
          <div class="mt-1 text-lg font-bold">{{ firstPlayer.points ?? 0 }} pts</div>
        </div>

        <div
          v-if="secondPlayer"
          ref="throneSecondRef"
          class="relative bg-slate-200 border-4 border-b-8 border-black rounded-2xl px-6 py-6 shadow-[0_10px_20px_rgba(0,0,0,0.15)] md:order-1"
        >
          <div class="absolute -top-4 left-4 w-9 h-9 rounded-full bg-black text-white flex items-center justify-center text-lg font-black">2</div>
          <div class="mt-2 text-xl font-black">{{ secondPlayer.name }}</div>
          <div class="mt-1 text-lg font-bold">{{ secondPlayer.points ?? 0 }} pts</div>
        </div>

        <div
          v-if="thirdPlayer"
          ref="throneThirdRef"
          class="relative bg-orange-200 border-4 border-b-8 border-black rounded-2xl px-6 py-6 shadow-[0_10px_20px_rgba(0,0,0,0.15)] md:order-3"
        >
          <div class="absolute -top-4 left-4 w-9 h-9 rounded-full bg-black text-white flex items-center justify-center text-lg font-black">3</div>
          <div class="mt-2 text-xl font-black">{{ thirdPlayer.name }}</div>
          <div class="mt-1 text-lg font-bold">{{ thirdPlayer.points ?? 0 }} pts</div>
        </div>
      </div>

      <div class="mt-8">
        <h3 class="text-xl font-black">Overige spelers</h3>
        <ul ref="listRef" class="mt-4 space-y-2">
          <li
            v-for="player in remainingPlayers"
            :key="player.id"
            class="flex items-center justify-between gap-4 rounded-xl border-2 border-b-4 border-black px-4 py-3"
          >
            <div class="text-xl font-black">{{ player.name }}</div>
            <div class="text-lg font-bold">{{ player.points ?? 0 }} pts</div>
          </li>
          <li v-if="!remainingPlayers.length" class="text-sm font-bold text-gray-600">
            Geen extra spelers in de lijst.
          </li>
        </ul>
      </div>

      <div v-show="showBackButton" ref="backButtonRef" class="mt-8 flex justify-center">
        <BaseButton size="lg" :disabled="!canReturnToLobby" @click="onReturnToLobby">
          Terug naar lobby
        </BaseButton>
      </div>
    </div>
  </section>
</template>
