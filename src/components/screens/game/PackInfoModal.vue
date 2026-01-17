<script setup lang="ts">
import { computed, ref, nextTick } from "vue";
import { resolvePacks } from "@/utils/packs"
import { useAudioStore } from '@/store/AudioStore'

const audio = useAudioStore()

const resolvedPacks = computed(() => resolvePacks())
const selectedPack = computed(() => resolvedPacks.value.find((p) => p.id === selectedPackId.value) || null)

const selectedPackId = ref<string | null>(null)

const open = (packId: string) => {
    const targetPack = resolvedPacks.value.find((p) => p.id === packId)
    if (!targetPack) return

    selectedPackId.value = packId

    document.body.style.backgroundImage = `linear-gradient(135deg, ${targetPack.backgroundColors.join(', ')})`

    if (targetPack.musicUrl) {
        audio.playPackMusicOnce(targetPack.id, targetPack.musicUrl)
    }
}

const close = () => {

    selectedPackId.value = null
    audio.playLobby()
    document.body.style.backgroundImage = ''
}

defineExpose({ open, close })

</script>

<template>
    <div v-if="selectedPack" class="fixed inset-0 z-50 flex items-center justify-center ">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="close"></div>
        <div class="relative bg-white border-4 border-b-8 border-black rounded-2xl max-w-xl w-full mx-4 p-6 text-black shadow-2xl">
            <button class="absolute top-3 right-3 w-8 h-8 rounded-full border-2 border-black text-black bg-gray-100 hover:bg-gray-200" @click="close">
                ✕
            </button>
            <div class="text-xs font-black uppercase tracking-wide text-gray-600">Pack info</div>
            <div class="flex gap-4 items-center">

                <h3 class="text-2xl font-black">{{ selectedPack.name }}</h3>
                <div class=" font-bold border-2 border-b-4 rounded-full px-2 py-0.5 text-xs" v-if="selectedPack.nsfw">NSFW</div>
            </div>
            <p class="mt-6 text-lg leading-relaxed">{{ selectedPack.description }}</p>
            <div class="mt-6 justify-between flex items-center bg-gray-50 rounded-xl p-3">
                <div class=" flex items-center gap-4">
                    <img v-if="selectedPack.logoUrl" :src="selectedPack.logoUrl" class="w-20 h-20 object-contain" alt="">
                    <div v-if="selectedPack.partnerUrl" class="flex gap-4 items-center">
                        <div class="text-sm text-gray-600">
                            In samenwerking met
                        </div>
                        <img class="" width="75" :src="selectedPack.partnerUrl" alt="">
                    </div>
                    <div v-else class=" text-gray-600">
                        Pack by
                        <b v-if="selectedPack?.author?.name">{{ selectedPack.author.name }}</b>
                        <b v-else>CardMadness</b>
                    </div>
                </div>


            </div>
        </div>
    </div>
</template>
