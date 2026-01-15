<script setup lang="ts">
import { computed, useSlots } from 'vue'

import Plus from 'vue-material-design-icons/Plus.vue'
import Close from 'vue-material-design-icons/Close.vue'
import ChevronRight from 'vue-material-design-icons/ChevronRight.vue'
import Music from 'vue-material-design-icons/Music.vue'
import Github from 'vue-material-design-icons/Github.vue'
import Cog from 'vue-material-design-icons/Cog.vue'
import ScaleBalance from 'vue-material-design-icons/ScaleBalance.vue'
import Minus from 'vue-material-design-icons/Minus.vue'
import Logout from 'vue-material-design-icons/Logout.vue'


type ButtonType = 'animated' | 'block'
type ButtonColor = 'white' | 'black' | 'blue' | 'pink' | 'green'
type ButtonSize = 'md' | 'lg' | 'sm'

const props = withDefaults(defineProps<{
  type?: ButtonType
  color?: ButtonColor
  size?: ButtonSize
  disabled?: boolean
  icon?: 'Plus' | 'ChevronRight' | 'Music' | 'Github' | 'Cog'
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
  Music,
  Github,
  Cog,
  ScaleBalance,
  Close,
  Minus,
  Logout
} as const

const Icon = computed(() => (props.icon ? icons[props.icon] : null))
const isIconOnly = computed(() => !!props.icon && !useSlots().default)


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
    case 'blue':
      return 'btn-blue'
    case 'pink':
      return 'btn-pink'
    case 'green':
      return 'btn-green'
    default:
      return 'btn-white'
  }
})

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'lg':
      return 'btn-lg'
    case 'sm':
      return 'btn-sm'
    default:
      return 'btn-md'
  }
})

const iconGap = computed(() => (props.icon ? 'gap-2' : ''))
</script>

<template>
  <button :class="[
    baseClasses,
    typeClasses,
    colorClasses,
    sizeClasses,
    iconGap,
    'inline-flex items-center justify-center',
    {
      'opacity-50 cursor-not-allowed': disabled,
      'btn-icon-only': isIconOnly,
    }
  ]" :disabled="disabled" @click="onClick">
    <component v-if="Icon && iconPosition === 'left'" :is="Icon" :class="iconClass" aria-hidden="true" />
    <slot />
    <component v-if="Icon && iconPosition === 'right'" :is="Icon" :class="iconClass" aria-hidden="true" />
  </button>
</template>
