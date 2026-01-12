<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import BaseModal from '@/components/ui/BaseModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

import { useAudioStore } from '@/store/AudioStore'
import { useUiStore } from '@/store/UiStore'

const modalRef = ref<InstanceType<typeof BaseModal> | null>(null)

const audio = useAudioStore()
const ui = useUiStore()

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

const musicVolume = computed({
  get: () => Math.round(audio.musicMaster * 100),
  set: (value: number | string) => audio.setMusicMaster(Number(value) / 100),
})

const sfxVolume = computed({
  get: () => Math.round(audio.sfxMaster * 100),
  set: (value: number | string) => audio.setSfxMaster(Number(value) / 100),
})

const stepMaster = (kind: 'music' | 'sfx', stepPct: number) => {
  const step = stepPct / 100

  if (kind === 'music') {
    audio.setMusicMaster(clamp01(audio.musicMaster + step))
    return
  }

  audio.setSfxMaster(clamp01(audio.sfxMaster + step))
}



const addMusicVolume = (steps: number) => stepMaster('music', +steps)
const takeMusicVolume = (steps: number) => stepMaster('music', -steps)

const addSfxVolume = (steps: number) => stepMaster('sfx', +steps)
const takeSfxVolume = (steps: number) => stepMaster('sfx', -steps)

watch(
  () => ui.isSettingsOpen,
  async (isOpen) => {
    if (isOpen) await modalRef.value?.open()
    else modalRef.value?.close()
  },
  { immediate: true }
)

const close = () => ui.closeSettings()
</script>

<template>
  <BaseModal ref="modalRef" @request-close="close">
    <div class="flex items-center justify-between">
      <h3 class="text-2xl font-black">Settings</h3>
      <BaseButton color="pink" icon="Close" size="sm" @click="close" />
    </div>

    <div class="mt-6 space-y-6">
      <!-- Muziek -->
      <div>
        <div class="w-1/2">
          <div class="text-lg font-black">Muziek</div>
          <p class="text-sm text-gray-600">Geweldige muziek, al zeggen we het zelf.</p>
        </div>

        <div class="mt-3 flex items-center justify-between gap-2">
          <BaseButton icon="Minus" size="sm" :disabled="!audio.musicEnabled" @click="takeMusicVolume(5)" />
          <input v-model="musicVolume" type="range" min="0" max="100" step="5" :disabled="!audio.musicEnabled" class="mt-2 w-full accent-black disabled:opacity-40" />
          <BaseButton icon="Plus" size="sm" :disabled="!audio.musicEnabled" @click="addMusicVolume(5)" />
        </div>
      </div>

      <!-- SFX -->
      <div class="mt-9">
        <div class="w-1/2">
          <div class="text-lg font-black">Sound effects</div>
          <p class="text-sm text-gray-600">Geeft je game wat meer kleur... ik bedoel geluid!</p>
        </div>

        <div class="mt-3 flex items-center justify-between gap-2">
          <BaseButton icon="Minus" size="sm" :disabled="!audio.sfxEnabled" @click="takeSfxVolume(5)" />
          <input v-model="sfxVolume" type="range" min="0" max="100" step="5" :disabled="!audio.sfxEnabled" class="mt-2 w-full accent-black disabled:opacity-40" />
          <BaseButton icon="Plus" size="sm" :disabled="!audio.sfxEnabled" @click="addSfxVolume(5)" />
        </div>
      </div>
    </div>
  </BaseModal>
</template>
