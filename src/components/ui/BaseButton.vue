<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'

type ButtonType = 'animated' | 'block'
type ButtonColor = 'white' | 'black'
type ButtonSize = 'md' | 'lg'

const props = withDefaults(defineProps<{
  type?: ButtonType
  color?: ButtonColor
  size?: ButtonSize
  disabled?: boolean
  icon?: string // bv: "Plus", "ChevronRight"
  iconPosition?: 'left' | 'right'
  iconClass?: string
}>(), {
  type: 'animated',
  color: 'white',
  size: 'md',
  disabled: false,
  iconPosition: 'left',
  iconClass: 'h-5 w-5',
})

const emit = defineEmits<{ click: [] }>()

const onClick = () => {
  if (props.disabled) return
  emit('click')
}

// --- base styling ---
const baseClasses = 'btn'

const typeClasses = computed(() => {
  switch (props.type) {
    case 'block':
      return 'btn-block'
    case 'animated':
    default:
      return 'btn-animated'
  }
})

const colorClasses = computed(() => {
  switch (props.color) {
    case 'black':
      return 'btn-black'
    case 'white':
    default:
      return 'btn-white'
  }
})

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'lg':
      return 'btn-lg'
    case 'md':
    default:
      return 'btn-md'
  }
})

// Vite-friendly dynamic icon loading
const iconModules = import.meta.glob('/node_modules/vue-material-design-icons/*.vue')

const Icon = computed(() => {
  if (!props.icon) return null

  const key = `/node_modules/vue-material-design-icons/${props.icon}.vue`
  const loader = iconModules[key]

  if (!loader) {
    // optioneel: console.warn voor snelle debug
    console.warn(`[BaseButton] Icon not found: ${key}`)
    return null
  }

  return defineAsyncComponent(loader as any)
})

const iconGap = computed(() => (props.icon ? 'gap-2' : ''))
</script>

<template>
  <button
    :class="[
      baseClasses,
      typeClasses,
      colorClasses,
      sizeClasses,
      iconGap,
      'inline-flex items-center justify-center',
      { 'opacity-50 cursor-not-allowed': disabled }
    ]"
    :disabled="disabled"
    @click="onClick"
  >
    <component
      v-if="Icon && iconPosition === 'left'"
      :is="Icon"
      :class="iconClass"
      aria-hidden="true"
    />

    <slot />

    <component
      v-if="Icon && iconPosition === 'right'"
      :is="Icon"
      :class="iconClass"
      aria-hidden="true"
    />
  </button>
</template>
