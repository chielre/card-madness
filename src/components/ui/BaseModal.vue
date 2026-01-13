<script setup lang="ts">
import { ref, nextTick, onBeforeUnmount } from 'vue'
import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

gsap.registerPlugin(CustomEase)
CustomEase.create('readyBounce', '0.16,1.45,0.34,1')

const props = withDefaults(defineProps<{
  closeOnOverlay?: boolean
  modalClass?: string
}>(), {
  closeOnOverlay: true,
  modalClass: 'bg-white border-4 border-b-8 border-black rounded-2xl max-w-xl w-full mx-4 p-6 text-black shadow-2xl',
})

const emit = defineEmits<{
  (e: 'request-close'): void
}>()

const modalWrapper = ref<HTMLElement | null>(null)
const modalRef = ref<HTMLElement | null>(null)
const modalBackdropRef = ref<HTMLElement | null>(null)
const isVisible = ref(false)

let tl: gsap.core.Timeline | null = null

function killTl() {
  tl?.kill()
  tl = null
}

onBeforeUnmount(() => killTl())

async function open() {
  isVisible.value = true
  await nextTick()

  if (!modalWrapper.value || !modalRef.value) {
    isVisible.value = false
    return
  }

  killTl()

  tl = gsap
    .timeline()
    .fromTo(modalWrapper.value, { opacity: 0 }, { opacity: 1, duration: 0.1, ease: 'power1.out' }, 0)
    .fromTo(modalRef.value, { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 1.5, ease: 'readyBounce' }, 0)
}

function close() {
  if (!modalWrapper.value || !modalRef.value) {
    isVisible.value = false
    return
  }

  killTl()

  tl = gsap
    .timeline()
    .fromTo(modalRef.value, { opacity: 1, scale: 1 }, { opacity: 0, scale: 0, duration: 1, ease: 'readyBounce' }, 0)
    .to(modalBackdropRef.value, { opacity: 0, visibility: 0, duration: 0.1, ease: 'power1.out' }, 0)
    .fromTo(modalWrapper.value, { opacity: 1 }, { opacity: 0, duration: 0.2, ease: 'power1.out' }, 0)
    .call(() => {
      isVisible.value = false
      tl = null
    }, [], 0.2)
}

function onOverlayClick() {
  if (!props.closeOnOverlay) return
  emit('request-close')
}

defineExpose({ open, close })
</script>

<template>
  <div v-if="isVisible" ref="modalWrapper" class="fixed inset-0 z-50 flex items-center justify-center">
    <div ref="modalBackdropRef" class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="onOverlayClick"></div>
    <div ref="modalRef" :class="modalClass" class="relative z-80 scale-0">
      <slot />
    </div>
  </div>
</template>
