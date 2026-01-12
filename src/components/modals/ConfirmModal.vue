<script setup lang="ts">
import { watch, ref } from 'vue'

import BaseModal from '@/components/ui/BaseModal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useUiStore } from '@/store/UiStore'

const ui = useUiStore()
const modalRef = ref<InstanceType<typeof BaseModal> | null>(null)

watch(
  () => ui.isConfirmOpen,
  async (isOpen) => {
    if (isOpen) await modalRef.value?.open()
    else modalRef.value?.close()
  },
  { immediate: true }
)

const onCancel = () => ui.resolveConfirm(false)
const onConfirm = () => ui.resolveConfirm(true)
</script>

<template>
  <BaseModal ref="modalRef" :close-on-overlay="false" @request-close="onCancel">
    <div class="flex items-center justify-between">
      <h3 class="text-2xl font-black">{{ ui.confirmTitle }}</h3>
      <BaseButton color="black" size="md" @click="onCancel">Close</BaseButton>
    </div>

    <p v-if="ui.confirmMessage" class="mt-4 text-lg text-gray-700">
      {{ ui.confirmMessage }}
    </p>

    <div class="mt-6 flex justify-end gap-3">
      <BaseButton color="black" size="md" @click="onCancel">{{ ui.confirmCancelText }}</BaseButton>
      <BaseButton
        :color="ui.confirmIsDestructive ? 'pink' : 'green'"
        size="md"
        @click="onConfirm"
      >
        {{ ui.confirmConfirmText }}
      </BaseButton>
    </div>
  </BaseModal>
</template>
