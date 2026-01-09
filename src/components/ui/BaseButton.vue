<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
    type?: 'animated' | 'block'
    color?: 'white' | 'black'
    size?: 'md' | 'lg'
    disabled?: boolean
}>()

const emit = defineEmits<{
    click: []
}>()

const onClick = () => {
    if (props.disabled) return
    emit('click')
}

// --- base styling ---
const baseClasses = 'btn'

const typeClasses = computed(() => {
    switch (props.type) {
        case 'animated':
            return 'btn-animated'
        default:
            return 'btn-animated'
    }
})

// --- dynamic colors ---
const colorClasses = computed(() => {
    switch (props.color) {
        case 'black':
            return 'btn-black'
        default:
            return 'btn-white'
    }
})

// --- sizes ---
const sizeClasses = computed(() => {
    switch (props.size) {
        case 'lg':
            return ' btn-lg'
        default:
            return 'btn-md'
    }
})
</script>


<template>
    <button :class="[
        baseClasses,
        typeClasses,

        colorClasses,
        sizeClasses,
        { 'opacity-50 cursor-not-allowed': disabled }
    ]" :disabled="disabled" @click="onClick">
        <slot />
    </button>
</template>
