<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
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
const baseClasses = 'uppercase border-b-8 text-black shadow-xl border-4 rounded-xl font-bold transition-all cursor-pointer select-none active:scale-105'

// --- dynamic colors ---
const colorClasses = computed(() => {
    switch (props.color) {
        case 'black':
            return 'bg-black text-white border-black hover:bg-white hover:text-black'
        default:
            return 'bg-white text-black border-black hover:bg-black hover:text-white'
    }
})

// --- sizes ---
const sizeClasses = computed(() => {
    switch (props.size) {
        case 'lg':
            return 'text-2xl py-4 px-6'
        default:
            return 'text-xl py-3 px-4'
    }
})
</script>


<template>
    <button :class="[
        baseClasses,
        colorClasses,
        sizeClasses,
        { 'opacity-50 cursor-not-allowed': disabled }
    ]" :disabled="disabled" @click="onClick">
        <slot />
    </button>
</template>
