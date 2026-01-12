<script setup lang="ts">
import { computed } from 'vue'

import Plus from 'vue-material-design-icons/Plus.vue'
import ChevronRight from 'vue-material-design-icons/ChevronRight.vue'

type ButtonType = 'animated' | 'block'
type ButtonColor = 'white' | 'black'
type ButtonSize = 'md' | 'lg'

const props = withDefaults(defineProps<{
  type?: ButtonType
  color?: ButtonColor
  size?: ButtonSize
  disabled?: boolean
  icon?: 'Plus' | 'ChevronRight' | 'Trash' // (optioneel stricter)
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

const icons = {
  Plus,
  ChevronRight,
} as const

const Icon = computed(() => (props.icon ? icons[props.icon] : null))

const onClick = () => {
  if (props.disabled) return
  emit('click')
}

const baseClasses = 'btn'

const typeClasses = computed(() => {
  switch (props.type) {
    case 'block':
      return 'btn-block'
    default:
      return 'btn-animated'
  }
})

const colorClasses = computed(() => {
  switch (props.color) {
    case 'black':
      return 'btn-black'
    default:
      return 'btn-white'
  }
})

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'lg':
      return 'btn-lg'
    default:
      return 'btn-md'
  }
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
