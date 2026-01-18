<script setup lang="ts">
import { computed } from "vue"
import { useLobbyStore } from "@/store/LobbyStore"

const lobby = useLobbyStore()

const sortedPlayers = computed(() => {
  return [...lobby.players].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
})
</script>

<template>
  <section class="w-full max-w-5xl mx-auto bg-white border-4 border-b-8 rounded-xl border-black p-8 text-black">
    <h2 class="text-3xl font-black">Results</h2>
    <p class="mt-2 text-lg">Eindstand van deze game.</p>

    <ul class="mt-6 space-y-2">
      <li
        v-for="player in sortedPlayers"
        :key="player.id"
        class="flex items-center justify-between gap-4 rounded-xl border-2 border-b-4 border-black px-4 py-3"
      >
        <div class="text-xl font-black">{{ player.name }}</div>
        <div class="text-lg font-bold">{{ player.points ?? 0 }} pts</div>
      </li>
    </ul>
  </section>
</template>
