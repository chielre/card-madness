<script setup lang="ts">
import { computed } from "vue"
import { useLobbyStore } from "@/store/LobbyStore"
import BaseButton from "@/components/ui/BaseButton.vue"

const lobby = useLobbyStore()

const stage = computed(() => (import.meta as any).env?.STAGE)
const showDebugPhaseButtons = computed(() => {
  const devButtons = (import.meta as any).env?.DEV_PHASE_BUTTONS
  return stage.value === "development" && String(devButtons) === "1"
})
const showDevTools = computed(() => stage.value === "development")

async function onDebugNextPhase() {
  if (!showDebugPhaseButtons.value) return
  const nextMap: Record<string, string> = {
    lobby: "starting",
    starting: "intro",
    intro: "board",
    board: "czar",
    czar: "czar-result",
    "czar-result": "board",
    results: "lobby",
  }
  const nextPhase = nextMap[lobby.phase]
  if (!nextPhase) return
  await lobby.setServerPhase(nextPhase)
}

async function onDebugNextRound() {
  if (!showDebugPhaseButtons.value) return
  await lobby.requestNextRound()
}

async function onSpawnBot() {
  if (!showDevTools.value || !lobby.lobbyId) return
  await lobby.spawnBot()
}
</script>

<template>
  <div v-if="showDebugPhaseButtons || showDevTools" class="fixed bottom-6 right-6 z-[90] flex flex-col gap-3 pointer-events-auto">
    <BaseButton v-if="showDebugPhaseButtons" size="md" @click="onDebugNextPhase">Debug: Next phase</BaseButton>
    <BaseButton v-if="showDebugPhaseButtons" size="md" @click="onDebugNextRound" :disabled="lobby.phase !== 'czar-result'">Debug: Next round</BaseButton>
    <BaseButton v-if="showDevTools" size="md" @click="onSpawnBot" :disabled="!lobby.lobbyId">Debug: Spawn AI</BaseButton>
  </div>
</template>
